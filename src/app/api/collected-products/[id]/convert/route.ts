import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// POST /api/collected-products/[id]/convert - 转为正式产品（Product 表）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;

    const collected = await prisma.collectedProduct.findUnique({
      where: { id },
      include: { images: { where: { type: 'main' }, take: 1 } },
    });

    if (!collected) return notFoundResponse('采集产品不存在');

    // 如果已经转正，直接返回
    if (collected.productId) {
      return successResponse({
        productId: collected.productId,
        sku: collected.sku,
        name: collected.title,
        alreadyConverted: true,
      });
    }

    // 生成 SKU（如果未填）
    const sku = collected.sku || `CP-${Date.now().toString(36).toUpperCase()}`;

    // 提取主图 URL（如果有）
    const mainImageUrl = collected.images.length > 0
      ? `data:${collected.images[0].mimeType};base64,${(collected.images[0].data as unknown as Buffer).toString('base64')}`
      : null;

    // 创建正式产品
    const product = await prisma.product.create({
      data: {
        sku,
        name: collected.title,
        nameEn: collected.titleEn || null,
        salePrice: collected.price || 0,
        currency: collected.currency || 'USD',
        weight: collected.weight || null,
        specification: collected.shortDescription || null,
        description: collected.description || null,
        descriptionEn: collected.descriptionEn || null,
        images: mainImageUrl ? [mainImageUrl] : [],
        categoryId: collected.categoryId || undefined,
        status: 'ACTIVE',
      },
    });

    // 回写关联
    await prisma.collectedProduct.update({
      where: { id },
      data: { productId: product.id, sku },
    });

    return successResponse({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      alreadyConverted: false,
    });
  } catch (error) {
    console.error('Error converting product:', error);
    return errorResponse('转为正式产品失败', 'INTERNAL_ERROR', 500);
  }
}
