import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { resolveOverseasWarehouse, OverseasWarehouseNotFoundError } from '@/lib/overseas-inventory';

/**
 * 补货建议列表
 *   GET /api/v1/replenishment/suggestions?overseasWarehouseId=&status=&sku=&search=&includeZero=&page=&limit=
 *
 * 排序：建议量降序（缺口大的先处理）→ 生成时间降序
 * includeZero=true 时把 suggestedQty=0 的历史行（APPROVED/CONVERTED 等）也带出来
 * summary 附带各状态条数与建议量合计（前端角标用）
 */

const QuerySchema = z.object({
  overseasWarehouseId: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'CONVERTED', 'DISMISSED']).optional(),
  sku: z.string().min(1).optional(),
  search: z.string().optional(),
  includeZero: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform(v => v === true || v === 'true' || v === '1'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(QuerySchema, Object.fromEntries(request.nextUrl.searchParams), 'query');
    if (!v.success) return v.response;
    const { overseasWarehouseId, status, sku, search, includeZero, page, limit } = v.data;

    const where: any = {};

    if (overseasWarehouseId) {
      try {
        where.overseasWarehouseId = (await resolveOverseasWarehouse(overseasWarehouseId)).id;
      } catch (e) {
        if (e instanceof OverseasWarehouseNotFoundError) {
          return errorResponse(e.message, 'NOT_FOUND', 404);
        }
        throw e;
      }
    }
    if (status) where.status = status;
    if (sku) where.sku = sku;
    if (!includeZero) where.suggestedQty = { gt: 0 };
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total, grouped] = await Promise.all([
      prisma.replenishmentSuggestion.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, costPrice: true, currency: true } },
          overseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
        },
        orderBy: [{ suggestedQty: 'desc' }, { generatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.replenishmentSuggestion.count({ where }),
      prisma.replenishmentSuggestion.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { suggestedQty: true },
      }),
    ]);

    const summary = {
      counts: { PENDING: 0, APPROVED: 0, CONVERTED: 0, DISMISSED: 0 } as Record<string, number>,
      suggestedQty: { PENDING: 0, APPROVED: 0, CONVERTED: 0, DISMISSED: 0 } as Record<string, number>,
      /** 当前页建议量合计 */
      pageSuggestedQty: rows.reduce((acc: number, r) => acc + r.suggestedQty, 0),
    };

    for (const g of grouped) {
      summary.counts[g.status] = g._count._all;
      summary.suggestedQty[g.status] = g._sum.suggestedQty ?? 0;
    }

    return NextResponse.json({
      success: true,
      code: 'SUCCESS',
      data: {
        items: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
        summary,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取补货建议失败:', error);
    return errorResponse('获取补货建议失败');
  }
}
