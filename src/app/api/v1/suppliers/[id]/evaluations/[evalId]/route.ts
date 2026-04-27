import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; evalId: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { evalId } = await params;
    await prisma.supplierEvaluation.delete({ where: { id: evalId } });
    return successResponse(null, '删除成功');
  } catch (e) { console.error(e); return errorResponse('删除失败', 'INTERNAL_ERROR', 500); }
}
