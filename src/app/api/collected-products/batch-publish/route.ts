import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { WooCommercePublisher } from '@/lib/woocommerce-publisher';

// POST /api/collected-products/batch-publish - 批量发布
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse('请选择要发布的产品', 'VALIDATION_ERROR', 422);
    }

    // 检查 WooCommerce 配置
    const wcConfig = await prisma.wooCommerceConfig.findFirst({
      where: { isActive: true, isDefault: true },
    });
    if (!wcConfig) {
      return errorResponse('未配置 WooCommerce', 'CONFIG_MISSING', 400);
    }

    const publisher = new WooCommercePublisher(wcConfig);
    const results = [];

    for (const id of ids) {
      try {
        const product = await prisma.collectedProduct.findUnique({
          where: { id },
          include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
        });

        if (!product) {
          results.push({ id, success: false, error: '产品不存在' });
          continue;
        }

        if (product.pipelineStatus !== 'ready' && product.pipelineStatus !== 'error') {
          results.push({ id, success: false, error: `产品状态为 ${product.pipelineStatus}，无法发布` });
          continue;
        }

        // 如果未转正，先转
        if (!product.productId) {
          const sku = product.sku || `CP-${Date.now().toString(36).toUpperCase()}`;
          const mainImage = product.images.find(i => i.type === 'main');
          const newProd = await prisma.product.create({
            data: {
              sku,
              name: product.title,
              nameEn: product.titleEn || null,
              salePrice: product.price || 0,
              currency: product.currency || 'USD',
              weight: product.weight || null,
              images: [],
              status: 'ACTIVE',
            },
          });
          await prisma.collectedProduct.update({ where: { id }, data: { productId: newProd.id, sku } });
        }

        // 发布
        const result = product.woocommerceId
          ? await publisher.update(product)
          : await publisher.create(product);

        const logData = {
          collectedProductId: id,
          action: product.woocommerceId ? 'update' : 'publish',
          status: result.success ? 'success' : 'failed',
          woocommerceId: result.woocommerceId || product.woocommerceId,
          errorMessage: result.error || null,
          durationMs: result.durationMs,
        };

        await prisma.publishLog.create({ data: logData });

        await prisma.collectedProduct.update({
          where: { id },
          data: result.success
            ? { pipelineStatus: 'published', woocommerceId: result.woocommerceId || product.woocommerceId, lastPublishedAt: new Date(), publishError: null }
            : { pipelineStatus: 'error', publishError: result.error || '未知错误' },
        });

        results.push({ id, success: result.success, error: result.error });
      } catch (e: any) {
        results.push({ id, success: false, error: e.message });
      }
    }

    return successResponse({
      total: ids.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('Batch publish error:', error);
    return errorResponse('批量发布失败', 'INTERNAL_ERROR', 500);
  }
}
