/**
 * 订单批量确认 API
 */

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { successResponse, errorResponse, forbiddenResponse } from '@/lib/api-response';
import { canTransition } from '@/lib/order-status-machine';
import { z } from 'zod';

/**
 * POST /api/orders/batch-confirm
 * 批量确认订单
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user || !['admin', 'sales'].includes(user.role)) {
      return forbiddenResponse('需要销售管理权限');
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

    // 验证订单状态 — 使用状态机检查 PENDING → CONFIRMED 是合法转换
    const invalidOrders = orders.filter((o) => !canTransition(o.status, 'CONFIRMED'));
    if (invalidOrders.length > 0) {
      return errorResponse(`以下订单状态不是待确认：${invalidOrders.map((o) => o.orderNo).join(', ')}`, 'VALIDATION_ERROR', 400);
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

      return orderResult;
    });

    return successResponse({ confirmedCount: result.count }, `成功确认 ${result.count} 条订单`);
  } catch (error: any) {
    console.error('批量确认错误:', error);
    return errorResponse('确认失败：' + error.message, 'INTERNAL_ERROR', 500);
  }
}
