import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { WooCommercePublisher } from '@/lib/woocommerce-publisher';

// POST /api/collected-products/[id]/publish - 发布到 WooCommerce
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
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
        attributes: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!collected) return notFoundResponse('采集产品不存在');

    // 如果还没转正，先自动转正
    if (!collected.productId) {
      // 触发 convert 逻辑（简化版：直接创建 Product）
      const sku = collected.sku || `CP-${Date.now().toString(36).toUpperCase()}`;
      const mainImage = collected.images.find(i => i.type === 'main');
      const mainImageUrl = mainImage?.data
        ? `data:${mainImage.mimeType};base64,${(mainImage.data as unknown as Buffer).toString('base64')}`
        : null;

      const product = await prisma.product.create({
        data: {
          sku,
          name: collected.title,
          nameEn: collected.titleEn || null,
          salePrice: collected.price || 0,
          currency: collected.currency || 'USD',
          weight: collected.weight || null,
          images: mainImageUrl ? [mainImageUrl] : [],
          status: 'ACTIVE',
        },
      });

      await prisma.collectedProduct.update({
        where: { id },
        data: { productId: product.id, sku },
      });
    }

    // 获取 WooCommerce 配置
    const wcConfig = await prisma.wooCommerceConfig.findFirst({
      where: { isActive: true, isDefault: true },
    });

    if (!wcConfig) {
      return errorResponse('未配置 WooCommerce，请先在系统设置中配置', 'CONFIG_MISSING', 400);
    }

    // 发布到 WooCommerce
    const publisher = new WooCommercePublisher(wcConfig);
    const startTime = Date.now();

    let result;
    if (collected.woocommerceId) {
      // 更新已有产品
      result = await publisher.update(collected);
    } else {
      // 创建新产品
      result = await publisher.create(collected);
    }

    const durationMs = Date.now() - startTime;

    // 记录发布日志
    await prisma.publishLog.create({
      data: {
        collectedProductId: id,
        action: collected.woocommerceId ? 'update' : 'publish',
        status: result.success ? 'success' : 'failed',
        woocommerceId: result.woocommerceId || collected.woocommerceId,
        requestData: result.requestData || null,
        responseData: result.responseData || null,
        errorMessage: result.error || null,
        durationMs,
      },
    });

    if (result.success) {
      // 更新采集产品状态
      await prisma.collectedProduct.update({
        where: { id },
        data: {
          pipelineStatus: 'published',
          woocommerceId: result.woocommerceId || collected.woocommerceId,
          woocommerceUrl: result.woocommerceUrl || null,
          lastPublishedAt: new Date(),
          publishError: null,
        },
      });

      return successResponse({
        woocommerceId: result.woocommerceId,
        woocommerceUrl: result.woocommerceUrl,
        pipelineStatus: 'published',
      });
    } else {
      // 记录失败
      await prisma.collectedProduct.update({
        where: { id },
        data: {
          pipelineStatus: 'error',
          publishError: result.error || '未知错误',
        },
      });

      return successResponse({
        pipelineStatus: 'error',
        publishError: result.error,
      });
    }
  } catch (error: any) {
    console.error('Error publishing:', error);
    return errorResponse('发布失败: ' + (error.message || '未知错误'), 'PUBLISH_ERROR', 500);
  }
}
