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
import { prisma } from '@/lib/prisma';

// ============================================
// POST /api/product-research/products/batch
// 批量导入产品数据
// ============================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { products } = body;

    // 验证输入
    if (!Array.isArray(products)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'products 必须是数组'
        },
        { status: 400 }
      );
    }

    if (products.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '产品列表不能为空'
        },
        { status: 400 }
      );
    }

    if (products.length > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: '每批最多导入 100 个产品'
        },
        { status: 400 }
      );
    }

    // 验证必填字段
    const errors: string[] = [];
    products.forEach((product: any, index: number) => {
      if (!product.name) {
        errors.push(`第${index + 1}个产品：缺少产品名称`);
      }
      if (!product.brand) {
        errors.push(`第${index + 1}个产品：缺少品牌`);
      }
      if (!product.categoryId) {
        errors.push(`第${index + 1}个产品：缺少品类 ID`);
      }
      if (!product.costPrice && product.costPrice !== 0) {
        errors.push(`第${index + 1}个产品：缺少成本价`);
      }
      if (!product.salePrice && product.salePrice !== 0) {
        errors.push(`第${index + 1}个产品：缺少销售价`);
      }
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '数据验证失败',
          details: errors.slice(0, 10) // 只显示前 10 个错误
        },
        { status: 400 }
      );
    }

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
