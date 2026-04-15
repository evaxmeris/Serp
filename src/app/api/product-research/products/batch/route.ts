/**
 * 批量导入产品 API - Batch Import Products
 * 
 * @module api/product-research/products/batch
 * @method POST - 批量导入产品数据
 * 
 * 功能：
 * - 批量创建产品（支持 50-100 条/批）
 * - 事务处理确保数据一致性
 * - 返回导入结果统计
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// ============================================
// POST /api/product-research/products/batch
// 批量导入产品数据
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ products: z.array(z.object({
      name: z.string(),
      brand: z.string(),
      categoryId: z.string(),
      costPrice: z.coerce.number(),
      salePrice: z.coerce.number(),
    })).min(1).max(100) }), body);
    if (!v.success) return v.response;
    const { products } = v.data;

    // 使用事务批量创建产品
    const createdProducts = await prisma.$transaction(
      products.map((product: any) =>
        prisma.productResearch.create({
          data: {
            name: product.name,
            nameEn: product.nameEn || null,
            brand: product.brand,
            brandEn: product.brandEn || null,
            model: product.model || null,
            manufacturer: product.manufacturer || null,
            sourcePlatform: product.sourcePlatform || null,
            costPrice: parseFloat(product.costPrice),
            salePrice: parseFloat(product.salePrice),
            currency: product.currency || 'USD',
            categoryId: product.categoryId,
            status: product.status || 'DRAFT',
            conclusion: product.conclusion || null,
            assignedTo: product.assignedTo || null,
            notes: product.notes || null,
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        total: createdProducts.length,
        products: createdProducts,
      },
    });
  } catch (error) {
    console.error('批量导入失败:', error);
    
    // 事务失败回滚
    return NextResponse.json(
      { 
        success: false, 
        error: '批量导入失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
