/**
 * 手动触发同步 API
 * 
 * POST /api/sync
 * Body: { platformCode?: string, marketplaceId?: string }  // 不传 platformCode 则同步所有已配置平台
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { executePlatformSync, platformRegistry } from '@/lib/sync';

export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    
    // 解析请求体（允许空 body）
    const body = await request.json().catch(() => ({} as any));
    const { platformCode, marketplaceId } = body || {};
    
    let results: any[] = [];
    
    if (platformCode) {
      // 同步指定平台（可指定站点）
      const result = await executePlatformSync(
        platformCode,
        'manual',
        marketplaceId || undefined,
      );
      results.push(result);
    } else {
      // 同步所有已配置平台：按配置行逐个同步（支持同平台多站点）
      const configs = await prisma.platformSyncConfig.findMany({
        where: { enabled: true },
        orderBy: { platformCode: 'asc' },
      });
      
      const targets = configs.length > 0
        ? configs.map(c => ({ platformCode: c.platformCode, marketplaceId: c.marketplaceId || undefined }))
        : platformRegistry.getAvailablePlatforms().map(code => ({ platformCode: code, marketplaceId: undefined }));
      
      for (const target of targets) {
        try {
          const result = await executePlatformSync(
            target.platformCode,
            'manual',
            target.marketplaceId,
          );
          results.push(result);
        } catch (error) {
          results.push({
            platformCode: target.platformCode,
            marketplaceId: target.marketplaceId,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    
    return successResponse({
      results,
      message: '同步完成',
    });
    
  } catch (error) {
    console.error('[Sync API] 同步失败:', error);
    return errorResponse(
      error instanceof Error ? error.message : '同步失败',
      'SYNC_FAILED',
      500
    );
  }
}
