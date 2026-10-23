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

/**
 * POST /api/v1/stock-transfers/[id]/ship
 * DRAFT → IN_TRANSIT（发运）。可在此补挂物流单号/物流订单。
 *
 * body: { logisticsOrderId?, items?: [{ itemId, shippedQty }] }
 * 幂等：状态原子领取（updateMany where status=DRAFT），重复提交返回 409。
 */

const ShipSchema = z.object({
  logisticsOrderId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        shippedQty: z.number().int().positive('发运数量必须大于 0'),
      })
    )
    .optional(),
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
    const v = validateOrReturn(ShipSchema, body ?? {});
    if (!v.success) return v.response;
    const { logisticsOrderId, items } = v.data;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) return notFoundResponse('调拨单');
    if (transfer.status !== 'DRAFT') {
      return conflictResponse(`当前状态为 ${transfer.status}，只有 DRAFT 可发运`);
    }

    if (logisticsOrderId) {
      const lo = await prisma.logisticsOrder.findUnique({
        where: { id: logisticsOrderId },
        select: { id: true },
      });
      if (!lo) return notFoundResponse('物流订单');
    }

    // 发运明细（默认全量发运）
    const shippedMap = new Map<string, number>();
    if (items?.length) {
      for (const i of items) {
        const item = transfer.items.find(t => t.id === i.itemId);
        if (!item) {
          return validationErrorResponse([{ field: 'items', message: `明细 ${i.itemId} 不属于该调拨单` }]);
        }
        if (i.shippedQty > item.quantity) {
          return validationErrorResponse([
            { field: 'items', message: `发运数量不能大于调拨数量（明细 ${i.itemId}）` },
          ]);
        }
        shippedMap.set(i.itemId, i.shippedQty);
      }
    }

    const result = await prisma.$transaction(async tx => {
      // 原子领取状态，避免并发重复发运
      const claimed = await tx.stockTransfer.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          status: 'IN_TRANSIT',
          shippedAt: new Date(),
          ...(logisticsOrderId ? { logisticsOrderId } : {}),
        },
      });
      if (claimed.count === 0) return null;

      for (const item of transfer.items) {
        const shippedQty = shippedMap.get(item.id) ?? item.quantity;
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { shippedQty },
        });
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

    if (!result) {
      const latest = await prisma.stockTransfer.findUnique({ where: { id }, select: { status: true } });
      return conflictResponse(`当前状态为 ${latest?.status}，无法重复发运`);
    }

    return successResponse(result, '调拨单已发运');
  } catch (error) {
    console.error('调拨单发运失败:', error);
    return errorResponse('调拨单发运失败');
  }
}
