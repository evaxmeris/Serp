/**
 * 统一订单映射器
 * 
 * 将 UnifiedOrder 转换为 Prisma Order 创建/更新数据
 */

import { UnifiedOrder, UnifiedOrderItem } from './types';
import { OrderStatus, PlatformType, type Prisma } from '@prisma/client';

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
  // TOP API 状态（alibaba.seller.order.list/order.get 返回的 trade_status）
  'unpay': OrderStatus.PENDING,
  'paying': OrderStatus.PENDING,
  'paid': OrderStatus.CONFIRMED,
  'relating': OrderStatus.CONFIRMED,
  'captured': OrderStatus.CONFIRMED,
  'undeliver': OrderStatus.CONFIRMED,
  'delivering': OrderStatus.SHIPPED,
  'wait_confirm_receipt': OrderStatus.SHIPPED,
  'trade_success': OrderStatus.COMPLETED,
  'intention_processing': OrderStatus.PENDING,
  'trade_close': OrderStatus.CANCELLED,
  'wait_confirm_modify': OrderStatus.PENDING,
  'charge_back': OrderStatus.CANCELLED,
  'frozen': OrderStatus.PENDING,
  'to_be_audited': OrderStatus.PENDING,
  // 旧兼容
  'TRADE_FINISHED': OrderStatus.COMPLETED,
  'TRADE_CLOSED': OrderStatus.CANCELLED,
  'TRADE_CANCELED': OrderStatus.CANCELLED,
  'WAIT_BUYER_PAY': OrderStatus.PENDING,
  'WAIT_SELLER_SEND_GOODS': OrderStatus.CONFIRMED,
  'WAIT_BUYER_CONFIRM_GOODS': OrderStatus.SHIPPED,
  
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
 * 平台代码 → PlatformOrder.platformType 枚举
 */
export const PLATFORM_TYPE_MAP: Record<string, PlatformType> = {
  alibaba: PlatformType.ALIBABA,
  alibaba_1688: PlatformType.ALIBABA_1688,
  amazon: PlatformType.AMAZON,
  tiktok: PlatformType.TIKTOK,
  shopify: PlatformType.SHOPIFY,
  wish: PlatformType.WISH,
  ebay: PlatformType.EBAY,
};

export function resolvePlatformType(platformCode: string): PlatformType {
  return PLATFORM_TYPE_MAP[platformCode?.toLowerCase()] || PlatformType.OTHER;
}

/**
 * 支付状态推导（零售镜像单没有独立的支付字段来源，用金额推算）
 */
function resolvePaymentStatus(order: UnifiedOrder): string {
  if (order.totalAmount <= 0) return 'UNPAID';
  if (order.paidAmount >= order.totalAmount) return 'PAID';
  if (order.paidAmount > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
}

/**
 * 将统一订单映射为 PlatformOrder 镜像表字段（零售单专用）
 *
 * 注意：这里不创建 Customer，也不创建 B2B Order——零售单只做平台数据镜像。
 *
 * @param order 统一订单
 * @param platformAccountId 平台账号 ID（PlatformAccount 外键，必需）
 * @param marketplaceId 站点/市场标识
 */
export function mapUnifiedOrderToPlatformOrder(
  order: UnifiedOrder,
  platformAccountId: string,
  marketplaceId?: string
): Prisma.PlatformOrderUncheckedCreateInput {
  return {
    platformOrderId: order.platformOrderId,
    platformOrderSn: order.orderNo || order.platformOrderId,
    platformCode: order.platformCode,
    marketplaceId: marketplaceId || order.marketplaceId || null,
    platformAccountId,
    platformType: resolvePlatformType(order.platformCode),
    buyerName: order.customer?.contactName || order.customer?.companyName || null,
    buyerEmail: order.customer?.email || null,
    buyerPhone: order.customer?.phone || null,
    status: order.status,
    paymentStatus: resolvePaymentStatus(order),
    orderDate: order.createdAt,
    orderedAt: order.createdAt,
    currency: order.currency || 'USD',
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingInfo?.address
      ? {
          address: order.shippingInfo.address,
          trackingNumber: order.shippingInfo.trackingNumber || null,
          carrier: order.shippingInfo.carrier || null,
          country: order.customer?.country || null,
        }
      : order.customer?.country
        ? { country: order.customer.country }
        : undefined,
    buyerMessage: order.buyerMemo || null,
    notes: order.sellerMemo || null,
    items: order.items.map(item => ({
      platformProductId: item.platformProductId,
      productName: item.productName,
      sku: item.sku || null,
      specification: item.specification || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      currency: item.currency || order.currency || 'USD',
      imageUrl: item.imageUrl || null,
    })),
    rawData: order.rawData ?? undefined,
    syncVersion: 1,
  };
}

/**
 * 已存在的零售单需要更新的字段（状态/金额随平台变化）
 */
export function mapUnifiedOrderToPlatformOrderUpdate(
  order: UnifiedOrder,
  marketplaceId?: string
): Prisma.PlatformOrderUncheckedUpdateInput {
  return {
    platformOrderSn: order.orderNo || order.platformOrderId,
    marketplaceId: marketplaceId || order.marketplaceId || null,
    buyerName: order.customer?.contactName || order.customer?.companyName || null,
    buyerEmail: order.customer?.email || null,
    buyerPhone: order.customer?.phone || null,
    status: order.status,
    paymentStatus: resolvePaymentStatus(order),
    orderedAt: order.createdAt,
    currency: order.currency || 'USD',
    totalAmount: order.totalAmount,
    items: order.items.map(item => ({
      platformProductId: item.platformProductId,
      productName: item.productName,
      sku: item.sku || null,
      specification: item.specification || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      currency: item.currency || order.currency || 'USD',
      imageUrl: item.imageUrl || null,
    })),
    rawData: order.rawData ?? undefined,
    syncVersion: { increment: 1 },
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
