import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateProductSchema } from '@/lib/api-schemas';

// GET /api/products - 获取产品列表
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    
    if (search) {
      where.OR = [
        { sku: { contains: search } },
        { name: { contains: search } },
        { nameEn: { contains: search } },
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
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
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products - 创建产品
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(CreateProductSchema, body);
    if (!v.success) return v.response;
    const {
      sku,
      name,
      nameEn,
      categoryId,
      specification,
      unit,
      costPrice,
      salePrice,
      currency,
      description,
      descriptionEn,
      weight,
      volume,
      moq,
      leadTime,
      images,
      attributes: _attributes,
    } = v.data;

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        nameEn,
        categoryId: categoryId || undefined,
        specification,
        unit: unit || 'PCS',
        costPrice: costPrice || 0,
        salePrice: salePrice || 0,
        currency: currency || 'USD',
        description,
        descriptionEn,
        weight: weight || null,
        volume: volume || null,
        moq,
        leadTime,
        images: images || [],
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
