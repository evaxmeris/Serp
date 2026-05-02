import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermission } from '@/middleware/auth';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

/**
 * 发票 API - POST /api/v1/invoices/[id]/send
 * 标记发票为已发送状态（DRAFT → SENT）
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // RBAC 权限检查：invoices:send
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'invoices:send');
    if (permError) return permError;

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return notFoundResponse('发票');
    if (invoice.status !== 'DRAFT') {
      return errorResponse('只有草稿状态的发票可以发送', 'INVALID_STATUS', 400);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' },
    });

    return successResponse(updated, '发票已发送');
  } catch (e) {
    console.error(e);
    return errorResponse('发送失败', 'INTERNAL_ERROR', 500);
  }
}
