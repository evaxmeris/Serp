import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { orderUpdateSchema, orderConfirmSchema, orderCancelSchema } from '@/lib/validators/order';

/**
 * GET /api/orders/[id] - 获取订单详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            country: true,
            address: true,
          },
        },
        salesRep: {
          select: {
            id: true,
            name: true,
            email: true,
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
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        shipments: {
          orderBy: { createdAt: 'desc' },
        },
        productionRecords: {
          orderBy: { createdAt: 'desc' },
        },
        qualityChecks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return notFoundResponse('订单');
    }

    // 格式化响应数据
    const formattedOrder = {
      id: order.id,
      orderNo: order.orderNo,
      customer: order.customer,
      sourceInquiry: order.sourceInquiryId
        ? { id: order.sourceInquiryId, inquiryNo: `INQ-${order.sourceInquiryId.slice(-8)}` }
        : null,
      sourceQuotation: order.sourceQuotationId
        ? { id: order.sourceQuotationId, quotationNo: `QT-${order.sourceQuotationId.slice(-8)}` }
        : null,
      status: order.status,
      approvalStatus: order.approvalStatus,
      currency: order.currency,
      exchangeRate: order.exchangeRate.toNumber(),
      totalAmount: order.totalAmount.toNumber(),
      paidAmount: order.paidAmount.toNumber(),
      balanceAmount: order.balanceAmount.toNumber(),
      paymentTerms: order.paymentTerms,
      paymentDeadline: order.paymentDeadline,
      deliveryTerms: order.deliveryTerms,
      deliveryDate: order.deliveryDate,
      deliveryDeadline: order.deliveryDeadline,
      shippingAddress: order.shippingAddress,
      shippingContact: order.shippingContact,
      shippingPhone: order.shippingPhone,
      salesRep: order.salesRep,
      items: order.items.map((item: any) => ({
        id: item.id,
        product: item.product
          ? {
              id: item.product.id,
              sku: item.product.sku,
              name: item.product.name,
            }
          : null,
        productName: item.productName,
        productSku: item.productSku,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice.toNumber(),
        discountRate: item.discountRate.toNumber(),
        amount: item.amount.toNumber(),
        productionStatus: item.productionStatus,
        shippedQty: item.shippedQty,
        deliveredQty: item.deliveredQty,
        notes: item.notes,
      })),
      payments: order.payments.map((payment: any) => ({
        id: payment.id,
        paymentNo: payment.paymentNo,
        amount: payment.amount.toNumber(),
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate,
        status: 'COMPLETED',
      })),
      shipments: order.shipments.map((shipment: any) => ({
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        carrier: shipment.carrier,
        trackingNo: shipment.trackingNo,
        etd: shipment.etd,
        eta: shipment.eta,
        status: shipment.status,
      })),
      productionRecords: order.productionRecords.map((record: any) => ({
        id: record.id,
        productionNo: record.productionNo,
        status: record.status,
        progress: record.progress,
        plannedStartDate: record.plannedStartDate,
        plannedEndDate: record.plannedEndDate,
        actualStartDate: record.actualStartDate,
        actualEndDate: record.actualEndDate,
      })),
      qualityChecks: order.qualityChecks.map((check: any) => ({
        id: check.id,
        qcNo: check.qcNo,
        type: check.type,
        status: check.status,
        inspectionDate: check.inspectionDate,
      })),
      notes: order.notes,
      internalNotes: order.internalNotes,
      attachments: order.attachments,
      confirmedAt: order.confirmedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    return successResponse(formattedOrder);
  } catch (error) {
    console.error('Error fetching order:', error);
    return errorResponse('获取订单详情失败', 'INTERNAL_ERROR');
  }
}

/**
 * PUT /api/orders/[id] - 更新订单
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return notFoundResponse('订单');
    }

    // 已取消的订单不可修改
    if (existingOrder.status === 'CANCELLED') {
      return conflictResponse('已取消的订单不可修改', 'ORDER_ALREADY_CANCELLED');
    }

    // 解析并验证请求体
    const body = await request.json();
    const validationResult = orderUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const updateData = validationResult.data;

    // 验证交货日期
    if (updateData.deliveryDate) {
      const deliveryDateTime = new Date(updateData.deliveryDate);
      if (deliveryDateTime <= new Date()) {
        return conflictResponse('交货日期必须晚于当前日期', 'ORDER_INVALID_DELIVERY_DATE');
      }
    }

    // 更新订单
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...updateData,
        paymentDeadline: updateData.paymentDeadline
          ? new Date(updateData.paymentDeadline)
          : undefined,
        deliveryDate: updateData.deliveryDate
          ? new Date(updateData.deliveryDate)
          : undefined,
        deliveryDeadline: updateData.deliveryDeadline
          ? new Date(updateData.deliveryDeadline)
          : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return successResponse({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      updatedAt: order.updatedAt,
    }, '订单更新成功');
  } catch (error) {
    console.error('Error updating order:', error);
    return errorResponse('更新订单失败', 'INTERNAL_ERROR');
  }
}

/**
 * DELETE /api/orders/[id] - 删除订单
 * 仅允许删除 PENDING 状态的订单
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查订单是否存在
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            payments: true,
            shipments: true,
          },
        },
      },
    });

    if (!order) {
      return notFoundResponse('订单');
    }

    // 只有 PENDING 状态的订单可以删除
    if (order.status !== 'PENDING') {
      return conflictResponse(
        `只有待确认状态的订单可以删除，当前状态：${order.status}`,
        'ORDER_INVALID_STATUS'
      );
    }

    // 已有收款或发货记录的订单不可删除
    if (order._count.payments > 0 || order._count.shipments > 0) {
      return conflictResponse(
        '已有收款或发货记录的订单不可删除',
        'ORDER_HAS_RELATED_RECORDS'
      );
    }

    // 删除订单
    await prisma.order.delete({
      where: { id },
    });

    return successResponse(null, '订单删除成功', 'NO_CONTENT');
  } catch (error) {
    console.error('Error deleting order:', error);
    return errorResponse('删除订单失败', 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/orders/[id]/confirm - 确认订单
 * POST /api/orders/[id]/cancel - 取消订单
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // 检查路径是否包含 /confirm 或 /cancel
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (pathname.endsWith('/confirm')) {
    return handleConfirm(id, request);
  }
  
  if (pathname.endsWith('/cancel')) {
    return handleCancel(id, request);
  }

  return errorResponse('方法不允许', 'BAD_REQUEST', 400);
}

/**
 * 处理订单确认
 */
async function handleConfirm(id: string, request: NextRequest) {
  try {
    // 检查订单是否存在
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return notFoundResponse('订单');
    }

    // 只有 PENDING 状态的订单可以确认
    if (order.status !== 'PENDING') {
      return conflictResponse(
        `只有待确认状态的订单可以确认，当前状态：${order.status}`,
        'ORDER_INVALID_STATUS'
      );
    }

    // 解析请求体
    const body = await request.json().catch(() => ({}));
    const validationResult = orderConfirmSchema.safeParse(body || {});

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const { notes } = validationResult.data;

    // 更新订单状态
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        notes: notes ? `${order.notes || ''}\n${notes}`.trim() : order.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return successResponse({
      id: updatedOrder.id,
      orderNo: updatedOrder.orderNo,
      status: updatedOrder.status,
      confirmedAt: updatedOrder.confirmedAt,
    }, '订单已确认');
  } catch (error) {
    console.error('Error confirming order:', error);
    return errorResponse('确认订单失败', 'INTERNAL_ERROR');
  }
}

/**
 * 处理订单取消
 */
async function handleCancel(id: string, request: NextRequest) {
  try {
    // 检查订单是否存在
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return notFoundResponse('订单');
    }

    // SHIPPED 及之后状态的订单不可取消
    const nonCancellableStatuses = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    if (nonCancellableStatuses.includes(order.status)) {
      return conflictResponse(
        `当前状态（${order.status}）的订单不可取消`,
        'ORDER_INVALID_STATUS'
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = orderCancelSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const { cancelReason, notes } = validationResult.data;

    // 更新订单状态
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason,
        notes: notes ? `${order.notes || ''}\n${notes}`.trim() : order.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return successResponse({
      id: updatedOrder.id,
      orderNo: updatedOrder.orderNo,
      status: updatedOrder.status,
      cancelledAt: updatedOrder.cancelledAt,
      cancelReason: updatedOrder.cancelReason,
    }, '订单已取消');
  } catch (error) {
    console.error('Error cancelling order:', error);
    return errorResponse('取消订单失败', 'INTERNAL_ERROR');
  }
}
