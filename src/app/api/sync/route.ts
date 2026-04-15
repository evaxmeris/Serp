/**
 * 手动触发同步 API
 * 
 * POST /api/sync
 * Body: { platformCode?: string }  // 不传则同步所有平台
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse, successResponse } from '@/lib/api-response';
import { executePlatformSync, platformRegistry } from '@/lib/sync';

export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    
    // 解析请求体
    const body = await request.json();
    const { platformCode } = body;
    
    let results: any[] = [];
    
    if (platformCode) {
      // 同步指定平台
      const result = await executePlatformSync(platformCode, 'manual');
      results.push(result);
    } else {
      // 同步所有已启用的平台
      const platforms = platformRegistry.getAvailablePlatforms();
      
      for (const code of platforms) {
        try {
          const result = await executePlatformSync(code, 'manual');
          results.push(result);
        } catch (error) {
          results.push({
            platformCode: code,
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
