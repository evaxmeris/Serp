import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import {
  applyOverseasStockChange,
  computeOverseasAvailable,
  resolveOverseasWarehouse,
  OverseasWarehouseNotFoundError,
  OverseasStockConflictError,
  OverseasStockValidationError,
} from '@/lib/overseas-inventory';

/**
 * 海外仓台账差异调整（丢件 / 平台差异 / 其他）
 *   POST /api/v1/overseas/inventory/adjust
 *   body: { warehouseId, productId, quantity(变动量，负数=盘亏), type: LOST|PLATFORM_DIFF|OTHER, reason, notes? }
 *
 * 规则（决策②：本地台账为过程权威，但每次调整必须留痕）：
 *   - type 与 reason 必填，reason 至少 2 个字，禁止"静默改数"
 *   - 调整写 stock_movements（type=ADJUSTMENT，referenceType=OVERSEAS_ADJUST_<TYPE>，notes=reason）
 *   - 台账快照 + 流水在同一事务内完成，乐观锁冲突返回 409
 */

const ADJUST_TYPES = ['LOST', 'PLATFORM_DIFF', 'OTHER'] as const;

const AdjustSchema = z.object({
  warehouseId: z.string().min(1, '海外仓 ID 不能为空'),
  productId: z.string().min(1, '产品 ID 不能为空'),
  quantity: z
    .number()
    .int('调整数量必须为整数')
    .refine(n => n !== 0, '调整数量不能为 0'),
  type: z.enum(ADJUST_TYPES, { message: '调整类型必须是 LOST / PLATFORM_DIFF / OTHER' }),
  reason: z.string().min(2, '必须填写调整原因（至少 2 个字）').max(500),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(AdjustSchema, body);
    if (!v.success) return v.response;
    const { warehouseId, productId, quantity, type, reason, notes } = v.data;

    // 1. 海外仓归一化（id 或 code）
    let warehouse;
    try {
      warehouse = await resolveOverseasWarehouse(warehouseId);
    } catch (e) {
      if (e instanceof OverseasWarehouseNotFoundError) {
        return errorResponse(e.message, 'NOT_FOUND', 404);
      }
      throw e;
    }
    if (!warehouse.isActive) {
      return errorResponse(`海外仓 ${warehouse.name} 已停用，不能调整台账`, 'CONFLICT', 409);
    }

    // 2. 产品校验
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product) return errorResponse('产品不存在', 'NOT_FOUND', 404);

    // 3. 事务：台账快照 + 流水
    const result = await prisma.$transaction(async tx => {
      const change = await applyOverseasStockChange(tx, {
        overseasWarehouseId: warehouse.id,
        overseasWarehouseCode: warehouse.code,
        productId,
        delta: quantity,
        type: 'ADJUSTMENT',
        referenceType: `OVERSEAS_ADJUST_${type}`,
        notes: `[${type}] ${reason}${notes ? ` / ${notes}` : ''}（操作人：${session.email}）`,
      });

      const row = await tx.overseasInventory.findUniqueOrThrow({
        where: { id: change.inventoryId },
      });
      const movement = await tx.stockMovement.findUniqueOrThrow({
        where: { id: change.movementId },
      });

      return {
        inventory: {
          ...row,
          availableQty: computeOverseasAvailable(row.quantity, row.reservedQty),
        },
        movement,
        before: change.before,
        after: change.after,
      };
    });

    return successResponse(
      {
        ...result,
        warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
        product,
        adjustType: type,
        reason,
      },
      '台账调整成功'
    );
  } catch (error) {
    console.error('海外仓台账调整失败:', error);
    if (error instanceof OverseasWarehouseNotFoundError) {
      return errorResponse(error.message, 'NOT_FOUND', 404);
    }
    if (error instanceof OverseasStockValidationError) {
      return validationErrorResponse([{ field: 'quantity', message: error.message }]);
    }
    if (error instanceof OverseasStockConflictError) {
      return errorResponse(error.message, 'CONFLICT', 409);
    }
    return errorResponse('台账调整失败');
  }
}
