/**
 * 订单批量发货 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
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
      return NextResponse.json(
        { error: '需要发货权限' },
        { status: 403 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    const v = validateOrReturn(z.object({ ids: z.array(z.string()) }), body);
    if (!v.success) return v.response;
    const { ids } = v.data;
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

    // 验证订单状态
    const invalidOrders = orders.filter((o) => o.status !== 'CONFIRMED');
    if (invalidOrders.length > 0) {
      return NextResponse.json(
        {
          error: `以下订单状态不是已确认：${invalidOrders.map((o) => o.orderNo).join(', ')}`,
        },
        { status: 400 }
      );
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
          await tx.outboundOrder.create({
            data: {
              orderId,
              warehouseId: 'default',
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

    return NextResponse.json({
      success: true,
      message: `成功发货 ${result.count} 条订单`,
      shippedCount: result.count,
    });
  } catch (error: any) {
    console.error('批量发货错误:', error);
    return NextResponse.json(
      { error: '发货失败：' + error.message },
      { status: 500 }
    );
  }
}
