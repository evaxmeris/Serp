/**
 * api-fetcher.ts — M2 ApiFetcher Node 侧封装（REQ-ADS-007 抽象实现）
 *
 * 职责：从 AdAccount 解密凭据 → 写临时 config → 调 fetch_cli.py 子进程 → 返回契约 JSON
 * 安全：凭据只进临时文件（600 权限，用完即删）；dry-run 默认；真实执行需 apply 参数
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { writeFile, unlink, chmod } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto-utils';

const execFileAsync = promisify(execFile);
const ENGINE_DIR = join(process.cwd(), 'services', 'amazon-ads-engine');

export interface ApiFetcherStatus {
  configured: boolean;
  mode: 'mock' | 'real';
  dryRun: boolean;
  marketplace: string;
  profileId: string;
  message: string;
}

export interface FetcherResult {
  ok: boolean;
  mode: 'mock' | 'real';
  error?: string;
  [k: string]: unknown;
}

/** 读取指定账户的 Ads API 凭据（解密）→ 若无凭据返回 null */
async function resolveCredentials(accountId: string): Promise<{
  client_id: string; client_secret: string; refresh_token: string;
  profile_id: string; marketplace: string;
} | null> {
  const acc = await prisma.adAccount.findUnique({
    where: { id: accountId },
    include: { marketplace: { select: { code: true, adEndpoint: true } } },
  });
  if (!acc || !acc.clientId || !acc.clientSecret || !acc.refreshToken) return null;
  try {
    return {
      client_id: decrypt(acc.clientId),
      client_secret: decrypt(acc.clientSecret),
      refresh_token: decrypt(acc.refreshToken),
      profile_id: acc.externalId ?? '',
      marketplace: acc.marketplace?.code ?? 'US',
    };
  } catch {
    return null; // 解密失败视为未配置（凭据损坏时降级 mock）
  }
}

/** 子进程调用 fetch_cli.py */
async function runFetchCli(args: string[], credentials: Record<string, string> | null, timeoutMs = 30000): Promise<FetcherResult> {
  let configPath: string | null = null;
  try {
    if (credentials) {
      configPath = join(tmpdir(), `ads-config-${randomUUID()}.json`);
      await writeFile(configPath, JSON.stringify(credentials));
      await chmod(configPath, 0o600);
      args = [...args, '--config', configPath];
    }
    const { stdout } = await execFileAsync('python3', [join(ENGINE_DIR, 'api_fetcher.py'), ...args], {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 8,
    });
    const out = stdout.trim().split('\n').pop() ?? '{}';
    return JSON.parse(out) as FetcherResult;
  } catch (e) {
    return { ok: false, mode: 'mock', error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  } finally {
    if (configPath) unlink(configPath).catch(() => {});
  }
}

/** 接入状态（前端提示卡 + 管理层） */
export async function getApiFetcherStatus(accountId: string | null): Promise<ApiFetcherStatus> {
  if (!accountId) {
    return {
      configured: false, mode: 'mock', dryRun: true, marketplace: 'US', profileId: '',
      message: '请先选择广告账户（站点管理配置凭据后启用自动拉取）',
    };
  }
  const cred = await resolveCredentials(accountId);
  const result = await runFetchCli(['--action', 'status'], cred);
  const s = result as unknown as ApiFetcherStatus;
  return {
    configured: s.configured === true,
    mode: (s.mode as 'mock' | 'real') ?? 'mock',
    dryRun: s.dryRun !== false,
    marketplace: s.marketplace ?? 'US',
    profileId: s.profileId ?? '',
    message: s.message ?? 'Ads API 状态未知',
  };
}

/** 拉取关键词 bid/状态（M2 自动读设置；mock 时返回演示数据） */
export async function fetchKeywordSettings(accountId: string, adGroupIds: string[]): Promise<FetcherResult> {
  const cred = await resolveCredentials(accountId);
  const args = ['--action', 'keywords', '--ad-group-ids', adGroupIds.join(',')];
  return runFetchCli(args, cred, 30000);
}

/** 自动执行决策（★ dry-run 默认；apply=true 才真实修改） */
export async function applyRecommendations(
  accountId: string,
  decisions: unknown[],
  apply = false,
): Promise<FetcherResult> {
  const cred = await resolveCredentials(accountId);
  const decPath = join(tmpdir(), `ads-decisions-${randomUUID()}.json`);
  await writeFile(decPath, JSON.stringify(decisions));
  const args = ['--action', 'apply', '--decisions', decPath];
  if (apply) args.push('--apply');
  try {
    return await runFetchCli(args, cred, 60000);
  } finally {
    unlink(decPath).catch(() => {});
  }
}
