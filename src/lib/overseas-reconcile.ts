/**
 * 海外仓台账 ↔ 平台镜像快照 对账（二期 BE-1）
 *
 * 口径（业务已拍板）：
 *   - 本地台账 overseas_inventory.quantity 是**过程权威**；平台快照只做对账参考
 *   - 对比量：本地可用量 = quantity - reservedQty vs 平台可售量 = snapshot.availableQty
 *   - 差异拉平必须走「差异调整单」：写 overseas_inventory（乐观锁）+ stock_movements
 *     （type=ADJUSTMENT，referenceType=OVERSEAS_ADJUST_PLATFORM_DIFF），禁止静默改数
 *   - 差异超过阈值（默认 5，可用 RECONCILE_DIFF_THRESHOLD 配置）在行上标 alert=true，供告警接入
 *
 * 多站点：marketplaceId 传入时只对账该站点；不传时按 SKU 汇总该平台所有站点
 *        （同一 SKU 在多站点各有一份快照，互不覆盖）。
 */

import { prisma } from '@/lib/prisma';
import {
  applyOverseasStockChange,
  computeOverseasAvailable,
  resolveOverseasWarehouse,
  OverseasStockConflictError,
  OverseasStockValidationError,
  OverseasWarehouseNotFoundError,
  type ResolvedOverseasWarehouse,
} from '@/lib/overseas-inventory';

// ============================================
// 类型
// ============================================

export type ReconcileStatus = 'MATCH' | 'DIFF' | 'LOCAL_ONLY' | 'PLATFORM_ONLY';

export interface ReconcileMarketplaceQty {
  marketplaceId: string;
  availableQty: number;
  reservedQty: number;
  inboundQty: number;
  syncedAt: Date | null;
}

export interface ReconcileRow {
  sku: string;
  productId: string | null;
  productName: string | null;
  /** 本地台账可用量（quantity - reservedQty），权威口径 */
  localQty: number;
  localQuantity: number;
  localReservedQty: number;
  /** 平台可售量；LOCAL_ONLY 时为 null */
  platformQty: number | null;
  platformReservedQty: number | null;
  platformInboundQty: number | null;
  asin: string | null;
  fnsku: string | null;
  /** diff = localQty - platformQty（PLATFORM_ONLY 视为 0 - platformQty） */
  diff: number;
  status: ReconcileStatus;
  /** |diff| 超过阈值，需要告警 */
  alert: boolean;
  marketplaces: ReconcileMarketplaceQty[];
  lastSnapshotAt: Date | null;
}

export interface ReconcileReport {
  warehouse: ResolvedOverseasWarehouse;
  platformCode: string;
  marketplaceId: string | null;
  threshold: number;
  rows: ReconcileRow[];
  summary: Record<ReconcileStatus, number> & {
    total: number;
    alertCount: number;
    totalLocalQty: number;
    totalPlatformQty: number;
    lastSnapshotAt: Date | null;
  };
}

export class ReconcileSnapshotMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconcileSnapshotMissingError';
  }
}

export class ReconcileProductMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconcileProductMissingError';
  }
}

// ============================================
// 阈值
// ============================================

export function getReconcileThreshold(override?: number | null): number {
  if (typeof override === 'number' && Number.isFinite(override) && override >= 0) {
    return Math.trunc(override);
  }
  const env = Number(process.env.RECONCILE_DIFF_THRESHOLD);
  if (Number.isFinite(env) && env >= 0) return Math.trunc(env);
  return 5;
}

// ============================================
// 对账报表
// ============================================

export interface BuildReconcileParams {
  warehouseId: string;
  platformCode: string;
  marketplaceId?: string;
  sku?: string;
  status?: ReconcileStatus;
  threshold?: number;
}

export async function buildReconcileReport(params: BuildReconcileParams): Promise<ReconcileReport> {
  const { warehouseId, platformCode, marketplaceId, sku, status: statusFilter } = params;
  const threshold = getReconcileThreshold(params.threshold);

  const warehouse = await resolveOverseasWarehouse(warehouseId);

  const [localRows, snapshotRows] = await Promise.all([
    prisma.overseasInventory.findMany({
      where: {
        warehouseId: warehouse.id,
        ...(sku ? { sku } : {}),
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { sku: 'asc' },
    }),
    prisma.platformInventorySnapshot.findMany({
      where: {
        platformCode,
        ...(marketplaceId ? { marketplaceId } : {}),
        ...(sku ? { sku } : {}),
      },
      orderBy: [{ sku: 'asc' }, { marketplaceId: 'asc' }],
    }),
  ]);

  // 平台快照按 SKU 聚合（多站点汇总；同时保留每站点明细）
  const platformBySku = new Map<
    string,
    {
      availableQty: number;
      reservedQty: number;
      inboundQty: number;
      asin: string | null;
      fnsku: string | null;
      lastSnapshotAt: Date | null;
      marketplaces: ReconcileMarketplaceQty[];
    }
  >();

  for (const s of snapshotRows) {
    const agg =
      platformBySku.get(s.sku) ||
      {
        availableQty: 0,
        reservedQty: 0,
        inboundQty: 0,
        asin: null as string | null,
        fnsku: null as string | null,
        lastSnapshotAt: null as Date | null,
        marketplaces: [] as ReconcileMarketplaceQty[],
      };
    agg.availableQty += s.availableQty;
    agg.reservedQty += s.reservedQty;
    agg.inboundQty += s.inboundQty;
    agg.asin = agg.asin || s.asin || null;
    agg.fnsku = agg.fnsku || s.fnsku || null;
    if (!agg.lastSnapshotAt || s.syncedAt > agg.lastSnapshotAt) agg.lastSnapshotAt = s.syncedAt;
    agg.marketplaces.push({
      marketplaceId: s.marketplaceId,
      availableQty: s.availableQty,
      reservedQty: s.reservedQty,
      inboundQty: s.inboundQty,
      syncedAt: s.syncedAt,
    });
    platformBySku.set(s.sku, agg);
  }

  const localBySku = new Map<string, (typeof localRows)[number]>();
  for (const l of localRows) localBySku.set(l.sku, l);

  const allSkus = new Set<string>([...localBySku.keys(), ...platformBySku.keys()]);
  const rows: ReconcileRow[] = [];

  for (const s of allSkus) {
    const local = localBySku.get(s);
    const platform = platformBySku.get(s);

    const localQty = local ? computeOverseasAvailable(local.quantity, local.reservedQty) : 0;
    const platformQty = platform ? platform.availableQty : null;
    const diff = localQty - (platformQty ?? 0);

    let status: ReconcileStatus;
    if (local && platform) status = diff === 0 ? 'MATCH' : 'DIFF';
    else if (local) status = 'LOCAL_ONLY';
    else status = 'PLATFORM_ONLY';

    rows.push({
      sku: s,
      productId: local?.productId ?? null,
      productName: local?.product?.name ?? null,
      localQty,
      localQuantity: local?.quantity ?? 0,
      localReservedQty: local?.reservedQty ?? 0,
      platformQty,
      platformReservedQty: platform ? platform.reservedQty : null,
      platformInboundQty: platform ? platform.inboundQty : null,
      asin: local?.asin || platform?.asin || null,
      fnsku: local?.fnsku || platform?.fnsku || null,
      diff,
      status,
      alert: status !== 'MATCH' && Math.abs(diff) > threshold,
      marketplaces: platform?.marketplaces ?? [],
      lastSnapshotAt: platform?.lastSnapshotAt ?? null,
    });
  }

  // 排序：差异优先（运营先看要处理的），同组按 SKU
  const order: Record<ReconcileStatus, number> = { DIFF: 0, PLATFORM_ONLY: 1, LOCAL_ONLY: 2, MATCH: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.sku.localeCompare(b.sku));

  const filtered = statusFilter ? rows.filter(r => r.status === statusFilter) : rows;

  const summary = {
    MATCH: rows.filter(r => r.status === 'MATCH').length,
    DIFF: rows.filter(r => r.status === 'DIFF').length,
    LOCAL_ONLY: rows.filter(r => r.status === 'LOCAL_ONLY').length,
    PLATFORM_ONLY: rows.filter(r => r.status === 'PLATFORM_ONLY').length,
    total: rows.length,
    alertCount: rows.filter(r => r.alert).length,
    totalLocalQty: rows.reduce((s, r) => s + r.localQty, 0),
    totalPlatformQty: rows.reduce((s, r) => s + (r.platformQty ?? 0), 0),
    lastSnapshotAt: rows.reduce<Date | null>(
      (acc, r) => (r.lastSnapshotAt && (!acc || r.lastSnapshotAt > acc) ? r.lastSnapshotAt : acc),
      null,
    ),
  };

  return {
    warehouse,
    platformCode,
    marketplaceId: marketplaceId || null,
    threshold,
    rows: filtered,
    summary,
  };
}

// ============================================
// 差异拉平（差异调整单）
// ============================================

export interface ResolveReconcileParams {
  warehouseId: string;
  sku: string;
  platformCode: string;
  marketplaceId?: string;
  reason?: string;
  notes?: string;
  operator?: string;
}

export interface ResolveReconcileResult {
  status: 'RESOLVED' | 'MATCH';
  changed: boolean;
  warehouse: ResolvedOverseasWarehouse;
  sku: string;
  platformQty: number;
  localQtyBefore: number;
  delta: number;
  inventory: any | null;
  movement: any | null;
  reason: string;
}

/**
 * 把本地台账拉到平台快照值
 *
 * 注意：这里只处理「平台有、本地有/本地缺但有产品主数据」的情况；
 * PLATFORM_ONLY 且本地没有对应 product 主数据时拒绝建台账行（避免凭空造产品）。
 */
export async function resolveReconcileDiff(
  params: ResolveReconcileParams,
): Promise<ResolveReconcileResult> {
  const { warehouseId, sku, platformCode, marketplaceId, reason, notes, operator } = params;

  const warehouse = await resolveOverseasWarehouse(warehouseId);

  const snapshots = await prisma.platformInventorySnapshot.findMany({
    where: {
      platformCode,
      sku,
      ...(marketplaceId ? { marketplaceId } : {}),
    },
  });

  if (snapshots.length === 0) {
    throw new ReconcileSnapshotMissingError(
      `没有找到 ${platformCode}${marketplaceId ? `@${marketplaceId}` : ''} SKU ${sku} 的平台快照，无法拉平（请先同步）`,
    );
  }

  const platformQty = snapshots.reduce((s, r) => s + r.availableQty, 0);

  const local = await prisma.overseasInventory.findFirst({
    where: { warehouseId: warehouse.id, sku },
  });
  const localQty = local ? computeOverseasAvailable(local.quantity, local.reservedQty) : 0;
  const delta = platformQty - localQty;

  const autoReason =
    `平台对账拉平：${platformCode}${marketplaceId ? '@' + marketplaceId : ''} SKU ${sku} ` +
    `台账可用 ${localQty} → 平台可售 ${platformQty}（差异 ${delta > 0 ? '+' : ''}${delta}）` +
    (reason ? `；备注：${reason}` : '');

  if (delta === 0) {
    return {
      status: 'MATCH',
      changed: false,
      warehouse,
      sku,
      platformQty,
      localQtyBefore: localQty,
      delta: 0,
      inventory: local ?? null,
      movement: null,
      reason: autoReason,
    };
  }

  // 本地没有台账行时，必须能从产品主数据找到该 SKU 才能建行
  let productId = local?.productId;
  if (!productId) {
    const product = await prisma.product.findFirst({
      where: { sku },
      select: { id: true },
    });
    if (!product) {
      throw new ReconcileProductMissingError(
        `SKU ${sku} 在本地没有产品主数据，无法建立台账行（请先在产品库建档，或人工核对平台 SKU 命名）`,
      );
    }
    productId = product.id;
  }

  const result = await prisma.$transaction(async tx => {
    const change = await applyOverseasStockChange(tx, {
      overseasWarehouseId: warehouse.id,
      overseasWarehouseCode: warehouse.code,
      productId: productId!,
      delta,
      type: 'ADJUSTMENT',
      referenceType: 'OVERSEAS_ADJUST_PLATFORM_DIFF',
      notes: `${autoReason}（操作人：${operator || 'system'}）${notes ? ` / ${notes}` : ''}`,
      sku,
    });

    const row = await tx.overseasInventory.findUniqueOrThrow({ where: { id: change.inventoryId } });
    const movement = await tx.stockMovement.findUniqueOrThrow({ where: { id: change.movementId } });
    return { row, movement, change };
  });

  return {
    status: 'RESOLVED',
    changed: true,
    warehouse,
    sku,
    platformQty,
    localQtyBefore: localQty,
    delta,
    inventory: {
      ...result.row,
      availableQty: computeOverseasAvailable(result.row.quantity, result.row.reservedQty),
    },
    movement: result.movement,
    reason: autoReason,
  };
}

export {
  OverseasWarehouseNotFoundError,
  OverseasStockValidationError,
  OverseasStockConflictError,
};
