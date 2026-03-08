import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/purchases/[id] - 获取采购单详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const purchase = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                specification: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

// PUT /api/purchases/[id] - 更新采购单
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      currency,
      totalAmount,
      deliveryDate,
      paymentTerms,
      notes,
    } = body;

    const purchase = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        currency,
        totalAmount,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        paymentTerms,
        notes,
      },
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

// DELETE /api/purchases/[id] - 删除采购单
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.purchaseOrder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
