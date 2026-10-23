/**
 * 海外仓 ↔ 平台 对账前端类型（对齐 GET /api/v1/overseas/reconcile）
 */

export type ReconcileStatus = 'MATCH' | 'DIFF' | 'LOCAL_ONLY' | 'PLATFORM_ONLY';

export interface ReconcileMarketplaceQty {
  marketplaceId: string;
  availableQty: number;
  reservedQty: number;
  inboundQty: number;
  syncedAt: string | null;
}

export interface ReconcileRow {
  sku: string;
  productId: string | null;
  productName: string | null;
  localQty: number;
  localQuantity: number;
  localReservedQty: number;
  platformQty: number | null;
  platformReservedQty: number | null;
  platformInboundQty: number | null;
  asin: string | null;
  fnsku: string | null;
  diff: number;
  status: ReconcileStatus;
  alert: boolean;
  marketplaces: ReconcileMarketplaceQty[];
  lastSnapshotAt: string | null;
}

export interface ReconcileSummary {
  MATCH: number;
  DIFF: number;
  LOCAL_ONLY: number;
  PLATFORM_ONLY: number;
  total: number;
  alertCount: number;
  totalLocalQty: number;
  totalPlatformQty: number;
  lastSnapshotAt: string | null;
}

export interface ReconcileResponse {
  warehouse: { id: string; code: string; name: string };
  platformCode: string;
  marketplaceId: string | null;
  threshold: number;
  rows: ReconcileRow[];
  summary: ReconcileSummary;
}

export const RECONCILE_STATUS_LABEL: Record<ReconcileStatus, string> = {
  MATCH: '一致',
  DIFF: '差异',
  LOCAL_ONLY: '仅本地',
  PLATFORM_ONLY: '仅平台',
};

/** 状态徽章配色：MATCH 绿 / DIFF 红 / LOCAL_ONLY 灰 / PLATFORM_ONLY 橙 */
export const RECONCILE_STATUS_COLOR: Record<ReconcileStatus, string> = {
  MATCH: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300',
  DIFF: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300',
  LOCAL_ONLY: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300',
  PLATFORM_ONLY: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300',
};

/** 平台与站点（Amazon 各 marketplaceId） */
export const PLATFORM_OPTIONS = [{ value: 'amazon', label: 'Amazon' }];

export const MARKETPLACE_OPTIONS = [
  { value: 'ATVPDKIKX0DER', label: '美国（ATVPDKIKX0DER）' },
  { value: 'A1F83G8C2ARO7P', label: '英国（A1F83G8C2ARO7P）' },
  { value: 'A1PA6795UKMFR9', label: '德国（A1PA6795UKMFR9）' },
  { value: 'A2VIGQ35RCS4UG', label: '阿联酋（A2VIGQ35RCS4UG）' },
];

export const ALL_VALUE = '__ALL__';

export function marketplaceLabel(marketplaceId?: string | null): string {
  if (!marketplaceId) return '全部站点';
  const hit = MARKETPLACE_OPTIONS.find(m => m.value === marketplaceId);
  return hit ? hit.label.split('（')[0] : marketplaceId;
}

export function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
