/**
 * 订单批量发货 API
 */

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { successResponse, errorResponse, forbiddenResponse } from '@/lib/api-response';
import { canTransition } from '@/lib/order-status-machine';
import { z } from 'zod';

/**
 * POST /api/orders/batch-ship
 * 批量发货
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user || !['ADMIN', 'SALES', 'WAREHOUSE'].includes(user.role)) {
      return forbiddenResponse('需要发货权限');
    }

    // 解析请求数据
    const body = await request.json();
    const v = validateOrReturn(
      z.object({
        ids: z.array(z.string()),
        warehouseId: z.string().optional(),
        trackingNumbers: z.record(z.string()).optional(),
      }),
      body,
    );
    if (!v.success) return v.response;
    const { ids } = v.data;
    let { warehouseId } = v.data;
    const trackingNumbers = (body as any).trackingNumbers;

    // 查询订单
    const orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        orderNo: true,
        status: true,
      },
    });

    // 验证订单状态 — 使用状态机检查 CONFIRMED → SHIPPED 是合法转换
    const invalidOrders = orders.filter((o) => !canTransition(o.status, 'SHIPPED'));
    if (invalidOrders.length > 0) {
      return errorResponse(`以下订单状态不是已确认：${invalidOrders.map((o) => o.orderNo).join(', ')}`, 'VALIDATION_ERROR', 400);
    }

    // 如果未传入 warehouseId，从第一个订单关联的出库单获取
    if (!warehouseId) {
      const firstOutbound = await prisma.outboundOrder.findFirst({
        where: { orderId: ids[0] },
        select: { warehouseId: true },
      });
      if (firstOutbound?.warehouseId) {
        warehouseId = firstOutbound.warehouseId;
      } else {
        return errorResponse('请提供 warehouseId 参数，或确认订单已有出库单', 'VALIDATION_ERROR', 400);
      }
    }

    // 使用事务包装所有数据库操作
    const result = await prisma.$transaction(async (tx) => {
      // 批量更新订单状态
      const orderResult = await tx.order.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'SHIPPED',
        },
      });

      // 处理出库单
      for (const orderId of ids) {
        const existingOutbound = await tx.outboundOrder.findFirst({
          where: { orderId },
        });

        if (!existingOutbound) {
          const now = new Date();
          const year = now.getFullYear().toString();
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          const day = now.getDate().toString().padStart(2, '0');
          const timestamp = Date.now().toString(36).slice(-6);
          const random = Math.random().toString(36).slice(2, 6);
          const outboundNo = `OUT-${year}${month}${day}-${timestamp}${random}`;
          await tx.outboundOrder.create({
            data: {
              outboundNo,
              orderId,
              warehouseId,
              status: 'SHIPPED',
              shipmentId: trackingNumbers?.[orderId] || null,
            },
          });
        } else {
          await tx.outboundOrder.update({
            where: { id: existingOutbound.id },
            data: {
              status: 'SHIPPED',
              shipmentId: trackingNumbers?.[orderId] || existingOutbound.shipmentId,
            },
          });
        }
      }

      return orderResult;
    });

    return successResponse({ shippedCount: result.count }, `成功发货 ${result.count} 条订单`);
  } catch (error: any) {
    console.error('批量发货错误:', error);
    return errorResponse('发货失败：' + error.message, 'INTERNAL_ERROR', 500);
  }
}
