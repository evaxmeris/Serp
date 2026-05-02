import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermission } from '@/middleware/auth';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

/**
 * 收款更新后重新计算订单已付金额和状态
 */
async function updateOrderPaymentStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, totalAmount: true, status: true, confirmedAt: true, completedAt: true },
  });

  if (!order) return;

  const payments = await prisma.payment.findMany({
    where: { orderId },
    select: { amount: true },
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
  const totalAmount = order.totalAmount.toNumber();
  const newBalance = Math.max(0, totalAmount - totalPaid);

  const updateData: any = {
    paidAmount: totalPaid,
    balanceAmount: newBalance,
  };

  const isFullyPaid = newBalance <= 0;
  const isPartiallyPaid = totalPaid > 0 && newBalance > 0;

  if (isFullyPaid) {
    if (order.status === 'PENDING') {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
      if (!order.confirmedAt) {
        updateData.confirmedAt = new Date();
      }
    } else if (!['COMPLETED', 'CANCELLED'].includes(order.status)) {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
    }
  } else if (isPartiallyPaid && order.status === 'PENDING') {
    updateData.status = 'CONFIRMED';
    updateData.confirmedAt = new Date();
  }

  await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });
}

// PUT /api/v1/payments/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // RBAC 权限检查：payments:edit
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'payments:edit');
    if (permError) return permError;

    const { id } = await params;
    const body = await request.json();

    // 获取当前支付记录以获取 orderId
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('收款记录');

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        amount: body.amount !== undefined ? body.amount : undefined,
        currency: body.currency || undefined,
        paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : undefined,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
        bankReference: body.bankReference !== undefined ? body.bankReference : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
    });

    // 重新计算订单收款状态
    await updateOrderPaymentStatus(existing.orderId);

    return successResponse(payment, '更新成功');
  } catch (e) {
    console.error(e);
    return notFoundResponse('记录');
  }
}

// DELETE /api/v1/payments/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // RBAC 权限检查：payments:delete
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'payments:delete');
    if (permError) return permError;

    const { id } = await params;

    // 删除前获取 orderId 用于后续重新计算
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('收款记录');

    await prisma.payment.delete({ where: { id } });

    // 删除后重新计算订单收款状态
    await updateOrderPaymentStatus(existing.orderId);

    return successResponse(null, '删除成功');
  } catch (e) {
    console.error(e);
    return notFoundResponse('记录');
  }
}
