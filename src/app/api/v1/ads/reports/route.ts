import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { listResponse, errorResponse, forbiddenResponse } from '@/lib/api-response';
import { withValidation } from '@/lib/api-validation';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// Zod 校验（BE 设计 §4.8）
// ──────────────────────────────────────────────────────────────

const AdsReportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).catch(1),
  limit: z.coerce.number().int().positive().max(100).default(20).catch(20),
  accountId: z.string().min(1).optional(),
  reportType: z.enum(['SEARCH_TERM', 'TARGETING']).optional(),
  source: z.enum(['MANUAL_UPLOAD', 'API']).optional(),
});

// GET /api/v1/ads/reports — 报告历史列表（ads:view，含 latestRecommendation）
// 注意：不返回 rawRows/summary 大字段（R6 防超限）
export const GET = withValidation(
  { query: AdsReportsQuerySchema },
  async (request, { query }) => {
    try {
      const session = await getUserFromRequest(request);
      if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
      const ok = await hasPermission(session.id, 'ads:view');
      if (!ok) return forbiddenResponse();

      const where: any = {
        ...(query.accountId && { adAccountId: query.accountId }),
        ...(query.reportType && { reportType: query.reportType }),
        ...(query.source && { source: query.source }),
      };

      const [reports, total] = await Promise.all([
        prisma.adReport.findMany({
          where,
          // R6：显式 select 排除 summary/rawRows 大字段
          select: {
            id: true,
            adAccountId: true,
            reportType: true,
            source: true,
            startDate: true,
            endDate: true,
            originalName: true,
            rowCount: true,
            analyzeStatus: true,
            analyzedAt: true,
            createdAt: true,
            adAccount: { select: { id: true, name: true } },
            recommendations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, version: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.adReport.count({ where }),
      ]);

      // 响应项（§17-8 键契约：id/accountId/accountName/reportType/source/startDate/endDate/
      // originalName/rowCount/analyzeStatus/analyzedAt/latestRecommendation/createdAt）
      const items = reports.map((r) => ({
        id: r.id,
        accountId: r.adAccountId,
        accountName: r.adAccount?.name ?? null,
        reportType: r.reportType,
        source: r.source,
        startDate: r.startDate,
        endDate: r.endDate,
        originalName: r.originalName,
        rowCount: r.rowCount,
        analyzeStatus: r.analyzeStatus,
        analyzedAt: r.analyzedAt,
        latestRecommendation: r.recommendations[0] ?? null,
        createdAt: r.createdAt,
      }));

      return listResponse(items, {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      });
    } catch (error) {
      console.error('获取报告历史失败:', error);
      return errorResponse('获取报告历史失败', 'INTERNAL_ERROR', 500);
    }
  }
);
