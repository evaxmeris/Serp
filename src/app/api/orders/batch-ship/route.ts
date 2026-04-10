/**
 * 订单批量发货 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

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
    const { ids, trackingNumbers } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '订单 ID 不能为空' },
        { status: 400 }
      );
    }

    // 限制批量大小
    if (ids.length > 100) {
      return NextResponse.json(
        { error: '单次最多发货 100 条订单' },
        { status: 400 }
      );
    }

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

    // 批量更新订单状态
    const result = await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'SHIPPED',
        // 如果有物流单号，更新到第一个出库单
      },
    });

    // 创建出库单（如果还没有）
    for (const orderId of ids) {
      const existingOutbound = await prisma.outboundOrder.findFirst({
        where: { orderId },
      });

      if (!existingOutbound) {
        await prisma.outboundOrder.create({
          data: {
            orderId,
            warehouseId: 'default',
            status: 'SHIPPED',
            shipmentId: trackingNumbers?.[orderId] || null,
          },
        });
      } else {
        await prisma.outboundOrder.update({
          where: { id: existingOutbound.id },
          data: {
            status: 'SHIPPED',
            shipmentId: trackingNumbers?.[orderId] || existingOutbound.shipmentId,
          },
        });
      }
    }

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
