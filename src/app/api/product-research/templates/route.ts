/**
 * 属性模板管理 API - 获取属性模板列表/创建属性模板
 * 
 * @module api/product-research/templates
 * @method GET - 获取属性模板列表（按品类分组）
 * @method POST - 创建新属性模板
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateResearchTemplateSchema } from '@/lib/api-schemas';

// ============================================
// GET /api/product-research/templates
// 获取属性模板列表
// ============================================
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId'); // 按品类过滤
    const type = searchParams.get('type'); // 按属性类型过滤
    const isActive = searchParams.get('isActive'); // 是否只获取启用的模板
    const isComparable = searchParams.get('isComparable'); // 是否只获取可对比的属性

    // 构建查询条件（使用 Prisma 类型）
    const where: Prisma.AttributeTemplateWhereInput = {};

    // 按品类过滤
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // 按类型过滤
    if (type) {
      where.type = type as any;
    }

    // 按状态过滤
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // 按可对比过滤
    if (isComparable !== null) {
      where.isComparable = isComparable === 'true';
    }

    // 查询属性模板
    const templates = await prisma.attributeTemplate.findMany({
      where,
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
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取属性模板列表失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/product-research/templates
// 创建属性模板
// ============================================
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(CreateResearchTemplateSchema, body);
    if (!v.success) return v.response;
    const {
      name,
      nameEn,
      code,
      categoryId,
      type,
      unit,
      options,
      isRequired,
      isComparable,
      sortOrder,
      description,
      validationRule,
      defaultValue,
      placeholder,
      isActive,
    } = v.data;

    // 验证必填字段
    if (!name || !code || !categoryId) {
      return NextResponse.json(
        { 
          success: false, 
          error: '属性名称、编码和所属品类为必填项' 
        },
        { status: 400 }
      );
    }

    // 检查编码是否已存在
    const existingTemplate = await prisma.attributeTemplate.findUnique({
      where: { code },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { 
          success: false, 
          error: '属性编码已存在' 
        },
        { status: 400 }
      );
    }

    // 验证品类是否存在
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
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

    // 验证选项（针对 SELECT 和 MULTI_SELECT 类型）
    const selectTypes = ['SELECT', 'MULTI_SELECT'];
    if (type && selectTypes.includes(type) && (!options || options.length === 0)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '选择类型属性必须提供选项' 
        },
        { status: 400 }
      );
    }

    // 创建属性模板
    const template = await prisma.attributeTemplate.create({
      data: {
        name,
        nameEn: nameEn || null,
        code,
        categoryId,
        type: type || 'TEXT',
        unit: unit || null,
        options: options || [],
        isRequired: isRequired !== undefined ? isRequired : false,
        isComparable: isComparable !== undefined ? isComparable : true,
        sortOrder: sortOrder || 0,
        description: description || null,
        validationRule: validationRule || null,
        defaultValue: defaultValue || null,
        placeholder: placeholder || null,
        isActive: isActive !== undefined ? isActive : true,
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
    });

    return NextResponse.json(
      {
        success: true,
        data: template,
        message: '属性模板创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '创建属性模板失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
