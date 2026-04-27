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

// 财务确认请求 Schema
const FinanceConfirmSchema = z.object({
  comment: z.string().max(500).optional(), // 财务确认意见
});

// POST /api/v1/logistics/orders/[id]/finance-confirm
// 财务确认：PENDING_FINANCE → APPROVED
// 只有 financeId 匹配的用户或 ADMIN 可以操作
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
    const v = validateOrReturn(FinanceConfirmSchema, body);
    if (!v.success) return v.response;

    // 检查订单是否存在
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approvalStep: true,
        financeId: true,
        notes: true,
      },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    // 验证当前审批步骤必须是 PENDING_FINANCE
    if (existing.approvalStep !== 'PENDING_FINANCE') {
      return conflictResponse(
        `只有财务确认中的订单可以确认，当前审批步骤: ${existing.approvalStep}`
      );
    }

    // 权限检查：只有指定的财务人或 ADMIN 可以操作
    if (session.role !== 'ADMIN' && existing.financeId !== session.id) {
      return forbiddenResponse('只有指定的财务人员可以执行财务确认操作');
    }

    // 更新订单：财务确认通过，订单审批完成
    const financeNote = v.data.comment
      ? `[财务确认: ${v.data.comment}]`
      : '[财务确认通过]';
    const order = await prisma.logisticsOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvalStep: 'APPROVED',
        financeConfirmedById: session.id,
        financeConfirmedAt: new Date(),
        notes: existing.notes
          ? `${existing.notes}\n${financeNote}`
          : financeNote,
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
        financeConfirmedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(order, '财务确认通过，订单审批完成');
  } catch (error) {
    console.error('财务确认物流订单失败:', error);
    return errorResponse('财务确认物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
