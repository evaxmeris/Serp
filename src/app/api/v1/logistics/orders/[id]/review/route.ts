import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  forbiddenResponse,
} from '@/lib/api-response';
import { z } from 'zod';
import { validateOrReturn } from '@/lib/api-validation';

// 校对请求 Schema
const ReviewSchema = z.object({
  comment: z.string().max(500).optional(), // 校对意见
});

// POST /api/v1/logistics/orders/[id]/review
// 校对通过：PENDING_REVIEW → PENDING_APPROVAL
// 只有 reviewerId 匹配的用户或 ADMIN 可以操作
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(ReviewSchema, body);
    if (!v.success) return v.response;

    // 检查订单是否存在
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approvalStep: true,
        reviewerId: true,
        notes: true,
      },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    // 验证当前审批步骤必须是 PENDING_REVIEW
    if (existing.approvalStep !== 'PENDING_REVIEW') {
      return conflictResponse(
        `只有校对中的订单可以校对通过，当前审批步骤: ${existing.approvalStep}`
      );
    }

    // 权限检查：只有指定的校对人或 ADMIN 可以操作
    if (session.role !== 'ADMIN' && existing.reviewerId !== session.id) {
      return forbiddenResponse('只有指定的校对人可以执行校对操作');
    }

    // 更新订单：校对通过，进入审批步骤
    const reviewNote = v.data.comment
      ? `[校对通过: ${v.data.comment}]`
      : '[校对通过]';
    const order = await prisma.logisticsOrder.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        approvalStep: 'PENDING_APPROVAL',
        reviewedById: session.id,
        reviewedAt: new Date(),
        notes: existing.notes
          ? `${existing.notes}\n${reviewNote}`
          : reviewNote,
      },
      include: {
        provider: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            contactPhone: true,
          },
        },
        submitter: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        finance: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(order, '校对通过，已进入审批流程');
  } catch (error) {
    console.error('校对物流订单失败:', error);
    return errorResponse('校对物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
