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
 * 出库单批量操作 API
 * 支持批量确认、批量取消、批量导出
 */

// 批量操作 Schema
const BatchActionSchema = z.object({
  ids: z.array(z.string()).min(1, '至少选择一个出库单'),
  action: z.enum(['confirm', 'cancel', 'export']),
});

/**
 * POST /api/v1/outbound-orders/batch
 * 批量操作出库单
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = BatchActionSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const { ids, action } = validationResult.data;

    // 验证所有出库单存在
    const orders = await prisma.outboundOrder.findMany({
      where: { id: { in: ids } },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        order: true,
      },
    });

    if (orders.length !== ids.length) {
      const foundIds = orders.map(o => o.id);
      const missingIds = ids.filter(id => !foundIds.includes(id));
      return notFoundResponse(`出库单不存在 (IDs: ${missingIds.join(', ')})`);
    }

    // 执行批量操作
    switch (action) {
      case 'confirm':
        return await batchConfirm(orders);
      case 'cancel':
        return await batchCancel(orders);
      case 'export':
        return await batchExport(orders);
      default:
        return errorResponse('不支持的操作类型');
    }
  } catch (error) {
    console.error('Batch operation error:', error);
    return errorResponse('批量操作失败');
  }
}

/**
 * 批量确认出库单
 */
async function batchConfirm(orders: any[]) {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ id: string; reason: string }>,
  };

  for (const order of orders) {
    try {
      // 验证状态
      if (order.status !== 'PENDING') {
        results.failed.push({
          id: order.id,
          reason: `当前状态为 ${order.status}，无法确认`,
        });
        continue;
      }

      // 更新状态
      await prisma.outboundOrder.update({
        where: { id: order.id },
        data: { status: 'SHIPPED' },
      });

      // 更新关联销售订单
      if (order.orderId) {
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: order.orderId },
        });

        const outboundItems = await prisma.outboundOrderItem.findMany({
          where: {
            outboundOrder: {
              orderId: order.orderId,
              status: 'SHIPPED',
            },
          },
        });

        for (const orderItem of orderItems) {
          const shippedQty = outboundItems
            .filter(item => item.productId === orderItem.productId)
            .reduce((sum, item) => sum + item.quantity, 0);

          if (shippedQty > 0) {
            await prisma.orderItem.update({
              where: { id: orderItem.id },
              data: { shippedQty: { increment: shippedQty } },
            });
          }
        }

        const allShipped = orderItems.every(item => {
          const shippedQty = outboundItems
            .filter(outItem => outItem.productId === item.productId)
            .reduce((sum, outItem) => sum + outItem.quantity, 0);
          return shippedQty >= item.quantity;
        });

        if (allShipped) {
          await prisma.order.update({
            where: { id: order.orderId },
            data: { status: 'SHIPPED' },
          });
        }
      }

      results.success.push(order.outboundNo);
    } catch (error) {
      results.failed.push({
        id: order.id,
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return successResponse(
    {
      action: 'confirm',
      total: orders.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      success: results.success,
      failed: results.failed,
    },
    `批量确认完成：成功 ${results.success.length}，失败 ${results.failed.length}`
  );
}

/**
 * 批量取消出库单
 */
async function batchCancel(orders: any[]) {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ id: string; reason: string }>,
  };

  for (const order of orders) {
    try {
      // 验证状态
      if (!['DRAFT', 'PENDING'].includes(order.status)) {
        results.failed.push({
          id: order.id,
          reason: `当前状态为 ${order.status}，无法取消`,
        });
        continue;
      }

      // 更新状态
      await prisma.outboundOrder.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      // 如果是 PENDING 状态，恢复库存
      if (order.status === 'PENDING') {
        const warehouseCode = order.warehouseId; // 从父对象获取仓库 ID
        for (const item of order.items) {
          await prisma.inventoryItem.update({
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

          const inventoryItem = await prisma.inventoryItem.findUnique({
            where: {
              productId_warehouse: {
                productId: item.productId,
                warehouse: warehouseCode,
              },
            },
          });

          await prisma.inventoryLog.create({
            data: {
              productId: item.productId,
              warehouseId: warehouseCode,
              type: 'RETURN',
              quantity: item.quantity,
              beforeQuantity: inventoryItem ? inventoryItem.quantity - item.quantity : 0,
              afterQuantity: inventoryItem?.quantity || 0,
              referenceType: 'OUTBOUND_ORDER',
              referenceId: order.id,
              note: `批量取消出库单：${order.outboundNo}`,
            },
          });
        }
      }

      results.success.push(order.outboundNo);
    } catch (error) {
      results.failed.push({
        id: order.id,
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return successResponse(
    {
      action: 'cancel',
      total: orders.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      success: results.success,
      failed: results.failed,
    },
    `批量取消完成：成功 ${results.success.length}，失败 ${results.failed.length}`
  );
}

/**
 * 批量导出出库单
 */
async function batchExport(orders: any[]) {
  try {
    // 生成 CSV 格式数据
    const csvRows = [
      ['出库单号', '销售订单', '客户', '仓库', '商品数', '总金额', '状态', '创建时间'],
    ];

    for (const order of orders) {
      csvRows.push([
        order.outboundNo,
        order.order?.orderNo || '-',
        order.order?.customer?.companyName || '-',
        order.warehouse?.name || '-',
        order.items?.length || 0,
        order.totalAmount ? `¥${order.totalAmount.toFixed(2)}` : '-',
        order.status,
        new Date(order.createdAt).toLocaleString('zh-CN'),
      ]);
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    return successResponse({
      action: 'export',
      format: 'csv',
      count: orders.length,
      data: csvContent,
    }, `导出 ${orders.length} 条出库单记录`);
  } catch (error) {
    console.error('Export error:', error);
    return errorResponse('导出失败');
  }
}
