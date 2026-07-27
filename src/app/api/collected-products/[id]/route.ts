import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// GET /api/collected-products/[id] - 获取采集产品详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;

    const product = await prisma.collectedProduct.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
        attributes: { orderBy: { sortOrder: 'asc' } },
        publishLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!product) return notFoundResponse('采集产品不存在');

    // 将图片二进制转换为 base64 data URL 供前端展示
    const imagesWithDataUrl = product.images.map(img => ({
      id: img.id,
      type: img.type,
      mimeType: img.mimeType,
      fileSize: img.fileSize,
      width: img.width,
      height: img.height,
      sortOrder: img.sortOrder,
      altText: img.altText,
      originalUrl: img.originalUrl,
      dataUrl: img.data
        ? `data:${img.mimeType};base64,${(img.data as unknown as Buffer).toString('base64')}`
        : null,
    }));

    return successResponse({
      ...product,
      images: imagesWithDataUrl,
      // ★ 辅助解析字段（前端可直接展示，无需自己解析 rawData）
      _tieredPricing: (product.rawData as any)?.tieredPricing || null,
      _supplierInfo: (product.rawData as any)?.supplier || null,
      _aggregateRating: (product.rawData as any)?.aggregateRating || null,
      _moq: (product.rawData as any)?.moq || null,
    });
  } catch (error) {
    console.error('Error fetching collected product:', error);
    return errorResponse('获取采集产品详情失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/collected-products/[id] - 编辑采集产品
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.collectedProduct.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('采集产品不存在');

    // 构建更新数据（只传了需要改的字段）
    const updateData: any = {};
    const updatableFields = [
      'title', 'titleEn', 'shortDescription', 'description', 'descriptionEn',
      'brand', 'sku', 'price', 'compareAtPrice', 'currency', 'stockQuantity',
      'weight', 'length', 'width', 'height', 'shippingClass', 'hsCode',
      'metaTitle', 'metaDescription', 'urlSlug', 'tags',
      'categoryId', 'woocommerceCategoryId', 'pipelineStatus',
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 如果修改了关键字段且已发布，前端需要弹窗询问（后端返回标记）
    const wasPublished = existing.pipelineStatus === 'published';
    const keyFieldsChanged = ['title', 'titleEn', 'description', 'descriptionEn', 'price', 'sku']
      .some(f => body[f] !== undefined && body[f] !== (existing as any)[f]);

    const product = await prisma.collectedProduct.update({
      where: { id },
      data: updateData,
    });

    // 如果更新了属性（全量替换）
    if (body.attributes && Array.isArray(body.attributes)) {
      await prisma.collectedProductAttribute.deleteMany({ where: { collectedProductId: id } });
      if (body.attributes.length > 0) {
        await prisma.collectedProductAttribute.createMany({
          data: body.attributes.map((attr: any, idx: number) => ({
            collectedProductId: id,
            name: attr.name,
            nameEn: attr.nameEn || null,
            value: attr.value,
            valueEn: attr.valueEn || null,
            unit: attr.unit || null,
            sortOrder: idx,
          })),
        });
      }
    }

    // 如果更新了变体（全量替换）
    if (body.variants && Array.isArray(body.variants)) {
      await prisma.collectedProductVariant.deleteMany({ where: { collectedProductId: id } });
      if (body.variants.length > 0) {
        await prisma.collectedProductVariant.createMany({
          data: body.variants.map((v: any, idx: number) => ({
            collectedProductId: id,
            sku: v.sku || null,
            price: v.price ? parseFloat(v.price) : null,
            stock: v.stock ? parseInt(v.stock) : null,
            options: v.options || null,
            sortOrder: idx,
          })),
        });
      }
    }

    return successResponse({
      id: product.id,
      pipelineStatus: product.pipelineStatus,
      woocommerceNeedsSync: wasPublished && keyFieldsChanged,
    });
  } catch (error) {
    console.error('Error updating collected product:', error);
    return errorResponse('更新采集产品失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/collected-products/[id] - 删除采集产品
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;

    const existing = await prisma.collectedProduct.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('采集产品不存在');

    await prisma.collectedProduct.delete({ where: { id } });

    return successResponse({ id }, '删除成功');
  } catch (error) {
    console.error('Error deleting collected product:', error);
    return errorResponse('删除采集产品失败', 'INTERNAL_ERROR', 500);
  }
}
