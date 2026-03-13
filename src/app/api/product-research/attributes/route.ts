/**
 * 动态属性值 API - 批量保存/读取产品属性值
 * 
 * @module api/product-research/attributes
 * @method GET - 获取产品的属性值列表
 * @method POST - 批量保存产品属性值
 * @method PUT - 批量更新产品属性值
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/product-research/attributes
// 获取产品的属性值列表
// ============================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId'); // 产品 ID（必填）
    const attributeId = searchParams.get('attributeId'); // 属性 ID（可选）
    const categoryId = searchParams.get('categoryId'); // 品类 ID（可选，获取该品类所有属性）

    // 验证必填参数
    if (!productId && !categoryId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'productId 或 categoryId 至少提供一个' 
        },
        { status: 400 }
      );
    }

    const where: any = {};

    // 按产品过滤
    if (productId) {
      where.productId = productId;
    }

    // 按属性过滤
    if (attributeId) {
      where.attributeId = attributeId;
    }

    // 如果提供了 categoryId，需要关联查询
    let includeAttributes = false;
    if (categoryId) {
      includeAttributes = true;
    }

    // 查询属性值
    const attributeValues = await prisma.productAttributeValue.findMany({
      where,
      include: {
        // 包含属性模板信息
        attribute: includeAttributes ? {
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
            categoryId: true,
          },
        } : false,
        // 包含产品信息
        product: {
          select: {
            id: true,
            name: true,
            categoryId: true,
          },
        },
      },
      orderBy: {
        attribute: {
          sortOrder: 'asc',
        },
      },
    });

    // 如果提供了 categoryId，过滤出该品类的属性
    let filteredValues = attributeValues;
    if (categoryId && productId) {
      // 获取该品类的属性模板
      const categoryTemplates = await prisma.attributeTemplate.findMany({
        where: {
          categoryId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      const templateIds = categoryTemplates.map(t => t.id);
      
      // 过滤出属于该品类的属性值
      filteredValues = attributeValues.filter(v => 
        templateIds.includes(v.attributeId)
      );

      // 补充缺失的属性（该品类有但产品没有的属性）
      const existingAttributeIds = attributeValues.map(v => v.attributeId);
      const missingTemplates = categoryTemplates.filter(
        t => !existingAttributeIds.includes(t.id)
      );

      if (missingTemplates.length > 0) {
        // 为缺失的属性创建空值记录（可选）
        // 这里只返回已有的属性值
      }
    }

    return NextResponse.json({
      success: true,
      data: filteredValues,
    });
  } catch (error) {
    console.error('Error fetching attributes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取属性值失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/product-research/attributes
// 批量保存产品属性值
// ============================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, attributes } = body;

    // 验证必填参数
    if (!productId || !attributes || !Array.isArray(attributes)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'productId 和 attributes 为必填项' 
        },
        { status: 400 }
      );
    }

    // 验证产品是否存在
    const product = await prisma.productResearch.findUnique({
      where: { id: productId },
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

    // 使用事务批量创建/更新属性值
    const results = await prisma.$transaction(
      attributes.map((attr: any) => {
        const { attributeId, valueText, valueNumber, valueBoolean, valueDate, valueOptions, unit, notes } = attr;

        // 验证属性 ID
        if (!attributeId) {
          throw new Error('属性 ID 为必填项');
        }

        // 准备数据
        const data: any = {
          productId,
          attributeId,
          valueText: valueText || null,
          valueNumber: valueNumber ? parseFloat(valueNumber) : null,
          valueBoolean: valueBoolean !== undefined ? valueBoolean : null,
          valueDate: valueDate ? new Date(valueDate) : null,
          valueOptions: valueOptions || [],
          unit: unit || null,
          notes: notes || null,
        };

        // 使用 upsert 实现创建或更新
        return prisma.productAttributeValue.upsert({
          where: {
            productId_attributeId: {
              productId,
              attributeId,
            },
          },
          create: data,
          update: data,
          include: {
            attribute: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
                unit: true,
              },
            },
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      data: results,
      message: `成功保存 ${results.length} 个属性值`,
    });
  } catch (error) {
    console.error('Error saving attributes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '保存属性值失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/product-research/attributes
// 批量更新产品属性值（与 POST 相同，使用 upsert）
// ============================================
export async function PUT(request: Request) {
  // PUT 请求的处理逻辑与 POST 相同
  return POST(request);
}
