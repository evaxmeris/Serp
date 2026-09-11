import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generateBulkTable } from '@/lib/ads/bulk-table';
import type { AdKeywordRow } from '@/types/ads';
import { z } from 'zod';

// POST /api/v1/ads/bulk-table  — 生成批量操作表 xlsx（返回下载用 Buffer）
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
      recommendationId: z.string().min(1),
      confirmEmpty: z.boolean().default(false),
    })
    .safeParse(body);
  if (!v.success) return errorResponse('参数校验失败', 'VALIDATION_ERROR', 400);
  const { recommendationId, confirmEmpty } = v.data;

  // 勾选的决策行（单一数据源：AdKeyword 表，P0-7）
  const rows = await prisma.adKeyword.findMany({
    where: { recommendationId, isSelected: true },
    orderBy: { source: 'asc' },
  });

  if (rows.length === 0 && !confirmEmpty) {
    return errorResponse('执行清单为空，确认生成空表？', 'EMPTY_LIST', 400);
  }

  // 风险词两行：关闭 + 活动级否定（调用方在勾选时已拆两行 source；这里按 action 归类）
  const inputs = rows.map(row => {
    const raw = (row.action ?? 'KEEP').toUpperCase();
    // EXPAND（收割精准）/ EXPAND_BROAD（开广泛探测）→ 批量表 CREATE 行（matchType 取行值）
    const action = (raw === 'EXPAND' || raw === 'EXPAND_BROAD' ? 'CREATE' : raw) as 'PAUSE' | 'RAISE_BID' | 'LOWER_BID' | 'NEGATE' | 'CREATE';
    const r = row as unknown as AdKeywordRow;
    // PAUSE/NEGATE 行强制 actionBid=null（批量表禁止 paused+Bid 并存，自检 #4）
    const actionBid = action === 'PAUSE' || action === 'NEGATE' ? null : (row.actionBid ?? row.bid);
    return { row: { ...r, actionBid, amazonCampaignId: row.amazonCampaignId ?? '' }, action };
  });

  try {
    const { buffer, result } = await generateBulkTable(inputs);
    // 审计日志（R7：批量表生成留痕）
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADS_BULK_TABLE_GENERATE',
        targetType: 'AdRecommendation',
        targetId: recommendationId,
        detail: JSON.stringify(result.stats),
      } as never,
    }).catch(() => undefined);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ads-bulk-${recommendationId.slice(0, 8)}.xlsx"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('自检失败')) return errorResponse(msg.slice(0, 500), 'BULK_SELF_CHECK_FAILED', 400);
    return errorResponse('生成失败：' + msg.slice(0, 300), 'DB_ERROR', 500);
  }
}
