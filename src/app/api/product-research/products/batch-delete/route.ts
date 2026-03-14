/**
 * 批量删除产品调研 API
 * 
 * @module api/product-research/products/batch-delete
 * @method DELETE - 批量删除产品调研
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// DELETE /api/product-research/products/batch-delete
// 批量删除产品调研
// ============================================
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    // 验证参数
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '请选择要删除的产品' 
        },
        { status: 400 }
      );
    }

    // 批量删除产品调研
    await prisma.productResearch.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `成功删除 ${ids.length} 个产品`,
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '批量删除失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
