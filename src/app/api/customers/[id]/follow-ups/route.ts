import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const CreateFollowUpSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'WHATSAPP', 'NOTE']).default('NOTE'),
  content: z.string().min(1, '跟进内容不能为空').max(2000),
  nextFollowUp: z.string().optional(),
});

// POST /api/customers/[id]/follow-ups
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: customerId } = await params;

    // 检查客户是否存在
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return errorResponse('客户不存在', 'NOT_FOUND', 404);
    }

    const body = await request.json();
    const v = CreateFollowUpSchema.safeParse(body);
    if (!v.success) {
      return errorResponse(v.error.errors[0]?.message || '参数错误', 'VALIDATION_ERROR', 400);
    }

    const followUp = await prisma.followUp.create({
      data: {
        customerId,
        type: v.data.type,
        content: v.data.content,
        nextFollowUp: v.data.nextFollowUp ? new Date(v.data.nextFollowUp) : null,
      },
    });

    return successResponse(followUp, 201);
  } catch (error) {
    console.error('Error creating follow-up:', error);
    return errorResponse('创建跟进记录失败', 'INTERNAL_ERROR', 500);
  }
}

// GET /api/customers/[id]/follow-ups
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: customerId } = await params;

    const followUps = await prisma.followUp.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse(followUps);
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    return errorResponse('获取跟进记录失败', 'INTERNAL_ERROR', 500);
  }
}
