import { z } from 'zod';

export const SupplierStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'BLACKLISTED',
  'PENDING',
]);

export const SupplierTypeSchema = z.enum(['DOMESTIC', 'OVERSEAS']);

export const SupplierLevelSchema = z.enum([
  'STRATEGIC',
  'PREFERRED',
  'NORMAL',
  'RESTRICTED',
]);

export const CreateSupplierSchema = z.object({
  companyName: z.string().min(1, '公司名称不能为空'),
  companyEn: z.string().optional(),
  contactName: z.string().optional(),
  contactTitle: z.string().optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().default('CN'),
  postalCode: z.string().optional(),
  website: z.string().url('网址格式不正确').optional().or(z.literal('')),
  taxId: z.string().optional(),
  businessLicense: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankCode: z.string().optional(),
  products: z.string().optional(),
  categories: z.array(z.string()).optional().default([]),
  status: SupplierStatusSchema.optional().default('ACTIVE'),
  type: SupplierTypeSchema.optional().default('DOMESTIC'),
  level: SupplierLevelSchema.optional().default('NORMAL'),
  score: z.number().min(0).max(5).optional(),
  creditTerms: z.string().optional(),
  paymentMethods: z.array(z.string()).optional().default([]),
  currency: z.string().default('CNY'),
  minOrderAmount: z.number().nonnegative().optional(),
  ownerId: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional().default([]),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export const SupplierQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: SupplierStatusSchema.optional(),
  type: SupplierTypeSchema.optional(),
  level: SupplierLevelSchema.optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const SupplierIdSchema = z.object({
  id: z.string().cuid('无效的供应商 ID'),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type SupplierQueryInput = z.infer<typeof SupplierQuerySchema>;
