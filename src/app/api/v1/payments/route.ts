import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, successResponse, notFoundResponse } from '@/lib/api-response';

// GET /api/v1/payments
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';

    const where: any = {};
    if (type) where.type = type;
    if (search) where.OR = [{ counterparty: { contains: search } }, { referenceNo: { contains: search } }];

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit }),
      prisma.payment.count({ where }),
    ]);
    return listResponse(payments, { page, limit, total, totalPages: Math.ceil(total/limit) });
  } catch (e) { console.error(e); return errorResponse('获取失败', 'INTERNAL_ERROR', 500); }
}

// POST /api/v1/payments
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const body = await request.json();
    const payment = await prisma.payment.create({ data: {
      type: body.type || 'INCOME', amount: body.amount, currency: body.currency || 'CNY',
      counterparty: body.counterparty, referenceNo: body.referenceNo || null,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      status: body.status || 'COMPLETED', notes: body.notes || null,
    }});
    return createdResponse(payment, '创建成功');
  } catch (e) { console.error(e); return errorResponse('创建失败', 'INTERNAL_ERROR', 500); }
}
