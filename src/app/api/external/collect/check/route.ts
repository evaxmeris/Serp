import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/external/collect/check?sourceUrl=xxx
 * 去重查询：检查产品是否已经被采集过
 * 返回 existing 信息，让前端决定是否继续采集
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sourceUrl = searchParams.get('sourceUrl');

    if (!sourceUrl) {
      return errorResponse('缺少 sourceUrl 参数', 'VALIDATION_ERROR', 422);
    }

    // 按 sourceUrl 查找已有记录
    const existing = await prisma.collectedProduct.findFirst({
      where: { sourceUrl },
      orderBy: { collectedAt: 'desc' },
      select: {
        id: true,
        title: true,
        pipelineStatus: true,
        collectedAt: true,
      },
    });

    if (!existing) {
      return successResponse({
        exists: false,
        message: '该产品尚未采集',
      }, '未采集');
    }

    // 已存在 → 返回详情
    const minutesAgo = Math.floor(
      (Date.now() - existing.collectedAt.getTime()) / 60000
    );

    return successResponse({
      exists: true,
      id: existing.id,
      title: existing.title,
      pipelineStatus: existing.pipelineStatus,
      collectedAt: existing.collectedAt.toISOString(),
      minutesAgo,
      message: existing.pipelineStatus === 'published'
        ? `该产品已在 ${minutesAgo} 分钟前采集并发布，重新采集会创建新记录`
        : `该产品已在 ${minutesAgo} 分钟前采集（${existing.pipelineStatus}），重新采集会覆盖更新`,
    }, '已存在');
  } catch (error) {
    console.error('Check collect error:', error);
    return errorResponse('去重查询失败', 'INTERNAL_ERROR', 500);
  }
}
