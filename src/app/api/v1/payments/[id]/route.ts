import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const body = await request.json();
    const payment = await prisma.payment.update({ where: { id }, data: { type: body.type, amount: body.amount, currency: body.currency, counterparty: body.counterparty, referenceNo: body.referenceNo, paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined, notes: body.notes } });
    return successResponse(payment, '更新成功');
  } catch (e) { console.error(e); return notFoundResponse('记录'); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    await prisma.payment.delete({ where: { id } });
    return successResponse(null, '删除成功');
  } catch (e) { console.error(e); return notFoundResponse('记录'); }
}
