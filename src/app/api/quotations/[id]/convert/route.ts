import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';

const ConvertSchema = z.object({
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  deliveryDeadline: z.string().datetime().optional(),
  shippingAddress: z.string().optional(),
  shippingContact: z.string().optional(),
  shippingPhone: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

// POST /api/quotations/[id]/convert - 报价单转订单
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Zod 验证
    const v = validateOrReturn(ConvertSchema, body);
    if (!v.success) return v.response;

    // 检查报价单是否存在
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
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

    // 检查报价单状态
    if (quotation.status === 'DRAFT') {
      return NextResponse.json(
        { error: '草稿状态的报价单不能转为订单，请先发送报价单' },
        { status: 400 }
      );
    }

    // 生成订单号
    const orderNo = `PO${Date.now()}`;

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId: quotation.customerId,
        sourceQuotationId: id,
        status: 'PENDING',
        currency: quotation.currency,
        exchangeRate: 1,
        totalAmount: quotation.totalAmount,
        paidAmount: 0,
        balanceAmount: quotation.totalAmount,
        paymentTerms: body.paymentTerms || quotation.paymentTerms,
        deliveryTerms: body.deliveryTerms || quotation.deliveryTerms,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        deliveryDeadline: body.deliveryDeadline ? new Date(body.deliveryDeadline) : null,
        shippingAddress: body.shippingAddress,
        shippingContact: body.shippingContact,
        shippingPhone: body.shippingPhone,
        notes: body.notes,
        internalNotes: body.internalNotes,
        items: {
          create: quotation.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.product?.sku || null,
            specification: item.specification,
            quantity: item.quantity,
            unit: 'PCS',
            unitPrice: item.unitPrice,
            discountRate: 0,
            amount: item.amount,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    // 更新报价单状态为 ACCEPTED
    await prisma.quotation.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
      },
    });

    return NextResponse.json({
      success: true,
      message: '报价单已转为订单',
      order: {
        id: order.id,
        orderNo: order.orderNo,
        customerId: order.customerId,
        customer: order.customer,
        totalAmount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
      },
      quotationId: id,
    });
  } catch (error) {
    console.error('Error converting quotation to order:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '请求参数验证失败' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to convert quotation to order' },
      { status: 500 }
    );
  }
}
