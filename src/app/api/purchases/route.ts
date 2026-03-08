import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/purchases - 获取采购单列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};

    if (search) {
      where.OR = [
        { poNo: { contains: search } },
        { supplier: { companyName: { contains: search } } },
        { notes: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [purchases, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
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
                  sku: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      data: purchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}

// POST /api/purchases - 创建采购单
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      supplierId,
      currency,
      totalAmount,
      deliveryDate,
      paymentTerms,
      notes,
      items,
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Purchase order items are required' },
        { status: 400 }
      );
    }

    // Generate purchase order number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = await prisma.purchaseOrder.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), 1),
        },
      },
    });
    const poNo = `PO${year}${month}-${String(count + 1).padStart(4, '0')}`;

    const purchase = await prisma.purchaseOrder.create({
      data: {
        poNo,
        supplierId,
        status: 'PENDING',
        currency: currency || 'CNY',
        totalAmount: totalAmount || 0,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        paymentTerms,
        notes,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            specification: item.specification,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            receivedQty: 0,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
