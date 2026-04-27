import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, notFoundResponse, conflictResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateInquirySchema } from '@/lib/api-schemas';

// GET /api/inquiries/[id] - 获取询盘详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
          },
        },
        followUps: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inquiry) {
      return notFoundResponse('询盘');
    }

    // 行级权限：非 ADMIN 用户只能查看分配给自己的询盘
    if (session.role !== 'ADMIN' && inquiry.assignedTo !== session.id) {
      return errorResponse('无权访问此询盘', 'FORBIDDEN', 403);
    }

    return successResponse(inquiry);
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    return errorResponse('Failed to fetch inquiry', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/inquiries/[id] - 更新询盘
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;

    // 行级权限：非 ADMIN 用户只能更新分配给自己的询盘
    const existingInquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: { assignedTo: true },
    });
    if (!existingInquiry) {
      return notFoundResponse('询盘');
    }
    if (session.role !== 'ADMIN' && existingInquiry.assignedTo !== session.id) {
      return errorResponse('无权修改此询盘', 'FORBIDDEN', 403);
    }

    const body = await request.json();
    const v = validateOrReturn(UpdateInquirySchema, body);
    if (!v.success) return v.response;

    const {
      source,
      status,
      priority,
      deadline,
      products,
      quantity,
      targetPrice,
      currency,
      requirements,
      assignedTo,
      notes,
    } = v.data;

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: {
        source,
        status,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        products,
        quantity,
        targetPrice: targetPrice != null ? targetPrice : undefined,
        currency,
        requirements,
        assignedTo,
        notes,
      },
    });

    return successResponse(inquiry, '询盘更新成功');
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return errorResponse('Failed to update inquiry', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/inquiries/[id] - 删除询盘（需检查关联报价单）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;

    // 行级权限：非 ADMIN 用户只能删除分配给自己的询盘
    const existingInquiry = await prisma.inquiry.findUnique({
      where: { id, deletedAt: null },
      select: { assignedTo: true },
    });
    if (!existingInquiry) {
      return notFoundResponse('询盘');
    }
    if (session.role !== 'ADMIN' && existingInquiry.assignedTo !== session.id) {
      return errorResponse('无权删除此询盘', 'FORBIDDEN', 403);
    }

    // 检查关联报价单
    const relatedQuotations = await prisma.quotation.findMany({
      where: { inquiryId: id, deletedAt: null },
      select: { id: true, quotationNo: true },
      take: 10,
    });

    // 如果有关联报价单，返回 409 禁止删除
    if (relatedQuotations.length > 0) {
      return conflictResponse(
        `无法删除询盘：存在关联报价单(${relatedQuotations.map(q => q.quotationNo).join(', ')})`
      );
    }

    await prisma.inquiry.delete({
      where: { id },
    });

    return successResponse(null, '询盘删除成功');
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    return errorResponse('Failed to delete inquiry', 'INTERNAL_ERROR', 500);
  }
}
