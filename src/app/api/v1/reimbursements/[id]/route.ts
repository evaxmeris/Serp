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
    const item = await prisma.reimbursement.update({ where: { id }, data: { title: body.title, amount: body.amount, currency: body.currency, category: body.category, description: body.description, status: body.status } });
    return successResponse(item, '更新成功');
  } catch (e) { console.error(e); return notFoundResponse('报销记录'); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    await prisma.reimbursement.delete({ where: { id } });
    return successResponse(null, '删除成功');
  } catch (e) { console.error(e); return notFoundResponse('报销记录'); }
}
