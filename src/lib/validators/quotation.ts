import { z } from 'zod';

// 报价单状态枚举
export const quotationStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);

// 报价单项创建验证器
export const quotationItemCreateSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, '产品名称必填'),
  specification: z.string().optional(),
  quantity: z.number().int().positive('数量必须为正整数'),
  unitPrice: z.number().nonnegative('单价不能为负数'),
  notes: z.string().optional(),
});

// 报价单创建验证器
export const quotationCreateSchema = z.object({
  customerId: z.string().min(1, '客户 ID 必填'),
  inquiryId: z.string().optional(),
  currency: z.string().default('USD'),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  validityDays: z.number().int().positive().default(30),
  notes: z.string().optional(),
  items: z.array(quotationItemCreateSchema).min(1, '报价单至少需要一项商品'),
});

// 报价单更新验证器
export const quotationUpdateSchema = z.object({
  customerId: z.string().optional(),
  inquiryId: z.string().optional(),
  status: quotationStatusSchema.optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  validityDays: z.number().int().positive().optional(),
  notes: z.string().optional(),
  items: z.array(quotationItemCreateSchema).optional(),
});

// 报价单发送验证器
export const quotationSendSchema = z.object({
  recipientEmails: z.array(z.string().email()).min(1, '至少需要一个收件人'),
  subject: z.string().optional(),
  message: z.string().optional(),
  attachments: z.array(z.string().url()).optional(),
});

// 报价单转订单验证器
export const quotationConvertSchema = z.object({
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  shippingAddress: z.string().optional(),
  shippingContact: z.string().optional(),
  shippingPhone: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

// 报价单列表查询参数验证器
export const quotationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: quotationStatusSchema.optional(),
  customerId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 报价单详情响应 schema
export const quotationDetailResponseSchema = z.object({
  id: z.string(),
  quotationNo: z.string(),
  customerId: z.string(),
  inquiryId: z.string().nullable(),
  status: quotationStatusSchema,
  currency: z.string(),
  paymentTerms: z.string().nullable(),
  deliveryTerms: z.string().nullable(),
  validityDays: z.number().nullable(),
  notes: z.string().nullable(),
  totalAmount: z.number(),
  customer: z.object({
    id: z.string(),
    companyName: z.string(),
    contactName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  items: z.array(z.object({
    id: z.string(),
    productId: z.string().nullable(),
    productName: z.string(),
    specification: z.string().nullable(),
    quantity: z.number(),
    unitPrice: z.number(),
    amount: z.number(),
    notes: z.string().nullable(),
  })),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 导出类型
export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;
export type QuotationUpdateInput = z.infer<typeof quotationUpdateSchema>;
export type QuotationSendInput = z.infer<typeof quotationSendSchema>;
export type QuotationConvertInput = z.infer<typeof quotationConvertSchema>;
export type QuotationListQuery = z.infer<typeof quotationListQuerySchema>;
export type QuotationItemCreateInput = z.infer<typeof quotationItemCreateSchema>;
