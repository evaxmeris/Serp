import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateQuotationSchema } from '@/lib/api-schemas';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, validationErrorResponse, notFoundResponse } from '@/lib/api-response';

// GET /api/quotations/[id] - 获取报价单详情 - 需要认证
export async function GET(
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
    const quotation = await prisma.quotation.findUnique({
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
      return notFoundResponse('报价单');
    }

    // 计算是否过期
    let isExpired = false;
    if (quotation.validityDays && quotation.createdAt) {
      const expiryDate = new Date(quotation.createdAt);
      expiryDate.setDate(expiryDate.getDate() + quotation.validityDays);
      isExpired = new Date() > expiryDate;
    }

    // 如果已过期但状态未标记，自动更新状态为 EXPIRED
    if (isExpired && quotation.status !== 'EXPIRED' && quotation.status !== 'ACCEPTED' && quotation.status !== 'REJECTED') {
      await prisma.quotation.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      quotation.status = 'EXPIRED';
    }

    return successResponse({
      ...quotation,
      isExpired,
      expiryDate: quotation.validityDays
        ? new Date(quotation.createdAt.getTime() + quotation.validityDays * 86400000)
        : null,
    });
  } catch (error) {
    console.error('Error fetching quotation:', error);
    return errorResponse('获取报价详情失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/quotations/[id] - 更新报价单 - 需要认证
export async function PUT(
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
    const v = validateOrReturn(UpdateQuotationSchema, body);
    if (!v.success) return v.response;
    const validatedData = v.data;

    // 检查报价单是否存在并获取当前状态
    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingQuotation) {
      return notFoundResponse('报价单');
    }

    // 状态机验证：防止跳过中间状态或逆向流转
    const currentStatus = existingQuotation.status;
    const newStatus = validatedData.status;
    const QUOTATION_TRANSITIONS: Record<string, string[]> = {
      DRAFT:     ['SENT', 'EXPIRED'],
      SENT:      ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      VIEWED:    ['ACCEPTED', 'REJECTED', 'EXPIRED'],
      ACCEPTED:  [],
      REJECTED:  [],
      EXPIRED:   [],
    };
    if (newStatus && newStatus !== currentStatus) {
      const allowed = QUOTATION_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        return errorResponse(
          `无效的状态变更：${currentStatus} → ${newStatus}。允许的目标状态：${allowed.join(', ') || '无（终态不可变更）'}`,
          'INVALID_TRANSITION',
          422
        );
      }
    }

    // 构建更新数据（排除 customerId 和 inquiryId，因为这些通常不更新）
    const updateData: any = {};
    if (validatedData.status) updateData.status = validatedData.status;
    if (validatedData.currency) updateData.currency = validatedData.currency;
    if (validatedData.paymentTerms !== undefined) updateData.paymentTerms = validatedData.paymentTerms;
    if (validatedData.deliveryTerms !== undefined) updateData.deliveryTerms = validatedData.deliveryTerms;
    if (validatedData.validityDays !== undefined) updateData.validityDays = validatedData.validityDays;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

    // 如果有 items 更新，需要先删除现有 items
    if (validatedData.items) {
      await prisma.quotationItem.deleteMany({
        where: { quotationId: id },
      });

      const totalAmount = validatedData.items.reduce((sum, item) => {
        return sum + item.unitPrice * item.quantity;
      }, 0);

      updateData.totalAmount = totalAmount;
      updateData.items = {
        create: validatedData.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          specification: item.specification,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.unitPrice * item.quantity,
          notes: item.notes,
        })),
      };
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
      },
    });

    return successResponse(quotation, '报价单更新成功');
  } catch (error) {
    console.error('Error updating quotation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse('验证失败', 'VALIDATION_ERROR', 400);
    }
    return errorResponse('更新报价失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/quotations/[id] - 删除报价单 - 需要认证
export async function DELETE(
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

    // 检查报价单是否存在
    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return notFoundResponse('报价单');
    }

    // 软删除报价单（设置 deletedAt）
    await prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse({ success: true }, '报价单已删除');
  } catch (error) {
    console.error('Error deleting quotation:', error);
    return errorResponse('删除报价失败', 'INTERNAL_ERROR', 500);
  }
}
