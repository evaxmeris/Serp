/**
 * 海外仓前端共享类型（对齐 /api/v1/overseas/* 响应体）
 */

export const OVERSEAS_TYPES: Record<string, string> = {
  FBA: 'FBA 仓',
  FBN: 'FBN 仓',
  SELF_OWNED: '自营仓',
  THIRD_PARTY: '第三方仓',
};

export interface OverseasWarehouse {
  id: string;
  code: string;
  name: string;
  type?: string;
  country: string;
  region?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  contactName?: string | null;
  isActive: boolean;
  skuCount: number;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  createdAt: string;
}

export interface LedgerItem {
  id: string;
  productId: string;
  warehouseId: string;
  sku: string;
  fnsku?: string | null;
  asin?: string | null;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  product: { id: string; name: string; sku: string } | null;
}

export interface LedgerSummary {
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
}

export interface Movement {
  id: string;
  productId: string;
  warehouse: string;
  overseasWarehouseId: string | null;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string } | null;
}

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  IN: '入库',
  OUT: '出库',
  ADJUSTMENT: '调整',
  TRANSFER: '调拨',
  RETURN: '退货',
};

export const MOVEMENT_TYPE_COLOR: Record<string, string> = {
  IN: 'bg-green-100 text-green-800',
  OUT: 'bg-orange-100 text-orange-800',
  ADJUSTMENT: 'bg-purple-100 text-purple-800',
  TRANSFER: 'bg-blue-100 text-blue-800',
  RETURN: 'bg-gray-100 text-gray-700',
};

/** 流水来源类型 → 中文（含差异调整的三类 referenceType） */
export function referenceLabel(referenceType?: string | null): string {
  if (!referenceType) return '-';
  const map: Record<string, string> = {
    STOCK_TRANSFER: '调拨单',
    OVERSEAS_ADJUST_LOST: '丢件调整',
    OVERSEAS_ADJUST_PLATFORM_DIFF: '平台差异调整',
    OVERSEAS_ADJUST_OTHER: '手工调整',
    INBOUND_ORDER: '采购入库',
    OUTBOUND_ORDER: '出库单',
  };
  return map[referenceType] ?? referenceType;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
