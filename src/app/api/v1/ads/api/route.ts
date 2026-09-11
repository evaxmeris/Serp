import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getApiFetcherStatus } from '@/lib/ads/api-fetcher';
import { z } from 'zod';

// GET /api/v1/ads/api/status?accountId=xxx — M2 接入状态（ads:view）
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:view');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  const accountId = request.nextUrl.searchParams.get('accountId') || null;
  const status = await getApiFetcherStatus(accountId);
  return successResponse(status);
}

// POST /api/v1/ads/api/apply — 自动执行决策（★ dry-run 默认；confirm=true 才真实修改）
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:edit');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('请求体不是合法 JSON', 'INVALID_JSON', 400);
  }
  const v = z
    .object({
      accountId: z.string().min(1),
      recommendationId: z.string().min(1),
      confirm: z.boolean().default(false),
    })
    .safeParse(body);
  if (!v.success) return errorResponse('参数校验失败', 'VALIDATION_ERROR', 400);
  const { accountId, recommendationId, confirm } = v.data;

  // 取勾选的决策行 → 转 ApiFetcher decisions
  const rows = await prisma.adKeyword.findMany({
    where: { recommendationId, isSelected: true },
  });
  if (rows.length === 0) return errorResponse('执行清单为空，请先勾选决策行', 'EMPTY_LIST', 400);

  const decisions = rows.map(r => ({
    action: (r.action ?? 'KEEP').toUpperCase(),
    keywordId: r.externalId,
    keywordText: r.keywordText,
    matchType: r.matchType,
    bid: r.actionBid ?? r.bid,
    amazonCampaignId: r.amazonCampaignId,
    adGroupId: r.adGroupId,
  }));

  const { applyRecommendations } = await import('@/lib/ads/api-fetcher');
  const result = await applyRecommendations(accountId, decisions, confirm);

  if (!result.ok) {
    return errorResponse((result.error as string) ?? '执行失败（凭据未配置？）', 'API_NOT_CONFIGURED', 400);
  }
  // 审计（dry-run 也留痕）
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: confirm ? 'ADS_API_APPLY' : 'ADS_API_APPLY_DRYRUN',
      targetType: 'AdRecommendation',
      targetId: recommendationId,
      detail: JSON.stringify({ dryRun: !confirm, rows: rows.length, result }),
    },
  } as never).catch(() => undefined);

  return successResponse(result, confirm ? '已执行（真实修改后台）' : 'dry-run 预览（未修改后台，确认后再次调用将真实执行）');
}
