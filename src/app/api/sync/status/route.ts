/**
 * 查询同步状态 API
 * 
 * GET /api/sync/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { platformRegistry } from '@/lib/sync';
import { decryptCredentials } from '@/lib/crypto-utils';

export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    
    // 获取所有平台状态
    const platforms = platformRegistry.getAvailablePlatforms();
    const platformStatuses = [];
    
    for (const code of platforms) {
      const adapter = platformRegistry.get(code);
      const config = await prisma.platformSyncConfig.findUnique({
        where: { platformCode: code },
      });
      
      platformStatuses.push({
        code,
        name: adapter?.platformName || code,
        enabled: config?.enabled || false,
        configured: !!config && Object.keys(decryptCredentials(config.credentials)).length > 0,
        lastSyncAt: config?.lastSyncAt,
        lastSyncStatus: config?.lastSyncStatus,
        syncIntervalMin: config?.syncIntervalMin || 120,
      });
    }
    
    // 获取最近的同步日志
    const recentLogs = await prisma.platformSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
    
    return successResponse({
      platforms: platformStatuses,
      recentLogs,
    });
    
  } catch (error) {
    console.error('[Sync Status API] 查询失败:', error);
    return errorResponse(
      error instanceof Error ? error.message : '查询同步状态失败',
      'STATUS_QUERY_FAILED',
      500
    );
  }
}
