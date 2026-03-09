import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { z } from 'zod';

const ConfirmInboundOrderSchema = z.object({
  actualDate: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string(),
    actualQuantity: z.number().min(1, '实际入库数量必须大于 0'),
  })).optional(),
});

// POST /api/v1/inbound-orders/[id]/confirm - 确认入库
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      return notFoundResponse('入库单');
    }

    // 检查状态
    if (order.status === 'COMPLETED') {
      return conflictResponse('入库单已完成，不能重复确认');
    }

    if (order.status === 'CANCELLED') {
      return conflictResponse('已取消的入库单不能确认');
    }

    const validationResult = ConfirmInboundOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 更新入库单状态和实际入库日期
    const updateData: any = {
      status: 'COMPLETED',
      actualDate: data.actualDate ? new Date(data.actualDate) : new Date(),
    };

    // 如果有提供入库明细，更新实际入库数量
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await prisma.inboundOrderItem.update({
          where: { id: item.itemId },
          data: {
            actualQuantity: item.actualQuantity,
          },
        });
      }
    } else {
      // 如果没有提供明细，默认全部入库
      await prisma.inboundOrderItem.updateMany({
        where: { inboundOrderId: id },
        data: {
          actualQuantity: {
            set: 0,
          },
        },
      });
      
      // 手动设置实际入库数量为预期数量
      const items = await prisma.inboundOrderItem.findMany({
        where: { inboundOrderId: id },
      });
      
      for (const item of items) {
        await prisma.inboundOrderItem.update({
          where: { id: item.id },
          data: {
            actualQuantity: item.expectedQuantity,
          },
        });
      }
    }

    // 更新入库单
    const updatedOrder = await prisma.inboundOrder.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // 更新库存
    const warehouseId = order.warehouseId || 'default';

    for (const item of updatedOrder.items) {
      const actualQty = item.actualQuantity || item.expectedQuantity;

      // 查找或创建库存记录
      let inventory = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: item.productId,
            warehouseId,
          },
        },
      });

      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            productId: item.productId,
            warehouseId,
            quantity: 0,
            availableQuantity: 0,
            lockedQuantity: 0,
          },
        });
      }

      // 更新库存数量
      const beforeQuantity = inventory.quantity;
      const afterQuantity = beforeQuantity + actualQty;

      await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: afterQuantity,
          availableQuantity: {
            increment: actualQty,
          },
          lastInboundDate: new Date(),
        },
      });

      // 创建库存流水
      await prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          warehouseId,
          inboundOrderId: id,
          type: 'IN',
          quantity: actualQty,
          beforeQuantity,
          afterQuantity,
          referenceType: 'INBOUND_ORDER',
          referenceId: id,
          note: `入库单 ${order.inboundNo} 入库`,
        },
      });
    }

    return successResponse(updatedOrder, '入库确认成功');
  } catch (error) {
    console.error('Error confirming inbound order:', error);
    return errorResponse('入库确认失败');
  }
}
