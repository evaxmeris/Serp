/**
 * 属性模板详情 API - 获取/更新/删除单个属性模板
 * 
 * @module api/product-research/templates/[id]
 * @method GET - 获取属性模板详情
 * @method PUT - 更新属性模板
 * @method DELETE - 删除属性模板
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/product-research/templates/[id]
// 获取属性模板详情
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await prisma.attributeTemplate.findUnique({
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
        // 统计使用该模板的产品数量
        _count: {
          select: {
            values: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { 
          success: false, 
          error: '属性模板不存在' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取属性模板详情失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/product-research/templates/[id]
// 更新属性模板
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 检查模板是否存在
    const existingTemplate = await prisma.attributeTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { 
          success: false, 
          error: '属性模板不存在' 
        },
        { status: 404 }
      );
    }

    // 如果修改了编码，检查新编码是否已被使用
    if (body.code && body.code !== existingTemplate.code) {
      const codeExists = await prisma.attributeTemplate.findUnique({
        where: { code: body.code },
      });

      if (codeExists) {
        return NextResponse.json(
          { 
            success: false, 
            error: '属性编码已存在' 
          },
          { status: 400 }
        );
      }
    }

    // 验证选项（针对 SELECT 和 MULTI_SELECT 类型）
    const type = body.type || existingTemplate.type;
    const selectTypes = ['SELECT', 'MULTI_SELECT'];
    const options = body.options !== undefined ? body.options : existingTemplate.options;
    
    if (selectTypes.includes(type) && (!options || options.length === 0)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '选择类型属性必须提供选项' 
        },
        { status: 400 }
      );
    }

    // 更新属性模板
    const template = await prisma.attributeTemplate.update({
      where: { id },
      data: body,
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
      data: template,
      message: '属性模板更新成功',
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '更新属性模板失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/product-research/templates/[id]
// 删除属性模板
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查模板是否存在
    const template = await prisma.attributeTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            values: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { 
          success: false, 
          error: '属性模板不存在' 
        },
        { status: 404 }
      );
    }

    // 检查是否有产品使用该模板
    if (template._count.values > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `该属性已被 ${template._count.values} 个产品使用，无法删除` 
        },
        { status: 400 }
      );
    }

    // 删除属性模板
    await prisma.attributeTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '属性模板删除成功',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '删除属性模板失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
