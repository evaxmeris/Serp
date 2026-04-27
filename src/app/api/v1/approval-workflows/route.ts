/**
 * 审批流程配置 API — CRUD 端点
 *
 * GET  /api/v1/approval-workflows        — 列表查询（支持 isActive 筛选）
 * POST /api/v1/approval-workflows        — 创建流程（含步骤及审批人）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, conflictResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// ==================== Zod Schemas ====================

/** 创建审批流程的 Zod Schema */
const CreateApprovalWorkflowSchema = z.object({
  name: z.string().min(1, '流程名称不能为空').max(100, '流程名称过长'),
  code: z.string().min(1, '流程编码不能为空').max(50, '流程编码过长')
    .regex(/^[A-Z][A-Z0-9_]*$/, '流程编码必须是大写字母开头，只包含大写字母、数字和下划线'),
  description: z.string().max(500, '流程说明过长').optional(),
  applicableTo: z.array(z.string().min(1)).min(1, '至少指定一个适用模块'),
  isActive: z.boolean().optional().default(true),
  steps: z.array(z.object({
    order: z.number().int().min(1, '步骤序号从 1 开始'),
    name: z.string().min(1, '步骤名称不能为空').max(50, '步骤名称过长'),
    description: z.string().max(200, '步骤说明过长').optional(),
    assignees: z.array(z.object({
      userId: z.string().min(1).optional(),
      role: z.string().min(1).optional(),
    })).min(1, '每个步骤至少指定一名审批人').optional(),
  })).min(1, '至少包含一个审批步骤'),
});

// ==================== GET: 列表查询 ====================

export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const isActiveParam = searchParams.get('isActive');

    // 构建查询条件 — 支持 isActive 筛选
    const where: any = {};
    if (isActiveParam !== null && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true';
    }

    const [workflows, total] = await Promise.all([
      prisma.approvalWorkflow.findMany({
        where,
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: {
              assignees: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.approvalWorkflow.count({ where }),
    ]);

    return listResponse(workflows, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('获取审批流程列表失败:', error);
    return errorResponse('获取审批流程列表失败', 'INTERNAL_ERROR', 500);
  }
}

// ==================== POST: 创建流程 ====================

export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(CreateApprovalWorkflowSchema, body);
    if (!v.success) return v.response;

    const { name, code, description, applicableTo, isActive, steps } = v.data;

    // 检查 code 是否已被占用
    const existing = await prisma.approvalWorkflow.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      return conflictResponse(`流程编码 "${code}" 已被使用`);
    }

    // 事务创建：流程 + 步骤 + 审批人
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        name,
        code,
        description: description || null,
        applicableTo,
        isActive: isActive ?? true,
        steps: {
          create: steps.map((step) => ({
            order: step.order,
            name: step.name,
            description: step.description || null,
            assignees: {
              create: (step.assignees || []).map((assignee) => ({
                userId: assignee.userId || null,
                role: assignee.role || null,
              })),
            },
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            assignees: true,
          },
        },
      },
    });

    return createdResponse(workflow, `审批流程 "${name}" 创建成功`);
  } catch (error) {
    console.error('创建审批流程失败:', error);
    return errorResponse('创建审批流程失败', 'INTERNAL_ERROR', 500);
  }
}
