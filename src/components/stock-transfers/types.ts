/**
 * 调拨单前端共享类型（对齐 /api/v1/stock-transfers）
 */

export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
export type TransferDirection = 'DOMESTIC_TO_OVERSEAS' | 'OVERSEAS_TO_DOMESTIC';

export interface TransferItem {
  id: string;
  productId: string;
  quantity: number;
  shippedQty: number;
  receivedQty: number;
  notes?: string | null;
  product: { id: string; name: string; sku: string } | null;
}

export interface WarehouseRef {
  id: string;
  code: string;
  name: string;
  country?: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  status: TransferStatus;
  direction: TransferDirection;
  items: TransferItem[];
  fromWarehouse: WarehouseRef | null;
  toWarehouse: WarehouseRef | null;
  fromOverseasWarehouse: WarehouseRef | null;
  toOverseasWarehouse: WarehouseRef | null;
  logisticsOrder: { id: string; orderNo: string; status: string; trackingNo?: string | null } | null;
  logisticsOrderId?: string | null;
  notes?: string | null;
  createdAt: string;
  shippedAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
}

export interface StockOption {
  productId: string;
  name: string;
  sku: string;
  available: number;
}

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  DRAFT: '待发货',
  IN_TRANSIT: '在途',
  RECEIVED: '已收货',
  CANCELLED: '已取消',
};

export const TRANSFER_STATUS_COLOR: Record<TransferStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export const DIRECTION_LABEL: Record<TransferDirection, string> = {
  DOMESTIC_TO_OVERSEAS: '国内 → 海外',
  OVERSEAS_TO_DOMESTIC: '海外 → 国内',
};

/** 源仓 / 目标仓（按方向取对应字段） */
export function transferFrom(t: StockTransfer): WarehouseRef | null {
  return t.direction === 'DOMESTIC_TO_OVERSEAS' ? t.fromWarehouse : t.fromOverseasWarehouse;
}

export function transferTo(t: StockTransfer): WarehouseRef | null {
  return t.direction === 'DOMESTIC_TO_OVERSEAS' ? t.toOverseasWarehouse : t.toWarehouse;
}

export function sumQuantity(t: StockTransfer): number {
  return t.items.reduce((sum, i) => sum + i.quantity, 0);
}

export function sumReceived(t: StockTransfer): number {
  return t.items.reduce((sum, i) => sum + i.receivedQty, 0);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
