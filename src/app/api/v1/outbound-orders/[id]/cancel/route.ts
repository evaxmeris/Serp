import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { z } from 'zod';

/**
 * 出库单取消 API
 * 将出库单取消，并恢复库存
 */

const CancelSchema = z.object({
  reason: z.string().optional(), // 取消原因
});

/**
 * POST /api/v1/outbound-orders/[id]/cancel
 * 取消出库单
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const validationResult = CancelSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const { reason } = validationResult.data;

    // 检查出库单是否存在
    const outboundOrder = await prisma.outboundOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        order: true,
      },
    });

    if (!outboundOrder) {
      return notFoundResponse('出库单');
    }

    // 只有草稿或待确认状态的出库单可以取消
    if (!['DRAFT', 'PENDING'].includes(outboundOrder.status)) {
      return conflictResponse(`当前状态为 ${outboundOrder.status}，无法取消`);
    }

    // 取消出库单并恢复库存
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 更新出库单状态
      const order = await tx.outboundOrder.update({
        where: { id },
        data: { 
          status: 'CANCELLED',
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          order: true,
        },
      });

      // 恢复库存（如果是待确认状态，说明库存已被扣减）
      if (outboundOrder.status === 'PENDING') {
        const warehouseCode = outboundOrder.warehouseId; // 从父对象获取仓库 ID
        for (const item of outboundOrder.items) {
          await tx.inventoryItem.update({
            where: {
              productId_warehouse: {
                productId: item.productId,
                warehouse: warehouseCode,
              },
            },
            data: {
              quantity: { increment: item.quantity },
              availableQty: { increment: item.quantity },
            },
          });

          // 创建库存日志
          const inventoryItem = await tx.inventoryItem.findUnique({
            where: {
              productId_warehouse: {
                productId: item.productId,
                warehouse: warehouseCode,
              },
            },
          });

          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              warehouseId: warehouseCode,
              type: 'RETURN',
              quantity: item.quantity,
              beforeQuantity: inventoryItem ? inventoryItem.quantity - item.quantity : 0,
              afterQuantity: inventoryItem?.quantity || 0,
              referenceType: 'OUTBOUND_ORDER',
              referenceId: id,
              note: `出库单取消恢复库存：${outboundOrder.outboundNo}${reason ? `，原因：${reason}` : ''}`,
            },
          });
        }
      }

      return order;
    });

    return successResponse(updatedOrder, '出库单已取消');
  } catch (error) {
    console.error('Error cancelling outbound order:', error);
    return errorResponse('取消出库单失败');
  }
}
