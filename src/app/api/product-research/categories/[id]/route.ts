/**
 * 品类详情 API - 获取/更新/删除单个品类
 * 
 * @module api/product-research/categories/[id]
 * @method GET - 获取品类详情（包含子品类和模板）
 * @method PUT - 更新品类信息
 * @method DELETE - 删除品类
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/product-research/categories/[id]
// 获取品类详情
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        // 包含父品类
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        // 包含子品类
        children: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            isActive: true,
          },
        },
        // 包含属性模板
        templates: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        // 统计产品数量
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          error: '品类不存在' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取品类详情失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/product-research/categories/[id]
// 更新品类信息
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 检查品类是否存在
    const existingCategory = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { 
          success: false, 
          error: '品类不存在' 
        },
        { status: 404 }
      );
    }

    // 如果修改了编码，检查新编码是否已被使用
    if (body.code && body.code !== existingCategory.code) {
      const codeExists = await prisma.productCategory.findUnique({
        where: { code: body.code },
      });

      if (codeExists) {
        return NextResponse.json(
          { 
            success: false, 
            error: '品类编码已存在' 
          },
          { status: 400 }
        );
      }
    }

    // 构建更新数据，只添加存在的字段，避免 undefined 导致错误
    const updateData: any = {};
    
    // 将空字符串转换为 null（前端选择"无"时传递空字符串）
    const normalizedParentId = body.parentId === '' ? null : body.parentId;
    
    // 只在字段存在时才添加到更新数据中
    if (body.name !== undefined) updateData.name = body.name;
    if (body.nameEn !== undefined) updateData.nameEn = body.nameEn || null;
    if (body.code !== undefined) updateData.code = body.code;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.icon !== undefined) updateData.icon = body.icon || null;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.parentId !== undefined) updateData.parentId = normalizedParentId;
    
    // 如果父品类发生了变化，需要重新计算层级和路径
    if (body.parentId !== undefined && normalizedParentId !== existingCategory.parentId) {
      if (normalizedParentId) {
        const parentCategory = await prisma.productCategory.findUnique({
          where: { id: normalizedParentId },
        });

        if (!parentCategory) {
          return NextResponse.json(
            { 
              success: false, 
              error: '父品类不存在' 
            },
            { status: 400 }
          );
        }

        // 不能将自己设为父品类
        if (normalizedParentId === id) {
          return NextResponse.json(
          { 
            success: false, 
            error: '不能将自己设为父品类' 
          },
          { status: 400 }
        );
        }

        updateData.level = parentCategory.level + 1;
        updateData.path = parentCategory.path ? `${parentCategory.path}/${parentCategory.id}` : parentCategory.id;
      } else {
        // 没有父品类，设为顶级品类
        updateData.level = 1;
        updateData.path = null;
      }
    } else {
      // 如果父品类没有变化，保持原有的 level 和 path
      updateData.level = existingCategory.level;
      updateData.path = existingCategory.path;
    }

    // 更新品类
    const category = await prisma.productCategory.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
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
      data: category,
      message: '品类更新成功',
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '更新品类失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/product-research/categories/[id]
// 删除品类
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查品类是否存在
    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            templates: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          error: '品类不存在' 
        },
        { status: 404 }
      );
    }

    // 检查是否有子品类
    if (category._count.children > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '该品类下有子品类，无法删除' 
        },
        { status: 400 }
      );
    }

    // 检查是否有属性模板
    if (category._count.templates > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '该品类下有属性模板，无法删除' 
        },
        { status: 400 }
      );
    }

    // 检查是否有产品
    if (category._count.products > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '该品类下有产品，无法删除' 
        },
        { status: 400 }
      );
    }

    // 删除品类
    await prisma.productCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '品类删除成功',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '删除品类失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
