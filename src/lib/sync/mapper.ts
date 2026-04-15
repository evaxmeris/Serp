/**
 * 统一订单映射器
 * 
 * 将 UnifiedOrder 转换为 Prisma Order 创建/更新数据
 */

import { UnifiedOrder, UnifiedOrderItem } from './types';
import { OrderStatus, type Prisma } from '@prisma/client';

/**
 * 平台状态 → ERP 订单状态映射
 * 
 * 各平台可以有自己的状态，这里定义通用映射
 */
const STATUS_MAP: Record<string, OrderStatus> = {
  // 通用状态
  'PENDING': OrderStatus.PENDING,
  'CONFIRMED': OrderStatus.CONFIRMED,
  'PROCESSING': OrderStatus.CONFIRMED,
  'SHIPPED': OrderStatus.SHIPPED,
  'DELIVERED': OrderStatus.COMPLETED,
  'COMPLETED': OrderStatus.COMPLETED,
  'FINISHED': OrderStatus.COMPLETED,
  'CANCELLED': OrderStatus.CANCELLED,
  'CANCELED': OrderStatus.CANCELLED,
  'CLOSED': OrderStatus.CANCELLED,
  'REFUNDED': OrderStatus.CANCELLED,
  
  // 阿里国际站特定状态
  'WAIT_BUYER_PAY': OrderStatus.PENDING,
  'WAIT_SELLER_SEND_GOODS': OrderStatus.CONFIRMED,
  'WAIT_BUYER_CONFIRM_GOODS': OrderStatus.SHIPPED,
  'TRADE_FINISHED': OrderStatus.COMPLETED,
  'TRADE_CLOSED': OrderStatus.CANCELLED,
  'TRADE_CANCELED': OrderStatus.CANCELLED,
  
  // TikTok Shop 特定状态（预留）
  'UNPAID': OrderStatus.PENDING,
  'AWAITING_SHIPMENT': OrderStatus.CONFIRMED,
  'IN_TRANSIT': OrderStatus.SHIPPED,
  
  // Amazon 特定状态（预留）
  'Pending': OrderStatus.PENDING,
  'Unshipped': OrderStatus.CONFIRMED,
  'PartiallyShipped': OrderStatus.SHIPPED,
  'Canceled': OrderStatus.CANCELLED,
  'Unfulfillable': OrderStatus.CANCELLED,
  
  // Shopify 特定状态（预留）
  'open': OrderStatus.PENDING,
  'paid': OrderStatus.CONFIRMED,
  'fulfilled': OrderStatus.SHIPPED,
  'partially_fulfilled': OrderStatus.SHIPPED,
};

/**
 * 映射统一订单为 ERP 订单创建数据
 * 
 * @param order 统一订单
 * @param customerId 关联的客户 ID
 * @returns Prisma Order 创建数据
 */
export function mapUnifiedOrderToERP(
  order: UnifiedOrder,
  customerId: string
): Prisma.OrderCreateInput {
  const erpStatus = STATUS_MAP[order.status] || OrderStatus.PENDING;
  
  return {
    orderNo: order.orderNo,
    customer: {
      connect: { id: customerId },
    },
    status: erpStatus,
    currency: order.currency,
    exchangeRate: 1,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    balanceAmount: order.totalAmount - order.paidAmount,
    deliveryDate: order.createdAt,
    shippingAddress: order.shippingInfo?.address || order.customer.address || undefined,
    notes: order.sellerMemo || undefined,
    internalNotes: order.buyerMemo || undefined,
    items: {
      create: order.items.map(item => mapOrderItem(item)),
    },
    // 标记来源平台
    sourcePlatform: order.platformCode,
    platformOrderId: order.platformOrderId,
    platformData: order.rawData || undefined,
  };
}

/**
 * 映射订单明细
 * 
 * @param item 统一订单明细
 * @returns Prisma OrderItem 创建数据
 */
function mapOrderItem(item: UnifiedOrderItem): Prisma.OrderItemCreateWithoutOrderInput {
  return {
    productName: item.productName,
    productSku: item.sku || item.platformProductId,
    specification: item.specification || undefined,
    quantity: item.quantity,
    unit: item.unit || 'PCS',
    unitPrice: item.unitPrice,
    discountRate: 0,
    amount: item.amount,
    productImage: item.imageUrl || undefined,
    originCountry: 'CN',
  };
}

/**
 * 更新 ERP 订单状态
 * 
 * @param currentStatus 当前 ERP 状态
 * @param platformStatus 平台订单状态
 * @returns 新的 ERP 状态
 */
export function updateOrderStatus(
  currentStatus: OrderStatus,
  platformStatus: string
): OrderStatus {
  const newStatus = STATUS_MAP[platformStatus];
  
  if (!newStatus) {
    return currentStatus;
  }
  
  // 定义状态推进顺序
  const statusOrder: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.SHIPPED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ];
  
  const currentIndex = statusOrder.indexOf(currentStatus);
  const newIndex = statusOrder.indexOf(newStatus);
  
  // 只允许状态向前推进（防止回退）
  if (newIndex > currentIndex) {
    return newStatus;
  }
  
  return currentStatus;
}
