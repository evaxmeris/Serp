/**
 * 产品调研管理 API - 获取产品调研列表/创建产品调研
 * 
 * @module api/product-research/products
 * @method GET - 获取产品调研列表（支持分页、搜索、过滤）
 * @method POST - 创建新产品调研
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/product-research/products
// 获取产品调研列表
// ============================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const status = searchParams.get('status') || '';
    const brand = searchParams.get('brand') || '';
    const assignedTo = searchParams.get('assignedTo') || '';
    const priority = searchParams.get('priority') || '';

    const where: any = {};

    // 搜索条件（产品名称、品牌、型号）
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameEn: { contains: search } },
        { brand: { contains: search } },
        { model: { contains: search } },
        { manufacturer: { contains: search } },
      ];
    }

    // 按品类过滤
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // 按状态过滤
    if (status) {
      where.status = status;
    }

    // 按品牌过滤
    if (brand) {
      where.brand = { contains: brand };
    }

    // 按负责人过滤
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // 按优先级过滤
    if (priority) {
      where.priority = priority;
    }

    // 查询产品调研列表
    const [products, total] = await Promise.all([
      prisma.productResearch.findMany({
        where,
        include: {
          // 包含品类信息
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          // 包含属性值（仅基本信息）
          attributes: {
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
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productResearch.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取产品调研列表失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/product-research/products
// 创建产品调研
// ============================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      nameEn,
      categoryId,
      brand,
      brandEn,
      model,
      manufacturer,
      manufacturerEn,
      originCountry,
      sourceUrl,
      sourcePlatform,
      mainImage,
      images,
      status,
      priority,
      assignedTo,
      tags,
      notes,
      
      // 价格信息
      costPrice,
      salePrice,
      currency,
      moq,
      leadTime,
      
      // 规格信息
      specification,
      weight,
      volume,
      dimensions,
      
      // 属性值（动态属性）
      attributes,
    } = body;

    // 验证必填字段
    if (!name || !categoryId) {
      return NextResponse.json(
        { 
          success: false, 
          error: '产品名称和所属品类为必填项' 
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

    // 创建产品调研（使用事务确保数据一致性）
    const product = await prisma.productResearch.create({
      data: {
        name,
        nameEn: nameEn || null,
        categoryId,
        brand: brand || null,
        brandEn: brandEn || null,
        model: model || null,
        manufacturer: manufacturer || null,
        manufacturerEn: manufacturerEn || null,
        originCountry: originCountry || 'CN',
        sourceUrl: sourceUrl || null,
        sourcePlatform: sourcePlatform || null,
        mainImage: mainImage || null,
        images: images || [],
        status: status || 'DRAFT',
        priority: priority || 'MEDIUM',
        assignedTo: assignedTo || null,
        tags: tags || [],
        notes: notes || null,
        
        // 价格信息
        costPrice: costPrice ? parseFloat(costPrice) : null,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        currency: currency || 'CNY',
        moq: moq || null,
        leadTime: leadTime || null,
        
        // 规格信息
        specification: specification || null,
        weight: weight ? parseFloat(weight) : null,
        volume: volume ? parseFloat(volume) : null,
        dimensions: dimensions || null,
        
        // 属性值在创建后通过单独的 API 添加
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

    // 如果提供了属性值，批量创建
    if (attributes && Array.isArray(attributes) && attributes.length > 0) {
      await prisma.productAttributeValue.createMany({
        data: attributes.map((attr: any) => ({
          productId: product.id,
          attributeId: attr.attributeId,
          valueText: attr.valueText || null,
          valueNumber: attr.valueNumber ? parseFloat(attr.valueNumber) : null,
          valueBoolean: attr.valueBoolean || null,
          valueDate: attr.valueDate ? new Date(attr.valueDate) : null,
          valueOptions: attr.valueOptions || [],
          unit: attr.unit || null,
          notes: attr.notes || null,
        })),
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: product,
        message: '产品调研创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '创建产品调研失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
