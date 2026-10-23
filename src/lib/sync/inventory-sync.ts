/**
 * 平台镜像快照同步（二期 BE-1）
 *
 * 职责：把适配器给出的统一快照写入 platform_inventory_snapshots /
 *       platform_listing_snapshots，并记录 PlatformSyncLog。
 *
 * 边界（重要）：
 *   - 快照表只是**平台侧的镜像**，不参与库存扣减；本地台账 overseas_inventory 才是过程权威
 *   - 差异由 /api/v1/overseas/reconcile 读出，拉平走 /api/v1/overseas/reconcile/resolve（差异调整单）
 *   - 任何平台/凭证错误都**不向上抛**：写一条 failed 的 PlatformSyncLog 并返回 status='failed'，
 *     保证 /api/sync 这类触发端点不会因为「亚马逊还没给凭证」而 500
 *
 * 多站点：全部以 (platformCode, marketplaceId, sku) 定位，不同 marketplaceId 互不覆盖。
 */

import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '@/lib/crypto-utils';
import { platformRegistry } from './registry';
import type {
  PlatformConfig,
  SyncResource,
  UnifiedInventorySnapshot,
  UnifiedListingSnapshot,
} from './types';

// ============================================
// 错误类型
// ============================================

/** 平台/资源未实现（tiktok、shopify 等一期只留接口位） */
export class SyncNotSupportedError extends Error {
  readonly code = 'NOT_SUPPORTED';
  constructor(message: string) {
    super(message);
    this.name = 'SyncNotSupportedError';
  }
}

// ============================================
// 结果类型
// ============================================

export type ResourceSyncStatus = 'success' | 'failed' | 'partial' | 'not_supported';

export interface ResourceSyncResult {
  platformCode: string;
  marketplaceId: string;
  resource: string;
  status: ResourceSyncStatus;
  /** 抓取到的条数（快照行 / 订单条数） */
  itemsFound: number;
  /** 实际落库条数 */
  itemsSynced: number;
  itemsFailed: number;
  /** 清理掉的过期快照行数（平台已不存在该 SKU） */
  itemsPruned?: number;
  errors?: string[];
  durationMs: number;
  logId?: string;
}

// ============================================
// 并发互斥（进程内 + DB 原子标志）
// ============================================

const inFlight = new Set<string>();

function lockKey(platformCode: string, marketplaceId: string, resource: string): string {
  return `${platformCode}@${marketplaceId || '-'}:${resource}`;
}

// ============================================
// 配置解析
// ============================================

interface ResolvedSyncTarget {
  config: PlatformConfig;
  /** platform_sync_configs 行 id（无配置行时为 null，例如夹具模式/纯参数触发） */
  configRowId: string | null;
  marketplaceId: string;
}

/**
 * 解析同步目标：优先级 显式入参 > 配置行 > 凭证/设置里的 marketplaceId
 *
 * 与 order-sync.ts 的口径保持一致（多站点共用一套 LWA 凭证，按 (platformCode, marketplaceId) 配置）。
 * 找不到配置行时不直接失败——适配器（如夹具模式）可能不需要凭证，
 * 凭证缺失会在调用适配器时以 failed 日志的形式体现。
 */
export async function resolveSyncTarget(
  platformCode: string,
  marketplaceId?: string,
): Promise<ResolvedSyncTarget> {
  const configRow =
    (await prisma.platformSyncConfig.findUnique({
      where: {
        platformCode_marketplaceId: { platformCode, marketplaceId: marketplaceId || '' },
      },
    })) ||
    (marketplaceId
      ? null
      : await prisma.platformSyncConfig.findFirst({
          where: { platformCode },
          orderBy: { updatedAt: 'desc' },
        }));

  const decrypted = (configRow ? decryptCredentials(configRow.credentials) : {}) as Record<string, string>;
  const settings = (configRow?.settings as Record<string, any>) || {};
  const effectiveMarketplaceId =
    marketplaceId ||
    configRow?.marketplaceId ||
    decrypted?.marketplaceId ||
    settings?.marketplaceId ||
    '';

  return {
    configRowId: configRow?.id ?? null,
    marketplaceId: effectiveMarketplaceId,
    config: {
      id: configRow?.id ?? '',
      platformCode,
      marketplaceId: effectiveMarketplaceId,
      enabled: configRow?.enabled ?? true,
      syncIntervalMin: configRow?.syncIntervalMin ?? 0,
      credentials: effectiveMarketplaceId
        ? { marketplaceId: effectiveMarketplaceId, ...(decrypted || {}) }
        : (decrypted || {}),
      settings: Object.keys(settings).length > 0 ? settings : undefined,
    },
  };
}

// ============================================
// 同步日志工具
// ============================================

async function openSyncLog(
  platformCode: string,
  marketplaceId: string,
  resource: string,
  triggerType: string,
) {
  try {
    return await prisma.platformSyncLog.create({
      data: {
        platformCode,
        marketplaceId,
        resource,
        triggerType,
        status: 'processing',
      },
    });
  } catch (error) {
    console.error('[Snapshot Sync] 创建同步日志失败:', error);
    return null;
  }
}

async function closeSyncLog(
  logId: string | null,
  data: {
    status: string;
    found: number;
    synced: number;
    failed: number;
    errorMessage?: string | null;
    durationMs: number;
  },
) {
  if (!logId) return;
  try {
    await prisma.platformSyncLog.update({
      where: { id: logId },
      data: {
        status: data.status,
        ordersFound: data.found,
        ordersSynced: data.synced,
        ordersFailed: data.failed,
        errorMessage: data.errorMessage ?? null,
        completedAt: new Date(),
        durationMs: data.durationMs,
      },
    });
  } catch (error) {
    console.error('[Snapshot Sync] 更新同步日志失败:', error);
  }
}

// ============================================
// 落库
// ============================================

async function upsertInventorySnapshots(
  rows: UnifiedInventorySnapshot[],
  pruneStale: boolean,
): Promise<{ synced: number; pruned: number }> {
  const now = new Date();
  let pruned = 0;

  await prisma.$transaction(async tx => {
    for (const r of rows) {
      const data = {
        fnsku: r.fnsku ?? null,
        asin: r.asin ?? null,
        availableQty: r.availableQty ?? 0,
        inboundQty: r.inboundQty ?? 0,
        reservedQty: r.reservedQty ?? 0,
        fcDetail: (r.fcDetail ?? null) as any,
        platformUpdatedAt: r.platformUpdatedAt ?? null,
        syncedAt: now,
      };
      await tx.platformInventorySnapshot.upsert({
        where: {
          platformCode_marketplaceId_sku: {
            platformCode: r.platformCode,
            marketplaceId: r.marketplaceId,
            sku: r.sku,
          },
        },
        create: {
          platformCode: r.platformCode,
          marketplaceId: r.marketplaceId,
          sku: r.sku,
          ...data,
        },
        update: data,
      });
    }

    // 平台已下架的 SKU：快照表是镜像，允许清理；但只在本次确实拉到数据时清理，
    // 避免接口异常返回空列表时把整站快照清空
    if (pruneStale && rows.length > 0) {
      const groups = new Map<string, string[]>();
      for (const r of rows) {
        const k = `${r.platformCode}\u0000${r.marketplaceId}`;
        const arr = groups.get(k) || [];
        arr.push(r.sku);
        groups.set(k, arr);
      }
      for (const [k, skus] of groups) {
        const [platformCode, marketplaceId] = k.split('\u0000');
        const res = await tx.platformInventorySnapshot.deleteMany({
          where: { platformCode, marketplaceId, sku: { notIn: skus } },
        });
        pruned += res.count;
      }
    }
  });

  return { synced: rows.length, pruned };
}

async function upsertListingSnapshots(
  rows: UnifiedListingSnapshot[],
  pruneStale: boolean,
): Promise<{ synced: number; pruned: number }> {
  const now = new Date();
  let pruned = 0;

  await prisma.$transaction(async tx => {
    for (const r of rows) {
      const data = {
        asin: r.asin ?? null,
        title: r.title ?? null,
        status: r.status ?? null,
        price: r.price === null || r.price === undefined ? null : r.price,
        currency: r.currency || 'USD',
        rawPayload: (r.rawPayload ?? null) as any,
        platformUpdatedAt: r.platformUpdatedAt ?? null,
        syncedAt: now,
      };
      await tx.platformListingSnapshot.upsert({
        where: {
          platformCode_marketplaceId_sku: {
            platformCode: r.platformCode,
            marketplaceId: r.marketplaceId,
            sku: r.sku,
          },
        },
        create: {
          platformCode: r.platformCode,
          marketplaceId: r.marketplaceId,
          sku: r.sku,
          ...data,
        },
        update: data,
      });
    }

    if (pruneStale && rows.length > 0) {
      const groups = new Map<string, string[]>();
      for (const r of rows) {
        const k = `${r.platformCode}\u0000${r.marketplaceId}`;
        const arr = groups.get(k) || [];
        arr.push(r.sku);
        groups.set(k, arr);
      }
      for (const [k, skus] of groups) {
        const [platformCode, marketplaceId] = k.split('\u0000');
        const res = await tx.platformListingSnapshot.deleteMany({
          where: { platformCode, marketplaceId, sku: { notIn: skus } },
        });
        pruned += res.count;
      }
    }
  });

  return { synced: rows.length, pruned };
}

// ============================================
// 主流程
// ============================================

interface ExecuteSnapshotSyncOptions {
  /** 是否清理平台侧已不存在的旧快照（默认 true；仅在拉到数据时生效） */
  pruneStale?: boolean;
}

/**
 * 执行一次快照同步（fbaInventory / listings）
 *
 * 语义保证：
 *   - 不会抛异常（除编程错误外），失败以 status='failed' + PlatformSyncLog 呈现
 *   - 同一 (platform, marketplace, resource) 并发调用会被互斥锁挡住，返回 failed + 明确原因
 *   - 幂等：重复执行只更新 syncedAt/字段，不产生重复行
 */
export async function executeSnapshotSync(
  platformCode: string,
  resource: 'fbaInventory' | 'listings',
  triggerType: 'manual' | 'scheduled' | 'webhook' = 'manual',
  marketplaceId?: string,
  options: ExecuteSnapshotSyncOptions = {},
): Promise<ResourceSyncResult> {
  const started = Date.now();
  const { pruneStale = true } = options;

  const base: ResourceSyncResult = {
    platformCode,
    marketplaceId: marketplaceId || '',
    resource,
    status: 'failed',
    itemsFound: 0,
    itemsSynced: 0,
    itemsFailed: 0,
    durationMs: 0,
  };

  const adapter = platformRegistry.get(platformCode);
  if (!adapter) {
    return { ...base, errors: [`平台 ${platformCode} 未注册`], durationMs: Date.now() - started };
  }

  const capability =
    resource === 'fbaInventory' ? adapter.fetchInventorySnapshots : adapter.fetchListingSnapshots;
  if (typeof capability !== 'function') {
    // tiktok / shopify 等：接口位已留，暂未实现
    const result: ResourceSyncResult = {
      ...base,
      status: 'not_supported',
      errors: [`平台 ${platformCode} 暂不支持 ${resource} 快照同步`],
      durationMs: Date.now() - started,
    };
    const log = await openSyncLog(platformCode, marketplaceId || '', resource, triggerType);
    await closeSyncLog(log?.id ?? null, {
      status: 'not_supported',
      found: 0,
      synced: 0,
      failed: 0,
      errorMessage: result.errors?.join('\n'),
      durationMs: result.durationMs,
    });
    result.logId = log?.id;
    return result;
  }

  let target: ResolvedSyncTarget;
  try {
    target = await resolveSyncTarget(platformCode, marketplaceId);
  } catch (error) {
    return {
      ...base,
      errors: [`解析同步配置失败：${error instanceof Error ? error.message : String(error)}`],
      durationMs: Date.now() - started,
    };
  }
  base.marketplaceId = target.marketplaceId;

  const key = lockKey(platformCode, target.marketplaceId, resource);
  if (inFlight.has(key)) {
    return {
      ...base,
      errors: [`${key} 正在同步中，跳过本次（互斥锁保护）`],
      durationMs: Date.now() - started,
    };
  }
  inFlight.add(key);

  // DB 原子标志（跨进程/跨路由也生效）：只有抢到 isSyncing=false → true 的那个进程继续
  let claimedConfigId: string | null = null;
  if (target.configRowId) {
    const claimed = await prisma.platformSyncConfig.updateMany({
      where: { id: target.configRowId, isSyncing: false },
      data: { isSyncing: true },
    });
    if (claimed.count === 0) {
      inFlight.delete(key);
      return {
        ...base,
        errors: [`${key} 正在同步中（平台配置行被其他进程锁定），跳过本次`],
        durationMs: Date.now() - started,
      };
    }
    claimedConfigId = target.configRowId;
  }

  const log = await openSyncLog(platformCode, target.marketplaceId, resource, triggerType);

  try {
    let rows: UnifiedInventorySnapshot[] | UnifiedListingSnapshot[];
    if (resource === 'fbaInventory') {
      rows = await adapter.fetchInventorySnapshots!(target.config);
    } else {
      rows = await adapter.fetchListingSnapshots!(target.config);
    }

    const persisted =
      resource === 'fbaInventory'
        ? await upsertInventorySnapshots(rows as UnifiedInventorySnapshot[], pruneStale)
        : await upsertListingSnapshots(rows as UnifiedListingSnapshot[], pruneStale);

    const durationMs = Date.now() - started;
    const result: ResourceSyncResult = {
      ...base,
      status: 'success',
      itemsFound: rows.length,
      itemsSynced: persisted.synced,
      itemsFailed: 0,
      itemsPruned: persisted.pruned,
      durationMs,
      logId: log?.id,
    };

    await closeSyncLog(log?.id ?? null, {
      status: 'success',
      found: rows.length,
      synced: persisted.synced,
      failed: 0,
      durationMs,
    });

    // 顺手更新配置行的状态（不动 lastSyncAt：那是订单同步的增量水位线，混用会漏单）
    if (target.configRowId) {
      await prisma.platformSyncConfig
        .update({ where: { id: target.configRowId }, data: { lastSyncStatus: 'success' } })
        .catch(() => undefined);
    }

    console.log(
      `[Snapshot Sync] ${key} 完成：抓取 ${rows.length}，落库 ${persisted.synced}，清理 ${persisted.pruned}，耗时 ${durationMs}ms`,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - started;
    console.error(`[Snapshot Sync] ${key} 失败：${message}`);

    await closeSyncLog(log?.id ?? null, {
      status: 'failed',
      found: 0,
      synced: 0,
      failed: 0,
      errorMessage: message,
      durationMs,
    });
    if (target.configRowId) {
      await prisma.platformSyncConfig
        .update({ where: { id: target.configRowId }, data: { lastSyncStatus: 'failed' } })
        .catch(() => undefined);
    }

    return { ...base, status: 'failed', errors: [message], durationMs, logId: log?.id };
  } finally {
    inFlight.delete(key);
    if (claimedConfigId) {
      await prisma.platformSyncConfig
        .update({ where: { id: claimedConfigId }, data: { isSyncing: false } })
        .catch(() => undefined);
    }
  }
}
