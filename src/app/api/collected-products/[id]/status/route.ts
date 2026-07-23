import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// POST /api/collected-products/[id]/status - 更新管线状态
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const { status } = await request.json();

    const validStatuses = ['collected', 'organizing', 'ready', 'discarded'];
    if (!validStatuses.includes(status)) {
      return errorResponse('无效的状态值', 'VALIDATION_ERROR', 422);
    }

    const existing = await prisma.collectedProduct.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('采集产品不存在');

    const updateData: any = { pipelineStatus: status };
    if (status === 'organizing') updateData.organizedAt = new Date();

    const product = await prisma.collectedProduct.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ id: product.id, pipelineStatus: product.pipelineStatus });
  } catch (error) {
    console.error('Error updating status:', error);
    return errorResponse('更新状态失败', 'INTERNAL_ERROR', 500);
  }
}
