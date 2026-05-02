import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse, notFoundResponse } from '@/lib/api-response';

// POST /api/quotations/[id]/send - 发送报价单 - 需要认证
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const body = await request.json();

    // 验证输入
    const v = validateOrReturn(z.object({
      recipientEmails: z.array(z.string().email()),
      attachments: z.array(z.string()).optional(),
    }), body);
    if (!v.success) return v.response;
    const validatedData = v.data;

    // 检查报价单是否存在
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!quotation) {
      return notFoundResponse('Quotation');
    }

    // 更新报价单状态为 SENT
    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: {
        status: 'SENT',
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // TODO: 实现邮件发送逻辑
    // 这里可以集成邮件服务发送报价单

    // 如果有附件，处理附件逻辑
    if (validatedData.attachments && validatedData.attachments.length > 0) {
      // 处理附件
    }

    return successResponse({ quotation: updatedQuotation, sentTo: validatedData.recipientEmails, sentAt: new Date().toISOString() }, '报价单已发送');
  } catch (error) {
    console.error('Error sending quotation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse('Validation failed', 'VALIDATION_ERROR', 400);
    }
    return errorResponse('Failed to send quotation', 'INTERNAL_ERROR', 500);
  }
}
