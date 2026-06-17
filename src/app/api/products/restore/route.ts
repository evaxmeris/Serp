/**
 * 产品恢复 API
 * POST /api/products/restore
 * 恢复已软删除的产品（设置 deletedAt = null, status = 'ACTIVE'）
 */

import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/products/restore
 * 批量恢复已删除的产品
 */
export async function POST(request: Request) {
  try {
    // 认证检查（与 batch-delete 相同权限）
    const user = await getCurrentUser();
    if (!user || !['ADMIN', 'SALES', 'PURCHASING'].includes(user.role)) {
      return NextResponse.json(
        { error: '需要产品管理权限' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '请至少选择一个产品' },
        { status: 400 }
      );
    }

    // 恢复产品：设置 deletedAt = null, status = 'ACTIVE'
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: {
        deletedAt: null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: `成功恢复 ${result.count} 条产品`,
      restoredCount: result.count,
    });
  } catch (error: any) {
    console.error('恢复产品错误:', error);
    return NextResponse.json(
      { error: '恢复失败：' + error.message },
      { status: 500 }
    );
  }
}
