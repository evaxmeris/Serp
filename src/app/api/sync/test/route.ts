/**
 * 平台连接测试 API
 * POST /api/sync/test
 * 测试平台 API 凭据是否有效
 */

import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { platformRegistry } from '@/lib/sync';
import { decryptCredentials } from '@/lib/crypto-utils';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json();
    const { platformCode } = body;

    if (!platformCode) return errorResponse('缺少 platformCode', 'VALIDATION_ERROR', 400);

    // 检查平台适配器是否存在
    const adapter = platformRegistry.get(platformCode);
    if (!adapter) return errorResponse(`平台 ${platformCode} 未注册`, 'PLATFORM_NOT_FOUND', 404);

    // 读取配置
    const config = await prisma.platformSyncConfig.findUnique({
      where: { platformCode },
    });

    if (!config) {
      return errorResponse('未找到平台配置，请先在平台管理中保存凭据', 'CONFIG_NOT_FOUND', 404);
    }

    if (!config.enabled) {
      return successResponse({
        connected: false,
        message: '平台未启用，请先启用后再测试',
        details: null,
      });
    }

    // 解密凭据
    const credentials = decryptCredentials(config.credentials) || {};

    // 构建完整的平台配置
    const platformConfig = {
      platformCode,
      platformName: adapter.platformName,
      enabled: config.enabled,
      syncIntervalMin: config.syncIntervalMin || 120,
      credentials,
      settings: config.settings || {},
    };

    // 调用认证测试
    const authResult = await adapter.authenticate(platformConfig);

    // 如果 token 被刷新了，自动保存新 token
    const refreshedToken = (authResult as any).refreshedToken;
    const newRefreshToken = (authResult as any).newRefreshToken;
    if (refreshedToken) {
      await prisma.platformSyncConfig.update({
        where: { platformCode },
        data: {
          credentials: encryptCredentials({
            ...credentials,
            accessToken: refreshedToken,
            ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
          }),
        },
      });
    }

    if (authResult.success) {
      const msg = refreshedToken ? 'Token 已自动续期，连接成功！' : '连接成功！API 凭据配置正确';
      return successResponse({
        connected: true,
        message: msg,
        details: null,
      });
    } else {
      return successResponse({
        connected: false,
        message: '连接失败',
        details: authResult.error || '未知错误',
      });
    }

  } catch (error) {
    console.error('[Sync Test] 测试失败:', error);
    return errorResponse(
      error instanceof Error ? error.message : '测试连接失败',
      'TEST_FAILED',
      500
    );
  }
}
