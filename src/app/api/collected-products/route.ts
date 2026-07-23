import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, listResponse, createdResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// GET /api/collected-products - 采集产品列表
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const where: any = {};

    if (status) where.pipelineStatus = status;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { titleEn: { contains: search } },
        { sku: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      where.collectedAt = {};
      if (dateFrom) where.collectedAt.gte = new Date(dateFrom);
      if (dateTo) where.collectedAt.lte = new Date(dateTo + 'T23:59:59Z');
    }

    const [items, total] = await Promise.all([
      prisma.collectedProduct.findMany({
        where,
        orderBy: { collectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: {
            where: { type: 'main' },
            take: 1,
            select: { id: true, mimeType: true, fileSize: true },
          },
        },
      }),
      prisma.collectedProduct.count({ where }),
    ]);

    // 列表返回精简数据，不含大二进制
    const list = items.map(p => ({
      id: p.id,
      title: p.title,
      titleEn: p.titleEn,
      source: p.source,
      sourceUrl: p.sourceUrl,
      pipelineStatus: p.pipelineStatus,
      price: p.price,
      currency: p.currency,
      weight: p.weight,
      hasVariants: false, // variants count will be added later
      productId: p.productId,
      woocommerceId: p.woocommerceId,
      hasImage: p.images.length > 0,
      collectedAt: p.collectedAt,
    }));

    return listResponse(list, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching collected products:', error);
    return errorResponse('获取采集产品列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/collected-products - Chrome 插件接收采集数据
export async function POST(request: NextRequest) {
  try {
    // 支持两种鉴权方式：
    // 1. 内部 API：session 登录态（getUserFromRequest）
    // 2. 外部插件：X-API-Token header
    let session = await getUserFromRequest(request);
    if (!session) {
      // 尝试 API Token 鉴权
      const apiToken = request.headers.get('X-API-Token');
      if (!apiToken) return errorResponse('未认证', 'UNAUTHORIZED', 401);
      // TODO: 验证 API Token
    }

    const body = await request.json();

    const product = await prisma.collectedProduct.create({
      data: {
        source: body.source || 'manual',
        sourceUrl: body.sourceUrl || '',
        sourceId: body.sourceId || null,
        title: body.title || '',
        titleEn: body.titleEn || null,
        shortDescription: body.shortDescription || null,
        description: body.description || null,
        descriptionEn: body.descriptionEn || null,
        brand: body.brand || null,
        sku: body.sku || null,
        price: body.price ? parseFloat(body.price) : null,
        compareAtPrice: body.compareAtPrice ? parseFloat(body.compareAtPrice) : null,
        currency: body.currency || 'USD',
        stockQuantity: body.stockQuantity ? parseInt(body.stockQuantity) : null,
        weight: body.weight ? parseFloat(body.weight) : null,
        pipelineStatus: 'collected',
        collectedAt: new Date(),
        rawData: body.rawData || null,
      },
    });

    // 保存图片
    if (body.images && Array.isArray(body.images)) {
      await prisma.collectedProductImage.createMany({
        data: body.images.map((img: any, idx: number) => ({
          collectedProductId: product.id,
          type: img.type || 'gallery',
          data: img.data ? Buffer.from(img.data, 'base64') : null,
          originalUrl: img.originalUrl || null,
          mimeType: img.mimeType || 'image/jpeg',
          fileName: img.fileName || null,
          fileSize: img.fileSize || null,
          width: img.width || null,
          height: img.height || null,
          sortOrder: idx,
        })),
      });
    }

    // 保存属性
    if (body.attributes && Array.isArray(body.attributes)) {
      await prisma.collectedProductAttribute.createMany({
        data: body.attributes.map((attr: any, idx: number) => ({
          collectedProductId: product.id,
          name: attr.name,
          nameEn: attr.nameEn || null,
          value: attr.value,
          valueEn: attr.valueEn || null,
          unit: attr.unit || null,
          sortOrder: idx,
        })),
      });
    }

    // 保存变体
    if (body.variants && Array.isArray(body.variants)) {
      await prisma.collectedProductVariant.createMany({
        data: body.variants.map((v: any, idx: number) => ({
          collectedProductId: product.id,
          sku: v.sku || null,
          price: v.price ? parseFloat(v.price) : null,
          stock: v.stock ? parseInt(v.stock) : null,
          options: v.options || null,
          sortOrder: idx,
        })),
      });
    }

    return createdResponse({
      id: product.id,
      pipelineStatus: product.pipelineStatus,
    });
  } catch (error) {
    console.error('Error creating collected product:', error);
    return errorResponse('接收采集数据失败', 'INTERNAL_ERROR', 500);
  }
}
