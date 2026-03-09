import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { quotationSendSchema } from '@/lib/validators/quotation';

// POST /api/quotations/[id]/send - 发送报价单
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 验证输入
    const validatedData = quotationSendSchema.parse(body);

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
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
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
    console.log('Sending quotation to:', validatedData.recipientEmails);
    console.log('Quotation details:', {
      quotationNo: quotation.quotationNo,
      customer: quotation.customer.companyName,
      totalAmount: quotation.totalAmount,
      currency: quotation.currency,
    });

    // 如果有附件，处理附件逻辑
    if (validatedData.attachments && validatedData.attachments.length > 0) {
      console.log('Attachments:', validatedData.attachments);
    }

    return NextResponse.json({
      success: true,
      message: '报价单已发送',
      quotation: updatedQuotation,
      sentTo: validatedData.recipientEmails,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error sending quotation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to send quotation' },
      { status: 500 }
    );
  }
}
