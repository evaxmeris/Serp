import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, successResponse } from '@/lib/api-response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await getUserFromRequest(request); if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const receipts = await prisma.purchaseReceipt.findMany({ where: { purchaseOrderId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return listResponse(receipts, { page:1, limit:100, total:receipts.length, totalPages:1 });
  } catch(e) { return errorResponse('获取失败', 'INTERNAL_ERROR', 500); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await getUserFromRequest(request); if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params; const body = await request.json();
    const receipt = await prisma.purchaseReceipt.create({ data: { purchaseOrderId: id, quantity: body.quantity, warehouse: body.warehouse || null, notes: body.notes || null, status: 'COMPLETED' } });
    return createdResponse(receipt, '收货登记成功');
  } catch(e) { return errorResponse('创建失败', 'INTERNAL_ERROR', 500); }
}
