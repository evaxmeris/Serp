import { z } from 'zod';

export const PurchaseOrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED',
]);

export const ApprovalStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const PurchaseOrderItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, '产品名称不能为空'),
  productSku: z.string().optional(),
  specification: z.string().optional(),
  unit: z.string().default('PCS'),
  quantity: z.number().int().positive('数量必须为正整数'),
  unitPrice: z.number().nonnegative('单价不能为负数'),
  discountRate: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  expectedDeliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().cuid('无效的供应商 ID'),
  salesOrderId: z.string().optional(),
  currency: z.string().default('CNY'),
  exchangeRate: z.number().positive().default(1),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  deliveryAddress: z.string().optional(),
  shippingMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  paymentDeadline: z.string().datetime().optional(),
  purchaserId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  attachments: z.array(z.string()).optional().default([]),
  items: z
    .array(PurchaseOrderItemSchema)
    .min(1, '采购订单至少需要一项商品'),
});

// Update schema excludes items (they need separate handling)
export const UpdatePurchaseOrderSchema = z.object({
  supplierId: z.string().cuid().optional(),
  salesOrderId: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.number().positive().optional(),
  status: PurchaseOrderStatusSchema.optional(),
  approvalStatus: ApprovalStatusSchema.optional(),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  deliveryAddress: z.string().optional(),
  shippingMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  paymentDeadline: z.string().datetime().optional(),
  purchaserId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const PurchaseOrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: PurchaseOrderStatusSchema.optional(),
  supplierId: z.string().optional(),
  salesOrderId: z.string().optional(),
  purchaserId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const PurchaseOrderIdSchema = z.object({
  id: z.string().cuid('无效的采购订单 ID'),
});

export const UpdatePurchaseOrderStatusSchema = z.object({
  status: PurchaseOrderStatusSchema,
  notes: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<
  typeof CreatePurchaseOrderSchema
>;
export type UpdatePurchaseOrderInput = z.infer<
  typeof UpdatePurchaseOrderSchema
>;
export type PurchaseOrderQueryInput = z.infer<
  typeof PurchaseOrderQuerySchema
>;
export type PurchaseOrderItemInput = z.infer<typeof PurchaseOrderItemSchema>;
