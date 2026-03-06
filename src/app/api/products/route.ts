import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products - 获取产品列表
export async function GET(request: Request) {
  try {
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
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sku,
      name,
      nameEn,
      category,
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
    } = body;

    if (!sku || !name) {
      return NextResponse.json(
        { error: 'SKU and name are required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        nameEn,
        category,
        specification,
        unit: unit || 'PCS',
        costPrice: parseFloat(costPrice) || 0,
        salePrice: parseFloat(salePrice) || 0,
        currency: currency || 'USD',
        description,
        descriptionEn,
        weight: weight ? parseFloat(weight) : null,
        volume: volume ? parseFloat(volume) : null,
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
