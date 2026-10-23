import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import {
  buildReconcileReport,
  OverseasWarehouseNotFoundError,
  type ReconcileStatus,
} from '@/lib/overseas-reconcile';

/**
 * 海外仓台账 ↔ 平台镜像快照 对账
 *   GET /api/v1/overseas/reconcile?warehouseId=&platformCode=&marketplaceId=&sku=&status=&threshold=
 *
 * 返回每行：
 *   { sku, productName, localQty, platformQty, diff, status: MATCH|DIFF|LOCAL_ONLY|PLATFORM_ONLY, ... }
 *
 * 只读接口：不写台账、不改快照。拉平请调 POST /api/v1/overseas/reconcile/resolve。
 */

const QuerySchema = z.object({
  warehouseId: z.string().min(1, 'warehouseId 不能为空'),
  platformCode: z.string().min(1, 'platformCode 不能为空'),
  marketplaceId: z.string().optional(),
  sku: z.string().optional(),
  status: z.enum(['MATCH', 'DIFF', 'LOCAL_ONLY', 'PLATFORM_ONLY']).optional(),
  threshold: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(
      QuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
      'query',
    );
    if (!v.success) return v.response;

    const { warehouseId, platformCode, marketplaceId, sku, status, threshold } = v.data;

    const report = await buildReconcileReport({
      warehouseId,
      platformCode,
      marketplaceId: marketplaceId || undefined,
      sku: sku || undefined,
      status: status as ReconcileStatus | undefined,
      threshold,
    });

    return successResponse({
      warehouse: report.warehouse,
      platformCode: report.platformCode,
      marketplaceId: report.marketplaceId,
      threshold: report.threshold,
      rows: report.rows,
      summary: report.summary,
    });
  } catch (error) {
    if (error instanceof OverseasWarehouseNotFoundError) {
      return errorResponse(error.message, 'NOT_FOUND', 404);
    }
    console.error('海外仓对账失败:', error);
    return errorResponse('海外仓对账失败');
  }
}
