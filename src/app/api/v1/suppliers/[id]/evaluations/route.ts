import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, successResponse, notFoundResponse } from '@/lib/api-response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const evaluations = await prisma.supplierEvaluation.findMany({ where: { supplierId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return listResponse(evaluations, { page: 1, limit: 100, total: evaluations.length, totalPages: 1 });
  } catch (e) { console.error(e); return errorResponse('获取失败', 'INTERNAL_ERROR', 500); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const body = await request.json();
    const evaluation = await prisma.supplierEvaluation.create({ data: { supplierId: id, score: body.score, deliveryScore: body.deliveryScore, qualityScore: body.qualityScore, priceScore: body.priceScore, serviceScore: body.serviceScore, comment: body.comment, evaluatedAt: new Date() } });
    return createdResponse(evaluation, '评估创建成功');
  } catch (e) { console.error(e); return errorResponse('创建失败', 'INTERNAL_ERROR', 500); }
}
