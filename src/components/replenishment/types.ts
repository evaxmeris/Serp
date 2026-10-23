/**
 * 补货建议前端类型（对齐 /api/v1/replenishment/*）
 */

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'CONVERTED' | 'DISMISSED';

export interface SuggestionProduct {
  id: string;
  name: string;
  sku: string;
  costPrice?: string | number | null;
  currency?: string | null;
}

export interface SuggestionWarehouse {
  id: string;
  code: string;
  name: string;
  country?: string;
}

export interface ReplenishmentSuggestion {
  id: string;
  sku: string;
  productId: string | null;
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
  salesBasis: string;
  salesOrderCount: number;
  leadTimeSource: string;
  leadTimeSampleSize: number;
  targetDays: number | null;
  serviceLevelZ: number;
  replenishCycleDays: number;
  status: SuggestionStatus;
  generatedAt: string;
  convertedType: string | null;
  convertedId: string | null;
  convertedNo: string | null;
  convertedAt: string | null;
  dismissedAt: string | null;
  dismissedReason: string | null;
  notes: string | null;
  product: SuggestionProduct | null;
  overseasWarehouse: SuggestionWarehouse | null;
}

export interface SuggestionCounts {
  PENDING: number;
  APPROVED: number;
  CONVERTED: number;
  DISMISSED: number;
}

export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  PENDING: '待处理',
  APPROVED: '已批准',
  CONVERTED: '已转单',
  DISMISSED: '已忽略',
};

/** 状态徽章配色（与海外仓模块保持同一套色感） */
export const STATUS_COLOR: Record<SuggestionStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300',
  CONVERTED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300',
  DISMISSED: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300',
};

/** 头程来源 → 徽章文案（HISTORY 历史实测 / CONFIG 配置 / DEFAULT 内置默认） */
export function leadTimeSourceLabel(source: string): { text: string; historical: boolean } {
  if (source === 'HISTORY') return { text: '历史', historical: true };
  if (source === 'CONFIG') return { text: '配置', historical: false };
  return { text: '默认', historical: false };
}

export function salesBasisLabel(basis: string): string {
  return basis === 'MANUAL_TARGET' ? '手工目标周转（无销量数据降级）' : '平台订单实测';
}

/** 千分位 + 最多两位小数 */
export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 整数千分位 */
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('zh-CN');
}
