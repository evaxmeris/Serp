import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import {
  convertSuggestion,
  ReplenishmentSuggestionNotFoundError,
  ReplenishmentSuggestionStateError,
  ReplenishmentConvertValidationError,
} from '@/lib/replenishment-convert';
import {
  OverseasWarehouseNotFoundError,
  OverseasStockValidationError,
  OverseasStockConflictError,
} from '@/lib/overseas-inventory';
import {
  DomesticStockValidationError,
  DomesticStockConflictError,
} from '@/lib/inventory-mutations';

/**
 * 一键转单：补货建议 → 采购单草稿 / 调拨单草稿
 *   POST /api/v1/replenishment/suggestions/[id]/convert
 *   body: {
 *     target: 'PURCHASE_ORDER' | 'STOCK_TRANSFER',
 *     supplierId?,        // target=PURCHASE_ORDER 必填
 *     fromWarehouseId?,   // target=STOCK_TRANSFER 必填（国内源仓 id 或 code）
 *     quantity?,          // 默认 = 建议量
 *     unitPrice?,         // 转采购单单价，默认 product.costPrice
 *     currency?, notes?
 *   }
 *
 * 成功：建议状态 → CONVERTED，写回 convertedType/convertedId/convertedNo
 * 重复转单：409（带原单号）
 */

const ALLOWED_ROLES = [
  'super-admin',
  'super_admin',
  'admin',
  'ops',
  'Operator_Manager',
  'purchasing',
  'purchasing_manager',
];

const ConvertSchema = z.object({
  target: z.enum(['PURCHASE_ORDER', 'STOCK_TRANSFER'], {
    message: 'target 必须是 PURCHASE_ORDER 或 STOCK_TRANSFER',
  }),
  supplierId: z.string().min(1).optional(),
  fromWarehouseId: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    if (!ALLOWED_ROLES.includes(session.role)) {
      return errorResponse('无权限转单（需要采购/运营/管理员角色）', 'FORBIDDEN', 403);
    }

    const { id } = await params;
    if (!id || typeof id !== 'string' || id.length < 1) {
      return errorResponse('建议 ID 不能为空', 'VALIDATION_ERROR', 422);
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(ConvertSchema, body);
    if (!v.success) return v.response;

    const result = await convertSuggestion({
      id,
      target: v.data.target,
      supplierId: v.data.supplierId ?? null,
      fromWarehouseId: v.data.fromWarehouseId ?? null,
      quantity: v.data.quantity ?? null,
      unitPrice: v.data.unitPrice ?? null,
      currency: v.data.currency ?? null,
      notes: v.data.notes ?? null,
      operatorId: session.email ?? session.id,
      operatorUserId: session.id,
    });

    return successResponse(
      {
        suggestion: result.suggestion,
        target: result.target,
        document: result.document,
      },
      `已转为${result.target === 'PURCHASE_ORDER' ? '采购单' : '调拨单'}草稿 ${result.document.no}`
    );
  } catch (error) {
    if (error instanceof ReplenishmentSuggestionNotFoundError) {
      return notFoundResponse('补货建议');
    }
    if (error instanceof ReplenishmentSuggestionStateError) {
      return conflictResponse(error.message, 'INVALID_STATE');
    }
    if (error instanceof ReplenishmentConvertValidationError) {
      return validationErrorResponse(
        error.fields.length ? error.fields : [{ field: 'body', message: error.message }]
      );
    }
    if (error instanceof OverseasWarehouseNotFoundError) {
      return notFoundResponse('海外仓');
    }
    if (error instanceof DomesticStockValidationError || error instanceof OverseasStockValidationError) {
      return validationErrorResponse([{ field: 'items', message: error.message }]);
    }
    if (error instanceof DomesticStockConflictError || error instanceof OverseasStockConflictError) {
      return conflictResponse(error.message, 'STOCK_CONFLICT');
    }
    console.error('补货建议转单失败:', error);
    return errorResponse('补货建议转单失败');
  }
}
