/**
 * 共享 Zod API 验证 schemas
 * 
 * 所有 API 路由应使用这些 schemas 进行请求参数验证
 */

import { z } from 'zod';

// ==================== 通用查询参数 ====================

/** 分页查询参数 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** 搜索查询参数 */
export const SearchSchema = z.object({
  search: z.string().optional(),
});

/** 状态筛选参数 */
export const StatusFilterSchema = z.object({
  status: z.string().optional(),
});

// ==================== 认证相关 ====================

/** 登录请求 */
export const LoginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').min(1, '邮箱不能为空'),
  password: z.string().min(6, '密码至少 6 个字符').max(128, '密码过长'),
});

/** 注册请求 */
export const RegisterSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 个字符').max(128, '密码过长'),
  name: z.string().min(1, '姓名不能为空').max(100, '姓名过长'),
});

/** 批准/拒绝用户 */
export const ApprovalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

// ==================== 客户管理 ====================

/** 创建客户 */
export const CreateCustomerSchema = z.object({
  companyName: z.string().min(1, '公司名称不能为空').max(200, '公司名称过长'),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('请输入有效的邮箱地址').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxId: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

/** 更新客户 */
export const UpdateCustomerSchema = CreateCustomerSchema.partial();

/** 批量标签 */
export const BatchTagSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, '至少选择一个客户'),
  tags: z.array(z.string()).min(1, '至少添加一个标签'),
});

/** 批量导入 */
export const BatchImportSchema = z.object({
  customers: z.array(z.object({
    companyName: z.string().min(1, '公司名称不能为空'),
    contactName: z.string().max(100).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    website: z.string().max(200).optional(),
    source: z.string().max(100).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).optional(),
    level: z.enum(['NORMAL', 'IMPORTANT', 'STRATEGIC']).optional(),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string()).optional(),
  })).min(1, '至少导入一条数据').max(1000, '单次最多导入 1000 条'),
  mode: z.enum(['create', 'update']).optional().default('create'),
});

// ==================== 供应商管理 ====================

/** 创建供应商 */
export const CreateSupplierSchema = z.object({
  companyName: z.string().min(1, '公司名称不能为空').max(200, '公司名称过长'),
  companyEn: z.string().max(200).optional(),
  contactName: z.string().max(100).optional(),
  contactTitle: z.string().max(100).optional(),
  email: z.string().email('请输入有效的邮箱地址').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  mobile: z.string().max(20).optional(),
  fax: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  website: z.string().url('请输入有效的网址').optional().or(z.literal('')),
  taxId: z.string().max(50).optional(),
  businessLicense: z.string().max(200).optional(),
  bankName: z.string().max(100).optional(),
  bankAccount: z.string().max(50).optional(),
  bankCode: z.string().max(50).optional(),
  products: z.string().max(500).optional(),
  categories: z.array(z.string()).optional(),
  type: z.enum(['DOMESTIC', 'OVERSEAS']).optional(),
  level: z.enum(['NORMAL', 'IMPORTANT', 'STRATEGIC']).optional(),
  score: z.number().min(0).max(5).optional(),
  creditTerms: z.string().max(200).optional(),
  paymentMethods: z.array(z.string()).optional(),
  currency: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).optional(),
});

/** 更新供应商 */
export const UpdateSupplierSchema = CreateSupplierSchema.partial();

// ==================== 产品管理 ====================

/** 创建产品 */
export const CreateProductSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(200, '产品名称过长'),
  sku: z.string().min(1, 'SKU 不能为空').max(100, 'SKU 过长'),
  nameEn: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  specification: z.string().max(2000).optional(),
  description: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  unitPrice: z.number().min(0, '价格不能为负').optional(),
  costPrice: z.number().min(0, '成本价不能为负').optional(),
  salePrice: z.number().min(0, '售价不能为负').optional(),
  currency: z.string().max(10).optional(),
  unit: z.string().max(20).optional(),
  minStock: z.number().int().min(0).optional(),
  moq: z.number().int().min(0).optional(),
  leadTime: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
  volume: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  images: z.array(z.string()).optional(),
  attributes: z.array(z.object({
    attributeId: z.string(),
    valueText: z.string().optional(),
    valueNumber: z.number().optional(),
    valueBoolean: z.boolean().optional(),
    valueDate: z.string().optional(),
    valueOptions: z.array(z.string()).optional(),
    unit: z.string().optional(),
  })).optional(),
});

/** 更新产品 */
export const UpdateProductSchema = CreateProductSchema.partial().extend({
  attributes: z.array(z.object({
    attributeId: z.string(),
    valueText: z.string().optional(),
    valueNumber: z.number().optional(),
    valueBoolean: z.boolean().optional(),
    valueDate: z.string().optional(),
    valueOptions: z.array(z.string()).optional(),
    unit: z.string().optional(),
  })).optional(),
});

// ==================== 采购订单 ====================

/** 创建采购订单 */
export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('供应商 ID 格式不正确'),
  orderDate: z.string().datetime().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  items: z.array(z.object({
    productId: z.string().uuid('产品 ID 格式不正确'),
    quantity: z.number().int().positive('数量必须大于 0'),
    unitPrice: z.number().min(0, '单价不能为负'),
    notes: z.string().optional(),
  })).min(1, '至少需要一项商品'),
  notes: z.string().max(2000).optional(),
  currency: z.string().max(10).optional(),
  totalAmount: z.number().min(0).optional(),
  deliveryDate: z.string().datetime().optional(),
  paymentTerms: z.string().optional(),
  purchaserId: z.string().uuid().optional(),
  status: z.string().optional(),
});

/** 更新采购订单 */
export const UpdatePurchaseOrderSchema = CreatePurchaseOrderSchema.partial();

// ==================== 产品调研 ====================

/** 创建调研产品 */
export const CreateResearchProductSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(200),
  nameEn: z.string().max(200).optional(),
  categoryId: z.string().uuid('品类 ID 格式不正确'),
  brand: z.string().max(100).optional(),
  brandEn: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  manufacturerEn: z.string().max(200).optional(),
  originCountry: z.string().max(10).optional(),
  source: z.string().max(200).optional(),
  sourceUrl: z.string().url('请输入有效的 URL').optional().or(z.literal('')),
  sourcePlatform: z.string().max(100).optional(),
  mainImage: z.string().url().optional().or(z.literal('')),
  images: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'RESEARCHING', 'COMPLETED', 'ARCHIVED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  moq: z.number().int().min(0).optional(),
  leadTime: z.number().int().min(0).optional(),
  specification: z.string().max(2000).optional(),
  weight: z.number().min(0).optional(),
  volume: z.number().min(0).optional(),
  dimensions: z.string().max(100).optional(),
  rating: z.number().min(0).max(5).optional(),
  category: z.string().max(100).optional(),
  attributes: z.array(z.object({
    attributeId: z.string().uuid(),
    valueText: z.string().optional(),
    valueNumber: z.number().optional(),
    valueBoolean: z.boolean().optional(),
    valueDate: z.string().optional(),
    valueOptions: z.array(z.string()).optional(),
    unit: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
});

// ==================== 询盘管理 ====================

/** 创建询盘 */
export const CreateInquirySchema = z.object({
  customerId: z.string().uuid('客户 ID 格式不正确'),
  subject: z.string().min(1, '主题不能为空').max(200, '主题过长'),
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
  status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  deadline: z.string().datetime().optional(),
  source: z.string().max(100).optional(),
  products: z.string().max(500).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  targetPrice: z.coerce.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  requirements: z.string().max(2000).optional(),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

/** 更新询盘 */
export const UpdateInquirySchema = CreateInquirySchema.partial();

// ==================== 报价管理 ====================

/** 创建报价 */
export const CreateQuotationSchema = z.object({
  customerId: z.string().uuid('客户 ID 格式不正确'),
  inquiryId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVISED']).optional(),
  currency: z.string().max(10).optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  validityDays: z.number().int().min(1).optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid('产品 ID 格式不正确'),
    productName: z.string().optional(),
    specification: z.string().optional(),
    quantity: z.number().int().positive('数量必须大于 0'),
    unitPrice: z.number().min(0, '单价不能为负'),
    discount: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  })).min(1, '至少需要一项商品'),
});

/** 更新报价 */
export const UpdateQuotationSchema = CreateQuotationSchema.partial();

// ==================== 订单管理 ====================

/** 创建订单 */
export const CreateOrderSchema = z.object({
  customerId: z.string().uuid('客户 ID 格式不正确'),
  sourceInquiryId: z.string().uuid().optional(),
  sourceQuotationId: z.string().uuid().optional(),
  currency: z.string().max(10).optional(),
  exchangeRate: z.number().min(0).optional(),
  orderDate: z.string().datetime().optional(),
  paymentDeadline: z.string().datetime().optional(),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingContact: z.string().optional(),
  shippingPhone: z.string().optional(),
  salesRepId: z.string().uuid().optional(),
  internalNotes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  items: z.array(z.object({
    productId: z.string().uuid('产品 ID 格式不正确'),
    productName: z.string().optional(),
    productSku: z.string().optional(),
    specification: z.string().optional(),
    quantity: z.number().int().positive('数量必须大于 0'),
    unitPrice: z.number().min(0, '单价不能为负'),
    discountRate: z.number().min(0).max(100).optional(),
    unit: z.string().max(20).optional(),
    notes: z.string().optional(),
  })).min(1, '至少需要一项商品'),
  notes: z.string().max(2000).optional(),
});

/** 更新订单 */
export const UpdateOrderSchema = CreateOrderSchema.partial();

// ==================== 角色/权限管理 ====================

/** 创建角色 */
export const CreateRoleSchema = z.object({
  name: z.string().min(1, '角色名称不能为空').max(100, '角色名称过长'),
  displayName: z.string().max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/** 更新角色 */
export const UpdateRoleSchema = CreateRoleSchema.partial();

/** 分配权限 */
export const AssignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()).min(1, '至少选择一个权限'),
});

/** 创建权限 */
export const CreatePermissionSchema = z.object({
  name: z.string().min(1, '权限名称不能为空').max(100),
  code: z.string().min(1, '权限编码不能为空').max(100),
  module: z.string().min(1, '模块不能为空').max(50),
  displayName: z.string().max(100),
  description: z.string().max(500).optional(),
});

/** 更新权限 */
export const UpdatePermissionSchema = CreatePermissionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ==================== 产品调研 ====================

/** 创建调研品类 */
export const CreateResearchCategorySchema = z.object({
  name: z.string().min(1, '品类名称不能为空').max(100),
  nameEn: z.string().max(100).optional(),
  code: z.string().min(1, '品类编码不能为空').max(50),
  parentId: z.string().uuid().optional().or(z.literal('')),
  level: z.number().int().min(1).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** 创建调研模板 */
export const CreateResearchTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  nameEn: z.string().max(100).optional(),
  code: z.string().min(1, '模板编码不能为空').max(50),
  categoryId: z.string().uuid('品类 ID 格式不正确'),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DECIMAL', 'URL']).optional(),
  unit: z.string().max(20).optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  isComparable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  description: z.string().max(500).optional(),
  validationRule: z.string().max(200).optional(),
  defaultValue: z.string().max(200).optional(),
  placeholder: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  fields: z.array(z.object({
    name: z.string().min(1, '字段名不能为空'),
    type: z.enum(['text', 'number', 'date', 'select', 'url']),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
});

// ==================== 批量操作 ====================

/** 批量删除 */
export const BatchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '至少选择一项').max(100, '单次最多删除 100 项'),
});

// ==================== 报表查询 ====================

/** 报表日期范围查询 */
export const ReportDateRangeSchema = z.object({
  startDate: z.string().datetime('开始日期格式不正确').optional(),
  endDate: z.string().datetime('结束日期格式不正确').optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

/** 销售报表 */
export const SalesReportSchema = ReportDateRangeSchema.extend({
  groupBy: z.enum(['day', 'week', 'month', 'customer', 'product']).optional(),
  customerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  reportName: z.string().max(100).optional(),
});

/** 采购报表 */
export const PurchaseReportSchema = ReportDateRangeSchema.extend({
  supplierId: z.string().uuid().optional(),
  reportName: z.string().max(100).optional(),
});

/** 利润报表 */
export const ProfitReportSchema = ReportDateRangeSchema.extend({
  reportName: z.string().max(100).optional(),
});

/** 现金流报表 */
export const CashflowReportSchema = ReportDateRangeSchema.extend({
  reportName: z.string().max(100).optional(),
});

/** 库存报表 */
export const InventoryReportSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  lowStock: z.boolean().optional(),
  includeZero: z.boolean().optional(),
  includeHistory: z.boolean().optional(),
  reportName: z.string().max(100).optional(),
});

// ==================== 报表订阅 ====================

/** 创建报表订阅 */
export const CreateSubscriptionSchema = z.object({
  reportId: z.string().uuid('报表 ID 格式不正确'),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  email: z.string().email('请输入有效的邮箱地址'),
  format: z.enum(['pdf', 'excel', 'csv']).optional(),
});

// ==================== ID 验证 ====================

/** UUID 参数（用于路径参数） */
export const IdParamSchema = z.object({
  id: z.string().uuid('ID 格式不正确'),
});

// ==================== 验证辅助函数 ====================

/** 验证请求体并返回结果 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Array<{ field: string; message: string }> } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/** 验证查询参数 */
export function validateQuery<T extends z.ZodTypeAny>(
  schema: T,
  params: Record<string, string | undefined>
): { success: true; data: z.infer<T> } | { success: false; errors: Array<{ field: string; message: string }> } {
  return validateBody(schema, params);
}
