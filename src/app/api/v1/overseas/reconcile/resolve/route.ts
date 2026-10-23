import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import {
  resolveReconcileDiff,
  ReconcileSnapshotMissingError,
  ReconcileProductMissingError,
  OverseasWarehouseNotFoundError,
  OverseasStockValidationError,
  OverseasStockConflictError,
} from '@/lib/overseas-reconcile';

/**
 * 对账差异拉平（差异调整单）
 *   POST /api/v1/overseas/reconcile/resolve
 *   body: { warehouseId, sku, platformCode, marketplaceId?, reason?, notes? }
 *
 * 行为：把本地台账可用量调整为平台快照可售量
 *   - 复用台账统一记账 applyOverseasStockChange（乐观锁 + 流水）
 *   - 流水 type=ADJUSTMENT，referenceType=OVERSEAS_ADJUST_PLATFORM_DIFF
 *   - reason 自动生成（含 diff 明细），调用方可追加业务备注
 *   - 已一致（diff=0）返回 status='MATCH' + changed=false，不写流水
 */

const ResolveSchema = z.object({
  warehouseId: z.string().min(1, '海外仓 ID 不能为空'),
  sku: z.string().min(1, 'SKU 不能为空'),
  platformCode: z.string().min(1, 'platformCode 不能为空'),
  marketplaceId: z.string().optional(),
  reason: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(ResolveSchema, body);
    if (!v.success) return v.response;
    const { warehouseId, sku, platformCode, marketplaceId, reason, notes } = v.data;

    const result = await resolveReconcileDiff({
      warehouseId,
      sku,
      platformCode,
      marketplaceId: marketplaceId || undefined,
      reason,
      notes,
      operator: session.email,
    });

    return successResponse(
      {
        ...result,
        adjustType: 'PLATFORM_DIFF',
      },
      result.changed
        ? `已拉平：SKU ${sku} 台账 ${result.localQtyBefore} → ${result.platformQty}`
        : `SKU ${sku} 台账与平台一致，无需调整`,
    );
  } catch (error) {
    if (error instanceof OverseasWarehouseNotFoundError) {
      return errorResponse(error.message, 'NOT_FOUND', 404);
    }
    if (error instanceof ReconcileSnapshotMissingError) {
      return errorResponse(error.message, 'NO_SNAPSHOT', 404);
    }
    if (error instanceof ReconcileProductMissingError) {
      return errorResponse(error.message, 'PRODUCT_MISSING', 422);
    }
    if (error instanceof OverseasStockValidationError) {
      return validationErrorResponse([{ field: 'quantity', message: error.message }]);
    }
    if (error instanceof OverseasStockConflictError) {
      return errorResponse(error.message, 'CONFLICT', 409);
    }
    console.error('对账差异拉平失败:', error);
    return errorResponse('对账差异拉平失败');
  }
}
