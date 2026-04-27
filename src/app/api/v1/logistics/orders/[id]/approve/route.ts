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

// 审批请求 Schema
const ApproveSchema = z.object({
  comment: z.string().max(500).optional(), // 审批意见
});

// POST /api/v1/logistics/orders/[id]/approve
// 审批通过：PENDING_APPROVAL → PENDING_FINANCE
// 只有 approverId 匹配的用户或 ADMIN 可以操作
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
    const v = validateOrReturn(ApproveSchema, body);
    if (!v.success) return v.response;

    // 检查订单是否存在
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approvalStep: true,
        approverId: true,
        notes: true,
      },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    // 验证当前审批步骤必须是 PENDING_APPROVAL
    if (existing.approvalStep !== 'PENDING_APPROVAL') {
      return conflictResponse(
        `只有审批中的订单可以审批通过，当前审批步骤: ${existing.approvalStep}`
      );
    }

    // 权限检查：只有指定的审批人或 ADMIN 可以操作
    if (session.role !== 'ADMIN' && existing.approverId !== session.id) {
      return forbiddenResponse('只有指定的审批人可以执行审批操作');
    }

    // 更新订单：审批通过，进入财务确认步骤
    const approvalNote = v.data.comment
      ? `[审批通过: ${v.data.comment}]`
      : '[审批通过]';
    const order = await prisma.logisticsOrder.update({
      where: { id },
      data: {
        status: 'PENDING_FINANCE',
        approvalStep: 'PENDING_FINANCE',
        approvedById: session.id,
        approvedAt: new Date(),
        notes: existing.notes
          ? `${existing.notes}\n${approvalNote}`
          : approvalNote,
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
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(order, '审批通过，已进入财务确认流程');
  } catch (error) {
    console.error('审批物流订单失败:', error);
    return errorResponse('审批物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
