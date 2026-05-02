import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

// PATCH /api/quotations/[id]/view - 将报价单标记为已查看
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return notFoundResponse('报价单');
    }

    // 仅当当前状态为 SENT 时才转为 VIEWED
    if (existingQuotation.status !== 'SENT') {
      return errorResponse('只有已发送的报价单可以标记为已查看', 'INVALID_STATUS', 409);
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: { status: 'VIEWED' },
    });

    return successResponse(quotation, '报价单已标记为已查看');
  } catch (error) {
    console.error('Error marking quotation as viewed:', error);
    return errorResponse('标记已查看失败', 'INTERNAL_ERROR', 500);
  }
}
