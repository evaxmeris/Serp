/**
 * 产品调研模块验证器
 * 
 * 使用 Zod 进行输入验证，确保数据完整性和安全性
 * 
 * @module validators/product-research
 */

import { z } from 'zod';

/**
 * 产品调研状态枚举
 */
export const ProductResearchStatusSchema = z.enum([
  'DRAFT',           // 草稿
  'IN_PROGRESS',     // 进行中
  'COMPLETED',       // 已完成
  'ARCHIVED',        // 已归档
]);

/**
 * 产品调研优先级枚举
 */
export const ProductResearchPrioritySchema = z.enum([
  'LOW',      // 低
  'MEDIUM',   // 中
  'HIGH',     // 高
  'URGENT',   // 紧急
]);

/**
 * 产品调研结论枚举
 */
export const ProductResearchConclusionSchema = z.enum([
  'RECOMMENDED',           // 推荐
  'NOT_RECOMMENDED',       // 不推荐
  'NEEDS_MORE_RESEARCH',   // 需要更多调研
]);

/**
 * 产品调研结论（兼容前端小写）
 */
export const ProductResearchConclusionQuerySchema = z.union([
  ProductResearchConclusionSchema,
  z.literal('recommended'),
  z.literal('alternative'),
  z.literal('eliminated'),
  z.literal('all'),
]).optional();

/**
 * 货币类型枚举
 */
export const CurrencySchema = z.enum(['CNY', 'USD', 'EUR', 'GBP']);

/**
 * 属性值创建 Schema
 */
export const AttributeValueCreateSchema = z.object({
  /** 属性 ID */
  attributeId: z.string().cuid('属性 ID 格式不正确'),
  /** 文本值 */
  valueText: z.string().optional(),
  /** 数值值 */
  valueNumber: z.number().optional(),
  /** 布尔值 */
  valueBoolean: z.boolean().optional(),
  /** 日期值 */
  valueDate: z.string().datetime().optional(),
  /** 选项值 */
  valueOptions: z.array(z.string()).optional(),
  /** 单位 */
  unit: z.string().optional(),
  /** 备注 */
  notes: z.string().optional(),
});

/**
 * 产品调研创建 Schema
 */
export const CreateProductResearchSchema = z.object({
  /** 产品名称 */
  name: z.string().min(1, '产品名称必填'),
  /** 产品名称（英文） */
  nameEn: z.string().optional(),
  /** 品类 ID */
  categoryId: z.string().cuid('品类 ID 格式不正确'),
  /** 品牌 */
  brand: z.string().optional(),
  /** 品牌（英文） */
  brandEn: z.string().optional(),
  /** 型号 */
  model: z.string().optional(),
  /** 生产厂家 */
  manufacturer: z.string().optional(),
  /** 生产厂家（英文） */
  manufacturerEn: z.string().optional(),
  /** 原产国 */
  originCountry: z.string().default('CN'),
  /** 来源链接 */
  sourceUrl: z.string().url('来源链接格式不正确').optional(),
  /** 来源平台 */
  sourcePlatform: z.string().optional(),
  /** 主图 URL */
  mainImage: z.string().url('主图 URL 格式不正确').optional(),
  /** 图片 URLs */
  images: z.array(z.string().url()).optional(),
  /** 状态 */
  status: ProductResearchStatusSchema.default('DRAFT'),
  /** 优先级 */
  priority: ProductResearchPrioritySchema.default('MEDIUM'),
  /** 负责人 */
  assignedTo: z.string().optional(),
  /** 标签 */
  tags: z.array(z.string()).optional(),
  /** 备注 */
  notes: z.string().optional(),
  /** 调研结论 */
  conclusion: ProductResearchConclusionSchema.optional(),
  /** 评分 */
  rating: z.number().min(1).max(5).optional(),
  /** 成本价 */
  costPrice: z.number().nonnegative().optional(),
  /** 销售价 */
  salePrice: z.number().nonnegative().optional(),
  /** 币种 */
  currency: CurrencySchema.default('CNY'),
  /** 最小起订量 */
  moq: z.number().int().positive().optional(),
  /** 交货期 */
  leadTime: z.number().int().positive().optional(),
  /** 规格描述 */
  specification: z.string().optional(),
  /** 重量 */
  weight: z.number().nonnegative().optional(),
  /** 体积 */
  volume: z.number().nonnegative().optional(),
  /** 尺寸 */
  dimensions: z.string().optional(),
  /** 调研时间 */
  researchedAt: z.string().datetime().optional(),
  /** 属性值列表 */
  attributes: z.array(AttributeValueCreateSchema).optional(),
});

/**
 * 产品调研更新 Schema
 */
export const UpdateProductResearchSchema = CreateProductResearchSchema.partial();

/**
 * 产品调研查询参数 Schema
 */
export const ProductResearchQuerySchema = z.object({
  /** 页码 */
  page: z.coerce.number().int().positive().default(1),
  /** 每页数量 */
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** 搜索关键词 */
  search: z.string().max(100, '搜索关键词不能超过 100 个字符').optional(),
  /** 品类 ID */
  categoryId: z.string().cuid('品类 ID 格式不正确').optional(),
  /** 状态 */
  status: ProductResearchStatusSchema.or(z.literal('all')).optional(),
  /** 品牌 */
  brand: z.string().max(100, '品牌名称不能超过 100 个字符').optional(),
  /** 负责人 */
  assignedTo: z.string().max(100, '负责人名称不能超过 100 个字符').optional(),
  /** 优先级 */
  priority: ProductResearchPrioritySchema.optional(),
  /** 结论 */
  conclusion: ProductResearchConclusionQuerySchema,
  /** 开始日期 */
  dateFrom: z.string().datetime('日期格式不正确').optional(),
  /** 结束日期 */
  dateTo: z.string().datetime('日期格式不正确').optional(),
});

/**
 * 批量删除产品调研请求 Schema
 */
export const BulkDeleteProductResearchSchema = z.object({
  /** 产品 ID 列表 */
  ids: z.array(z.string().cuid('产品 ID 格式不正确')).min(1, '至少选择一个产品'),
});

/**
 * 导出验证错误为友好格式
 * 
 * @param error Zod 验证错误
 * @returns 字段级错误信息
 */
export function formatValidationError(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  
  if (error.issues && Array.isArray(error.issues)) {
    error.issues.forEach((err: z.ZodIssue) => {
      const field = err.path.join('.');
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(err.message);
    });
  }
  
  return fieldErrors;
}

