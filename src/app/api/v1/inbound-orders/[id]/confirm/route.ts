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
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // 准备更新数据
    const updateData: any = {
      status: 'COMPLETED',
      actualDate: data.actualDate ? new Date(data.actualDate) : new Date(),
    };

    // 收集所有入库明细项
    let itemsToUpdate: Array<{ itemId: string; actualQuantity: number }> = [];

    if (data.items && data.items.length > 0) {
      // 如果提供了入库明细，验证并准备更新
      for (const item of data.items) {
        const orderItem = await prisma.inboundOrderItem.findUnique({
          where: { id: item.itemId },
        });
        
        if (!orderItem || orderItem.inboundOrderId !== id) {
          return notFoundResponse('入库明细项');
        }
        
        itemsToUpdate.push({
          itemId: item.itemId,
          actualQuantity: item.actualQuantity,
        });
      }
    } else {
      // 如果没有提供明细，默认全部入库
      const allItems = await prisma.inboundOrderItem.findMany({
        where: { inboundOrderId: id },
      });
      
      itemsToUpdate = allItems.map(item => ({
        itemId: item.id,
        actualQuantity: item.expectedQuantity,
      }));
    }

    // 使用完整事务包裹所有操作
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. 更新入库明细项的实际入库数量
      for (const item of itemsToUpdate) {
        await tx.inboundOrderItem.update({
          where: { id: item.itemId },
          data: {
            actualQuantity: item.actualQuantity,
          },
        });
      }

      // 2. 更新入库单状态
      const order = await tx.inboundOrder.update({
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

      // 3. 更新库存（在事务中）
      const warehouseCode = order.warehouseId || 'MAIN';

      for (const item of order.items) {
        const actualQty = item.actualQuantity || item.expectedQuantity;

        // 查找或创建库存记录
        let inventoryItem = await tx.inventoryItem.findUnique({
          where: {
            productId_warehouse: {
              productId: item.productId,
              warehouse: warehouseCode,
            },
          },
        });

        if (!inventoryItem) {
          inventoryItem = await tx.inventoryItem.create({
            data: {
              productId: item.productId,
              warehouse: warehouseCode,
              quantity: 0,
              availableQty: 0,
              reservedQty: 0,
            },
          });
        }

        // 更新库存数量
        const beforeQuantity = inventoryItem.quantity;
        const afterQuantity = beforeQuantity + actualQty;

        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: afterQuantity,
            availableQty: {
              increment: actualQty,
            },
            lastInboundDate: new Date(),
          },
        });

        // 创建库存流水
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            warehouseId: warehouseCode,
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

      return order;
    });

    return successResponse(updatedOrder, '入库确认成功');
  } catch (error) {
    console.error('Error confirming inbound order:', error);
    return errorResponse('入库确认失败');
  }
}
