/**
 * 订单批量确认 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

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
    const v = validateOrReturn(z.object({ ids: z.array(z.string()) }), body);
    if (!v.success) return v.response;
    const { ids } = v.data;

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

    // 使用事务包装所有数据库操作
    const result = await prisma.$transaction(async (tx) => {
      // 批量更新订单状态
      const orderResult = await tx.order.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      // 记录操作日志
      await tx.approvalHistory.createMany({
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

      return orderResult;
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
