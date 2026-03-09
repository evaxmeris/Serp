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

const UpdateInboundOrderSchema = z.object({
  type: z.enum(['PURCHASE_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'OTHER_IN']).optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  expectedDate: z.string().optional(),
  totalAmount: z.number().optional(),
  note: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    productId: z.string(),
    expectedQuantity: z.number().min(1),
    unitPrice: z.number().min(0),
    batchNo: z.string().optional(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
  })).optional(),
});

// GET /api/v1/inbound-orders/[id] - 获取入库单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
        purchaseOrder: true,
        inventoryLogs: true,
      },
    });

    if (!order) {
      return notFoundResponse('入库单');
    }

    return successResponse(order);
  } catch (error) {
    console.error('Error fetching inbound order:', error);
    return errorResponse('获取入库单详情失败');
  }
}

// PUT /api/v1/inbound-orders/[id] - 更新入库单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 检查入库单是否存在
    const existingOrder = await prisma.inboundOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return notFoundResponse('入库单');
    }

    // 检查状态
    if (existingOrder.status === 'COMPLETED' || existingOrder.status === 'CANCELLED') {
      return conflictResponse('只能更新待入库状态的入库单');
    }

    const validationResult = UpdateInboundOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 更新入库单
    const updatedOrder = await prisma.inboundOrder.update({
      where: { id },
      data: {
        type: data.type,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
        totalAmount: data.totalAmount,
        note: data.note,
        updatedAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return successResponse(updatedOrder, '入库单更新成功');
  } catch (error) {
    console.error('Error updating inbound order:', error);
    return errorResponse('更新入库单失败');
  }
}

// DELETE /api/v1/inbound-orders/[id] - 删除入库单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: {
        inventoryLogs: true,
      },
    });

    if (!order) {
      return notFoundResponse('入库单');
    }

    // 检查状态
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return conflictResponse('只能删除待入库状态的入库单');
    }

    // 检查是否已有库存流水
    if (order.inventoryLogs && order.inventoryLogs.length > 0) {
      return conflictResponse('已有库存流水的入库单不能删除');
    }

    // 删除入库单（级联删除 items）
    await prisma.inboundOrder.delete({
      where: { id },
    });

    return successResponse({ success: true }, '入库单删除成功');
  } catch (error) {
    console.error('Error deleting inbound order:', error);
    return errorResponse('删除入库单失败');
  }
}
