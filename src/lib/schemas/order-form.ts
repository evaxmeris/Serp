import { z } from 'zod';

// 订单项表单 schema
export const orderItemFormSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, '产品名称必填'),
  productSku: z.string().optional(),
  specification: z.string().optional(),
  quantity: z.number().int().positive('数量必须为正整数'),
  unit: z.string().default('PCS'),
  unitPrice: z.number().nonnegative('单价不能为负数'),
  discountRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

// 订单表单 schema
export const orderFormSchema = z.object({
  customerId: z.string().min(1, '客户必填'),
  currency: z.string().default('USD'),
  exchangeRate: z.number().positive().default(1),
  paymentTerms: z.string().optional(),
  paymentDeadline: z.string().optional(),
  deliveryTerms: z.string().optional(),
  deliveryDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingContact: z.string().optional(),
  shippingPhone: z.string().optional(),
  salesRepId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  items: z.array(orderItemFormSchema).min(1, '订单至少需要一项商品'),
});

// 订单类型
export type OrderFormValues = z.infer<typeof orderFormSchema>;
export type OrderItemFormValues = z.infer<typeof orderItemFormSchema>;
