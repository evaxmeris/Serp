/**
 * Dashboard API 类型定义
 * 
 * 用于替换 `any` 类型，提供完整的类型安全
 * 
 * @module types/dashboard
 */

// ============================================
// 通用查询参数类型
// ============================================

/**
 * Dashboard 查询参数接口
 */
export interface DashboardQueryParams {
  /** 统计天数 (默认 30) */
  days?: number;
  /** 统计周期: day | week | month */
  period?: 'day' | 'week' | 'month';
}

/**
 * 日期范围接口
 */
export interface DateRange {
  gte?: Date;
  lte?: Date;
}

// ============================================
// 客户统计相关类型
// ============================================

/**
 * 客户汇总统计
 */
export interface CustomerSummary {
  /** 客户总数 */
  totalCustomers: number;
  /** 新增客户数 */
  newCustomers: number;
  /** 活跃客户数 */
  activeCustomers: number;
  /** 非活跃客户数 */
  inactiveCustomers: number;
}

/**
 * 客户增长趋势项
 */
export interface CustomerGrowthTrendItem {
  /** 日期 (ISO 字符串) */
  date: string;
  /** 新增客户数 */
  newCustomers: number;
}

/**
 * TOP 客户信息
 */
export interface TopCustomer {
  /** 客户 ID */
  id: string;
  /** 公司名称 */
  companyName: string | null;
  /** 联系人姓名 */
  contactName: string | null;
  /** 国家/地区 */
  country: string | null;
  /** 订单数量 */
  orderCount: number;
  /** 总收入 */
  totalRevenue: number;
  /** 平均订单金额 */
  avgOrderValue: number;
}

/**
 * 地区分布项
 */
export interface RegionDistributionItem {
  /** 国家/地区 */
  country: string;
  /** 客户数量 */
  customerCount: number;
}

/**
 * 来源分布项
 */
export interface SourceDistributionItem {
  /** 来源渠道 */
  source: string;
  /** 客户数量 */
  customerCount: number;
}

/**
 * 客户统计数据响应
 */
export interface CustomerStatsData {
  /** 汇总统计 */
  summary: CustomerSummary;
  /** 增长趋势 */
  growthTrend: CustomerGrowthTrendItem[];
  /** TOP 客户 */
  topCustomers: TopCustomer[];
  /** 地区分布 */
  regionDistribution: RegionDistributionItem[];
  /** 来源分布 */
  sourceDistribution: SourceDistributionItem[];
}

// ============================================
// 订单统计相关类型
// ============================================

/**
 * 订单汇总统计
 */
export interface OrderSummary {
  /** 订单总数 */
  totalOrders: number;
  /** 总收入 */
  totalRevenue: number;
  /** 平均订单金额 */
  avgOrderValue: number;
  /** 待处理订单数 */
  pendingOrders: number;
  /** 已确认订单数 */
  confirmedOrders: number;
  /** 处理中订单数 */
  processingOrders: number;
  /** 已发货订单数 */
  shippedOrders: number;
  /** 已完成订单数 */
  completedOrders: number;
  /** 已取消订单数 */
  cancelledOrders: number;
}

/**
 * 订单状态分布项
 */
export interface OrderStatusDistributionItem {
  /** 订单状态 */
  status: string;
  /** 订单数量 */
  orderCount: number;
  /** 总金额 */
  totalAmount: number;
}

/**
 * 订单趋势项
 */
export interface OrderTrendItem {
  /** 日期 (ISO 字符串) */
  date: string;
  /** 订单数量 */
  orderCount: number;
  /** 总金额 */
  totalAmount: number;
}

/**
 * 转化漏斗数据
 */
export interface ConversionFunnel {
  /** 询盘总数 */
  totalInquiries: number;
  /** 报价总数 */
  totalQuotations: number;
  /** 订单总数 */
  totalOrders: number;
  /** 询盘到报价转化率 (%) */
  inquiryToQuotationRate: number;
  /** 报价到订单转化率 (%) */
  quotationToOrderRate: number;
  /** 询盘到订单转化率 (%) */
  inquiryToOrderRate: number;
}

/**
 * 订单金额区间统计项
 */
export interface OrderAmountRangeItem {
  /** 金额区间 */
  amountRange: string;
  /** 订单数量 */
  orderCount: number;
}

/**
 * 订单统计数据响应
 */
export interface OrderStatsData {
  /** 汇总统计 */
  summary: OrderSummary;
  /** 状态分布 */
  statusDistribution: OrderStatusDistributionItem[];
  /** 订单趋势 */
  orderTrend: OrderTrendItem[];
  /** 转化漏斗 */
  conversion: ConversionFunnel;
  /** 金额区间统计 */
  amountRangeStats: OrderAmountRangeItem[];
}

// ============================================
// 看板总览相关类型
// ============================================

/**
 * 销售核心指标
 */
export interface SalesMetrics {
  /** 订单总数 */
  totalOrders: number;
  /** 总收入 */
  totalRevenue: number;
  /** 平均订单金额 */
  avgOrderValue: number;
  /** 活跃客户数 */
  activeCustomers: number;
  /** 环比增长率 (%) */
  growth: number;
}

/**
 * 客户核心指标
 */
export interface CustomerMetrics {
  /** 客户总数 */
  totalCustomers: number;
  /** 新增客户数 */
  newCustomers: number;
  /** 活跃客户数 */
  activeCustomers: number;
}

/**
 * 产品核心指标
 */
export interface ProductMetrics {
  /** 产品总数 */
  totalProducts: number;
  /** 活跃产品数 */
  activeProducts: number;
  /** 新增产品数 */
  newProducts: number;
}

/**
 * 转化指标
 */
export interface ConversionMetrics {
  /** 询盘总数 */
  totalInquiries: number;
  /** 报价总数 */
  totalQuotations: number;
  /** 订单总数 */
  totalOrders: number;
  /** 询盘到报价转化率 (%) */
  inquiryToQuotationRate: number;
  /** 报价到订单转化率 (%) */
  quotationToOrderRate: number;
}

/**
 * 预警信息
 */
export interface AlertInfo {
  /** 库存预警商品数 */
  lowStockItems: number;
  /** 待处理订单数 */
  pendingOrders: number;
}

/**
 * 统计周期信息
 */
export interface PeriodInfo {
  /** 统计天数 */
  days: number;
  /** 开始日期 (ISO 字符串) */
  startDate: string;
  /** 结束日期 (ISO 字符串) */
  endDate: string;
}

/**
 * 看板总览数据响应
 */
export interface DashboardOverviewData {
  /** 销售指标 */
  sales: SalesMetrics;
  /** 客户指标 */
  customers: CustomerMetrics;
  /** 产品指标 */
  products: ProductMetrics;
  /** 转化指标 */
  conversion: ConversionMetrics;
  /** 预警信息 */
  alerts: AlertInfo;
  /** 统计周期 */
  period: PeriodInfo;
}

// ============================================
// 产品统计相关类型
// ============================================

/**
 * 产品汇总统计
 */
export interface ProductSummary {
  /** 产品总数 */
  totalProducts: number;
  /** 活跃产品数 */
  activeProducts: number;
  /** 非活跃产品数 */
  inactiveProducts: number;
  /** 新增产品数 */
  newProducts: number;
}

/**
 * 产品分类统计项
 */
export interface ProductCategoryStatsItem {
  /** 分类名称 */
  category: string;
  /** 产品数量 */
  productCount: number;
  /** 总销量 */
  totalQuantity: number;
  /** 总收入 */
  totalRevenue: number;
}

/**
 * 畅销产品信息
 */
export interface TopProduct {
  /** 产品 ID */
  id: string;
  /** SKU */
  sku: string | null;
  /** 产品名称 */
  name: string;
  /** 分类 */
  category: string | null;
  /** 销售价 */
  salePrice: number | null;
  /** 订单数量 */
  orderCount: number;
  /** 总销量 */
  totalQuantity: number;
  /** 总收入 */
  totalRevenue: number;
}

/**
 * 库存预警产品信息
 */
export interface LowStockProduct {
  /** 产品 ID */
  id: string;
  /** SKU */
  sku: string | null;
  /** 产品名称 */
  name: string;
  /** 分类 */
  category: string | null;
  /** 当前库存 */
  currentStock: number;
  /** 最低库存 */
  minStock: number;
}

/**
 * 产品价格区间统计项
 */
export interface ProductPriceRangeItem {
  /** 价格区间 */
  priceRange: string;
  /** 产品数量 */
  productCount: number;
}

/**
 * 产品统计数据响应
 */
export interface ProductStatsData {
  /** 汇总统计 */
  summary: ProductSummary;
  /** 分类统计 */
  categoryStats: ProductCategoryStatsItem[];
  /** 畅销产品 */
  topProducts: TopProduct[];
  /** 库存预警产品 */
  lowStockProducts: LowStockProduct[];
  /** 价格区间统计 */
  priceRangeStats: ProductPriceRangeItem[];
}

// ============================================
// 销售统计相关类型
// ============================================

/**
 * 销售汇总统计
 */
export interface SalesSummary {
  /** 订单总数 */
  totalOrders: number;
  /** 总收入 */
  totalRevenue: number;
  /** 平均订单金额 */
  avgOrderValue: number;
  /** 客户总数 */
  totalCustomers: number;
}

/**
 * 销售趋势项
 */
export interface SalesTrendItem {
  /** 日期 (ISO 字符串) */
  date: string;
  /** 订单数量 */
  orderCount: number;
  /** 总金额 */
  totalAmount: number;
  /** 平均金额 */
  avgAmount: number;
}

/**
 * 客户统计项
 */
export interface CustomerStatItem {
  /** 日期 (ISO 字符串) */
  date: string;
  /** 客户数量 */
  customerCount: number;
  /** 订单数量 */
  orderCount: number;
}

/**
 * 畅销产品项
 */
export interface TopSalesProduct {
  /** 产品名称 */
  productName: string;
  /** 分类 */
  category: string | null;
  /** 销量 */
  quantity: number;
  /** 收入 */
  revenue: number;
}

/**
 * 销售统计数据响应
 */
export interface SalesStatsData {
  /** 汇总统计 */
  summary: SalesSummary;
  /** 销售趋势 */
  trends: SalesTrendItem[];
  /** 客户统计 */
  customers: CustomerStatItem[];
  /** 畅销产品 */
  topProducts: TopSalesProduct[];
}

// ============================================
// API 响应通用类型
// ============================================

/**
 * 成功响应
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

/**
 * Dashboard API 响应类型
 */
export type DashboardResponse<T> = SuccessResponse<T> | ErrorResponse;
