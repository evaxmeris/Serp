import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { listResponse, errorResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import {
  resolveOverseasWarehouse,
  OverseasWarehouseNotFoundError,
} from '@/lib/overseas-inventory';

/**
 * 海外仓库存流水（stock_movements 里 overseasWarehouseId 非空的行）
 *   GET /api/v1/overseas/inventory/movements?warehouseId=&productId=&referenceType=&page=&limit=
 */

const QuerySchema = z.object({
  warehouseId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  referenceType: z.string().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(QuerySchema, Object.fromEntries(request.nextUrl.searchParams), 'query');
    if (!v.success) return v.response;
    const { warehouseId, productId, referenceType, type, page, limit } = v.data;

    const where: any = { overseasWarehouseId: { not: null } };

    if (warehouseId) {
      try {
        where.overseasWarehouseId = (await resolveOverseasWarehouse(warehouseId)).id;
      } catch (e) {
        if (e instanceof OverseasWarehouseNotFoundError) {
          return errorResponse(e.message, 'NOT_FOUND', 404);
        }
        throw e;
      }
    }
    if (productId) where.productId = productId;
    if (referenceType) where.referenceType = referenceType;
    if (type) where.type = type;

    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // StockMovement 没有 product 关系，单独补产品名称/SKU（避免 N+1）
    const productIds = Array.from(new Set(rows.map(r => r.productId)));
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, sku: true },
        })
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    const items = rows.map(r => ({
      ...r,
      product: productMap.get(r.productId) ?? null,
    }));

    return listResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    console.error('获取海外仓流水失败:', error);
    return errorResponse('获取海外仓流水失败');
  }
}
