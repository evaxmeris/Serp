import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';

/**
 * 出库单确认 API
 * 将出库单从 PENDING 状态确认为 SHIPPED 状态
 */

/**
 * POST /api/v1/outbound-orders/[id]/confirm
 * 确认出库单（发货）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

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

    // 只有待确认状态的出库单可以确认
    if (outboundOrder.status !== 'PENDING') {
      return conflictResponse(`当前状态为 ${outboundOrder.status}，无法确认`);
    }

    // 更新出库单状态为已发货
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 更新出库单状态
      const order = await tx.outboundOrder.update({
        where: { id },
        data: { status: 'SHIPPED' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          order: true,
        },
      });

      // 如果有关联的销售订单，更新销售订单的出库状态
      if (outboundOrder.orderId) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: outboundOrder.orderId },
        });

        // 计算已出库数量
        const outboundItems = await tx.outboundOrderItem.findMany({
          where: {
            outboundOrder: {
              orderId: outboundOrder.orderId,
              status: 'SHIPPED',
            },
          },
        });

        // 更新销售订单项目的已出库数量
        for (const orderItem of orderItems) {
          const shippedQty = outboundItems
            .filter(item => item.productId === orderItem.productId)
            .reduce((sum, item) => sum + item.quantity, 0);

          if (shippedQty > 0) {
            await tx.orderItem.update({
              where: { id: orderItem.id },
              data: {
                shippedQty: { increment: shippedQty },
              },
            });
          }
        }

        // 检查是否所有项目都已出库
        const allShipped = orderItems.every(item => {
          const shippedQty = outboundItems
            .filter(outItem => outItem.productId === item.productId)
            .reduce((sum, outItem) => sum + outItem.quantity, 0);
          return shippedQty >= item.quantity;
        });

        if (allShipped) {
          await tx.order.update({
            where: { id: outboundOrder.orderId },
            data: { status: 'SHIPPED' },
          });
        }
      }

      return order;
    });

    return successResponse(updatedOrder, '出库单已确认发货');
  } catch (error) {
    console.error('Error confirming outbound order:', error);
    return errorResponse('确认出库单失败');
  }
}
