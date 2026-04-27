/**
 * 审批流程单条记录 API — GET / PUT / DELETE
 *
 * GET    /api/v1/approval-workflows/[id]  — 获取流程详情（含步骤及审批人）
 * PUT    /api/v1/approval-workflows/[id]  — 更新流程及步骤（先删旧步骤再建新步骤）
 * DELETE /api/v1/approval-workflows/[id]  — 级联删除流程
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse, notFoundResponse, conflictResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// ==================== Zod Schemas ====================

/** 更新审批流程的 Zod Schema（所有字段可选） */
const UpdateApprovalWorkflowSchema = z.object({
  name: z.string().min(1, '流程名称不能为空').max(100, '流程名称过长').optional(),
  code: z.string().min(1, '流程编码不能为空').max(50, '流程编码过长')
    .regex(/^[A-Z][A-Z0-9_]*$/, '流程编码必须是大写字母开头，只包含大写字母、数字和下划线')
    .optional(),
  description: z.string().max(500, '流程说明过长').nullable().optional(),
  applicableTo: z.array(z.string().min(1)).min(1, '至少指定一个适用模块').optional(),
  isActive: z.boolean().optional(),
  steps: z.array(z.object({
    order: z.number().int().min(1, '步骤序号从 1 开始'),
    name: z.string().min(1, '步骤名称不能为空').max(50, '步骤名称过长'),
    description: z.string().max(200, '步骤说明过长').nullable().optional(),
    assignees: z.array(z.object({
      userId: z.string().min(1).nullable().optional(),
      role: z.string().min(1).nullable().optional(),
    })).optional(),
  })).optional(),
});

// ==================== GET: 获取流程详情 ====================

export async function GET(
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

    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            assignees: true,
          },
        },
      },
    });

    if (!workflow) {
      return notFoundResponse('审批流程');
    }

    return successResponse(workflow);
  } catch (error) {
    console.error('获取审批流程详情失败:', error);
    return errorResponse('获取审批流程详情失败', 'INTERNAL_ERROR', 500);
  }
}

// ==================== PUT: 更新流程及步骤 ====================

export async function PUT(
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

    // 检查流程是否存在
    const existing = await prisma.approvalWorkflow.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
    if (!existing) {
      return notFoundResponse('审批流程');
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(UpdateApprovalWorkflowSchema, body);
    if (!v.success) return v.response;

    const { name, code, description, applicableTo, isActive, steps } = v.data;

    // 如果更新 code，检查新 code 是否与其他记录冲突
    if (code && code !== existing.code) {
      const codeConflict = await prisma.approvalWorkflow.findUnique({
        where: { code },
        select: { id: true },
      });
      if (codeConflict) {
        return conflictResponse(`流程编码 "${code}" 已被其他流程使用`);
      }
    }

    // 事务更新：流程基本信息 + 步骤替换
    const workflow = await prisma.$transaction(async (tx) => {
      // 1. 更新流程基本信息
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (description !== undefined) updateData.description = description;
      if (applicableTo !== undefined) updateData.applicableTo = applicableTo;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (Object.keys(updateData).length > 0) {
        await tx.approvalWorkflow.update({
          where: { id },
          data: updateData,
        });
      }

      // 2. 如果传了 steps，先删除旧步骤再创建新步骤
      if (steps && steps.length > 0) {
        // 删除旧步骤（级联删除其 assignees）
        await tx.approvalWorkflowStep.deleteMany({
          where: { workflowId: id },
        });

        // 创建新步骤
        for (const step of steps) {
          await tx.approvalWorkflowStep.create({
            data: {
              workflowId: id,
              order: step.order,
              name: step.name,
              description: step.description || null,
              assignees: {
                create: (step.assignees || []).map((assignee) => ({
                  userId: assignee.userId || null,
                  role: assignee.role || null,
                })),
              },
            },
          });
        }
      }

      // 3. 返回完整的更新后流程
      return tx.approvalWorkflow.findUnique({
        where: { id },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: {
              assignees: true,
            },
          },
        },
      });
    });

    return successResponse(workflow, '审批流程更新成功');
  } catch (error) {
    console.error('更新审批流程失败:', error);
    return errorResponse('更新审批流程失败', 'INTERNAL_ERROR', 500);
  }
}

// ==================== DELETE: 级联删除流程 ====================

export async function DELETE(
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

    // 检查流程是否存在
    const existing = await prisma.approvalWorkflow.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return notFoundResponse('审批流程');
    }

    // 删除流程（steps 和 assignees 已设置 onDelete: Cascade，自动级联删除）
    await prisma.approvalWorkflow.delete({
      where: { id },
    });

    return successResponse(null, `审批流程 "${existing.name}" 已删除`);
  } catch (error) {
    console.error('删除审批流程失败:', error);
    return errorResponse('删除审批流程失败', 'INTERNAL_ERROR', 500);
  }
}
