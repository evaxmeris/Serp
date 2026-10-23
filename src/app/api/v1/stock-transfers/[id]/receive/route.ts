import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
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
 * POST /api/v1/stock-transfers/[id]/receive — 收货（支持部分收货）
 *
 * body: { items?: [{ itemId, receivedQty }] }   // 不传则按剩余数量全收
 * 规则：
 *   - 只有 IN_TRANSIT 可收货（必须先发运）
 *   - 每次收货都把收到的数量入对方仓台账/库存 + 写流水
 *   - 全部明细收满 → status=RECEIVED；否则保持 IN_TRANSIT，可继续收
 */

const ReceiveSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        receivedQty: z.number().int().positive('收货数量必须大于 0'),
      })
    )
    .optional(),
  notes: z.string().max(500).optional(),
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
    const v = validateOrReturn(ReceiveSchema, body ?? {});
    if (!v.success) return v.response;
    const { items, notes } = v.data;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: true,
        toOverseasWarehouse: { select: { id: true, code: true, name: true, isActive: true } },
        fromOverseasWarehouse: { select: { id: true, code: true, name: true } },
        toWarehouse: { select: { id: true, code: true, name: true } },
        fromWarehouse: { select: { id: true, code: true, name: true } },
      },
    });
    if (!transfer) return notFoundResponse('调拨单');
    if (transfer.status === 'RECEIVED') return conflictResponse('调拨单已收货完成，不能重复收货');
    if (transfer.status === 'CANCELLED') return conflictResponse('调拨单已取消，不能收货');
    if (transfer.status !== 'IN_TRANSIT') {
      return conflictResponse(`当前状态为 ${transfer.status}，只有 IN_TRANSIT 可收货`);
    }

    const isDomesticToOverseas = transfer.direction === 'DOMESTIC_TO_OVERSEAS';

    // 计算本次收货数量（默认收剩余）
    const receiveMap = new Map<string, number>();
    if (items?.length) {
      for (const i of items) {
        const item = transfer.items.find(t => t.id === i.itemId);
        if (!item) {
          return validationErrorResponse([{ field: 'items', message: `明细 ${i.itemId} 不属于该调拨单` }]);
        }
        const remaining = item.quantity - item.receivedQty;
        if (i.receivedQty > remaining) {
          return validationErrorResponse([
            {
              field: 'items',
              message: `收货数量超出剩余数量（明细 ${i.itemId} 剩余 ${remaining}，本次 ${i.receivedQty}）`,
            },
          ]);
        }
        receiveMap.set(i.itemId, i.receivedQty);
      }
    } else {
      for (const item of transfer.items) {
        const remaining = item.quantity - item.receivedQty;
        if (remaining > 0) receiveMap.set(item.id, remaining);
      }
    }

    if (receiveMap.size === 0) {
      return conflictResponse('没有待收货的明细');
    }

    const updated = await prisma.$transaction(async tx => {
      for (const [itemId, qty] of receiveMap.entries()) {
        const item = transfer.items.find(t => t.id === itemId)!;

        // 入对方仓
        if (isDomesticToOverseas) {
          const overseas = transfer.toOverseasWarehouse;
          if (!overseas) throw new Error('调拨单缺少目标海外仓');
          if (!overseas.isActive) throw new Error(`海外仓 ${overseas.name} 已停用，不能收货`);
          await applyOverseasStockChange(tx, {
            overseasWarehouseId: overseas.id,
            overseasWarehouseCode: overseas.code,
            productId: item.productId,
            delta: qty,
            type: 'TRANSFER',
            referenceType: 'STOCK_TRANSFER',
            referenceId: id,
            notes: `调拨单 ${transfer.transferNo} 收货` + (notes ? ` / ${notes}` : ''),
          });
        } else {
          const domestic = transfer.toWarehouse;
          if (!domestic) throw new Error('调拨单缺少目标国内仓');
          await applyDomesticStockChange(tx, {
            productId: item.productId,
            warehouseCode: domestic.code,
            delta: qty,
            type: 'TRANSFER',
            referenceType: 'STOCK_TRANSFER',
            referenceId: id,
            note: `调拨单 ${transfer.transferNo} 收货` + (notes ? ` / ${notes}` : ''),
          });
        }

        await tx.stockTransferItem.update({
          where: { id: itemId },
          data: { receivedQty: { increment: qty } },
        });
      }

      // 收满则置 RECEIVED；乐观领取避免并发重复标记
      const freshItems = await tx.stockTransferItem.findMany({
        where: { transferId: id },
        select: { quantity: true, receivedQty: true },
      });
      const allReceived = freshItems.every(i => i.receivedQty >= i.quantity);

      if (allReceived) {
        const claimed = await tx.stockTransfer.updateMany({
          where: { id, status: 'IN_TRANSIT' },
          data: { status: 'RECEIVED', receivedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new Error('调拨单状态已被其他操作修改，请重试');
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
          logisticsOrder: { select: { id: true, orderNo: true, status: true } },
        },
      });
    });

    return successResponse(
      { ...updated, fullyReceived: updated.status === 'RECEIVED' },
      updated.status === 'RECEIVED' ? '调拨单收货完成' : '调拨单部分收货成功'
    );
  } catch (error) {
    console.error('调拨单收货失败:', error);
    if (error instanceof DomesticStockValidationError || error instanceof OverseasStockValidationError) {
      return validationErrorResponse([{ field: 'items', message: error.message }]);
    }
    if (error instanceof DomesticStockConflictError || error instanceof OverseasStockConflictError) {
      return errorResponse(error.message, 'CONFLICT', 409);
    }
    const message = error instanceof Error ? error.message : '调拨单收货失败';
    return errorResponse(message);
  }
}
