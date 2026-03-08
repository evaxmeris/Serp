// 订单类型定义

// 订单状态
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

// 审批状态
export type ApprovalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

// 生产状态
export type ProductionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELAYED';

// 客户信息
export interface Customer {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
}

// 业务员信息
export interface SalesRep {
  id: string;
  name: string | null;
  email: string | null;
}

// 订单项
export interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productSku: string | null;
  specification: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  amount: number;
  productionStatus: ProductionStatus;
  shippedQty: number;
  deliveredQty: number;
  notes: string | null;
}

// 收款记录
export interface Payment {
  id: string;
  paymentNo: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

// 发货记录
export interface Shipment {
  id: string;
  shipmentNo: string;
  carrier: string | null;
  trackingNo: string | null;
  etd: string | null;
  eta: string | null;
  status: 'PENDING' | 'BOOKED' | 'IN_TRANSIT' | 'SHIPPED' | 'DELIVERED';
}

// 生产记录
export interface ProductionRecord {
  id: string;
  productionNo: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  progress: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
}

// 质检记录
export interface QualityCheck {
  id: string;
  qcNo: string;
  type: 'RAW_MATERIAL' | 'IN_PROCESS' | 'FINAL' | 'PRE_SHIPMENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'CONDITIONAL';
  inspectionDate: string | null;
}

// 订单详情
export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customer: Customer;
  sourceInquiryId: string | null;
  sourceQuotationId: string | null;
  status: OrderStatus;
  approvalStatus: ApprovalStatus;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentTerms: string | null;
  paymentDeadline: string | null;
  deliveryTerms: string | null;
  deliveryDate: string | null;
  deliveryDeadline: string | null;
  shippingAddress: string | null;
  shippingContact: string | null;
  shippingPhone: string | null;
  salesRepId: string | null;
  salesRep: SalesRep | null;
  notes: string | null;
  internalNotes: string | null;
  attachments: string[];
  items: OrderItem[];
  payments: Payment[];
  shipments: Shipment[];
  productionRecords: ProductionRecord[];
  qualityChecks: QualityCheck[];
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// 订单列表项（简化版）
export interface OrderListItem {
  id: string;
  orderNo: string;
  customer: {
    id: string;
    companyName: string;
    contactName: string | null;
  };
  status: OrderStatus;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  deliveryDate: string | null;
  salesRep: SalesRep | null;
  itemCount: number;
  paymentCount: number;
  shipmentCount: number;
  createdAt: string;
}

// 订单列表查询参数
export interface OrderListQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  customerId?: string;
  salesRepId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 订单列表响应
export interface OrderListResponse {
  data: OrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 创建订单输入
export interface OrderCreateInput {
  customerId: string;
  sourceInquiryId?: string;
  sourceQuotationId?: string;
  currency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  paymentDeadline?: string;
  deliveryTerms?: string;
  deliveryDate?: string;
  deliveryDeadline?: string;
  shippingAddress?: string;
  shippingContact?: string;
  shippingPhone?: string;
  salesRepId?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
  items: OrderItemInput[];
}

// 订单项输入
export interface OrderItemInput {
  productId?: string;
  productName?: string;
  productSku?: string;
  specification?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountRate?: number;
  notes?: string;
}

// 更新订单输入
export interface OrderUpdateInput {
  status?: OrderStatus;
  approvalStatus?: ApprovalStatus;
  currency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  paymentDeadline?: string;
  deliveryTerms?: string;
  deliveryDate?: string;
  deliveryDeadline?: string;
  shippingAddress?: string;
  shippingContact?: string;
  shippingPhone?: string;
  salesRepId?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
}

// 订单状态标签配置
export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string }
> = {
  PENDING: { label: '待确认', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '已确认', color: 'bg-blue-100 text-blue-800' },
  IN_PRODUCTION: { label: '生产中', color: 'bg-purple-100 text-purple-800' },
  READY: { label: '待发货', color: 'bg-green-100 text-green-800' },
  SHIPPED: { label: '已发货', color: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: '已送达', color: 'bg-teal-100 text-teal-800' },
  COMPLETED: { label: '已完成', color: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-800' },
};

// 审批状态标签配置
export const APPROVAL_STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; color: string }
> = {
  NOT_REQUIRED: { label: '无需审批', color: 'bg-gray-100 text-gray-800' },
  PENDING: { label: '待审批', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '已批准', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
};
