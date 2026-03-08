/**
 * 采购管理类型定义
 * Purchase Management Type Definitions
 */

// ============================================
// 供应商相关类型
// Supplier Types
// ============================================

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | 'PENDING';
export type SupplierType = 'DOMESTIC' | 'OVERSEAS';
export type SupplierLevel = 'STRATEGIC' | 'PREFERRED' | 'NORMAL' | 'RESTRICTED';

export interface Supplier {
  id: string;
  supplierNo: string;
  companyName: string;
  companyEn?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  businessLicense?: string;
  bankName?: string;
  bankAccount?: string;
  bankCode?: string;
  products?: string;
  categories?: string[];
  status: SupplierStatus;
  type: SupplierType;
  level: SupplierLevel;
  score?: number;
  creditTerms?: string;
  paymentMethods?: string[];
  currency?: string;
  minOrderAmount?: number;
  ownerId?: string;
  notes?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    purchaseOrders: number;
  };
}

export interface CreateSupplierInput {
  companyName: string;
  companyEn?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  businessLicense?: string;
  bankName?: string;
  bankAccount?: string;
  bankCode?: string;
  products?: string;
  categories?: string[];
  status?: SupplierStatus;
  type?: SupplierType;
  level?: SupplierLevel;
  score?: number;
  creditTerms?: string;
  paymentMethods?: string[];
  currency?: string;
  minOrderAmount?: number;
  ownerId?: string;
  notes?: string;
  attachments?: string[];
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {}

export interface SupplierQueryParams {
  page?: number;
  limit?: number;
  status?: SupplierStatus;
  type?: SupplierType;
  level?: SupplierLevel;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// 采购订单相关类型
// Purchase Order Types
// ============================================

export type PurchaseOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'READY'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PurchaseOrderItem {
  id?: string;
  productId?: string;
  productName: string;
  productSku?: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  amount?: number;
  taxAmount?: number;
  expectedDeliveryDate?: string;
  notes?: string;
  product?: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string;
  salesOrderId?: string;
  status: PurchaseOrderStatus;
  approvalStatus: ApprovalStatus;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  deliveryDate?: string;
  deliveryDeadline?: string;
  deliveryAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  paymentDeadline?: string;
  purchaserId?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    companyName: string;
    companyEn?: string;
    contactName?: string;
    email?: string;
    phone?: string;
  };
  purchaser?: {
    id: string;
    name: string;
    email: string;
  };
  salesOrder?: {
    id: string;
    orderNo: string;
    customerId: string;
  };
  items: PurchaseOrderItem[];
  _count?: {
    items: number;
    receipts: number;
  };
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  salesOrderId?: string;
  currency?: string;
  exchangeRate?: number;
  deliveryDate?: string;
  deliveryDeadline?: string;
  deliveryAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  paymentDeadline?: string;
  purchaserId?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
  items: Array<{
    productId?: string;
    productName: string;
    productSku?: string;
    specification?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    discountRate?: number;
    taxRate?: number;
    expectedDeliveryDate?: string;
    notes?: string;
  }>;
}

export interface UpdatePurchaseOrderInput {
  supplierId?: string;
  salesOrderId?: string;
  currency?: string;
  exchangeRate?: number;
  status?: PurchaseOrderStatus;
  approvalStatus?: ApprovalStatus;
  deliveryDate?: string;
  deliveryDeadline?: string;
  deliveryAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  paymentDeadline?: string;
  purchaserId?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
}

export interface PurchaseOrderQueryParams {
  page?: number;
  limit?: number;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  salesOrderId?: string;
  purchaserId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// API 响应类型
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// 表单类型
// Form Types
// ============================================

export interface SupplierFormData {
  companyName: string;
  companyEn?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  country?: string;
  address?: string;
  website?: string;
  products?: string;
  creditTerms?: string;
  notes?: string;
}

export interface PurchaseOrderFormData {
  supplierId: string;
  currency: string;
  exchangeRate: number;
  deliveryDate?: string;
  deliveryDeadline?: string;
  deliveryAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  paymentDeadline?: string;
  purchaserId?: string;
  notes?: string;
  internalNotes?: string;
  items: Array<{
    productId?: string;
    productName: string;
    productSku?: string;
    specification?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discountRate: number;
    taxRate: number;
    notes?: string;
  }>;
}

export interface PurchaseOrderTotals {
  subtotal: number;
  tax: number;
  total: number;
}
