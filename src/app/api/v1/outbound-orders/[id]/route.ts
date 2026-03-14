import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { z } from 'zod';

/**
 * 出库单 API - 单个出库单的详情、更新和删除
 */

// 更新出库单 Schema（部分字段可更新）
const UpdateOutboundOrderSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'SHIPPED', 'CANCELLED']).optional(),
  items: z.array(z.object({
    id: z.string().optional(), // 如果有 ID 则是更新，没有则是新增
    productId: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    warehouseId: z.string().optional(),
    batchNo: z.string().optional(),
    location: z.string().optional(),
    unitPrice: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).optional(),
});

const QuerySchema = z.object({
  include: z.string().optional(), // 指定要包含的关联数据
});

/**
 * GET /api/v1/outbound-orders/[id]
 * 获取单个出库单详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const { include } = queryResult.data;

    // 构建 include 对象
    const includeData: any = {
      items: {
        include: {
          product: true,
        },
      },
      shipment: true,
    };

    const outboundOrder = await prisma.outboundOrder.findUnique({
      where: { id },
      include: includeData,
    });

    if (!outboundOrder) {
      return notFoundResponse('出库单');
    }

    return successResponse(outboundOrder, 'SUCCESS');
  } catch (error) {
    console.error('Error fetching outbound order:', error);
    return errorResponse('获取出库单详情失败');
  }
}

/**
 * PUT /api/v1/outbound-orders/[id]
 * 更新出库单
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validationResult = UpdateOutboundOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 检查出库单是否存在
    const existingOrder = await prisma.outboundOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return notFoundResponse('出库单');
    }

    // 只有草稿状态的出库单可以修改
    if (existingOrder.status !== 'DRAFT') {
      return conflictResponse('只有草稿状态的出库单可以修改');
    }

    // 更新出库单
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 更新状态（如果提供了）
      if (data.status) {
        await tx.outboundOrder.update({
          where: { id },
          data: { status: data.status },
        });
      }

      // 更新项目（如果提供了）
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (item.id) {
            // 更新现有项目
            await tx.outboundOrderItem.update({
              where: { id: item.id },
              data: {
                productId: item.productId,
                quantity: item.quantity,
                warehouseId: item.warehouseId,
                batchNo: item.batchNo,
                location: item.location,
                unitPrice: item.unitPrice,
                notes: item.notes,
              },
            });
          } else if (item.productId) {
            // 新增项目
            await tx.outboundOrderItem.create({
              data: {
                outboundOrderId: id,
                productId: item.productId,
                quantity: item.quantity || 1,
                warehouseId: item.warehouseId || 'MAIN',
                batchNo: item.batchNo,
                location: item.location,
                unitPrice: item.unitPrice || 0,
                notes: item.notes,
              },
            });
          }
        }
      }

      // 返回更新后的出库单
      return await tx.outboundOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return successResponse(updatedOrder, '出库单更新成功');
  } catch (error) {
    console.error('Error updating outbound order:', error);
    return errorResponse('更新出库单失败');
  }
}

/**
 * DELETE /api/v1/outbound-orders/[id]
 * 删除出库单
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查出库单是否存在
    const existingOrder = await prisma.outboundOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return notFoundResponse('出库单');
    }

    // 只有草稿或已取消的出库单可以删除
    if (!['DRAFT', 'CANCELLED'].includes(existingOrder.status)) {
      return conflictResponse('只有草稿或已取消状态的出库单可以删除');
    }

    // 删除出库单（级联删除项目）
    await prisma.outboundOrder.delete({
      where: { id },
    });

    return successResponse(null, '出库单删除成功');
  } catch (error) {
    console.error('Error deleting outbound order:', error);
    return errorResponse('删除出库单失败');
  }
}
