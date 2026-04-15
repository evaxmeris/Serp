/**
 * 产品调研详情 API - 获取/更新/删除单个产品调研
 * 
 * @module api/product-research/products/[id]
 * @method GET - 获取产品调研详情（包含属性值）
 * @method PUT - 更新产品调研信息
 * @method DELETE - 删除产品调研
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateResearchProductSchema } from '@/lib/api-schemas';

// ============================================
// GET /api/product-research/products/[id]
// 获取产品调研详情
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.productResearch.findUnique({
      where: { id },
      include: {
        // 包含品类信息
        category: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
        // 包含所有属性值
        attributes: {
          include: {
            attribute: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                code: true,
                type: true,
                unit: true,
                options: true,
                isRequired: true,
                isComparable: true,
                description: true,
              },
            },
          },
          orderBy: {
            attribute: {
              sortOrder: 'asc',
            },
          },
        },
        // 包含对比记录
        comparisons: {
          include: {
            products: {
              select: {
                isRecommended: true,
                score: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { 
          success: false, 
          error: '产品调研不存在' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取产品调研详情失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/product-research/products/[id]
// 更新产品调研信息
// ============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(CreateResearchProductSchema.partial(), body);
    if (!v.success) return v.response;
    const validatedBody = v.data;

    // 检查产品是否存在
    const existingProduct = await prisma.productResearch.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { 
          success: false, 
          error: '产品调研不存在' 
        },
        { status: 404 }
      );
    }

    // 如果修改了品类，验证新品类是否存在
    if (validatedBody.categoryId && validatedBody.categoryId !== existingProduct.categoryId) {
      const category = await prisma.productCategory.findUnique({
        where: { id: validatedBody.categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { 
            success: false, 
            error: '所属品类不存在' 
          },
          { status: 400 }
        );
      }
    }

    // 准备更新数据
    const updateData: any = { ...validatedBody };

    // 转换数值类型字段
    if (validatedBody.costPrice !== undefined) {
      updateData.costPrice = validatedBody.costPrice ? parseFloat(validatedBody.costPrice as any) : null;
    }
    if (validatedBody.salePrice !== undefined) {
      updateData.salePrice = validatedBody.salePrice ? parseFloat(validatedBody.salePrice as any) : null;
    }
    if (validatedBody.weight !== undefined) {
      updateData.weight = validatedBody.weight ? parseFloat(validatedBody.weight as any) : null;
    }
    if (validatedBody.volume !== undefined) {
      updateData.volume = validatedBody.volume ? parseFloat(validatedBody.volume as any) : null;
    }
    if (validatedBody.rating !== undefined) {
      updateData.rating = validatedBody.rating ? parseFloat(validatedBody.rating as any) : null;
    }

    // 更新产品调研
    const product = await prisma.productResearch.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: '产品调研更新成功',
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '更新产品调研失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/product-research/products/[id]
// 删除产品调研
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await getUserFromRequest(request);
      if (!session) {
        return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
      }

    const { id } = await params;

    // 检查产品是否存在
    const product = await prisma.productResearch.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { 
          success: false, 
          error: '产品调研不存在' 
        },
        { status: 404 }
      );
    }

    // 删除产品调研（属性值会级联删除）
    await prisma.productResearch.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '产品调研删除成功',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '删除产品调研失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
