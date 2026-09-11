import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { successResponse, errorResponse, forbiddenResponse, notFoundResponse } from '@/lib/api-response';
import { withValidation } from '@/lib/api-validation';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// Zod 校验（BE 设计 §4.10）
// ──────────────────────────────────────────────────────────────

const ReportParamsSchema = z.object({ id: z.string().min(1, '报告 ID 不能为空') });

/**
 * GET /api/v1/ads/reports/[id]/result — 最新决策结果（ads:view，REQ-003）
 *
 * 数据源边界（架构 P0-7/AD-8）：
 *  - account/families/expandTable/layerCheck/summary 从 AdRecommendation.result 原样透传（数字零换算，R4/AC-1）
 *  - closeMatrix/negateList 从 AdKeyword 决策行读取（任务书口径：执行清单唯一数据源）
 *  - 顶层键与引擎契约一一对应（§17-4：recommendation/account/families/expandTable/layerCheck/
 *    summary/closeMatrix/negateList/degraded/pairing），前端禁止重命名
 */
export const GET = withValidation(
  { params: ReportParamsSchema },
  async (request, { params }) => {
    try {
      const session = await getUserFromRequest(request);
      if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
      const ok = await hasPermission(session.id, 'ads:view');
      if (!ok) return forbiddenResponse();

      // 1. 报告存在性 + 最新决策（批内最新版本，E8 重跑多版本共存取最新）
      const report = await prisma.adReport.findUnique({
        where: { id: params.id },
        select: { id: true, reportType: true, uploadBatchId: true, adAccountId: true },
      });
      if (!report) return notFoundResponse('报告');

      const recommendation = await prisma.adRecommendation.findFirst({
        where: { adReportId: params.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!recommendation) {
        return errorResponse('该报告尚未分析或分析失败', 'NOT_FOUND', 404);
      }

      // 2. result 快照原样读取（Json 单一事实源）
      const r = (recommendation.result ?? {}) as Record<string, unknown>;
      const degraded = r.degraded === true;

      // 3. closeMatrix/negateList 从 AdKeyword 决策行读（source 分区）
      const [closeRows, negateRows] = await Promise.all([
        prisma.adKeyword.findMany({
          where: { recommendationId: recommendation.id, source: 'CLOSE_MATRIX' },
          orderBy: [{ rawRowIndex: 'asc' }],
        }),
        prisma.adKeyword.findMany({
          where: { recommendationId: recommendation.id, source: 'NEGATE' },
          orderBy: [{ rawRowIndex: 'asc' }],
        }),
      ]);

      // 行对象保留 AdKeyword 全字段 + rowIndex/term/reason 别名（引擎契约形态，供前端下钻 AC-10）
      const closeMatrix = closeRows.map((k) => ({ ...k, rowIndex: k.rawRowIndex }));
      const negateList = negateRows.map((k) => ({ ...k, term: k.keywordText, reason: k.actionReason, rowIndex: k.rawRowIndex }));

      // 4. 批内报告引用（FE 设计 §13 O-1：原始行下钻定位）
      const batchReports = await prisma.adReport.findMany({
        where: { uploadBatchId: report.uploadBatchId, adAccountId: report.adAccountId },
        select: { id: true, reportType: true },
      });
      const reports = {
        search: batchReports.find((b) => b.reportType === 'SEARCH_TERM')?.id ?? null,
        targeting: batchReports.find((b) => b.reportType === 'TARGETING')?.id ?? null,
      };

      // 5. pairing 轻量重算（result 快照未存 pairing，按批内互补报告推断）
      const mainType = report.reportType;
      const pairedId = mainType === 'TARGETING' ? reports.search : reports.targeting;
      const pairing = pairedId
        ? { mode: 'batch' as const, reportId: pairedId }
        : { mode: 'none' as const, reportId: null as string | null };

      // 5b. rawRow 下钻（AC-10/R5）：?rawRow=N → 返回该原始报告行
      const rawRowParam = request.nextUrl?.searchParams?.get('rawRow');
      if (rawRowParam !== null && rawRowParam !== undefined && rawRowParam !== '') {
        const idx = Number(rawRowParam);
        if (!Number.isInteger(idx) || idx < 0) {
          return errorResponse('rawRow 参数非法', 'VALIDATION_ERROR', 400);
        }
        // 优先取批内对应报告（当前报告或互补报告）
        const targetReport = await prisma.adReport.findFirst({
          where: {
            uploadBatchId: report.uploadBatchId,
            adAccountId: report.adAccountId,
            OR: [
              { id: params.id },
              ...(reports.search ? [{ id: reports.search }] : []),
              ...(reports.targeting ? [{ id: reports.targeting }] : []),
            ],
          },
          select: { id: true, reportType: true, rawRows: true },
        });
        if (!targetReport) return notFoundResponse('原始报告');
        const rows = (targetReport.rawRows ?? []) as unknown[];
        if (idx >= rows.length) return errorResponse('行号超出范围', 'VALIDATION_ERROR', 400);
        return successResponse({ reportId: targetReport.id, reportType: targetReport.reportType, rowIndex: idx, row: rows[idx] });
      }

      // 6. 顶层键组装（§17-4；closeMatrix/negateList 为数组形态，与 types/ads.ts 契约一致）
      return successResponse({
        recommendation: {
          id: recommendation.id,
          version: recommendation.version,
          createdAt: recommendation.createdAt,
          params: recommendation.params ?? null,
        },
        account: (r.account as Record<string, unknown>) ?? null,
        families: Array.isArray(r.families) ? r.families : [],
        expandTable: Array.isArray(r.expandTable) ? r.expandTable : [],
        layerCheck: (r.layerCheck as Record<string, unknown>) ?? null,
        summary: (r.summary as Record<string, unknown>) ?? null,
        closeMatrix,
        negateList,
        degraded,
        pairing,
        reports: { search: reports.search ? { id: reports.search } : null, targeting: reports.targeting ? { id: reports.targeting } : null },
      });
    } catch (error) {
      console.error('获取决策结果失败:', error);
      return errorResponse('获取决策结果失败', 'INTERNAL_ERROR', 500);
    }
  }
);
