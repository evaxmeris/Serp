/**
 * 产品永久删除 API
 * POST /api/products/permanent-delete
 * 从数据库中物理删除已软删除的产品
 */

import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/products/permanent-delete
 * 批量永久删除产品（物理删除）
 */
export async function POST(request: Request) {
  try {
    // 认证检查（与 batch-delete 相同权限）
    const user = await getCurrentUser();
    if (!user || !['admin', 'sales', 'purchasing'].includes(user.role)) {
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
          error: `无法永久删除：有 ${totalCount} 条关联数据（库存 ${inventoryCount} + 订单 ${orderItemCount} + 采购 ${purchaseItemCount}）`,
        },
        { status: 400 }
      );
    }

    // 物理删除（关联的 ProductAttributeValue 通过级联自动删除）
    const result = await prisma.product.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      success: true,
      message: `成功永久删除 ${result.count} 条产品`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error('永久删除产品错误:', error);
    return NextResponse.json(
      { error: '永久删除失败：' + error.message },
      { status: 500 }
    );
  }
}
