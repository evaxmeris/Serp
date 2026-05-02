/**
 * 询盘跟进记录 API
 * 为指定询盘创建和查询跟进记录
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// ==================== Schemas ====================

const CreateFollowUpSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'MESSAGE', 'OTHER']).default('CALL'),
  content: z.string().min(1, '跟进内容不能为空'),
  nextFollowUp: z.string().datetime().optional().nullable(),
});

// ==================== GET: 获取跟进列表 ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;

    // 验证询盘存在且有权访问
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: { id: true, assignedTo: true },
    });
    if (!inquiry) return notFoundResponse('询盘');
    if (session.role !== 'ADMIN' && inquiry.assignedTo !== session.id) {
      return errorResponse('无权访问此询盘', 'FORBIDDEN', 403);
    }

    const followUps = await prisma.followUp.findMany({
      where: { inquiryId: id },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(followUps);
  } catch (error) {
    console.error('获取跟进记录失败:', error);
    return errorResponse('获取跟进记录失败', 'INTERNAL_ERROR', 500);
  }
}

// ==================== POST: 创建跟进记录 ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;

    // 验证询盘存在且有权访问
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: { id: true, assignedTo: true },
    });
    if (!inquiry) return notFoundResponse('询盘');
    if (session.role !== 'ADMIN' && inquiry.assignedTo !== session.id) {
      return errorResponse('无权操作此询盘', 'FORBIDDEN', 403);
    }

    const body = await request.json();
    const v = validateOrReturn(CreateFollowUpSchema, body);
    if (!v.success) return v.response;

    const followUp = await prisma.followUp.create({
      data: {
        inquiryId: id,
        type: v.data.type,
        content: v.data.content,
        nextFollowUp: v.data.nextFollowUp ? new Date(v.data.nextFollowUp) : null,
      },
    });

    return createdResponse(followUp, '跟进记录创建成功');
  } catch (error) {
    console.error('创建跟进记录失败:', error);
    return errorResponse('创建跟进记录失败', 'INTERNAL_ERROR', 500);
  }
}
