/**
 * 采购工具函数
 * 提供采购订单相关的计算辅助功能
 */

/**
 * 采购订单项 (PurchaseOrderItem) 的最小接口定义
 * 只需包含计算 pendingQty 所需的字段
 */
export interface PurchaseOrderItemLike {
  quantity: number;
  receivedQty: number;
  rejectedQty: number;
}

/**
 * 动态计算采购订单项的待处理数量
 * pendingQty = quantity - receivedQty - rejectedQty
 *
 * 替代数据库中的 pendingQty 字段，确保数据一致性
 *
 * @param poItem - 采购订单项，需包含 quantity、receivedQty、rejectedQty
 * @returns 待处理数量（不会为负数，最小返回 0）
 *
 * @example
 * const pending = getPendingQty({ quantity: 100, receivedQty: 30, rejectedQty: 5 });
 * // => 65
 */
export function getPendingQty(poItem: PurchaseOrderItemLike): number {
  return Math.max(0, poItem.quantity - poItem.receivedQty - poItem.rejectedQty);
}
