import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermission } from '@/middleware/auth';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { syncOrderPaymentStatus } from '@/lib/order-payment';

/**
 * 收款联动（与 POST 共用同一实现）：只重算已付/余额/收款状态，
 * 不把订单履约状态直接置为 COMPLETED —— 见 @/lib/order-payment。
 */

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
    await syncOrderPaymentStatus(prisma, existing.orderId);

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
    await syncOrderPaymentStatus(prisma, existing.orderId);

    return successResponse(null, '删除成功');
  } catch (e) {
    console.error(e);
    return notFoundResponse('记录');
  }
}
