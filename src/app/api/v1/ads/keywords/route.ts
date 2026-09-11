import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { listResponse, errorResponse, forbiddenResponse } from '@/lib/api-response';
import { withValidation } from '@/lib/api-validation';
import { z } from 'zod';
import { AD_ACTIONS } from '@/types/ads';

// ──────────────────────────────────────────────────────────────
// Zod 校验（BE 设计 §4.13：⚠️ 不复用 PaginationSchema 的 sortBy/sortOrder 默认值）
// ──────────────────────────────────────────────────────────────

const AdsKeywordsQuerySchema = z.object({
  recommendationId: z.string().min(1, 'recommendationId 必填'), // 必填，缺失 422
  accountId: z.string().min(1).optional(),
  familyL1: z.string().max(100).optional(),
  action: z.enum(AD_ACTIONS).optional(),
  matchType: z.string().max(50).optional(),
  source: z.enum(['CLOSE_MATRIX', 'LAYER_CHECK', 'EXPAND', 'NEGATE']).optional(),
  // ⚠️ 禁止 z.coerce.boolean()（B1 陷阱），enum+transform
  isSelected: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().max(100).optional(), // keywordText contains（不区分大小写）
  page: z.coerce.number().int().positive().default(1).catch(1),
  limit: z.coerce.number().int().positive().max(200).default(50).catch(50),
});

// GET /api/v1/ads/keywords — 决策行列表（ads:view，执行清单唯一数据源 REQ-003/004）
export const GET = withValidation(
  { query: AdsKeywordsQuerySchema },
  async (request, { query }) => {
    try {
      const session = await getUserFromRequest(request);
      if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
      const ok = await hasPermission(session.id, 'ads:view');
      if (!ok) return forbiddenResponse();

      const where: any = {
        recommendationId: query.recommendationId,
        ...(query.accountId && { adAccountId: query.accountId }),
        ...(query.familyL1 && { familyL1: query.familyL1 }),
        ...(query.action && { action: query.action }),
        ...(query.matchType && { matchType: query.matchType }),
        ...(query.source && { source: query.source }),
        ...(query.isSelected !== undefined && { isSelected: query.isSelected }),
        ...(query.search && { keywordText: { contains: query.search, mode: 'insensitive' } }),
      };

      const [rows, total] = await Promise.all([
        prisma.adKeyword.findMany({
          where,
          // 保持引擎行序（B9）：source 分区升序 + rawRowIndex nulls last + createdAt 次级键防抖动
          orderBy: [{ source: 'asc' }, { rawRowIndex: 'asc' }, { createdAt: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.adKeyword.count({ where }),
      ]);

      // 行对象 = AdKeyword 全字段 + 派生标记（§17-1）
      const items = rows.map((k) => ({
        ...k,
        isManualOverride: k.overriddenAt != null, // 派生：overriddenAt != null（前端标「手工修改」）
        reasonPending: k.actionReason === '待补充', // 派生：前端标黄（架构 P0-3）
        cpa: k.orders && k.orders > 0 && k.spend != null ? Number((k.spend / k.orders).toFixed(2)) : null,
      }));

      return listResponse(items, {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      });
    } catch (error) {
      console.error('获取决策行列表失败:', error);
      return errorResponse('获取决策行列表失败', 'INTERNAL_ERROR', 500);
    }
  }
);
