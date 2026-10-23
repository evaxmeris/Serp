/**
 * 手动触发同步 API
 *
 * POST /api/sync
 * Body: {
 *   platformCode?: string,        // 不传则同步所有已启用的配置行
 *   marketplaceId?: string,       // 站点（Amazon marketplaceId），支持同平台多站点
 *   resource?: 'orders' | 'fbaInventory' | 'listings' | 'all'   // 默认 orders（兼容第一期调用方）
 * }
 *
 * 返回语义（二期 BE-1）：
 *   - 单资源失败（含「无凭证」「平台未配置」）返回 HTTP 200 + results[].status='failed'，
 *     不再 500 —— 亚马逊凭证未到位时调用方可以稳定重试
 *   - 未实现资源（tiktok / shopify 的快照）返回 results[].status='not_supported'
 *   - 只有真正的内部异常（参数非法等）才 4xx/5xx
 */

import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { executeResourceSync, parseSyncResource, platformRegistry } from '@/lib/sync';
import type { ResourceSyncResult, AllResourcesSyncResult } from '@/lib/sync';

type AnyResourceResult = ResourceSyncResult | AllResourcesSyncResult;

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json().catch(() => ({} as any));
    const { platformCode, marketplaceId } = body || {};

    // resource 缺省为 orders（兼容一期脚本/页面）
    const rawResource = body?.resource ?? 'orders';
    const resource = parseSyncResource(rawResource);
    if (!resource) {
      return errorResponse(
        `不支持的 resource: ${rawResource}（可选 orders / fbaInventory / listings / all）`,
        'VALIDATION_ERROR',
        422,
      );
    }

    const results: AnyResourceResult[] = [];
    const triggerType = 'manual' as const;

    if (platformCode) {
      results.push(await executeResourceSync(platformCode, resource, triggerType, marketplaceId || undefined));
    } else {
      // 同步所有已配置平台：按配置行逐个同步（支持同平台多站点）
      const configs = await prisma.platformSyncConfig.findMany({
        where: { enabled: true },
        orderBy: { platformCode: 'asc' },
      });

      const targets =
        configs.length > 0
          ? configs.map(c => ({ platformCode: c.platformCode, marketplaceId: c.marketplaceId || undefined }))
          : platformRegistry
              .getAvailablePlatforms()
              .map(code => ({ platformCode: code, marketplaceId: undefined }));

      for (const target of targets) {
        results.push(
          await executeResourceSync(target.platformCode, resource, triggerType, target.marketplaceId),
        );
      }
    }

    const failed = results.filter(r => r.status === 'failed').length;

    return successResponse({
      resource,
      results,
      summary: {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        partial: results.filter(r => r.status === 'partial').length,
        failed,
        notSupported: results.filter(r => r.status === 'not_supported').length,
      },
      message: failed > 0 ? '同步完成（部分资源失败，详见 results）' : '同步完成',
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
