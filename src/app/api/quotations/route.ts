import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/quotations - 获取报价列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ]);

    return NextResponse.json({
      data: quotations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotations' },
      { status: 500 }
    );
  }
}

// POST /api/quotations - 创建报价
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerId,
      currency,
      paymentTerms,
      deliveryTerms,
      validityDays,
      notes,
      items,
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // 生成报价单号
    const quotationNo = `QT${Date.now()}`;

    // 计算总金额
    const totalAmount = items?.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0);
    }, 0) || 0;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        customerId,
        currency: currency || 'USD',
        paymentTerms,
        deliveryTerms,
        validityDays,
        notes,
        totalAmount,
        status: 'DRAFT',
        items: {
          create: items?.map((item: any) => ({
            productName: item.productName || '',
            specification: item.specification || '',
            quantity: parseInt(item.quantity) || 0,
            unitPrice: parseFloat(item.unitPrice) || 0,
            amount: (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0),
            notes: item.notes,
          })) || [],
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error('Error creating quotation:', error);
    return NextResponse.json(
      { error: 'Failed to create quotation' },
      { status: 500 }
    );
  }
}
