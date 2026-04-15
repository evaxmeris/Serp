/**
 * 同步配置管理 API
 * 
 * GET /api/sync/config?platformCode=alibaba  - 获取配置
 * PUT /api/sync/config                       - 更新配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { platformRegistry } from '@/lib/sync';

export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const platformCode = searchParams.get('platformCode');
    
    if (!platformCode) {
      // 返回所有平台配置
      const configs = await prisma.platformSyncConfig.findMany();
      return successResponse({ configs });
    }
    
    // 返回指定平台配置
    const config = await prisma.platformSyncConfig.findUnique({
      where: { platformCode },
    });
    
    if (!config) {
      return errorResponse('配置不存在', 'CONFIG_NOT_FOUND', 404);
    }
    
    return successResponse({ config });
    
  } catch (error) {
    console.error('[Sync Config API] 查询失败:', error);
    return errorResponse(
      error instanceof Error ? error.message : '查询配置失败',
      'CONFIG_QUERY_FAILED',
      500
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 认证检查（需要管理员权限）
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    
    // TODO: 检查管理员权限
    // if (session.user.role !== 'ADMIN') {
    //   return errorResponse('权限不足', 'FORBIDDEN', 403);
    // }
    
    // 解析请求体
    const body = await request.json();
    const { platformCode, enabled, syncIntervalMin, credentials, settings } = body;
    
    if (!platformCode) {
      return errorResponse('缺少 platformCode 参数', 'INVALID_REQUEST', 400);
    }
    
    // 检查平台是否已注册
    const adapter = platformRegistry.get(platformCode);
    if (!adapter) {
      return errorResponse(`平台 ${platformCode} 未注册`, 'PLATFORM_NOT_FOUND', 404);
    }
    
    // 创建或更新配置
    const config = await prisma.platformSyncConfig.upsert({
      where: { platformCode },
      update: {
        enabled: enabled !== undefined ? enabled : undefined,
        syncIntervalMin: syncIntervalMin || undefined,
        credentials: credentials || undefined,
        settings: settings || undefined,
      },
      create: {
        platformCode,
        platformName: adapter.platformName,
        enabled: enabled || false,
        syncIntervalMin: syncIntervalMin || 120,
        credentials: credentials || {},
        settings: settings || null,
      },
    });
    
    return successResponse({ config, message: '配置已保存' });
    
  } catch (error) {
    console.error('[Sync Config API] 保存失败:', error);
    return errorResponse(
      error instanceof Error ? error.message : '保存配置失败',
      'CONFIG_SAVE_FAILED',
      500
    );
  }
}
