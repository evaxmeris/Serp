/**
 * 批量删除产品调研 API
 * 
 * @module api/product-research/products/batch-delete
 * @method DELETE - 批量删除产品调研
 */

import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse, notFoundResponse, validationErrorResponse, createdResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// DELETE /api/product-research/products/batch-delete
// 批量删除产品调研
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const { ids } = body;

    // 验证参数
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse('请选择要删除的产品', 'VALIDATION_ERROR', 400);
    }

    // 批量删除产品调研
    await prisma.productResearch.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return successResponse(null, `成功删除 ${ids.length} 个产品`);
  } catch (error) {
    console.error('批量删除失败:', error);
    return errorResponse('批量删除失败', 'INTERNAL_ERROR', 500);
  }
}
