import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import {
  computeOverseasAvailable,
  resolveOverseasWarehouse,
  OverseasWarehouseNotFoundError,
} from '@/lib/overseas-inventory';

/**
 * 海外仓库存台账查询
 *   GET /api/v1/overseas/inventory?warehouseId=&productId=&search=&page=&limit=
 *
 * 口径：availableQty = quantity - reservedQty（动态计算，不信任库里的镜像字段）
 */

const QuerySchema = z.object({
  warehouseId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(QuerySchema, Object.fromEntries(request.nextUrl.searchParams), 'query');
    if (!v.success) return v.response;
    const { warehouseId, productId, search, page, limit } = v.data;

    const where: any = {};

    if (warehouseId) {
      // 支持海外仓 id 或 code
      let resolvedId = warehouseId;
      try {
        resolvedId = (await resolveOverseasWarehouse(warehouseId)).id;
      } catch (e) {
        if (e instanceof OverseasWarehouseNotFoundError) {
          return errorResponse(e.message, 'NOT_FOUND', 404);
        }
        throw e;
      }
      where.warehouseId = resolvedId;
    }

    if (productId) where.productId = productId;

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { fnsku: { contains: search, mode: 'insensitive' } },
        { asin: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total, sums] = await Promise.all([
      prisma.overseasInventory.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, code: true, name: true, country: true } },
        },
        orderBy: [{ sku: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.overseasInventory.count({ where }),
      prisma.overseasInventory.aggregate({
        where,
        _sum: { quantity: true, reservedQty: true },
      }),
    ]);

    const items = rows.map(r => ({
      ...r,
      availableQty: computeOverseasAvailable(r.quantity, r.reservedQty),
    }));

    const totalQuantity = sums._sum.quantity ?? 0;
    const totalReserved = sums._sum.reservedQty ?? 0;

    return NextResponse.json({
      success: true,
      code: 'SUCCESS',
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
        summary: {
          totalQuantity,
          totalReserved,
          totalAvailable: totalQuantity - totalReserved,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取海外仓台账失败:', error);
    return errorResponse('获取海外仓台账失败');
  }
}
