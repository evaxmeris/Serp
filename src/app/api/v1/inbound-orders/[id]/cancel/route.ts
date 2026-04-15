import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// POST /api/v1/inbound-orders/[id]/cancel - 取消入库
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
    const v = validateOrReturn(z.object({ reason: z.string().optional() }), body);
    if (!v.success) return v.response;

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
    });

    if (!order) {
      return notFoundResponse('入库单');
    }

    // 检查状态
    if (order.status === 'COMPLETED') {
      return conflictResponse('已完成的入库单不能取消');
    }

    if (order.status === 'CANCELLED') {
      return conflictResponse('入库单已取消');
    }

    // 更新状态
    const updatedOrder = await prisma.inboundOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        items: true,
      },
    });

    return successResponse(updatedOrder, '入库单取消成功');
  } catch (error) {
    console.error('Error cancelling inbound order:', error);
    return errorResponse('入库单取消失败');
  }
}
