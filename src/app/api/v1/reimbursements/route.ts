import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, successResponse, notFoundResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const [items, total] = await Promise.all([
      prisma.reimbursement.findMany({ orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit }),
      prisma.reimbursement.count(),
    ]);
    return listResponse(items, { page, limit, total, totalPages: Math.ceil(total/limit) });
  } catch (e) { console.error(e); return errorResponse('获取失败', 'INTERNAL_ERROR', 500); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const body = await request.json();
    const item = await prisma.reimbursement.create({ data: { title: body.title, amount: body.amount, currency: body.currency || 'CNY', category: body.category || 'TRAVEL', description: body.description || null, status: 'PENDING' } });
    return createdResponse(item, '创建成功');
  } catch (e) { console.error(e); return errorResponse('创建失败', 'INTERNAL_ERROR', 500); }
}
