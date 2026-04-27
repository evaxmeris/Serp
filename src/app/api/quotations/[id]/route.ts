import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateQuotationSchema } from '@/lib/api-schemas';
import { getUserFromRequest } from '@/lib/auth-api';

// GET /api/quotations/[id] - 获取报价单详情 - 需要认证
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(quotation);
  } catch (error) {
    console.error('Error fetching quotation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotation' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // 验证输入
    const v = validateOrReturn(UpdateQuotationSchema, body);
    if (!v.success) return v.response;
    const validatedData = v.data;

    // 检查报价单是否存在
    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
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

    return NextResponse.json(quotation);
  } catch (error) {
    console.error('Error updating quotation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update quotation' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 检查报价单是否存在
    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    // 删除报价单（级联删除 items）
    await prisma.quotation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    return NextResponse.json(
      { error: 'Failed to delete quotation' },
      { status: 500 }
    );
  }
}
