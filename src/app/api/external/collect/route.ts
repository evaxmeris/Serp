import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// POST /api/external/collect - Chrome 插件采集接口（API Token 鉴权）
export async function POST(request: NextRequest) {
  try {
    // 验证 API Token
    const apiToken = request.headers.get('X-API-Token');
    if (!apiToken) {
      return errorResponse('缺少 API Token', 'UNAUTHORIZED', 401);
    }

    const tokenConfig = await prisma.systemConfig.findUnique({
      where: { key: 'collect_api_token' },
    });

    if (!tokenConfig || tokenConfig.value !== apiToken) {
      return errorResponse('API Token 无效', 'UNAUTHORIZED', 401);
    }

    // 测试模式：只验证 Token，不创建数据
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.get('test') === '1') {
      return successResponse({ valid: true }, 'Token 验证成功');
    }

    const body = await request.json();

    if (!body.source || !body.sourceUrl) {
      return errorResponse('缺少来源信息（source / sourceUrl）', 'VALIDATION_ERROR', 422);
    }

    // 去重：按 sourceUrl 检查是否已采集过
    const existing = await prisma.collectedProduct.findFirst({
      where: { sourceUrl: body.sourceUrl },
      orderBy: { collectedAt: 'desc' },
    });

    if (existing) {
      if (existing.pipelineStatus === 'published') {
        return successResponse({
          id: existing.id,
          title: existing.title,
          pipelineStatus: existing.pipelineStatus,
          alreadyCollected: true,
          message: '该产品已发布到独立站，如需更新请在 ERP 中编辑后重新发布',
        }, '已存在（已发布）');
      }

      // 已采集但未发布 → 覆盖更新
      const updated = await prisma.collectedProduct.update({
        where: { id: existing.id },
        data: {
          title: body.title || existing.title,
          titleEn: body.titleEn || existing.titleEn,
          shortDescription: body.shortDescription || existing.shortDescription,
          description: body.description || existing.description,
          descriptionEn: body.descriptionEn || existing.descriptionEn,
          brand: body.brand || existing.brand,
          sku: body.sku || existing.sku,
          price: body.price ? parseFloat(body.price) : existing.price,
          compareAtPrice: body.compareAtPrice ? parseFloat(body.compareAtPrice) : existing.compareAtPrice,
          currency: body.currency || existing.currency,
          stockQuantity: body.stockQuantity ? parseInt(body.stockQuantity) : existing.stockQuantity,
          weight: body.weight ? parseFloat(body.weight) : existing.weight,
          length: body.length ? parseFloat(body.length) : existing.length,
          width: body.width ? parseFloat(body.width) : existing.width,
          height: body.height ? parseFloat(body.height) : existing.height,
          shippingClass: body.shippingClass || existing.shippingClass,
          hsCode: body.hsCode || existing.hsCode,
          pipelineStatus: 'collected',
          collectedAt: new Date(),
          rawData: body.rawData || existing.rawData,
        },
      });

      // 替换图片（删除旧的，插入新的）
      if (body.images && Array.isArray(body.images)) {
        await prisma.collectedProductImage.deleteMany({ where: { collectedProductId: existing.id } });
        await prisma.collectedProductImage.createMany({
          data: body.images.map((img, idx) => ({
            collectedProductId: existing.id,
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

      // 替换属性
      if (body.attributes && Array.isArray(body.attributes)) {
        await prisma.collectedProductAttribute.deleteMany({ where: { collectedProductId: existing.id } });
        if (body.attributes.length > 0) {
          await prisma.collectedProductAttribute.createMany({
            data: body.attributes.map((attr, idx) => ({
              collectedProductId: existing.id,
              name: attr.name,
              value: attr.value,
              unit: attr.unit || null,
              sortOrder: idx,
            })),
          });
        }
      }

      return successResponse({
        id: updated.id,
        title: updated.title,
        pipelineStatus: updated.pipelineStatus,
        updated: true,
      }, '已更新');
    }

    // 全新采集
    const product = await prisma.collectedProduct.create({
      data: {
        source: body.source,
        sourceUrl: body.sourceUrl,
        sourceId: body.sourceId || null,
        title: body.title || '(无标题)',
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
        // ★ 新增字段
        length: body.length ? parseFloat(body.length) : null,
        width: body.width ? parseFloat(body.width) : null,
        height: body.height ? parseFloat(body.height) : null,
        shippingClass: body.shippingClass || null,
        hsCode: body.hsCode || null,
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

    return successResponse({
      id: product.id,
      title: product.title,
      pipelineStatus: product.pipelineStatus,
    }, '采集成功');
  } catch (error) {
    console.error('External collect error:', error);
    return errorResponse('采集失败', 'INTERNAL_ERROR', 500);
  }
}
