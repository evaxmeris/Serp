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

// 拒绝审批请求 Schema
const RejectSchema = z.object({
  reason: z.string().min(1, '拒绝原因不能为空').max(500, '拒绝原因过长'),
});

// 四级审批中可被拒绝的步骤
const REJECTABLE_STEPS = ['PENDING_REVIEW', 'PENDING_APPROVAL', 'PENDING_FINANCE'];

// POST /api/v1/logistics/orders/[id]/reject
// 拒绝订单：任意审批步骤 → REJECTED，status → DRAFT
// 需是当前步骤的负责人或 ADMIN
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
    const v = validateOrReturn(RejectSchema, body);
    if (!v.success) return v.response;

    // 检查订单是否存在
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approvalStep: true,
        reviewerId: true,
        approverId: true,
        financeId: true,
        notes: true,
      },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    // 验证当前审批步骤是否可被拒绝
    if (!REJECTABLE_STEPS.includes(existing.approvalStep)) {
      return conflictResponse(
        `当前审批步骤不支持拒绝操作，当前步骤: ${existing.approvalStep}`
      );
    }

    // 权限检查：只有当前步骤的负责人或 ADMIN 可以拒绝
    if (session.role !== 'ADMIN') {
      const isCurrentStepOwner =
        (existing.approvalStep === 'PENDING_REVIEW' && existing.reviewerId === session.id) ||
        (existing.approvalStep === 'PENDING_APPROVAL' && existing.approverId === session.id) ||
        (existing.approvalStep === 'PENDING_FINANCE' && existing.financeId === session.id);
      if (!isCurrentStepOwner) {
        return forbiddenResponse('只有当前审批步骤的负责人可以执行拒绝操作');
      }
    }

    // 更新订单：拒绝，退回草稿状态
    const rejectionNote = `[审批拒绝${existing.approvalStep === 'PENDING_REVIEW' ? '(校对)' : existing.approvalStep === 'PENDING_APPROVAL' ? '(审批)' : '(财务)'}: ${v.data.reason}]`;
    const order = await prisma.logisticsOrder.update({
      where: { id },
      data: {
        status: 'DRAFT',
        approvalStep: 'REJECTED',
        rejectReason: v.data.reason,
        rejectAt: new Date(),
        notes: existing.notes
          ? `${existing.notes}\n${rejectionNote}`
          : rejectionNote,
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
      },
    });

    return successResponse(order, '订单审批已拒绝，退回草稿状态');
  } catch (error) {
    console.error('拒绝物流订单失败:', error);
    return errorResponse('拒绝物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
