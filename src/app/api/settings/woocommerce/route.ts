import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// GET /api/settings/woocommerce - 获取 WooCommerce 配置
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const configs = await prisma.wooCommerceConfig.findMany({
      orderBy: { isDefault: 'desc' },
    });

    // 隐藏密钥
    const safe = configs.map(c => ({
      id: c.id,
      name: c.name,
      url: c.url,
      consumerKey: c.consumerKey.substring(0, 8) + '...',
      isActive: c.isActive,
      isDefault: c.isDefault,
    }));

    return successResponse(safe);
  } catch (error) {
    console.error('Error fetching WooCommerce config:', error);
    return errorResponse('获取配置失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/settings/woocommerce - 更新 WooCommerce 配置
export async function PUT(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const body = await request.json();

    if (!body.url || !body.consumerKey || !body.consumerSecret) {
      return errorResponse('店铺地址、Consumer Key 和 Consumer Secret 为必填项', 'VALIDATION_ERROR', 422);
    }

    // 清除现有的默认配置
    const existing = await prisma.wooCommerceConfig.findFirst({ where: { isDefault: true } });

    if (existing) {
      await prisma.wooCommerceConfig.update({
        where: { id: existing.id },
        data: {
          name: body.name || '默认店铺',
          url: body.url,
          consumerKey: body.consumerKey,
          consumerSecret: body.consumerSecret,
        },
      });
    } else {
      await prisma.wooCommerceConfig.create({
        data: {
          name: body.name || '默认店铺',
          url: body.url,
          consumerKey: body.consumerKey,
          consumerSecret: body.consumerSecret,
          isDefault: true,
        },
      });
    }

    return successResponse({ updated: true }, 'WooCommerce 配置已保存');
  } catch (error) {
    console.error('Error saving WooCommerce config:', error);
    return errorResponse('保存配置失败', 'INTERNAL_ERROR', 500);
  }
}
