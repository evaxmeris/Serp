/**
 * 产品对比 API - 创建对比、获取对比结果、差异高亮
 * 
 * @module api/product-research/comparisons
 * @method GET - 获取对比列表或对比详情
 * @method POST - 创建产品对比
 * @method DELETE - 删除对比
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/product-research/comparisons
// 获取对比列表或对比详情（含差异分析）
// ============================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id'); // 对比 ID（如果提供，返回详情）
    const productId = searchParams.get('productId'); // 产品 ID（查找包含该产品的对比）

    // 如果提供了对比 ID，返回对比详情（含差异分析）
    if (id) {
      return getComparisonDetail(id);
    }

    // 否则返回对比列表
    const where: any = {};

    if (productId) {
      where.products = {
        some: {
          productId,
        },
      };
    }

    const comparisons = await prisma.productComparison.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                mainImage: true,
                costPrice: true,
                salePrice: true,
              },
            },
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: comparisons,
    });
  } catch (error) {
    console.error('Error fetching comparisons:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取对比列表失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 获取对比详情（含差异分析）- 优化版：批量查询
async function getComparisonDetail(comparisonId: string) {
  // 使用单次批量查询代替多层嵌套查询
  const [comparison, productsWithAttributes, categories] = await Promise.all([
    // 1. 获取对比基本信息
    prisma.productComparison.findUnique({
      where: { id: comparisonId },
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        comparedBy: true,
        status: true,
        attributes: true,
        highlightDiff: true,
        summary: true,
        recommendation: true,
        rating: true,
        createdAt: true,
        updatedAt: true,
        productResearchId: true,
      },
    }),
    
    // 2. 批量获取所有产品及其属性（关键优化点）
    prisma.productComparisonItem.findMany({
      where: { comparisonId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            model: true,
            mainImage: true,
            costPrice: true,
            salePrice: true,
            currency: true,
            categoryId: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    }),
    
    // 3. 批量获取品类信息
    prisma.productCategory.findMany({
      where: {
        id: comparisonId ? { in: [] } : { in: [] }, // 占位符
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
  ]);

  if (!comparison) {
    return NextResponse.json(
      { 
        success: false, 
        error: '对比不存在' 
      },
      { status: 404 }
    );
  }

  // 如果有品类ID，获取具体品类
  let category = null;
  if (comparison.categoryId) {
    category = await prisma.productCategory.findUnique({
      where: { id: comparison.categoryId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
  }

  // 批量获取所有产品的属性值
  const productIds = productsWithAttributes.map(item => item.productId);
  const allAttributes = productIds.length > 0 
    ? await prisma.productAttributeValue.findMany({
        where: { 
          productId: { in: productIds },
          attribute: { isComparable: true },
        },
        include: {
          attribute: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              code: true,
              type: true,
              unit: true,
              isComparable: true,
              sortOrder: true,
            },
          },
        },
        orderBy: {
          attribute: {
            sortOrder: 'asc',
          },
        },
      })
    : [];

  // 按产品ID分组属性
  const attributesByProduct = allAttributes.reduce((acc, attr) => {
    if (!acc[attr.productId]) {
      acc[attr.productId] = [];
    }
    acc[attr.productId].push(attr);
    return acc;
  }, {} as Record<string, any[]>);

  // 构建完整的产品数据
  const products = productsWithAttributes.map(item => ({
    ...item,
    product: {
      ...item.product,
      attributes: attributesByProduct[item.productId] || [],
    },
  }));

  if (!comparison) {
    return NextResponse.json(
      { 
        success: false, 
        error: '对比不存在' 
      },
      { status: 404 }
    );
  }

  // 构建完整的对比对象
  const fullComparison = {
    ...comparison,
    category,
    products,
  };

  // 生成差异分析
  const diffAnalysis = generateDiffAnalysis(fullComparison);

  return NextResponse.json({
    success: true,
    data: {
      ...comparison,
      diffAnalysis,
    },
  });
}

// 生成差异分析报告
function generateDiffAnalysis(comparison: any) {
  const { products, highlightDiff } = comparison;
  
  if (products.length < 2) {
    return { message: '至少需要两个产品才能进行对比' };
  }

  // 收集所有可对比的属性
  const allAttributes = new Map();
  
  products.forEach((item: any) => {
    item.product.attributes.forEach((attr: any) => {
      if (attr.attribute.isComparable && !allAttributes.has(attr.attributeId)) {
        allAttributes.set(attr.attributeId, {
          ...attr.attribute,
          values: [],
        });
      }
    });
  });

  // 填充每个产品的属性值
  products.forEach((item: any) => {
    item.product.attributes.forEach((attr: any) => {
      if (allAttributes.has(attr.attributeId)) {
        allAttributes.get(attr.attributeId).values.push({
          productId: item.product.id,
          productName: item.product.name,
          value: getAttributeValue(attr),
          isRecommended: item.isRecommended,
          score: item.score,
        });
      }
    });
  });

  // 分析差异
  const attributes = Array.from(allAttributes.values()).map((attr: any) => {
    const values = attr.values;
    const uniqueValues = new Set(values.map((v: any) => String(v.value)));
    const hasDiff = uniqueValues.size > 1;
    
    return {
      ...attr,
      hasDiff,
      values,
      diffHighlight: highlightDiff && hasDiff,
    };
  });

  // 统计信息
  const totalAttributes = attributes.length;
  const diffCount = attributes.filter((a: any) => a.hasDiff).length;
  const sameCount = totalAttributes - diffCount;

  return {
    totalAttributes,
    diffCount,
    sameCount,
    diffPercentage: totalAttributes > 0 ? Math.round((diffCount / totalAttributes) * 100) : 0,
    attributes,
  };
}

// 获取属性值的显示值
function getAttributeValue(attrValue: any): string | number | boolean | null {
  const { attribute, valueText, valueNumber, valueBoolean, valueDate, valueOptions, unit } = attrValue;
  
  switch (attribute.type) {
    case 'BOOLEAN':
      return valueBoolean;
    case 'NUMBER':
    case 'DECIMAL':
      return valueNumber !== null ? `${valueNumber}${unit || ''}` : null;
    case 'DATE':
      return valueDate ? new Date(valueDate).toISOString().split('T')[0] : null;
    case 'SELECT':
    case 'MULTI_SELECT':
      return valueOptions && valueOptions.length > 0 ? valueOptions.join(', ') : null;
    default:
      return valueText || null;
  }
}

// ============================================
// POST /api/product-research/comparisons
// 创建产品对比
// ============================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      categoryId,
      comparedBy,
      attributes,
      highlightDiff,
      products, // [{ productId, sortOrder, isRecommended, score, pros, cons, notes }]
    } = body;

    // 验证必填字段
    if (!name || !products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '对比名称和对比产品为必填项' 
        },
        { status: 400 }
      );
    }

    if (products.length < 2) {
      return NextResponse.json(
        { 
          success: false, 
          error: '至少需要两个产品才能进行对比' 
        },
        { status: 400 }
      );
    }

    // 验证所有产品是否存在
    const productIds = products.map((p: any) => p.productId);
    const existingProducts = await prisma.productResearch.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        categoryId: true,
      },
    });

    if (existingProducts.length !== productIds.length) {
      return NextResponse.json(
        { 
          success: false, 
          error: '部分产品不存在' 
        },
        { status: 400 }
      );
    }

    // 如果指定了品类，验证产品是否属于该品类
    if (categoryId) {
      const category = await prisma.productCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { 
            success: false, 
            error: '品类不存在' 
          },
          { status: 400 }
        );
      }

      const invalidProducts = existingProducts.filter(p => p.categoryId !== categoryId);
      if (invalidProducts.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: '部分产品不属于指定品类' 
          },
          { status: 400 }
        );
      }
    }

    // 使用事务创建对比
    const comparison = await prisma.$transaction(async (tx) => {
      // 创建对比
      const created = await tx.productComparison.create({
        data: {
          name,
          description: description || null,
          categoryId: categoryId || null,
          comparedBy: comparedBy || null,
          attributes: attributes || [],
          highlightDiff: highlightDiff !== undefined ? highlightDiff : true,
        },
      });

      // 创建对比项
      const comparisonItems = await tx.productComparisonItem.createMany({
        data: products.map((p: any, index: number) => ({
          comparisonId: created.id,
          productId: p.productId,
          sortOrder: p.sortOrder !== undefined ? p.sortOrder : index,
          isRecommended: p.isRecommended || false,
          score: p.score ? parseFloat(p.score) : null,
          pros: p.pros || [],
          cons: p.cons || [],
          notes: p.notes || null,
        })),
      });

      // 返回完整数据
      return tx.productComparison.findUnique({
        where: { id: created.id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  brand: true,
                  model: true,
                  mainImage: true,
                },
              },
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        data: comparison,
        message: '产品对比创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating comparison:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '创建产品对比失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/product-research/comparisons
// 删除产品对比
// ============================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: '对比 ID 为必填项' 
        },
        { status: 400 }
      );
    }

    // 检查对比是否存在
    const comparison = await prisma.productComparison.findUnique({
      where: { id },
    });

    if (!comparison) {
      return NextResponse.json(
        { 
          success: false, 
          error: '对比不存在' 
        },
        { status: 404 }
      );
    }

    // 删除对比（对比项会级联删除）
    await prisma.productComparison.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '对比删除成功',
    });
  } catch (error) {
    console.error('Error deleting comparison:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '删除对比失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
