import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateLogisticsQuotationSchema } from '@/lib/api-schemas';

// PUT /api/v1/logistics/providers/[id]/quotations/[qid] — 更新报价项
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: providerId, qid } = await params;
    const body = await request.json();
    const v = validateOrReturn(UpdateLogisticsQuotationSchema, body);
    if (!v.success) return v.response;

    // 检查报价是否存在且属于该服务商
    const existing = await prisma.logisticsQuotation.findFirst({
      where: { id: qid, providerId },
    });
    if (!existing) {
      return notFoundResponse('物流报价');
    }

    const quotation = await prisma.logisticsQuotation.update({
      where: { id: qid },
      data: v.data,
    });

    return successResponse(quotation, '物流报价更新成功');
  } catch (error) {
    console.error('更新物流报价失败:', error);
    return errorResponse('更新物流报价失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/v1/logistics/providers/[id]/quotations/[qid] — 删除报价项
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: providerId, qid } = await params;

    // 检查报价是否存在且属于该服务商
    const existing = await prisma.logisticsQuotation.findFirst({
      where: { id: qid, providerId },
      select: { id: true },
    });
    if (!existing) {
      return notFoundResponse('物流报价');
    }

    await prisma.logisticsQuotation.delete({
      where: { id: qid },
    });

    return successResponse(null, '物流报价删除成功');
  } catch (error) {
    console.error('删除物流报价失败:', error);
    return errorResponse('删除物流报价失败', 'INTERNAL_ERROR', 500);
  }
}
