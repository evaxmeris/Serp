/**
 * 多平台订单同步框架 - 类型定义
 * 
 * 定义统一的订单格式和平台接口
 * 支持：阿里国际站、TikTok Shop、Amazon、Shopify 等
 */

// ============================================
// 统一订单格式（所有平台转换为这种格式）
// ============================================

export interface UnifiedOrder {
  // 平台信息
  platformCode: string;      // 'alibaba', 'tiktok', 'amazon', 'shopify'
  platformOrderId: string;   // 平台原始订单号
  
  // 订单基本信息
  orderNo: string;           // ERP 订单号（由系统生成）
  status: string;            // 统一状态（见 OrderStatus 映射）
  currency: string;          // 币种
  totalAmount: number;       // 总金额
  paidAmount: number;        // 已付金额
  
  // 时间信息
  createdAt: Date;
  updatedAt: Date;
  
  // 客户信息
  customer: {
    email?: string;
    companyName?: string;
    contactName?: string;
    phone?: string;
    country?: string;
    address?: string;
  };
  
  // 订单明细
  items: UnifiedOrderItem[];
  
  // 物流信息
  shippingInfo?: {
    trackingNumber?: string;
    carrier?: string;
    address?: string;
  };
  
  // 备注
  sellerMemo?: string;
  buyerMemo?: string;
  
  // 原始数据（用于调试）
  rawData?: any;
}

export interface UnifiedOrderItem {
  platformProductId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
  imageUrl?: string;
  specification?: string;
  unit?: string;
}

// ============================================
// 平台适配器接口
// ============================================

export interface PlatformAdapter {
  // 平台标识
  readonly platformCode: string;  // 'alibaba', 'tiktok', 'amazon', 'shopify'
  readonly platformName: string;  // '阿里国际站', 'TikTok Shop', 'Amazon', 'Shopify'
  
  // 认证
  authenticate(config: PlatformConfig): Promise<AuthResult>;
  
  // 订单同步
  fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]>;
  fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder>;
  
  // 可选：Webhook 支持
  handleWebhook?(payload: any, config: PlatformConfig): Promise<UnifiedOrder | null>;
  
  // 可选：订单状态更新（从 ERP 推送到平台）
  updateOrderStatus?(orderId: string, status: string, config: PlatformConfig): Promise<void>;
}

// ============================================
// 认证相关
// ============================================

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

// ============================================
// 查询参数
// ============================================

export interface FetchOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  createdAtStart?: Date;
  createdAtEnd?: Date;
}

// ============================================
// 平台配置
// ============================================

export interface PlatformConfig {
  id: string;
  platformCode: string;
  enabled: boolean;
  syncIntervalMin: number;
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

// ============================================
// 同步结果
// ============================================

export interface SyncResult {
  platformCode: string;
  status: 'success' | 'failed' | 'partial';
  ordersFound: number;
  ordersSynced: number;
  ordersFailed: number;
  errors?: string[];
  durationMs: number;
}

// ============================================
// 平台状态
// ============================================

export interface PlatformStatus {
  code: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  nextSyncAt?: Date;
}

// ============================================
// 平台注册表
// ============================================

export interface PlatformRegistry {
  register(adapter: PlatformAdapter): void;
  get(platformCode: string): PlatformAdapter | undefined;
  getAll(): PlatformAdapter[];
  getAvailablePlatforms(): string[];
}
