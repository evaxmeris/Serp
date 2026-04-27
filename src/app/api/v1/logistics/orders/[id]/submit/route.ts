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

// 提交订单请求 Schema
// 校对/审批/财务人员可选 — 如果审批流程配置中指定了具体人员则自动填充
const SubmitSchema = z.object({
  reviewerId: z.string().min(1, '请选择校对人').optional(),
  approverId: z.string().min(1, '请选择审批人').optional(),
  financeId: z.string().min(1, '请选择财务人员').optional(),
});

// POST /api/v1/logistics/orders/[id]/submit
// 提交订单：DRAFT → PENDING_REVIEW
// 自动查找 LOGISTICS_PURCHASE 审批流程，创建 ApprovalInstance
// 如果流程步骤中配置了具体 assignee 人员，自动填充 reviewerId/approverId/financeId
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
    const v = validateOrReturn(SubmitSchema, body);
    if (!v.success) return v.response;

    // 检查订单是否存在且状态正确
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: { id: true, status: true, approvalStep: true },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    if (existing.status !== 'DRAFT') {
      return conflictResponse(
        `只有草稿状态的订单可以提交，当前状态: ${existing.status}`
      );
    }

    // ——— 查找物流采购审批流程，自动填充审批人员 ———
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { code: 'LOGISTICS_PURCHASE', isActive: true },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            assignees: {
              select: { userId: true, role: true },
            },
          },
        },
      },
    });

    // 从流程步骤的 assignees 中提取具体用户 ID
    // 步骤映射：step1=提交, step2=校对→reviewerId, step3=审批→approverId, step4=财务确认→financeId
    let autoReviewerId: string | undefined;
    let autoApproverId: string | undefined;
    let autoFinanceId: string | undefined;

    if (workflow && workflow.steps.length >= 4) {
      // 步骤2 -> 校对人（取第一个有 userId 的 assignee）
      const reviewerStep = workflow.steps[1]; // order=2
      const reviewerAssignee = reviewerStep?.assignees?.find((a) => a.userId);
      if (reviewerAssignee?.userId) autoReviewerId = reviewerAssignee.userId;

      // 步骤3 -> 审批人
      const approverStep = workflow.steps[2]; // order=3
      const approverAssignee = approverStep?.assignees?.find((a) => a.userId);
      if (approverAssignee?.userId) autoApproverId = approverAssignee.userId;

      // 步骤4 -> 财务人员
      const financeStep = workflow.steps[3]; // order=4
      const financeAssignee = financeStep?.assignees?.find((a) => a.userId);
      if (financeAssignee?.userId) autoFinanceId = financeAssignee.userId;
    }

    // 合并：请求体传入的值优先，未传入时使用流程自动填充的值
    const reviewerId = v.data.reviewerId || autoReviewerId;
    const approverId = v.data.approverId || autoApproverId;
    const financeId = v.data.financeId || autoFinanceId;

    // 确保三个角色都已确定
    if (!reviewerId || !approverId || !financeId) {
      const missing: string[] = [];
      if (!reviewerId) missing.push('校对人');
      if (!approverId) missing.push('审批人');
      if (!financeId) missing.push('财务人员');
      return errorResponse(
        `未能确定以下审批角色: ${missing.join('、')}。请在审批流程中配置具体人员，或在提交时指定。`,
        'MISSING_ASSIGNEES',
        400
      );
    }

    // 校验指定的三个角色人员都是有效用户
    const userIds = [reviewerId, approverId, financeId];
    const uniqueIds = [...new Set(userIds)];
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, role: true },
    });

    const foundIds = new Set(users.map((u) => u.id));
    const invalidIds = uniqueIds.filter((uid) => !foundIds.has(uid));
    if (invalidIds.length > 0) {
      return errorResponse(
        `以下用户不存在: ${invalidIds.join(', ')}`,
        'INVALID_USER',
        400
      );
    }

    // ——— 创建审批流程实例（如果找到工作流） ———
    if (workflow) {
      await prisma.approvalInstance.upsert({
        where: {
          targetType_targetId: {
            targetType: 'LOGISTICS_ORDER',
            targetId: id,
          },
        },
        create: {
          workflowId: workflow.id,
          targetType: 'LOGISTICS_ORDER',
          targetId: id,
          currentStep: 1,
          status: 'IN_PROGRESS',
        },
        update: {
          workflowId: workflow.id,
          currentStep: 1,
          status: 'IN_PROGRESS',
          rejectReason: null,
          rejectAt: null,
          completedAt: null,
        },
      });
    }

    // 更新订单：设置提交人、提交时间和审批步骤
    const order = await prisma.logisticsOrder.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        approvalStep: 'PENDING_REVIEW',
        submitterId: session.id,
        submittedAt: new Date(),
        reviewerId,
        approverId,
        financeId,
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

    return successResponse(order, '物流订单已提交，进入校对流程');
  } catch (error) {
    console.error('提交物流订单失败:', error);
    return errorResponse('提交物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
