/**
 * 补货建议引擎（二期 BE-2）
 *
 * 业务口径（已拍板，改公式前先读这里）：
 *
 *  1) 销量估计
 *     - 近 N 天（默认 30，不含当天，避免当天未过完低估日均）平台订单（PlatformOrder.items[].sku）
 *     逐日销量序列 → 日均 avgDailySales + 样本标准差 stdDevDailySales（n−1）
 *     - 窗口内没有任何销量 → 降级为「手工目标周转」：avgDailySales = 手工日均目标（可选），σ = 0
 *
 *  2) 安全库存 / 再订货点
 *     safetyStock  = z × σ × √leadTimeDays            （服务水平 90% → z = 1.28）
 *     reorderPoint = avgDailySales × leadTimeDays + safetyStock
 *
 *  3) 头程时效 leadTimeDays
 *     - 该路线（国内仓 → 该海外仓）已 RECEIVED 调拨单 shippedAt → receivedAt 的均值
 *     - 样本过滤：时长 < 1 天的样本视为同日收发的脏数据，剔除（否则均值被拉到 0，安全库存失真）
 *     - 无历史数据 → 默认值 35 天（SystemConfig `replenishment.default_lead_time_days`
 *       或环境变量 REPLENISHMENT_DEFAULT_LEAD_TIME_DAYS 可配置），海运为主
 *
 *  4) 建议量
 *     可用量口径 netAvailableQty = onHandQty(台账实物) + inTransitQty(在途) − reservedQty(已承诺预留)
 *     在途 = IN_TRANSIT 调拨单（本仓为收货方）+ 待收货入库单（targetOverseasWarehouseId=本仓，PENDING/PARTIAL）
 *     suggestedQty = max(0, ceil(reorderPoint + avgDailySales × replenishCycleDays − netAvailableQty))
 *
 * 参数快照：每次生成把上述所有数字写进 ReplenishmentSuggestion 行，事后不重算（可追溯「当时为什么建议这么多」）。
 *
 * 幂等：generate 对同一 (sku, 海外仓) 的 PENDING 行做原地刷新（update），不会产生重复行；
 * 建议量降到 0 且仍是 PENDING 的行会被清掉（cleared），APPROVED/CONVERTED/DISMISSED 永不被 generate 改写。
 */

import { prisma } from '@/lib/prisma';
import {
  computeOverseasAvailable,
  resolveOverseasWarehouse,
  OverseasWarehouseNotFoundError,
  type ResolvedOverseasWarehouse,
} from '@/lib/overseas-inventory';

// ============================================
// 常量与配置
// ============================================

/** 默认头程时效（天）：海运 35 天 */
export const DEFAULT_LEAD_TIME_DAYS = 35;
/** 默认销量统计窗口（天） */
export const DEFAULT_SALES_WINDOW_DAYS = 30;
/** 默认补货周期（天） */
export const DEFAULT_REPLENISH_CYCLE_DAYS = 30;
/** 默认服务水平 90% 对应的 z 值 */
export const DEFAULT_SERVICE_LEVEL_Z = 1.28;

export const REPLENISHMENT_CONFIG_KEYS = {
  defaultLeadTimeDays: 'replenishment.default_lead_time_days',
  salesWindowDays: 'replenishment.sales_window_days',
  replenishCycleDays: 'replenishment.replenish_cycle_days',
  serviceLevelZ: 'replenishment.service_level_z',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 保留 n 位小数（快照字段用，保证手算能复现） */
export function round(value: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}

export interface ReplenishmentConfig {
  defaultLeadTimeDays: number;
  /** 默认头程天数是否来自配置（true=CONFIG，false=内置 DEFAULT） */
  leadTimeFromConfig: boolean;
  salesWindowDays: number;
  replenishCycleDays: number;
  serviceLevelZ: number;
}

/**
 * 读取补货引擎默认配置。
 * 优先 SystemConfig（key 见 REPLENISHMENT_CONFIG_KEYS），其次环境变量，最后内置默认。
 */
export async function getReplenishmentConfig(): Promise<ReplenishmentConfig> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: Object.values(REPLENISHMENT_CONFIG_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map<string, string>();
  for (const r of rows) {
    // SystemConfig.value 是 JSON 字符串，兼容 "35" / 35 两种写法
    let raw = r.value;
    try {
      const parsed = JSON.parse(r.value);
      raw = parsed === null || parsed === undefined ? r.value : String(parsed);
    } catch {
      /* 非 JSON，按原样用 */
    }
    byKey.set(r.key, raw);
  }

  const cfgLead = toNumber(byKey.get(REPLENISHMENT_CONFIG_KEYS.defaultLeadTimeDays));
  const envLead = toNumber(process.env.REPLENISHMENT_DEFAULT_LEAD_TIME_DAYS);
  const leadCandidate = cfgLead ?? envLead;
  const defaultLeadTimeDays =
    leadCandidate !== null && leadCandidate > 0 ? leadCandidate : DEFAULT_LEAD_TIME_DAYS;

  const cfgWindow = toNumber(byKey.get(REPLENISHMENT_CONFIG_KEYS.salesWindowDays));
  const cfgCycle = toNumber(byKey.get(REPLENISHMENT_CONFIG_KEYS.replenishCycleDays));
  const cfgZ = toNumber(byKey.get(REPLENISHMENT_CONFIG_KEYS.serviceLevelZ));

  return {
    defaultLeadTimeDays,
    leadTimeFromConfig: leadCandidate !== null && leadCandidate > 0,
    salesWindowDays: cfgWindow && cfgWindow > 0 ? Math.trunc(cfgWindow) : DEFAULT_SALES_WINDOW_DAYS,
    replenishCycleDays:
      cfgCycle && cfgCycle > 0 ? Math.trunc(cfgCycle) : DEFAULT_REPLENISH_CYCLE_DAYS,
    serviceLevelZ: cfgZ && cfgZ > 0 ? cfgZ : DEFAULT_SERVICE_LEVEL_Z,
  };
}

// ============================================
// 销量统计
// ============================================

export interface SalesAggregate {
  /** 逐日销量，index 0 = 窗口最早一天，末尾 = 昨天 */
  series: number[];
  totalQty: number;
  /** 窗口内包含该 SKU 的订单数 */
  orderCount: number;
}

/** 视为无效（不计销量）的订单状态：取消/退款类 */
const INVALID_ORDER_STATUS = /cancel|refund|closed/i;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface CollectSalesOptions {
  windowDays: number;
  /** 统计截止时刻（默认 now）；窗口 = [startOfDay(now)−N 天, startOfDay(now)) */
  now?: Date;
}

/**
 * 汇总窗口内各 SKU 的逐日销量（平台订单口径）。
 * PlatformOrder.items 是 JSON 数组，元素形如 { sku, quantity, ... }，因此这里拉窗口内订单在内存里聚合。
 */
export async function collectSalesBySku(
  options: CollectSalesOptions
): Promise<Map<string, SalesAggregate>> {
  const windowDays = Math.max(1, Math.trunc(options.windowDays));
  const now = options.now ?? new Date();
  const windowEnd = startOfDay(now); // 不含当天
  const windowStart = new Date(windowEnd.getTime() - windowDays * DAY_MS);

  const orders = await prisma.platformOrder.findMany({
    where: {
      OR: [
        { orderDate: { gte: windowStart, lt: windowEnd } },
        { AND: [{ orderDate: null }, { orderedAt: { gte: windowStart, lt: windowEnd } }] },
      ],
    },
    select: { id: true, items: true, orderDate: true, orderedAt: true, status: true },
  });

  const result = new Map<string, SalesAggregate>();

  for (const order of orders) {
    if (order.status && INVALID_ORDER_STATUS.test(order.status)) continue;

    const at = order.orderDate ?? order.orderedAt;
    if (!at) continue;
    const idx = Math.floor((startOfDay(at).getTime() - windowStart.getTime()) / DAY_MS);
    if (idx < 0 || idx >= windowDays) continue;

    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    const skusInOrder = new Set<string>();

    for (const item of items) {
      const sku = typeof item?.sku === 'string' ? item.sku.trim() : '';
      const qty = Number(item?.quantity);
      if (!sku || !Number.isFinite(qty) || qty <= 0) continue;

      let agg = result.get(sku);
      if (!agg) {
        agg = { series: new Array(windowDays).fill(0), totalQty: 0, orderCount: 0 };
        result.set(sku, agg);
      }
      agg.series[idx] += qty;
      agg.totalQty += qty;
      skusInOrder.add(sku);
    }

    for (const sku of skusInOrder) {
      const agg = result.get(sku);
      if (agg) agg.orderCount += 1;
    }
  }

  return result;
}

export interface DemandStats {
  avgDailySales: number;
  stdDevDailySales: number;
}

/** 由逐日销量求出日均 + 样本标准差（n−1；n<2 → 0） */
export function computeDemandStats(series: number[]): DemandStats {
  const n = series.length;
  if (n === 0) return { avgDailySales: 0, stdDevDailySales: 0 };
  const sum = series.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  if (n < 2) return { avgDailySales: round(mean, 2), stdDevDailySales: 0 };
  const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { avgDailySales: round(mean, 2), stdDevDailySales: round(Math.sqrt(variance), 2) };
}

// ============================================
// 头程时效
// ============================================

export type LeadTimeSource = 'HISTORY' | 'CONFIG' | 'DEFAULT';

export interface LeadTimeResult {
  days: number;
  source: LeadTimeSource;
  sampleSize: number;
  /** 参与均值计算的样本（天），便于审计 */
  samples?: number[];
}

/**
 * 统计各海外仓的头程时效：国内仓 → 该海外仓，已 RECEIVED 调拨单 shippedAt→receivedAt 均值。
 * 无历史样本时回落默认值（可配置，海运 35 天）。
 */
export async function computeLeadTimeByWarehouse(
  warehouseIds: string[],
  defaults: { defaultLeadTimeDays: number; leadTimeFromConfig: boolean }
): Promise<Map<string, LeadTimeResult>> {
  const map = new Map<string, LeadTimeResult>();
  const fallback: LeadTimeResult = {
    days: defaults.defaultLeadTimeDays,
    source: defaults.leadTimeFromConfig ? 'CONFIG' : 'DEFAULT',
    sampleSize: 0,
  };
  if (!warehouseIds.length) return map;

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: 'RECEIVED',
      direction: 'DOMESTIC_TO_OVERSEAS',
      toOverseasWarehouseId: { in: warehouseIds },
      shippedAt: { not: null },
      receivedAt: { not: null },
    },
    select: { toOverseasWarehouseId: true, shippedAt: true, receivedAt: true },
  });

  const byWarehouse = new Map<string, number[]>();
  for (const t of transfers) {
    const whId = t.toOverseasWarehouseId;
    if (!whId || !t.shippedAt || !t.receivedAt) continue;
    const days = (t.receivedAt.getTime() - t.shippedAt.getTime()) / DAY_MS;
    // 数据噪音过滤：负数/0 = 录入错误；< 1 天 = 同日收发（头程不可能当天到），
    // 这类样本会把均值拉到 0，进而把安全库存/再订货点算成 0，必须剔除。
    if (!Number.isFinite(days) || days < 1) continue;
    const list = byWarehouse.get(whId) ?? [];
    list.push(days);
    byWarehouse.set(whId, list);
  }

  for (const whId of warehouseIds) {
    const samples = byWarehouse.get(whId);
    if (!samples || samples.length === 0) {
      map.set(whId, { ...fallback });
      continue;
    }
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    map.set(whId, {
      days: round(avg, 2),
      source: 'HISTORY',
      sampleSize: samples.length,
      samples: samples.map(v => round(v, 2)),
    });
  }

  return map;
}

// ============================================
// 在途
// ============================================

/** warehouseId → productId → 在途数量 */
export type InTransitMap = Map<string, Map<string, number>>;

const PENDING_INBOUND_STATUSES = ['PENDING', 'PARTIAL'] as const;

/**
 * 在途量：DRAFT+IN_TRANSIT 调拨单（本仓为收货方的未收部分；DRAFT 已锁货计入，防已转单未发货重复建议）+ 待收货入库单（本仓为目标海外仓）。
 */
export async function computeInTransitByWarehouse(warehouseIds: string[]): Promise<InTransitMap> {
  const map: InTransitMap = new Map();
  if (!warehouseIds.length) return map;

  const bump = (whId: string | null | undefined, productId: string, qty: number) => {
    if (!whId || !Number.isFinite(qty) || qty <= 0) return;
    let byProduct = map.get(whId);
    if (!byProduct) {
      byProduct = new Map();
      map.set(whId, byProduct);
    }
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + qty);
  };

  const [transferItems, inboundItems] = await Promise.all([
    prisma.stockTransferItem.findMany({
      where: {
        transfer: { status: { in: ['DRAFT', 'IN_TRANSIT'] }, toOverseasWarehouseId: { in: warehouseIds } },
      },
      select: {
        productId: true,
        quantity: true,
        receivedQty: true,
        transfer: { select: { toOverseasWarehouseId: true } },
      },
    }),
    prisma.inboundOrderItem.findMany({
      where: {
        inboundOrder: {
          status: { in: [...PENDING_INBOUND_STATUSES] },
          targetOverseasWarehouseId: { in: warehouseIds },
        },
      },
      select: {
        productId: true,
        expectedQuantity: true,
        actualQuantity: true,
        inboundOrder: { select: { targetOverseasWarehouseId: true } },
      },
    }),
  ]);

  for (const it of transferItems) {
    bump(it.transfer?.toOverseasWarehouseId, it.productId, it.quantity - it.receivedQty);
  }
  for (const it of inboundItems) {
    bump(it.inboundOrder?.targetOverseasWarehouseId, it.productId, it.expectedQuantity - it.actualQuantity);
  }

  return map;
}

// ============================================
// 参数计算（纯函数，便于手算复核）
// ============================================

export interface SuggestionComputeInput {
  sku: string;
  productId?: string | null;
  productName?: string | null;
  overseasWarehouseId: string;
  /** 台账实物数量 */
  onHandQty: number;
  reservedQty: number;
  inTransitQty: number;
  avgDailySales: number;
  stdDevDailySales: number;
  leadTimeDays: number;
  salesWindowDays: number;
  replenishCycleDays: number;
  serviceLevelZ: number;
  /** 手工目标周转天数（降级路径） */
  targetDays?: number | null;
  salesBasis: 'PLATFORM_ORDERS' | 'MANUAL_TARGET';
  salesOrderCount?: number;
  leadTimeSource: LeadTimeSource;
  leadTimeSampleSize?: number;
}

export interface SuggestionComputed {
  sku: string;
  productId: string | null;
  productName: string | null;
  overseasWarehouseId: string;
  avgDailySales: number;
  stdDevDailySales: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  onHandQty: number;
  availableQty: number;
  reservedQty: number;
  inTransitQty: number;
  netAvailableQty: number;
  suggestedQty: number;
  salesWindowDays: number;
  salesBasis: 'PLATFORM_ORDERS' | 'MANUAL_TARGET';
  salesOrderCount: number;
  leadTimeSource: LeadTimeSource;
  leadTimeSampleSize: number;
  targetDays: number | null;
  serviceLevelZ: number;
  replenishCycleDays: number;
  /** 计算轨迹（调试/审计用，不入库） */
  formula: {
    safetyStock: string;
    reorderPoint: string;
    suggested: string;
  };
}

/**
 * 核心公式（纯函数）：
 *   safetyStock  = round(z × σ × √leadTimeDays, 2)
 *   reorderPoint = round(avgDaily × leadTimeDays + safetyStock, 2)
 *   suggestedQty = max(0, ceil(reorderPoint + avgDaily × replenishCycleDays − netAvailableQty))
 *   netAvailableQty = onHandQty + inTransitQty − reservedQty
 */
export function computeSuggestion(input: SuggestionComputeInput): SuggestionComputed {
  const {
    sku,
    productId = null,
    productName = null,
    overseasWarehouseId,
    onHandQty,
    reservedQty,
    inTransitQty,
    avgDailySales,
    stdDevDailySales,
    leadTimeDays,
    salesWindowDays,
    replenishCycleDays,
    serviceLevelZ,
    targetDays = null,
    salesBasis,
    salesOrderCount = 0,
    leadTimeSource,
    leadTimeSampleSize = 0,
  } = input;

  const dayAvg = round(avgDailySales, 2);
  const sigma = round(stdDevDailySales, 2);
  const lead = round(leadTimeDays, 2);
  const z = round(serviceLevelZ, 4);

  const safetyStock = round(z * sigma * Math.sqrt(lead), 2);
  const reorderPoint = round(dayAvg * lead + safetyStock, 2);
  const availableQty = computeOverseasAvailable(onHandQty, reservedQty);
  const netAvailableQty = onHandQty + inTransitQty - reservedQty;
  const rawNeed = reorderPoint + dayAvg * replenishCycleDays - netAvailableQty;
  const suggestedQty = Math.max(0, Math.ceil(round(rawNeed, 4)));

  return {
    sku,
    productId,
    productName,
    overseasWarehouseId,
    avgDailySales: dayAvg,
    stdDevDailySales: sigma,
    leadTimeDays: lead,
    safetyStock,
    reorderPoint,
    onHandQty,
    availableQty,
    reservedQty,
    inTransitQty,
    netAvailableQty,
    suggestedQty,
    salesWindowDays,
    salesBasis,
    salesOrderCount,
    leadTimeSource,
    leadTimeSampleSize,
    targetDays,
    serviceLevelZ: z,
    replenishCycleDays,
    formula: {
      safetyStock: `${z} × ${sigma} × √${lead} = ${safetyStock}`,
      reorderPoint: `${dayAvg} × ${lead} + ${safetyStock} = ${reorderPoint}`,
      suggested: `max(0, ceil(${reorderPoint} + ${dayAvg} × ${replenishCycleDays} − ${netAvailableQty})) = ${suggestedQty}`,
    },
  };
}

// ============================================
// 生成（幂等刷新 PENDING）
// ============================================

export interface GenerateParams {
  /** 海外仓 id 或 code；为空表示全部启用中的海外仓 */
  warehouseInput?: string | null;
  /** 只算该 SKU（调试/单点重算用） */
  sku?: string | null;
  salesWindowDays?: number | null;
  replenishCycleDays?: number | null;
  serviceLevelZ?: number | null;
  /** 无销量数据时的手工日均目标（降级路径） */
  manualDailySales?: number | null;
  /** 手工目标周转天数（降级路径，仅记录用） */
  manualTargetDays?: number | null;
  /** 强制头程天数（跳过历史统计，仅运维/验证用） */
  leadTimeDaysOverride?: number | null;
  /** 操作人（写 notes 审计用） */
  operator?: string | null;
  now?: Date;
}

export interface WarehouseGenerationStats {
  warehouse: ResolvedOverseasWarehouse;
  leadTime: LeadTimeResult;
  created: number;
  refreshed: number;
  cleared: number;
  /** 因最近被 dismiss 而跳过的 SKU */
  skippedDismissed: number;
  rows: SuggestionComputed[];
}

export interface GenerateResult {
  generatedAt: string;
  params: {
    salesWindowDays: number;
    replenishCycleDays: number;
    serviceLevelZ: number;
    manualDailySales: number | null;
    manualTargetDays: number | null;
    leadTimeDaysOverride: number | null;
  };
  warehouses: WarehouseGenerationStats[];
  totals: { created: number; refreshed: number; cleared: number; skippedDismissed: number; rows: number };
}

/**
 * 生成补货建议（幂等）。同一 (sku + 海外仓) 的 PENDING 行原地刷新。
 */
export async function generateReplenishmentSuggestions(
  params: GenerateParams = {}
): Promise<GenerateResult> {
  const cfg = await getReplenishmentConfig();
  const now = params.now ?? new Date();

  const salesWindowDays =
    params.salesWindowDays && params.salesWindowDays > 0
      ? Math.trunc(params.salesWindowDays)
      : cfg.salesWindowDays;
  const replenishCycleDays =
    params.replenishCycleDays && params.replenishCycleDays > 0
      ? Math.trunc(params.replenishCycleDays)
      : cfg.replenishCycleDays;
  const serviceLevelZ =
    params.serviceLevelZ && params.serviceLevelZ > 0 ? params.serviceLevelZ : cfg.serviceLevelZ;
  const manualDailySales =
    params.manualDailySales !== null && params.manualDailySales !== undefined
      ? Number(params.manualDailySales)
      : null;
  const manualTargetDays =
    params.manualTargetDays !== null && params.manualTargetDays !== undefined
      ? Math.trunc(Number(params.manualTargetDays))
      : null;
  const leadTimeOverride =
    params.leadTimeDaysOverride !== null && params.leadTimeDaysOverride !== undefined
      ? Number(params.leadTimeDaysOverride)
      : null;

  // ---- 1. 目标仓库 ----
  let warehouses: ResolvedOverseasWarehouse[];
  if (params.warehouseInput) {
    warehouses = [await resolveOverseasWarehouse(params.warehouseInput)]; // 不存在时抛 OverseasWarehouseNotFoundError
  } else {
    warehouses = await prisma.overseasWarehouse.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, country: true, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  const warehouseIds = warehouses.map(w => w.id);
  if (!warehouseIds.length) {
    return {
      generatedAt: now.toISOString(),
      params: {
        salesWindowDays,
        replenishCycleDays,
        serviceLevelZ,
        manualDailySales,
        manualTargetDays,
        leadTimeDaysOverride: leadTimeOverride,
      },
      warehouses: [],
      totals: { created: 0, refreshed: 0, cleared: 0, skippedDismissed: 0, rows: 0 },
    };
  }

  // ---- 2. 一次性把共享数据取回来（销量 / 头程 / 在途） ----
  const [salesBySku, leadTimeMap, inTransitMap] = await Promise.all([
    collectSalesBySku({ windowDays: salesWindowDays, now }),
    computeLeadTimeByWarehouse(warehouseIds, {
      defaultLeadTimeDays: cfg.defaultLeadTimeDays,
      leadTimeFromConfig: cfg.leadTimeFromConfig,
    }),
    computeInTransitByWarehouse(warehouseIds),
  ]);

  const stats: WarehouseGenerationStats[] = [];

  // ---- 3. 逐仓计算 + 落库 ----
  for (const warehouse of warehouses) {
    const inventories = await prisma.overseasInventory.findMany({
      where: { warehouseId: warehouse.id, ...(params.sku ? { sku: params.sku } : {}) },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { sku: 'asc' },
    });

    const leadTime: LeadTimeResult = leadTimeOverride
      ? {
          days: round(leadTimeOverride, 2),
          source: 'CONFIG',
          sampleSize: 0,
        }
      : leadTimeMap.get(warehouse.id) ?? {
          days: cfg.defaultLeadTimeDays,
          source: cfg.leadTimeFromConfig ? 'CONFIG' : 'DEFAULT',
          sampleSize: 0,
        };

    const inTransitByProduct = inTransitMap.get(warehouse.id) ?? new Map<string, number>();

    const rows: SuggestionComputed[] = inventories.map(inv => {
      const sales = salesBySku.get(inv.sku);
      const stats = sales ? computeDemandStats(sales.series) : { avgDailySales: 0, stdDevDailySales: 0 };
      const hasSales = Boolean(sales && sales.totalQty > 0);

      // 降级：无销量数据 → 手工目标周转（未提供手工日均时 avgDaily=0，σ=0 → 建议量按缺口算）
      const avgDailySales = hasSales ? stats.avgDailySales : manualDailySales ?? 0;
      const stdDev = hasSales ? stats.stdDevDailySales : 0;

      return computeSuggestion({
        sku: inv.sku,
        productId: inv.productId,
        productName: inv.product?.name ?? null,
        overseasWarehouseId: warehouse.id,
        onHandQty: inv.quantity,
        reservedQty: inv.reservedQty,
        inTransitQty: inTransitByProduct.get(inv.productId) ?? 0,
        avgDailySales,
        stdDevDailySales: stdDev,
        leadTimeDays: leadTime.days,
        salesWindowDays,
        replenishCycleDays,
        serviceLevelZ,
        targetDays: hasSales ? null : manualTargetDays,
        salesBasis: hasSales ? 'PLATFORM_ORDERS' : 'MANUAL_TARGET',
        salesOrderCount: sales?.orderCount ?? 0,
        leadTimeSource: leadTime.source,
        leadTimeSampleSize: leadTime.sampleSize,
      });
    });

    // ---- 4. 幂等落库 ----
    const dismissedSince = new Date(now.getTime() - replenishCycleDays * DAY_MS);

    const counts = await prisma.$transaction(async tx => {
      const pending = await tx.replenishmentSuggestion.findMany({
        where: { overseasWarehouseId: warehouse.id, status: 'PENDING' },
        select: { id: true, sku: true },
      });
      const pendingBySku = new Map(pending.map(p => [p.sku, p.id]));

      const recentlyDismissed = await tx.replenishmentSuggestion.findMany({
        where: {
          overseasWarehouseId: warehouse.id,
          status: 'DISMISSED',
          dismissedAt: { gte: dismissedSince },
        },
        select: { sku: true },
      });
      const dismissedSkus = new Set(recentlyDismissed.map(r => r.sku));

      let created = 0;
      let refreshed = 0;
      let cleared = 0;
      let skippedDismissed = 0;

      for (const row of rows) {
        const existingId = pendingBySku.get(row.sku);

        if (row.suggestedQty <= 0) {
          if (existingId) {
            await tx.replenishmentSuggestion.delete({ where: { id: existingId } });
            cleared += 1;
          }
          continue;
        }

        if (!existingId && dismissedSkus.has(row.sku)) {
          skippedDismissed += 1;
          continue;
        }

        const snapshot = {
          sku: row.sku,
          productId: row.productId,
          overseasWarehouseId: warehouse.id,
          avgDailySales: row.avgDailySales,
          stdDevDailySales: row.stdDevDailySales,
          leadTimeDays: row.leadTimeDays,
          safetyStock: row.safetyStock,
          reorderPoint: row.reorderPoint,
          onHandQty: row.onHandQty,
          availableQty: row.availableQty,
          reservedQty: row.reservedQty,
          inTransitQty: row.inTransitQty,
          netAvailableQty: row.netAvailableQty,
          suggestedQty: row.suggestedQty,
          salesWindowDays: row.salesWindowDays,
          salesBasis: row.salesBasis,
          salesOrderCount: row.salesOrderCount,
          leadTimeSource: row.leadTimeSource,
          leadTimeSampleSize: row.leadTimeSampleSize,
          targetDays: row.targetDays,
          serviceLevelZ: row.serviceLevelZ,
          replenishCycleDays: row.replenishCycleDays,
          generatedAt: now,
        };

        if (existingId) {
          await tx.replenishmentSuggestion.update({
            where: { id: existingId },
            data: { ...snapshot, status: 'PENDING' },
          });
          refreshed += 1;
        } else {
          await tx.replenishmentSuggestion.create({ data: { ...snapshot, status: 'PENDING' } });
          created += 1;
        }
      }

      return { created, refreshed, cleared, skippedDismissed };
    });

    stats.push({
      warehouse,
      leadTime,
      ...counts,
      rows,
    });
  }

  const totals = stats.reduce(
    (acc, s) => ({
      created: acc.created + s.created,
      refreshed: acc.refreshed + s.refreshed,
      cleared: acc.cleared + s.cleared,
      skippedDismissed: acc.skippedDismissed + s.skippedDismissed,
      rows: acc.rows + s.rows.length,
    }),
    { created: 0, refreshed: 0, cleared: 0, skippedDismissed: 0, rows: 0 }
  );

  return {
    generatedAt: now.toISOString(),
    params: {
      salesWindowDays,
      replenishCycleDays,
      serviceLevelZ,
      manualDailySales,
      manualTargetDays,
      leadTimeDaysOverride: leadTimeOverride,
    },
    warehouses: stats,
    totals,
  };
}

export { OverseasWarehouseNotFoundError };
