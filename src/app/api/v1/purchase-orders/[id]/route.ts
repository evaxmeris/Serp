import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
} from '@/lib/api-response';
import {
  UpdatePurchaseOrderSchema,
  PurchaseOrderIdSchema,
} from '@/lib/validators/purchase-order';

// GET /api/v1/purchase-orders/[id] - 获取采购订单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const validationResult = PurchaseOrderIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            companyEn: true,
            contactName: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        purchaser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNo: true,
            customerId: true,
            status: true,
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
            receiptItems: true,
          },
        },
        receipts: {
          orderBy: { receiptDate: 'desc' },
          include: {
            items: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!purchaseOrder) {
      return notFoundResponse('采购订单');
    }

    return successResponse(purchaseOrder);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return errorResponse('获取采购订单详情失败', 'INTERNAL_ERROR');
  }
}

// PUT /api/v1/purchase-orders/[id] - 更新采购订单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const validationResult = PurchaseOrderIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    // 检查采购订单是否存在
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return notFoundResponse('采购订单');
    }

    // 检查订单状态
    if (
      existingOrder.status === 'COMPLETED' ||
      existingOrder.status === 'CANCELLED'
    ) {
      return errorResponse(
        '已完成或已取消的订单不可修改',
        'ORDER_INVALID_STATUS',
        409
      );
    }

    const body = await request.json();
    const updateResult = UpdatePurchaseOrderSchema.safeParse(body);

    if (!updateResult.success) {
      return validationErrorResponse(extractZodErrors(updateResult.error));
    }

    const data = updateResult.data;

    // 更新采购订单
    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data,
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
          },
        },
        items: true,
      },
    });

    return successResponse(purchaseOrder, '采购订单更新成功');
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return errorResponse('更新采购订单失败', 'INTERNAL_ERROR');
  }
}

// DELETE /api/v1/purchase-orders/[id] - 删除采购订单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const validationResult = PurchaseOrderIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    // 检查采购订单是否存在
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            receipts: true,
            payments: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return notFoundResponse('采购订单');
    }

    // 检查是否有关联的入库单或付款
    if (
      existingOrder._count.receipts > 0 ||
      existingOrder._count.payments > 0
    ) {
      return errorResponse(
        '采购订单存在关联的入库单或付款记录，无法删除',
        'CONFLICT',
        409
      );
    }

    // 删除采购订单
    await prisma.purchaseOrder.delete({
      where: { id },
    });

    return successResponse(null, '采购订单删除成功', 'NO_CONTENT');
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return errorResponse('删除采购订单失败', 'INTERNAL_ERROR');
  }
}

// POST /api/v1/purchase-orders/[id]/confirm - 确认采购订单
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const validationResult = PurchaseOrderIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    // 检查采购订单是否存在
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return notFoundResponse('采购订单');
    }

    // 检查订单状态
    if (existingOrder.status !== 'PENDING') {
      return errorResponse(
        '只有待确认状态的订单可以确认',
        'ORDER_INVALID_STATUS',
        409
      );
    }

    const body = await request.json();
    const { notes } = body;

    // 确认订单
    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        notes: notes || existingOrder.notes,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    return successResponse(purchaseOrder, '采购订单已确认');
  } catch (error) {
    console.error('Error confirming purchase order:', error);
    return errorResponse('确认采购订单失败', 'INTERNAL_ERROR');
  }
}
