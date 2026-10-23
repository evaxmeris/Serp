/**
 * SyncJob 调度（二期 BE-1）
 *
 * 为什么不靠 Next.js 内部 setInterval：
 *   - dev 模式下 HOT reload 会重建模块、生产多实例/无状态部署也无法保证「只跑一次」；
 *   - 因此这里做成**可外部驱动的轮询器**：/api/sync/tick 一次调用 = 跑一轮到期任务。
 *     由宿主机 cron / k8s CronJob / systemd timer 定时打这个端点即可（挂法见 README「同步调度」）。
 *
 * 防重入（两层）：
 *   1. SyncJob.isRunning：updateMany 条件更新做原子领取，抢不到就跳过（跨进程有效）
 *   2. nextRunAt：领取时即推进到下一个时间点，进程中途崩溃也不会在同一时间点反复重跑
 *   另外对超过 STALE_LOCK_MIN 分钟还挂着 isRunning 的行做兜底释放。
 */

import { CronExpressionParser } from 'cron-parser';
import { prisma } from '@/lib/prisma';
import { executeResourceSync, parseSyncResource } from './resource-sync';
import type { ResourceSyncResult } from './resource-sync';
import type { AllResourcesSyncResult } from './resource-sync';

/** 超过该时长仍 isRunning 视为进程崩溃遗留，允许回收 */
const STALE_LOCK_MIN = 30;

export interface SyncJobRunOutcome {
  jobId: string;
  platformCode: string;
  marketplaceId: string;
  resource: string;
  status: string;
  itemsFound: number;
  itemsSynced: number;
  errors?: string[];
  durationMs: number;
}

export interface SyncTickResult {
  claimed: number;
  outcomes: SyncJobRunOutcome[];
  skipped?: string[];
}

/**
 * 计算下次执行时间：cronExpr 优先，其次 intervalMin，都没有则 null（不再自动执行）
 * 非法 cron 表达式退化到 intervalMin（并打日志），避免一个手抖的表达式让任务永久停摆。
 */
export function computeNextRunAt(
  job: { cronExpr?: string | null; intervalMin?: number | null },
  from: Date = new Date(),
): Date | null {
  if (job.cronExpr && job.cronExpr.trim()) {
    try {
      const it = CronExpressionParser.parse(job.cronExpr.trim(), { currentDate: from });
      return it.next().toDate();
    } catch (error) {
      console.warn(
        `[SyncJob] cron 表达式无法解析：${job.cronExpr}（${error instanceof Error ? error.message : error}），改用 intervalMin`,
      );
    }
  }
  if (job.intervalMin && job.intervalMin > 0) {
    return new Date(from.getTime() + job.intervalMin * 60_000);
  }
  return null;
}

/** 回收崩溃遗留的执行锁 */
async function releaseStaleLocks(): Promise<number> {
  const threshold = new Date(Date.now() - STALE_LOCK_MIN * 60_000);
  const res = await prisma.syncJob.updateMany({
    where: {
      isRunning: true,
      OR: [{ lastRunAt: null }, { lastRunAt: { lt: threshold } }],
    },
    data: { isRunning: false, lastError: '上一次执行超时未结束，已回收执行锁' },
  });
  return res.count;
}

/**
 * 为已启用的平台配置补齐 orders 任务（幂等）
 *
 * 只自动补 orders：快照资源（fbaInventory / listings）会额外消耗 SP-API 配额，
 * 由业务按需建行，避免上线时把亚马逊限流打满。
 */
export async function ensureSyncJobsFromConfigs(): Promise<number> {
  const configs = await prisma.platformSyncConfig.findMany({ where: { enabled: true } });
  let created = 0;

  for (const c of configs) {
    const existing = await prisma.syncJob.findUnique({
      where: {
        platformCode_marketplaceId_resource: {
          platformCode: c.platformCode,
          marketplaceId: c.marketplaceId || '',
          resource: 'orders',
        },
      },
    });
    if (existing) continue;

    const intervalMin = c.syncIntervalMin > 0 ? c.syncIntervalMin : 120;
    await prisma.syncJob.create({
      data: {
        platformCode: c.platformCode,
        marketplaceId: c.marketplaceId || '',
        resource: 'orders',
        intervalMin,
        enabled: true,
        nextRunAt: new Date(Date.now() + intervalMin * 60_000),
      },
    });
    created++;
  }

  return created;
}

/**
 * 跑一轮到期任务（/api/sync/tick 的实现）
 *
 * @param limit 单轮最多领取的任务数（防止一次 tick 打太久）
 */
export async function runDueSyncJobs(limit = 5): Promise<SyncTickResult> {
  const skipped: string[] = [];
  await releaseStaleLocks();
  await ensureSyncJobsFromConfigs();

  const now = new Date();
  const due = await prisma.syncJob.findMany({
    where: {
      enabled: true,
      isRunning: false,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(1, Math.min(limit, 20)),
  });

  const outcomes: SyncJobRunOutcome[] = [];

  for (const job of due) {
    const resource = parseSyncResource(job.resource);
    if (!resource) {
      skipped.push(`${job.id}: 不支持的 resource=${job.resource}`);
      await prisma.syncJob
        .update({
          where: { id: job.id },
          data: { lastStatus: 'failed', lastError: `不支持的 resource=${job.resource}`, nextRunAt: computeNextRunAt(job) },
        })
        .catch(() => undefined);
      continue;
    }

    // 原子领取：isRunning 必须是 false，且 nextRunAt 仍是刚才读到的「已到期」状态
    const claimed = await prisma.syncJob.updateMany({
      where: {
        id: job.id,
        isRunning: false,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      data: {
        isRunning: true,
        lastRunAt: now,
        // 先推进 nextRunAt 再执行：即使执行中崩溃，也不会立刻被下一轮 tick 重复领取
        nextRunAt: computeNextRunAt(job, now) ?? new Date(now.getTime() + 120 * 60_000),
      },
    });
    if (claimed.count === 0) {
      skipped.push(`${job.id}: 已被其他进程领取`);
      continue;
    }

    const started = Date.now();
    try {
      const result: ResourceSyncResult | AllResourcesSyncResult = await executeResourceSync(
        job.platformCode,
        resource,
        'scheduled',
        job.marketplaceId || undefined,
      );

      const errors = (result as any).errors as string[] | undefined;
      const errorText = errors && errors.length > 0 ? errors.join('\n') : null;

      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          isRunning: false,
          lastStatus: result.status,
          lastError: errorText,
        },
      });

      outcomes.push({
        jobId: job.id,
        platformCode: job.platformCode,
        marketplaceId: job.marketplaceId,
        resource: job.resource,
        status: result.status,
        itemsFound: result.itemsFound,
        itemsSynced: result.itemsSynced,
        errors,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      // executeResourceSync 理论上不抛；留兜底，确保 isRunning 一定被释放
      const message = error instanceof Error ? error.message : String(error);
      await prisma.syncJob
        .update({
          where: { id: job.id },
          data: { isRunning: false, lastStatus: 'failed', lastError: message },
        })
        .catch(() => undefined);
      outcomes.push({
        jobId: job.id,
        platformCode: job.platformCode,
        marketplaceId: job.marketplaceId,
        resource: job.resource,
        status: 'failed',
        itemsFound: 0,
        itemsSynced: 0,
        errors: [message],
        durationMs: Date.now() - started,
      });
    }
  }

  return { claimed: outcomes.length, outcomes, skipped: skipped.length > 0 ? skipped : undefined };
}
