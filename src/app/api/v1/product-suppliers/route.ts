/**
 * 产品-供应商关联 API
 * GET  - 获取关联列表（按产品/供应商筛选、搜索）
 * POST - 创建关联
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import {
  successResponse,
  createdResponse,
  listResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { z } from 'zod';

// 创建关联 Schema
const CreateSchema = z.object({
  productId: z.string().min(1, '产品 ID 不能为空'),
  supplierId: z.string().min(1, '供应商 ID 不能为空'),
  supplierSKU: z.string().optional().nullable(),
  unitPrice: z.number().positive('单价必须大于 0').optional().nullable(),
  currency: z.string().default('CNY'),
  moq: z.number().int().positive('MOQ 必须大于 0').optional().nullable(),
  leadTime: z.number().int().positive('交期必须大于 0').optional().nullable(),
  isPreferred: z.boolean().default(false),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// 查询参数 Schema
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  productId: z.string().optional(),
  supplierId: z.string().optional(),
  search: z.string().optional(),
  isPreferred: z.coerce.boolean().optional(),
});

/**
 * GET /api/v1/product-suppliers
 * 获取产品-供应商关联列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'supplier_product:list');
    if (permError) return permError;

    const searchParams = request.nextUrl.searchParams;
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const { page, limit, productId, supplierId, search, isPreferred } = queryResult.data;

    const where: any = {};
    if (productId) where.productId = productId;
    if (supplierId) where.supplierId = supplierId;
    if (isPreferred !== undefined) where.isPreferred = isPreferred;
    if (search) {
      where.OR = [
        { supplier: { companyName: { contains: search } } },
        { supplier: { companyEn: { contains: search } } },
        { product: { name: { contains: search } } },
        { product: { sku: { contains: search } } },
        { supplierSKU: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productSupplier.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, sku: true, specification: true, unit: true, images: true },
          },
          supplier: {
            select: { id: true, companyName: true, companyEn: true, supplierNo: true, status: true },
          },
        },
        orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productSupplier.count({ where }),
    ]);

    return listResponse(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('获取产品-供应商关联列表失败:', error);
    return errorResponse('获取关联列表失败');
  }
}

/**
 * POST /api/v1/product-suppliers
 * 创建产品-供应商关联
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'supplier_product:create');
    if (permError) return permError;

    const body = await request.json();
    const validationResult = CreateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 验证产品存在
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return notFoundResponse('产品');

    // 验证供应商存在
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) return notFoundResponse('供应商');

    // 检查是否已存在关联
    const existing = await prisma.productSupplier.findUnique({
      where: { productId_supplierId: { productId: data.productId, supplierId: data.supplierId } },
    });
    if (existing) {
      return conflictResponse('该产品与供应商已存在关联');
    }

    // 如果标记为首选，先取消该产品的其他首选标记
    if (data.isPreferred) {
      await prisma.productSupplier.updateMany({
        where: { productId: data.productId, isPreferred: true },
        data: { isPreferred: false },
      });
    }

    const record = await prisma.productSupplier.create({
      data: {
        productId: data.productId,
        supplierId: data.supplierId,
        supplierSKU: data.supplierSKU ?? null,
        unitPrice: data.unitPrice ?? null,
        currency: data.currency,
        moq: data.moq ?? null,
        leadTime: data.leadTime ?? null,
        isPreferred: data.isPreferred ?? false,
        rating: data.rating ?? null,
        notes: data.notes ?? null,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        supplier: { select: { id: true, companyName: true, supplierNo: true } },
      },
    });

    return createdResponse(record, '关联创建成功');
  } catch (error) {
    console.error('创建产品-供应商关联失败:', error);
    return errorResponse('创建关联失败');
  }
}
