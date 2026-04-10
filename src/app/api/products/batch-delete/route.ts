/**
 * 产品批量删除 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/products/batch-delete
 * 批量删除产品
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user || !['ADMIN', 'SALES'].includes(user.role)) {
      return NextResponse.json(
        { error: '需要产品管理权限' },
        { status: 403 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '产品 ID 不能为空' },
        { status: 400 }
      );
    }

    // 限制批量大小
    if (ids.length > 100) {
      return NextResponse.json(
        { error: '单次最多删除 100 条产品' },
        { status: 400 }
      );
    }

    // 检查是否有关联数据
    const relatedData = await prisma.$transaction([
      prisma.inventoryItem.count({
        where: { productId: { in: ids } },
      }),
      prisma.orderItem.count({
        where: { productId: { in: ids } },
      }),
      prisma.purchaseOrderItem.count({
        where: { productId: { in: ids } },
      }),
    ]);

    const [inventoryCount, orderItemCount, purchaseItemCount] = relatedData;
    const totalCount = inventoryCount + orderItemCount + purchaseItemCount;

    if (totalCount > 0) {
      return NextResponse.json(
        {
          error: `无法删除：有 ${totalCount} 条关联数据（库存 ${inventoryCount} + 订单 ${orderItemCount} + 采购 ${purchaseItemCount}）`,
        },
        { status: 400 }
      );
    }

    // 软删除：设置 deletedAt 字段
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: {
        deletedAt: new Date(),
        status: 'DISCONTINUED', // 同时设置状态为已停产
      },
    });

    return NextResponse.json({
      success: true,
      message: `成功软删除 ${result.count} 条产品`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error('批量删除错误:', error);
    return NextResponse.json(
      { error: '删除失败：' + error.message },
      { status: 500 }
    );
  }
}
