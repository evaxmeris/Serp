import { z } from 'zod';

// 订单状态枚举
export const orderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
]);

// 审批状态枚举
export const approvalStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

// 订单项创建验证器
export const orderItemCreateSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().optional(),
  productSku: z.string().optional(),
  specification: z.string().optional(),
  quantity: z.number().int().positive('数量必须为正整数'),
  unit: z.string().default('PCS'),
  unitPrice: z.number().nonnegative('单价不能为负数'),
  discountRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

// 订单创建验证器
export const orderCreateSchema = z.object({
  customerId: z.string().min(1, '客户 ID 必填'),
  sourceInquiryId: z.string().optional(),
  sourceQuotationId: z.string().optional(),
  currency: z.string().default('USD'),
  exchangeRate: z.number().positive().default(1),
  paymentTerms: z.string().optional(),
  paymentDeadline: z.string().datetime().optional(),
  deliveryTerms: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  shippingAddress: z.string().optional(),
  shippingContact: z.string().optional(),
  shippingPhone: z.string().optional(),
  salesRepId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  attachments: z.array(z.string().url()).optional(),
  items: z.array(orderItemCreateSchema).min(1, '订单至少需要一项商品'),
});

// 订单更新验证器
export const orderUpdateSchema = z.object({
  status: orderStatusSchema.optional(),
  approvalStatus: approvalStatusSchema.optional(),
  currency: z.string().optional(),
  exchangeRate: z.number().positive().optional(),
  paymentTerms: z.string().optional(),
  paymentDeadline: z.string().datetime().optional(),
  deliveryTerms: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  shippingAddress: z.string().optional(),
  shippingContact: z.string().optional(),
  shippingPhone: z.string().optional(),
  salesRepId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  attachments: z.array(z.string().url()).optional(),
});

// 订单确认验证器
export const orderConfirmSchema = z.object({
  notes: z.string().optional(),
});

// 订单取消验证器
export const orderCancelSchema = z.object({
  cancelReason: z.string().min(1, '取消原因必填'),
  notes: z.string().optional(),
});

// 订单列表查询参数验证器
export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: orderStatusSchema.optional(),
  customerId: z.string().optional(),
  salesRepId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 订单详情响应 schema
export const orderDetailResponseSchema = z.object({
  id: z.string(),
  orderNo: z.string(),
  customerId: z.string(),
  customer: z.object({
    id: z.string(),
    companyName: z.string(),
    contactName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  sourceInquiryId: z.string().nullable(),
  sourceQuotationId: z.string().nullable(),
  status: orderStatusSchema,
  approvalStatus: approvalStatusSchema,
  currency: z.string(),
  exchangeRate: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  balanceAmount: z.number(),
  paymentTerms: z.string().nullable(),
  paymentDeadline: z.date().nullable(),
  deliveryTerms: z.string().nullable(),
  deliveryDate: z.date().nullable(),
  deliveryDeadline: z.date().nullable(),
  shippingAddress: z.string().nullable(),
  shippingContact: z.string().nullable(),
  shippingPhone: z.string().nullable(),
  salesRepId: z.string().nullable(),
  salesRep: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }).nullable(),
  notes: z.string().nullable(),
  internalNotes: z.string().nullable(),
  attachments: z.array(z.string()),
  confirmedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  items: z.array(z.object({
    id: z.string(),
    productId: z.string().nullable(),
    productName: z.string(),
    productSku: z.string().nullable(),
    specification: z.string().nullable(),
    quantity: z.number(),
    unit: z.string(),
    unitPrice: z.number(),
    discountRate: z.number(),
    amount: z.number(),
    productionStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']),
    shippedQty: z.number(),
    deliveredQty: z.number(),
    notes: z.string().nullable(),
  })),
  payments: z.array(z.object({
    id: z.string(),
    paymentNo: z.string(),
    amount: z.number(),
    currency: z.string(),
    paymentMethod: z.string().nullable(),
    paymentDate: z.date().nullable(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  })),
  shipments: z.array(z.object({
    id: z.string(),
    shipmentNo: z.string(),
    carrier: z.string().nullable(),
    trackingNo: z.string().nullable(),
    status: z.enum(['PENDING', 'BOOKED', 'IN_TRANSIT', 'SHIPPED', 'DELIVERED']),
  })),
  productionRecords: z.array(z.object({
    id: z.string(),
    productionNo: z.string(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']),
    progress: z.number(),
    plannedEndDate: z.date(),
  })),
});

// 导出类型
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type OrderItemCreateInput = z.infer<typeof orderItemCreateSchema>;
