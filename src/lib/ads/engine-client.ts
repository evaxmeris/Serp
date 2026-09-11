/**
 * 广告引擎子进程封装（Node 侧）
 *
 * 依据：docs/advertising-domain-m1-be-design.md §6.3/§6.2
 *  - execFile 数组参数无 shell（防注入），超时 120s + 超时重试 1 次（E2）
 *  - 参数白名单双保险（数值/日期正则 + 范围），文件路径一律系统生成
 *  - 并发闸门：进程内信号量（并发 2 + Promise 队列，§9.1 非功能）
 *  - runParse：Node 侧 xlsx/csv 解析（SheetJS，归一化列名 + 摘要 + 一致性）——
 *    实际 analyze_cli.py 无独立 parse 模式，故解析在 Node 内完成，E1 前置校验仍生效
 *  - runAdsEngine：调用 analyze_cli.py analyze 模式（--search 必传；--targeting 缺省 = degraded P0-1）
 *    注：当前 CLI 仅支持 --search/--targeting/--start-date/--end-date/--out，
 *        阈值参数（breakEvenAcos 等）暂无法透传 CLI（引擎用内部默认），仅记录在 opts/params（AC-4 自证）
 */
import { execFile, type ChildProcess } from 'child_process';
import path from 'path';
import { mkdir, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import { EngineResultSchema, type EngineResult } from './engine-schema';

// ──────────────────────────────────────────────────────────────
// 常量
// ──────────────────────────────────────────────────────────────

const ENGINE_DIR = path.join(process.cwd(), 'services', 'amazon-ads-engine');
const ENGINE_ENTRY = path.join(ENGINE_DIR, 'analyze_cli.py');
const TMP_DIR = path.join(process.cwd(), 'data', 'ads-engine');
const ENGINE_TIMEOUT = 120_000; // 120s
const MAX_ATTEMPTS = 2; // 超时重试 1 次
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB（stderr 全量记录需求，B6）
const CONCURRENCY = 2; // 全局引擎并发闸门

// ──────────────────────────────────────────────────────────────
// 类型契约（§6.3）
// ──────────────────────────────────────────────────────────────

export interface EngineOptions {
  /** 白名单数值参数，仅此 3 个可透传（I-9）；null 值不传 → 引擎动态计算（AC-4） */
  breakEvenAcos?: number;
  negateClicks?: number;
  stopSpend?: number;
  /** 白名单日期参数 YYYY-MM-DD（dateMismatch / 配对回退） */
  startDate?: string;
  endDate?: string;
}

export interface EngineErrorPayload {
  exitCode: number | null;
  stderr: string;
  attempts: number;
  timedOut: boolean;
  durationMs: number;
}

/** 引擎失败异常（E2/E7：exit 非 0 / 超时 / {ok:false} / 契约校验失败） */
export class EngineError extends Error {
  exitCode: number | null;
  stderr: string;
  attempts: number;
  timedOut: boolean;

  constructor(message: string, payload: Partial<EngineErrorPayload> = {}) {
    super(message);
    this.name = 'EngineError';
    this.exitCode = payload.exitCode ?? null;
    this.stderr = payload.stderr ?? '';
    this.attempts = payload.attempts ?? 1;
    this.timedOut = payload.timedOut ?? false;
  }
}

/** parse 模式输出契约（§6.2）：reports.search/targeting 为归一化原始行 */
export interface ParsedReport {
  columns: string[];
  rowCount: number;
  summary: Record<string, unknown>;
  rawRows: Record<string, unknown>[];
}

export type ParseResult =
  | {
      ok: true;
      reports: { search?: ParsedReport; targeting?: ParsedReport };
      consistency?: {
        spendDiffPct?: number | null;
        ordersDiffPct?: number | null;
        dateMismatch?: boolean;
        warning?: boolean;
      };
    }
  | { ok: false; error: { errors: string[] } };

export { type EngineResult };

// ──────────────────────────────────────────────────────────────
// 并发闸门（并发 2 + Promise 队列）
// ──────────────────────────────────────────────────────────────

let activeCount = 0;
const waitQueue: Array<() => void> = [];

async function withEngineGate<T>(fn: () => Promise<T>): Promise<T> {
  if (activeCount >= CONCURRENCY) {
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  }
  activeCount += 1;
  try {
    return await fn();
  } finally {
    activeCount -= 1;
    waitQueue.shift()?.();
  }
}

// ──────────────────────────────────────────────────────────────
// 参数白名单校验（发起进程前，不合法直接抛错不执行）
// ──────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertWhitelist(opts: EngineOptions): void {
  if (opts.breakEvenAcos !== undefined && !(opts.breakEvenAcos >= 0 && opts.breakEvenAcos <= 100)) {
    throw new EngineError(`breakEvenAcos 越界: ${opts.breakEvenAcos}（范围 0-100）`, { exitCode: 2 });
  }
  if (opts.negateClicks !== undefined && !(opts.negateClicks >= 0 && opts.negateClicks <= 100000)) {
    throw new EngineError(`negateClicks 越界: ${opts.negateClicks}（范围 0-100000）`, { exitCode: 2 });
  }
  if (opts.stopSpend !== undefined && !(opts.stopSpend >= 0 && opts.stopSpend <= 100000)) {
    throw new EngineError(`stopSpend 越界: ${opts.stopSpend}（范围 0-100000）`, { exitCode: 2 });
  }
  if (opts.startDate !== undefined && !DATE_RE.test(opts.startDate)) {
    throw new EngineError(`startDate 非法: ${opts.startDate}（须 YYYY-MM-DD）`, { exitCode: 2 });
  }
  if (opts.endDate !== undefined && !DATE_RE.test(opts.endDate)) {
    throw new EngineError(`endDate 非法: ${opts.endDate}（须 YYYY-MM-DD）`, { exitCode: 2 });
  }
}

// ──────────────────────────────────────────────────────────────
// 子进程执行（execFile 数组参数 + 超时 SIGKILL + 重试）
// ──────────────────────────────────────────────────────────────

interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function runCliOnce(args: string[], timeoutMs: number): Promise<CliRunResult> {
  return new Promise((resolve) => {
    const child: ChildProcess = execFile(
      'python3',
      args,
      {
        timeout: timeoutMs,
        cwd: ENGINE_DIR,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        maxBuffer: MAX_BUFFER,
        encoding: 'utf-8',
      } as any,
      (error, stdout, stderr) => {
        if (error) {
          const e = error as { code?: number | string; killed?: boolean; signal?: string };
          resolve({
            stdout: String(stdout ?? ''),
            stderr: String(stderr ?? ''),
            exitCode: typeof e.code === 'number' ? e.code : null,
            timedOut: e.killed === true,
          });
        } else {
          resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), exitCode: 0, timedOut: false });
        }
      }
    );
    // 超时 → SIGKILL（execFile 默认 SIGTERM，设计要求 SIGKILL 后重试）
    child.on('timeout', () => {
      child.kill('SIGKILL');
    });
  });
}

/**
 * 执行引擎 CLI（通用）：超时重试 1 次；退出码语义 0=成功 / 1=业务失败（tmp 含 {ok:false}）/
 * 2=参数错误（引擎侧 bug）/ 超时=124。
 * 成功后返回 outJson（tmp 读取）；失败抛 EngineError。
 */
export async function runEngineCli(
  args: string[],
  opts: EngineOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string; outJson?: unknown }> {
  assertWhitelist(opts);
  await mkdir(TMP_DIR, { recursive: true });
  const tmpJson = path.join(TMP_DIR, `tmp-${randomUUID()}.json`);
  const fullArgs = [...args, '--out', tmpJson];

  const startedAt = Date.now();
  let last: CliRunResult | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    last = await runCliOnce(fullArgs, ENGINE_TIMEOUT);
    // 仅超时重试（E2）；业务失败（1）/参数错误（2）不重试
    if (!last.timedOut) break;
  }

  const durationMs = Date.now() - startedAt;
  const timedOut = last?.timedOut ?? false;
  const exitCode = last?.exitCode ?? null;
  const stderr = last?.stderr ?? '';

  try {
    if (exitCode === 0) {
      const outJson = JSON.parse(await readFile(tmpJson, 'utf-8'));
      return { exitCode: 0, stdout: last?.stdout ?? '', stderr, outJson };
    }
    if (exitCode === 1) {
      // 业务失败：tmp 写 {ok:false, error}
      let detail = '';
      try {
        const err = JSON.parse(await readFile(tmpJson, 'utf-8')) as { error?: string };
        detail = err.error ?? '';
      } catch {
        detail = stderr.slice(0, 2000);
      }
      throw new EngineError(detail || '引擎业务失败', { exitCode, stderr, attempts: timedOut ? MAX_ATTEMPTS : 1, timedOut, durationMs });
    }
    throw new EngineError(`引擎参数错误或异常退出（exit=${exitCode ?? 'null'}）: ${stderr.slice(0, 2000)}`, {
      exitCode,
      stderr,
      attempts: timedOut ? MAX_ATTEMPTS : 1,
      timedOut,
      durationMs,
    });
  } finally {
    // best-effort 清理 tmp（重试前/读后）
    unlink(tmpJson).catch(() => {});
  }
}

// ──────────────────────────────────────────────────────────────
// runAdsEngine：analyze 模式（targetingPath 缺省 = degraded）
// ──────────────────────────────────────────────────────────────

export async function runAdsEngine(input: {
  searchPath: string;
  targetingPath?: string;
  opts: EngineOptions;
}): Promise<EngineResult> {
  const { searchPath, targetingPath, opts } = input;
  if (!searchPath) throw new EngineError('缺少搜索词报告路径（--search 必传）', { exitCode: 2 });

  // 仅透传 CLI 实际支持的参数（当前 analyze_cli.py 未实现阈值 flags，见文件头注释）
  const args = [
    ENGINE_ENTRY,
    '--search',
    searchPath,
    ...(targetingPath ? ['--targeting', targetingPath] : []),
    ...(opts.startDate ? ['--start-date', opts.startDate] : []),
    ...(opts.endDate ? ['--end-date', opts.endDate] : []),
  ];

  return withEngineGate(async () => {
    const { outJson } = await runEngineCli(args, opts);
    // E7：契约校验（ok:false 或字段级失败 → EngineError，details 含失败信息）
    const parsed = EngineResultSchema.safeParse(outJson);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map((i) => i.path.join('.') || i.message).join(', ');
      throw new EngineError(`引擎输出与契约不符（E7）: ${issues}`, { exitCode: 1, stderr: issues });
    }
    return parsed.data;
  });
}

// ──────────────────────────────────────────────────────────────
// runParse：Node 侧报告解析（归一化列名 + 摘要 + 双报告一致性）
// ──────────────────────────────────────────────────────────────

/** 归一化列名映射（§6.2 契约，关键字 contains 定位，与引擎 find_col 同思路） */
const NORM_COLUMNS: Array<{ keys: string[]; name: string }> = [
  { keys: ['客户搜索词', 'customerSearchTerm', 'search term'], name: 'customerSearchTerm' },
  { keys: ['投放', 'targeting', 'target', '投放方案', 'Keyword Text'], name: 'targeting' },
  { keys: ['匹配类型', 'match type', '匹配'], name: 'matchType' },
  { keys: ['花费', 'spend', '总成本', 'cost'], name: 'spend' },
  { keys: ['7天总销售额', 'attributedSales7d', '销售额', 'sales'], name: 'attributedSales7d' },
  { keys: ['7天总订单数', 'attributedUnitsOrdered7d', '订单数', '购买量', 'purchases'], name: 'attributedUnitsOrdered7d' },
  { keys: ['点击量', 'clicks', '点击'], name: 'clicks' },
  { keys: ['展示量', 'impr', 'impressions'], name: 'impressions' },
  { keys: ['单次点击成本', 'cpc', 'CPC'], name: 'cpc' },
  { keys: ['目标竞价', 'bid', '竞价'], name: 'bid' },
  { keys: ['投放状态', '状态', 'state'], name: 'state' },
  { keys: ['Campaign ID', '广告活动ID', 'campaignId'], name: 'campaignId' },
  { keys: ['Ad Group ID', '广告组ID', 'adGroupId'], name: 'adGroupId' },
  { keys: ['关键词ID', '商品定向ID', 'keywordId', 'externalId', 'Target ID'], name: 'externalId' },
  { keys: ['日期', 'date'], name: 'date' },
];

function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.trim().replace(/,/g, '').replace(/\$/g, '').replace(/%$/, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const toInt = (v: unknown): number => Math.round(toNum(v));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 解析单个报告文件（xlsx/csv 通用，SheetJS 自动识别），保持原始行序（P0-6） */
async function parseReportFile(filePath: string): Promise<ParsedReport> {
  const buffer = await readFile(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }) as unknown[][];
  if (aoa.length < 2) {
    throw new Error('数据行为空（仅表头或无内容）');
  }
  const header = (aoa[0] as unknown[]).map((c) => String(c ?? '').trim());

  const findIdx = (keywords: string[]): number => {
    const lower = keywords.map((k) => k.toLowerCase());
    return header.findIndex((h) => lower.some((k) => h.toLowerCase().includes(k)));
  };
  const spendIdx = findIdx(['花费', 'spend', '总成本', 'cost']);
  const clicksIdx = findIdx(['点击量', 'clicks']);
  const salesIdx = findIdx(['7天总销售额', 'attributedSales7d', '销售额', 'sales']);
  const ordersIdx = findIdx(['7天总订单数', 'attributedUnitsOrdered7d', '订单数', '购买量', 'purchases']);
  // E1：必需指标列（搜索词报告与新版 Targeting 报告列名不同：旧=花费/7天总销售额/7天总订单数，新=总成本/购买量/销售额）
  const missing: string[] = [];
  if (spendIdx < 0) missing.push('花费/总成本(spend/cost)');
  if (clicksIdx < 0) missing.push('点击量(clicks)');
  if (salesIdx < 0) missing.push('7天总销售额/销售额(attributedSales7d/sales)');
  if (ordersIdx < 0) missing.push('7天总订单数/购买量(attributedUnitsOrdered7d/purchases)');
  if (missing.length > 0) {
    throw new Error(`缺少必要列：${missing.join('、')}（不同站点模板列名可能不同，请核对列名后重传）`);
  }

  // 归一化列 → 原表列下标
  const colIndex = new Map<string, number>();
  for (const { keys, name } of NORM_COLUMNS) {
    colIndex.set(name, findIdx(keys));
  }

  const rawRows: Record<string, unknown>[] = [];
  for (const row of aoa.slice(1)) {
    if (row.length === 0 || (row.length === 1 && String(row[0] ?? '').trim() === '')) continue; // 跳过空行
    const obj: Record<string, unknown> = {};
    for (const { name } of NORM_COLUMNS) {
      const idx = colIndex.get(name) ?? -1;
      if (idx >= 0 && idx < row.length) obj[name] = row[idx];
    }
    rawRows.push(obj);
  }
  if (rawRows.length === 0) {
    throw new Error('数据行为空（0 行有效数据）');
  }

  // 账户总览摘要（镜像引擎口径，§6.2 parse 契约 summary）
  let spend = 0;
  let sales = 0;
  let orders = 0;
  let clicks = 0;
  for (const r of rawRows) {
    spend += toNum(r.spend);
    sales += toNum(r.attributedSales7d);
    orders += toInt(r.attributedUnitsOrdered7d);
    clicks += toInt(r.clicks);
  }
  const summary = {
    spend: round2(spend),
    sales: round2(sales),
    orders,
    clicks,
    acos: sales > 0 ? round1((spend / sales) * 100) : null,
    cvr: clicks > 0 ? round2((orders / clicks) * 100) : null,
    aov: orders > 0 ? round2(sales / orders) : null,
  };

  return { columns: header, rowCount: rawRows.length, summary, rawRows };
}

/** 日期单元格解析：Date → YYYY-MM-DD；字符串 → 正则提取 */
function toDateStr(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const m = v.trim().match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      const mm = m[2].padStart(2, '0');
      const dd = m[3].padStart(2, '0');
      return `${m[1]}-${mm}-${dd}`;
    }
  }
  return null;
}

/** 双报告一致性（E4 前置）：spend/orders 偏差 + 日期窗口比对（P0-4） */
function computeConsistency(
  search: ParsedReport,
  targeting: ParsedReport,
  startDate?: string,
  endDate?: string
): { spendDiffPct: number; ordersDiffPct: number; dateMismatch: boolean; warning: boolean } {
  const sSpend = toNum(search.summary.spend);
  const tSpend = toNum(targeting.summary.spend);
  const sOrders = toInt(search.summary.orders);
  const tOrders = toInt(targeting.summary.orders);
  const spendMax = Math.max(sSpend, tSpend);
  const ordersMax = Math.max(sOrders, tOrders);
  const spendDiffPct = spendMax > 0 ? round2((Math.abs(sSpend - tSpend) / spendMax) * 100) : 0;
  const ordersDiffPct = ordersMax > 0 ? round2((Math.abs(sOrders - tOrders) / ordersMax) * 100) : 0;
  const warning = spendDiffPct > 15; // REQ-001-6：>15% 分析时阻断（E4）

  // dateMismatch：报告内 min/max 日期 vs 用户窗口（字符串比较 YYYY-MM-DD 安全）
  let dateMismatch = false;
  const allDates = [...search.rawRows, ...targeting.rawRows]
    .map((r) => toDateStr(r.date))
    .filter((d): d is string => d !== null);
  if (allDates.length > 0 && startDate && endDate) {
    const min = allDates.reduce((a, b) => (a < b ? a : b));
    const max = allDates.reduce((a, b) => (a > b ? a : b));
    dateMismatch = min < startDate || max > endDate;
  }

  return { spendDiffPct, ordersDiffPct, dateMismatch, warning };
}

/** parse 模式：单文件或双文件解析，失败返回 {ok:false, errors}（不抛异常） */
export async function runParse(input: {
  searchPath?: string;
  targetingPath?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ParseResult> {
  const errors: string[] = [];
  const reports: { search?: ParsedReport; targeting?: ParsedReport } = {};

  if (input.searchPath) {
    try {
      reports.search = await parseReportFile(input.searchPath);
    } catch (e) {
      errors.push(`搜索词报告：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (input.targetingPath) {
    try {
      reports.targeting = await parseReportFile(input.targetingPath);
    } catch (e) {
      errors.push(`投放报告：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length > 0) return { ok: false, error: { errors } };

  let consistency: Extract<ParseResult, { ok: true }>['consistency'];
  if (reports.search && reports.targeting) {
    consistency = computeConsistency(reports.search, reports.targeting, input.startDate, input.endDate);
  }

  return { ok: true, reports, consistency };
}
