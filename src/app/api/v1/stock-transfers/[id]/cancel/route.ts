import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import {
  applyOverseasStockChange,
  OverseasStockConflictError,
  OverseasStockValidationError,
} from '@/lib/overseas-inventory';
import {
  applyDomesticStockChange,
  DomesticStockConflictError,
  DomesticStockValidationError,
} from '@/lib/inventory-mutations';

/**
 * POST /api/v1/stock-transfers/[id]/cancel — 取消（仅未发货的 DRAFT）
 *
 * 创建时已扣减源仓库存，取消必须原路回补，并写流水留痕。
 * 已发运（IN_TRANSIT）不允许取消（货已在途，走收货流程处理差异）。
 */

const CancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(CancelSchema, body ?? {});
    if (!v.success) return v.response;
    const { reason } = v.data;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: true,
        fromWarehouse: { select: { id: true, code: true, name: true } },
        fromOverseasWarehouse: { select: { id: true, code: true, name: true } },
      },
    });
    if (!transfer) return notFoundResponse('调拨单');
    if (transfer.status === 'CANCELLED') return conflictResponse('调拨单已取消');
    if (transfer.status !== 'DRAFT') {
      return conflictResponse(`当前状态为 ${transfer.status}，只有未发运（DRAFT）可取消`);
    }

    const isDomesticToOverseas = transfer.direction === 'DOMESTIC_TO_OVERSEAS';

    const updated = await prisma.$transaction(async tx => {
      // 原子领取，防并发重复回补
      const claimed = await tx.stockTransfer.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null },
      });
      if (claimed.count === 0) {
        throw new Error('调拨单状态已被其他操作修改，请重试');
      }

      for (const item of transfer.items) {
        if (isDomesticToOverseas) {
          const from = transfer.fromWarehouse;
          if (!from) throw new Error('调拨单缺少源国内仓');
          await applyDomesticStockChange(tx, {
            productId: item.productId,
            warehouseCode: from.code,
            delta: item.quantity,
            type: 'RETURN',
            referenceType: 'STOCK_TRANSFER',
            referenceId: id,
            note: `调拨单 ${transfer.transferNo} 取消回补` + (reason ? `，原因：${reason}` : ''),
          });
        } else {
          const from = transfer.fromOverseasWarehouse;
          if (!from) throw new Error('调拨单缺少源海外仓');
          await applyOverseasStockChange(tx, {
            overseasWarehouseId: from.id,
            overseasWarehouseCode: from.code,
            productId: item.productId,
            delta: item.quantity,
            type: 'RETURN',
            referenceType: 'STOCK_TRANSFER',
            referenceId: id,
            notes: `调拨单 ${transfer.transferNo} 取消回补` + (reason ? `，原因：${reason}` : ''),
          });
        }
      }

      return tx.stockTransfer.findUniqueOrThrow({
        where: { id },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          fromWarehouse: { select: { id: true, code: true, name: true } },
          toOverseasWarehouse: { select: { id: true, code: true, name: true } },
          fromOverseasWarehouse: { select: { id: true, code: true, name: true } },
          toWarehouse: { select: { id: true, code: true, name: true } },
        },
      });
    });

    return successResponse(updated, '调拨单已取消，库存已回补');
  } catch (error) {
    console.error('调拨单取消失败:', error);
    if (error instanceof DomesticStockValidationError || error instanceof OverseasStockValidationError) {
      return errorResponse(error.message, 'VALIDATION_ERROR', 422);
    }
    if (error instanceof DomesticStockConflictError || error instanceof OverseasStockConflictError) {
      return errorResponse(error.message, 'CONFLICT', 409);
    }
    const message = error instanceof Error ? error.message : '调拨单取消失败';
    return errorResponse(message);
  }
}
