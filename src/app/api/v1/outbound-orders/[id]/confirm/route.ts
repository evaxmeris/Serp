import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { confirmOutboundOrderOnce } from '@/lib/outbound-confirm';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

/**
 * 出库单确认 API
 * 将出库单从 PENDING 状态确认为 SHIPPED 状态
 *
 * 幂等保证：
 *   - 状态领取用 updateMany({ where: { id, status: 'PENDING' } }) 原子完成，
 *     重复点击 / 并发确认只有第一次生效，后续返回 409，不会重复累计已出数量。
 *   - 库存扣减发生在【出库单创建】时，确认动作不碰库存表，因此连续确认两次库存只扣一次。
 */

/**
 * POST /api/v1/outbound-orders/[id]/confirm
 * 确认出库单（发货）
 */
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
    // 允许空 body（前端确认按钮可能不带 body）
    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(z.object({ notes: z.string().optional() }), body ?? {});
    if (!v.success) return v.response;

    const result = await prisma.$transaction(async (tx) => {
      const confirmed = await confirmOutboundOrderOnce(tx, id);
      if (!confirmed.ok) return confirmed;

      return {
        ok: true as const,
        order: await tx.outboundOrder.findUnique({
          where: { id },
          include: {
            items: { include: { product: true } },
            order: true,
          },
        }),
      };
    });

    if (!result.ok) {
      if (result.reason === 'NOT_FOUND') return notFoundResponse('出库单');
      return conflictResponse(`当前状态为 ${result.status}，无法确认`);
    }

    return successResponse(result.order, '出库单已确认发货');
  } catch (error) {
    console.error('Error confirming outbound order:', error);
    return errorResponse('确认出库单失败');
  }
}
