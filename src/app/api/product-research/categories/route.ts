/**
 * 品类管理 API - 获取品类列表/创建品类
 * 
 * @module api/product-research/categories
 * @method GET - 获取品类列表（支持树形结构）
 * @method POST - 创建新品类
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/product-research/categories
// 获取品类列表（支持树形结构）
// ============================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId'); // 父品类 ID（获取子品类）
    const isActive = searchParams.get('isActive'); // 是否只获取启用品类
    const includeChildren = searchParams.get('includeChildren') === 'true'; // 是否包含子品类

    const where: any = {};

    // 按父品类过滤
    if (parentId !== null) {
      where.parentId = parentId === '' ? null : parentId;
    }

    // 按状态过滤
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // 查询品类
    const categories = await prisma.productCategory.findMany({
      where,
      include: {
        // 包含子品类（递归查询需要手动处理）
        children: includeChildren ? {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        } : false,
        // 包含父品类信息
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        // 统计模板数量
        _count: {
          select: {
            templates: true,
            products: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取品类列表失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/product-research/categories
// 创建新品类
// ============================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      nameEn,
      code,
      parentId,
      level,
      description,
      icon,
      sortOrder,
      isActive,
    } = body;

    // 验证必填字段
    if (!name || !code) {
      return NextResponse.json(
        { 
          success: false, 
          error: '品类名称和编码为必填项' 
        },
        { status: 400 }
      );
    }

    // 检查编码是否已存在
    const existingCategory = await prisma.productCategory.findUnique({
      where: { code },
    });

    if (existingCategory) {
      return NextResponse.json(
        { 
          success: false, 
          error: '品类编码已存在' 
        },
        { status: 400 }
      );
    }

    // 如果指定了父品类，验证父品类是否存在
    let calculatedLevel = level || 1;
    let calculatedPath = null;

    if (parentId) {
      const parentCategory = await prisma.productCategory.findUnique({
        where: { id: parentId },
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

      calculatedLevel = parentCategory.level + 1;
      calculatedPath = parentCategory.path ? `${parentCategory.path}/${parentId}` : parentId;
    }

    // 创建品类
    const category = await prisma.productCategory.create({
      data: {
        name,
        nameEn: nameEn || null,
        code,
        parentId: parentId || null,
        level: calculatedLevel,
        path: calculatedPath,
        description: description || null,
        icon: icon || null,
        sortOrder: sortOrder || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
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

    return NextResponse.json(
      {
        success: true,
        data: category,
        message: '品类创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '创建品类失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
