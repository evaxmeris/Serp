/**
 * 资源级同步分发（二期 BE-1）
 *
 * 统一入口：orders（平台订单镜像）/ fbaInventory（库存快照）/ listings（Listing 快照）/ all
 *
 * 设计要点：
 *   - orders 仍走第一期 executePlatformSync（B2B / RETAIL 分流、重试、水位线逻辑不变）
 *   - 快照资源走 executeSnapshotSync（幂等 upsert + PlatformSyncLog）
 *   - 未实现的平台（tiktok / shopify）返回 status='not_supported'，不抛 500
 *   - 任何单资源失败都收敛成结果对象，由路由决定 HTTP 状态（默认 200 + status=failed）
 */

import { executePlatformSync } from './order-sync';
import { executeSnapshotSync } from './inventory-sync';
import type { ResourceSyncResult } from './inventory-sync';
import type { SyncResource } from './types';

export type { ResourceSyncResult } from './inventory-sync';

export interface AllResourcesSyncResult {
  platformCode: string;
  marketplaceId: string;
  resource: 'all';
  status: 'success' | 'failed' | 'partial' | 'not_supported';
  itemsFound: number;
  itemsSynced: number;
  itemsFailed: number;
  durationMs: number;
  results: ResourceSyncResult[];
  errors?: string[];
}

function normalizeOrderResult(
  platformCode: string,
  marketplaceId: string,
  raw: Awaited<ReturnType<typeof executePlatformSync>>,
  durationMs: number,
): ResourceSyncResult {
  return {
    platformCode,
    marketplaceId,
    resource: 'orders',
    status: raw.status,
    itemsFound: raw.ordersFound,
    itemsSynced: raw.ordersSynced,
    itemsFailed: raw.ordersFailed,
    errors: raw.errors,
    durationMs,
  };
}

/** 订单资源（保留第一期行为，但错误不再向上抛） */
async function runOrdersSync(
  platformCode: string,
  triggerType: 'manual' | 'scheduled' | 'webhook',
  marketplaceId?: string,
): Promise<ResourceSyncResult> {
  const started = Date.now();
  try {
    const raw = await executePlatformSync(platformCode, triggerType, marketplaceId);
    return normalizeOrderResult(platformCode, marketplaceId || '', raw, Date.now() - started);
  } catch (error) {
    return {
      platformCode,
      marketplaceId: marketplaceId || '',
      resource: 'orders',
      status: 'failed',
      itemsFound: 0,
      itemsSynced: 0,
      itemsFailed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      durationMs: Date.now() - started,
    };
  }
}

function aggregateStatus(
  results: ResourceSyncResult[],
): 'success' | 'failed' | 'partial' | 'not_supported' {
  if (results.length === 0) return 'not_supported';
  if (results.every(r => r.status === 'not_supported')) return 'not_supported';
  const real = results.filter(r => r.status !== 'not_supported');
  if (real.every(r => r.status === 'success')) return 'success';
  if (real.some(r => r.status === 'success' || r.status === 'partial')) return 'partial';
  return 'failed';
}

/**
 * 执行一次资源同步
 *
 * @param platformCode  平台代码（amazon / alibaba / tiktok / shopify）
 * @param resource      orders | fbaInventory | listings | all
 * @param triggerType   manual | scheduled | webhook
 * @param marketplaceId 站点（Amazon marketplaceId）
 */
export async function executeResourceSync(
  platformCode: string,
  resource: SyncResource,
  triggerType: 'manual' | 'scheduled' | 'webhook' = 'manual',
  marketplaceId?: string,
): Promise<ResourceSyncResult | AllResourcesSyncResult> {
  if (resource === 'orders') {
    return runOrdersSync(platformCode, triggerType, marketplaceId);
  }

  if (resource === 'fbaInventory' || resource === 'listings') {
    return executeSnapshotSync(platformCode, resource, triggerType, marketplaceId);
  }

  // all：顺序执行，避免同一适配器 token 缓存/限流互相踩
  const started = Date.now();
  const results: ResourceSyncResult[] = [];
  results.push(await runOrdersSync(platformCode, triggerType, marketplaceId));
  results.push(await executeSnapshotSync(platformCode, 'fbaInventory', triggerType, marketplaceId));
  results.push(await executeSnapshotSync(platformCode, 'listings', triggerType, marketplaceId));

  const resolvedMarketplaceId =
    results.find(r => r.marketplaceId)?.marketplaceId || marketplaceId || '';

  return {
    platformCode,
    marketplaceId: resolvedMarketplaceId,
    resource: 'all',
    status: aggregateStatus(results),
    itemsFound: results.reduce((s, r) => s + r.itemsFound, 0),
    itemsSynced: results.reduce((s, r) => s + r.itemsSynced, 0),
    itemsFailed: results.reduce((s, r) => s + r.itemsFailed, 0),
    errors: results.flatMap(r => r.errors || []),
    durationMs: Date.now() - started,
    results,
  };
}

/** 判断未知输入是否是合法资源类型 */
export function parseSyncResource(input: unknown): SyncResource | null {
  const allowed: SyncResource[] = ['orders', 'fbaInventory', 'listings', 'all'];
  return typeof input === 'string' && (allowed as string[]).includes(input)
    ? (input as SyncResource)
    : null;
}
