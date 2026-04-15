/**
 * 产品调研管理 API - 获取产品调研列表/创建产品调研
 * 
 * @module api/product-research/products
 * @method GET - 获取产品调研列表（支持分页、搜索、过滤）
 * @method POST - 创建新产品调研
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ResearchStatus, Priority } from '@prisma/client';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateResearchProductSchema } from '@/lib/api-schemas';
import { 
  ProductResearchQuerySchema,
  formatValidationError 
} from '@/lib/validators/product-research';

// ============================================
// GET /api/product-research/products
// 获取产品调研列表
// ============================================
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    
    // 获取 includeAttributes 参数
    const includeAttributes = searchParams.get('includeAttributes') === 'true';
    
    // 验证查询参数
    const queryValidation = ProductResearchQuerySchema.safeParse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      categoryId: searchParams.get('categoryId') || '',
      status: searchParams.get('status') || '',
      brand: searchParams.get('brand') || '',
      assignedTo: searchParams.get('assignedTo') || '',
      priority: searchParams.get('priority') || '',
      conclusion: searchParams.get('conclusion') || '',
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: '查询参数验证失败',
          details: formatValidationError(queryValidation.error)
        },
        { status: 400 }
      );
    }

    const { 
      page, 
      limit, 
      search, 
      categoryId, 
      status, 
      brand, 
      assignedTo, 
      priority, 
      conclusion,
      dateFrom,
      dateTo 
    } = queryValidation.data;

    // 构建查询条件
    const where: {
      OR?: Array<{
        name?: { contains: string };
        nameEn?: { contains: string };
        brand?: { contains: string };
        model?: { contains: string };
        manufacturer?: { contains: string };
      }>;
      categoryId?: string;
      status?: ResearchStatus;
      brand?: { contains: string };
      assignedTo?: string;
      priority?: Priority;
      conclusion?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

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

    // 按品类过滤（'all' 表示不过滤）
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    // 按状态过滤（'all' 表示不过滤）
    if (status && status !== 'all') {
      where.status = status as ResearchStatus;
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
      where.priority = priority as Priority;
    }

    // 按结论过滤
    if (conclusion) {
      where.conclusion = conclusion;
    }

    // 按创建时间范围过滤
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // 包含结束日期的整天
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // 构建 include 配置
    const includeConfig: any = {
      // 包含品类信息
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    };
    
    // 根据参数决定是否包含属性
    if (includeAttributes) {
      includeConfig.attributes = {
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
      };
    }
    
    // 查询产品调研列表
    const [products, total] = await Promise.all([
      prisma.productResearch.findMany({
        where,
        include: includeConfig,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productResearch.count({ where }),
    ]);

    // 查询每个产品是否已转化为正式产品
    const productsWithConversion = await Promise.all(
      products.map(async (product) => {
        // TODO: 验证产品来源研究
        // const convertedProduct = await prisma.product.findFirst({
        //   where: { sourceResearchId: product.id },
        //   select: { id: true, createdAt: true },
        // });

        // 暂时不返回转换信息，待 Product 模型完善后添加
        return product;
      })
    );

    return NextResponse.json({
      success: true,
      data: productsWithConversion,
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
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();

    // 验证请求体
    const v = validateOrReturn(CreateResearchProductSchema, body);
    if (!v.success) return v.response;
    const data = v.data;

    // 验证品类是否存在
    const category = await prisma.productCategory.findUnique({
      where: { id: data.categoryId },
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
        name: data.name,
        nameEn: data.nameEn || null,
        categoryId: data.categoryId,
        brand: data.brand || null,
        brandEn: data.brandEn || null,
        model: data.model || null,
        manufacturer: data.manufacturer || null,
        manufacturerEn: data.manufacturerEn || null,
        originCountry: data.originCountry || 'CN',
        sourceUrl: data.sourceUrl || null,
        sourcePlatform: data.sourcePlatform || null,
        mainImage: data.mainImage || null,
        images: data.images || [],
        status: (data.status || 'DRAFT') as ResearchStatus,
        priority: (data.priority || 'MEDIUM') as Priority,
        assignedTo: data.assignedTo || null,
        tags: data.tags || [],
        notes: data.notes || null,
        
        // 价格信息
        costPrice: data.costPrice || null,
        salePrice: data.salePrice || null,
        currency: data.currency || 'CNY',
        moq: data.moq || null,
        leadTime: data.leadTime || null,
        
        // 规格信息
        specification: data.specification || null,
        weight: data.weight || null,
        volume: data.volume || null,
        dimensions: data.dimensions || null,
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
    if (data.attributes && data.attributes.length > 0) {
      await prisma.productResearchAttributeValue.createMany({
        data: data.attributes.map((attr) => ({
          productId: product.id,
          attributeId: attr.attributeId,
          valueText: attr.valueText || null,
          valueNumber: attr.valueNumber || null,
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
