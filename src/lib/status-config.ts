/**
 * 统一状态/颜色配置模块
 *
 * 解决问题：UI 审计报告 UI P0 #3 - "状态/颜色映射大量重复"
 *
 * 所有页面的状态标签和颜色集中在此配置，确保：
 * 1. 相同语义的状态使用统一颜色
 * 2. 避免各页面重复定义 STATUS_COLORS / getStatusBadge / getStatusText
 * 3. 颜色严格遵守 Tailwind 语义约定：
 *    - 草稿/归档 = gray
 *    - 待处理 = yellow/amber
 *    - 进行中 = blue
 *    - 已完成/已发货 = green
 *    - 已取消/丢失 = red
 *
 * @module lib/status-config
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 支持的实体类型 */
export type EntityType =
  | 'order'
  | 'purchaseOrder'
  | 'inboundOrder'
  | 'outboundOrder'
  | 'purchase'
  | 'inquiry'
  | 'productResearch';

/** 状态配置项 */
export interface StatusConfig {
  label: string;
  color: string;
}

// ============================================================================
// 统一颜色常量（Tailwind CSS 类名）
// ============================================================================

const COLOR = {
  /** 草稿 / 归档 / 中性 */
  GRAY: 'bg-gray-100 text-gray-800',
  /** 待处理 / 警告 */
  YELLOW: 'bg-yellow-100 text-yellow-800',
  /** 进行中 / 处理中 */
  BLUE: 'bg-blue-100 text-blue-800',
  /** 已完成 / 成功 */
  GREEN: 'bg-green-100 text-green-800',
  /** 已取消 / 失败 */
  RED: 'bg-red-100 text-red-800',
  /** 回退颜色 */
  FALLBACK: 'bg-gray-100 text-gray-800',
} as const;

// ============================================================================
// 各实体状态配置
// ============================================================================

/**
 * 销售订单状态
 * 来源: src/types/order.ts (ORDER_STATUS_CONFIG) + src/app/orders/page.tsx
 */
const ORDER_STATUS: Record<string, StatusConfig> = {
  PENDING:        { label: '待确认',   color: COLOR.YELLOW },
  CONFIRMED:      { label: '已确认',   color: COLOR.BLUE },
  IN_PRODUCTION:  { label: '生产中',   color: COLOR.BLUE },
  READY:          { label: '待发货',   color: COLOR.GREEN },
  SHIPPED:        { label: '已发货',   color: COLOR.GREEN },
  DELIVERED:      { label: '已送达',   color: COLOR.GREEN },
  COMPLETED:      { label: '已完成',   color: COLOR.GREEN },
  CANCELLED:      { label: '已取消',   color: COLOR.RED },
};

/**
 * 采购订单状态
 * 来源: src/app/purchase-orders/page.tsx (PO_STATUS + STATUS_COLORS)
 */
const PURCHASE_ORDER_STATUS: Record<string, StatusConfig> = {
  PENDING:        { label: '待确认',   color: COLOR.YELLOW },
  CONFIRMED:      { label: '已确认',   color: COLOR.BLUE },
  IN_PRODUCTION:  { label: '生产中',   color: COLOR.BLUE },
  READY:          { label: '待发货',   color: COLOR.GREEN },
  RECEIVED:       { label: '已收货',   color: COLOR.GREEN },
  COMPLETED:      { label: '已完成',   color: COLOR.GREEN },
  CANCELLED:      { label: '已取消',   color: COLOR.RED },
};

/**
 * 入库单状态
 * 来源: src/app/inbound-orders/page.tsx (INBOUND_STATUS + STATUS_COLORS)
 */
const INBOUND_ORDER_STATUS: Record<string, StatusConfig> = {
  PENDING:   { label: '待入库',   color: COLOR.YELLOW },
  PARTIAL:   { label: '部分入库', color: COLOR.BLUE },
  COMPLETED: { label: '已完成',   color: COLOR.GREEN },
  CANCELLED: { label: '已取消',   color: COLOR.RED },
};

/**
 * 出库单状态
 * 来源: src/app/outbound-orders/page.tsx (OUTBOUND_STATUS + STATUS_COLORS)
 */
const OUTBOUND_ORDER_STATUS: Record<string, StatusConfig> = {
  DRAFT:      { label: '草稿',   color: COLOR.GRAY },
  PENDING:    { label: '待发货', color: COLOR.YELLOW },
  PROCESSING: { label: '处理中', color: COLOR.BLUE },
  PICKED:     { label: '已拣货', color: COLOR.BLUE },
  SHIPPED:    { label: '已发货', color: COLOR.GREEN },
  CANCELLED:  { label: '已取消', color: COLOR.RED },
};

/**
 * 采购单状态
 * 来源: src/app/purchases/page.tsx (PURCHASE_STATUS + STATUS_COLORS)
 */
const PURCHASE_STATUS: Record<string, StatusConfig> = {
  PENDING:        { label: '待确认',   color: COLOR.YELLOW },
  CONFIRMED:      { label: '已确认',   color: COLOR.BLUE },
  IN_PRODUCTION:  { label: '生产中',   color: COLOR.BLUE },
  READY:          { label: '待收货',   color: COLOR.GREEN },
  RECEIVED:       { label: '已收货',   color: COLOR.GREEN },
  COMPLETED:      { label: '已完成',   color: COLOR.GREEN },
  CANCELLED:      { label: '已取消',   color: COLOR.RED },
};

/**
 * 询盘状态
 * 来源: src/app/inquiries/page.tsx (getStatusBadge + getStatusText)
 */
const INQUIRY_STATUS: Record<string, StatusConfig> = {
  NEW:         { label: '新建',   color: COLOR.YELLOW },
  CONTACTED:   { label: '已联系', color: COLOR.BLUE },
  QUOTED:      { label: '已报价', color: COLOR.BLUE },
  NEGOTIATING: { label: '谈判中', color: COLOR.BLUE },
  WON:         { label: '成交',   color: COLOR.GREEN },
  LOST:        { label: '丢失',   color: COLOR.RED },
};

/**
 * 产品调研状态
 * 来源: src/lib/validators/product-research.ts (ProductResearchStatusSchema)
 */
const PRODUCT_RESEARCH_STATUS: Record<string, StatusConfig> = {
  DRAFT:       { label: '草稿',   color: COLOR.GRAY },
  IN_PROGRESS: { label: '进行中', color: COLOR.BLUE },
  COMPLETED:   { label: '已完成', color: COLOR.GREEN },
  ARCHIVED:    { label: '已归档', color: COLOR.GRAY },
};

// ============================================================================
// 实体到状态配置的映射表
// ============================================================================

const STATUS_MAP: Record<EntityType, Record<string, StatusConfig>> = {
  order:           ORDER_STATUS,
  purchaseOrder:   PURCHASE_ORDER_STATUS,
  inboundOrder:    INBOUND_ORDER_STATUS,
  outboundOrder:   OUTBOUND_ORDER_STATUS,
  purchase:        PURCHASE_STATUS,
  inquiry:         INQUIRY_STATUS,
  productResearch: PRODUCT_RESEARCH_STATUS,
};

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 获取状态的中文标签
 *
 * @param entityType - 实体类型
 * @param status     - 状态值（如 'PENDING', 'COMPLETED'）
 * @returns 中文标签；未知状态返回原始 status 值
 *
 * @example
 * getStatusLabel('order', 'PENDING')     // '待确认'
 * getStatusLabel('inquiry', 'WON')       // '成交'
 * getStatusLabel('order', 'UNKNOWN')     // 'UNKNOWN'
 */
export function getStatusLabel(entityType: EntityType, status: string): string {
  const map = STATUS_MAP[entityType];
  if (!map) return status;
  return map[status]?.label ?? status;
}

/**
 * 获取状态的 Tailwind 颜色类名
 *
 * @param entityType - 实体类型
 * @param status     - 状态值（如 'PENDING', 'COMPLETED'）
 * @returns Tailwind CSS 颜色类名字符串；未知状态返回灰色回退值
 *
 * @example
 * getStatusColor('order', 'PENDING')     // 'bg-yellow-100 text-yellow-800'
 * getStatusColor('inquiry', 'LOST')      // 'bg-red-100 text-red-800'
 * getStatusColor('order', 'UNKNOWN')     // 'bg-gray-100 text-gray-800'
 */
export function getStatusColor(entityType: EntityType, status: string): string {
  const map = STATUS_MAP[entityType];
  if (!map) return COLOR.FALLBACK;
  return map[status]?.color ?? COLOR.FALLBACK;
}

/**
 * 获取完整的状态配置（标签 + 颜色）
 *
 * @param entityType - 实体类型
 * @param status     - 状态值
 * @returns StatusConfig 对象；未知状态返回灰色回退值
 *
 * @example
 * getStatusConfig('order', 'COMPLETED')
 * // { label: '已完成', color: 'bg-green-100 text-green-800' }
 */
export function getStatusConfig(
  entityType: EntityType,
  status: string,
): StatusConfig {
  const map = STATUS_MAP[entityType];
  if (!map) return { label: status, color: COLOR.FALLBACK };
  return map[status] ?? { label: status, color: COLOR.FALLBACK };
}

/**
 * 获取实体类型的所有状态列表（用于下拉筛选器等）
 *
 * @param entityType - 实体类型
 * @returns 状态配置数组
 */
export function getStatusList(
  entityType: EntityType,
): (StatusConfig & { value: string })[] {
  const map = STATUS_MAP[entityType];
  if (!map) return [];
  return Object.entries(map).map(([value, config]) => ({
    value,
    ...config,
  }));
}

/**
 * 获取统一的颜色常量（供需要直接引用颜色的组件使用）
 */
export { COLOR };
