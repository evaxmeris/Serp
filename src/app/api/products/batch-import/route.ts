/**
 * 产品批量导入 API
 * 支持 Excel/CSV 格式导入
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/products/batch-import
 * 批量导入产品
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
    const { products, mode = 'create' } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: '产品数据不能为空' },
        { status: 400 }
      );
    }

    // 限制批量大小
    if (products.length > 1000) {
      return NextResponse.json(
        { error: '单次最多导入 1000 条产品' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };

    // 批量处理
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        // 验证必填字段
        if (!product.sku || !product.name) {
          results.failed++;
          results.errors.push({
            index: i + 1,
            error: '缺少必填字段：SKU 或名称',
          });
          continue;
        }

        // 检查 SKU 是否重复
        const existing = await prisma.product.findUnique({
          where: { sku: product.sku },
        });

        if (existing && mode === 'create') {
          results.failed++;
          results.errors.push({
            index: i + 1,
            error: `SKU ${product.sku} 已存在`,
          });
          continue;
        }

        // 创建或更新产品
        if (mode === 'update' && existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: product.name,
              nameEn: product.nameEn,
              unit: product.unit || 'PCS',
              costPrice: product.costPrice || 0,
              salePrice: product.salePrice || 0,
              currency: product.currency || 'USD',
              status: product.status || 'ACTIVE',
              category: product.category,
              description: product.description,
              images: product.images || [],
            },
          });
        } else {
          await prisma.product.create({
            data: {
              sku: product.sku,
              name: product.name,
              nameEn: product.nameEn,
              unit: product.unit || 'PCS',
              costPrice: product.costPrice || 0,
              salePrice: product.salePrice || 0,
              currency: product.currency || 'USD',
              status: product.status || 'ACTIVE',
              category: product.category,
              description: product.description,
              images: product.images || [],
            },
          });
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          index: i + 1,
          error: error.message || '未知错误',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`,
      results,
    });
  } catch (error: any) {
    console.error('批量导入错误:', error);
    return NextResponse.json(
      { error: '导入失败：' + error.message },
      { status: 500 }
    );
  }
}
