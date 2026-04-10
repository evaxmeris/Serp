/**
 * 订单批量确认 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orders/batch-confirm
 * 批量确认订单
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user || !['ADMIN', 'SALES'].includes(user.role)) {
      return NextResponse.json(
        { error: '需要销售管理权限' },
        { status: 403 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '订单 ID 不能为空' },
        { status: 400 }
      );
    }

    // 限制批量大小
    if (ids.length > 100) {
      return NextResponse.json(
        { error: '单次最多确认 100 条订单' },
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
    const invalidOrders = orders.filter((o) => o.status !== 'PENDING');
    if (invalidOrders.length > 0) {
      return NextResponse.json(
        {
          error: `以下订单状态不是待确认：${invalidOrders.map((o) => o.orderNo).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 批量更新订单状态
    const result = await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // 记录操作日志
    await prisma.approvalHistory.createMany({
      data: ids.map((id: string) => ({
        recordId: id,
        orderId: id,
        step: 1,
        approverId: user.id,
        action: 'APPROVE',
        status: 'APPROVED',
        comments: `批量确认订单，共 ${ids.length} 条`,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `成功确认 ${result.count} 条订单`,
      confirmedCount: result.count,
    });
  } catch (error: any) {
    console.error('批量确认错误:', error);
    return NextResponse.json(
      { error: '确认失败：' + error.message },
      { status: 500 }
    );
  }
}
