import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { withValidation } from '@/lib/api-validation';
import { z } from 'zod';
import { runAdsEngine, type EngineOptions, type EngineResult } from '@/lib/ads/engine-client';
import { writeAdsAuditLog } from '@/lib/ads/audit';

// ──────────────────────────────────────────────────────────────
// Zod 校验（BE 设计 §4.9：body 已裁剪 force 参数，E4 阻断后按需求字面重传）
// ──────────────────────────────────────────────────────────────

const ReportParamsSchema = z.object({ id: z.string().min(1, '报告 ID 不能为空') });

// ──────────────────────────────────────────────────────────────
// 决策行构建（§5.3：4 类来源行 + 内存合并 + 冲突消解）
// ──────────────────────────────────────────────────────────────

const SOURCE_PRIORITY: Record<string, number> = {
  CLOSE_MATRIX: 4,
  LAYER_CHECK: 3,
  EXPAND: 2,
  NEGATE: 1,
};

/** 引擎动作中文文本 → AdAction 枚举（关闭/暂停优先于否定，§7.3 语义） */
function mapEngineAction(actionText: string | null | undefined): string {
  const a = actionText ?? '';
  if (a.includes('暂停') || a.includes('关闭') || a.includes('停止')) return 'PAUSE';
  if (a.includes('加价')) return 'RAISE_BID';
  if (a.includes('降竞价') || a.includes('降')) return 'LOWER_BID';
  if (a.includes('否定')) return 'NEGATE';
  return 'KEEP';
}

interface DecisionRow {
  keywordText: string;
  matchType: string | null;
  state: string;
  bid: number | null;
  action: string;
  actionBid: number | null;
  actionReason: string;
  rawRowIndex: number | null;
  source: string;
  acos: number | null;
  orders: number | null;
  spend: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  externalId: string | null;
  amazonCampaignId: string | null;
  adGroupId: string | null;
  familyL1: string | null;
  duplicateOf: string | null;
  reportId: string;
  recommendationId: string;
  adAccountId: string;
  campaignId: string | null;
}

/** 内存合并键（§5.3 步骤 2）：externalId 非空 → (externalId, rawRowIndex)；否则 → (keywordText, matchType, source) */
function mergeKeyOf(row: Pick<DecisionRow, 'externalId' | 'rawRowIndex' | 'keywordText' | 'matchType' | 'source'>): string {
  if (row.externalId) return `id:${row.externalId}|${row.rawRowIndex ?? -1}`;
  return `text:${row.keywordText}|${row.matchType ?? ''}|${row.source}`;
}

/** 来源优先级冲突消解（I-7：关闭优先于改价，杜绝矛盾行） */
function mergeRows(rows: DecisionRow[]): DecisionRow[] {
  const merged = new Map<string, DecisionRow>();
  for (const row of rows) {
    const key = mergeKeyOf(row);
    const prev = merged.get(key);
    if (!prev || (SOURCE_PRIORITY[row.source] ?? 0) >= (SOURCE_PRIORITY[prev.source] ?? 0)) {
      merged.set(key, row);
    }
  }
  return [...merged.values()];
}

/** 依据兜底：actionReason 空 → "待补充"（P0-3，落库强校验非空） */
const reasonOrDefault = (r: unknown): string => (typeof r === 'string' && r.trim() ? r : '待补充');

// POST /api/v1/ads/reports/[id]/analyze — 触发 v20 引擎跑批（ads:edit）
// 流程：配对 → E3/E4 → 并发守卫 → ANALYZING → 引擎（事务外，120s）→ 事务落库 → ANALYZED
export const POST = withValidation(
  { params: ReportParamsSchema },
  async (request, { params }) => {
    const startedAt = Date.now();
    try {
      const session = await getUserFromRequest(request);
      if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
      const ok = await hasPermission(session.id, 'ads:edit');
      if (!ok) return forbiddenResponse();

      // 1. 报告存在性（B12：账户软删过滤）
      const report = await prisma.adReport.findUnique({
        where: { id: params.id },
        include: { adAccount: true },
      });
      if (!report || report.adAccount.deletedAt) return notFoundResponse('报告');

      // 2. 配对（架构 P0-2/G-2：批内 → 跨批回退 → none）
      const complementaryType = report.reportType === 'SEARCH_TERM' ? 'TARGETING' : 'SEARCH_TERM';
      let pairing: { mode: 'batch' | 'fallback' | 'none'; reportId: string | null };
      let pairedReport: (typeof report) | null = null;

      const inBatch = await prisma.adReport.findFirst({
        where: {
          uploadBatchId: report.uploadBatchId,
          adAccountId: report.adAccountId,
          reportType: complementaryType,
          id: { not: report.id },
        },
      });
      if (inBatch) {
        pairedReport = inBatch as typeof report;
        pairing = { mode: 'batch', reportId: inBatch.id };
      } else {
        // 跨批回退：同账户 + 互补类型 + 日期窗口重叠 ≥ 50% + 唯一命中
        const candidates = await prisma.adReport.findMany({
          where: { adAccountId: report.adAccountId, reportType: complementaryType, id: { not: report.id } },
        });
        const overlaps = candidates.filter((c) => {
          const s = Math.max(report.startDate.getTime(), c.startDate.getTime());
          const e = Math.min(report.endDate.getTime(), c.endDate.getTime());
          if (e <= s) return false;
          const overlapDays = (e - s) / 86400000;
          const minWindow = Math.min(
            (report.endDate.getTime() - report.startDate.getTime()) / 86400000,
            (c.endDate.getTime() - c.startDate.getTime()) / 86400000
          );
          return minWindow > 0 && overlapDays / minWindow >= 0.5;
        });
        if (overlaps.length === 1) {
          pairedReport = overlaps[0] as typeof report;
          pairing = { mode: 'fallback', reportId: overlaps[0].id };
        } else {
          pairing = { mode: 'none', reportId: null };
        }
      }

      const targetingReport = pairedReport?.reportType === 'TARGETING' ? pairedReport : report.reportType === 'TARGETING' ? report : null;
      const searchReport = pairedReport?.reportType === 'SEARCH_TERM' ? pairedReport : report.reportType === 'SEARCH_TERM' ? report : null;

      // 引擎要求 --search 必传：仅有 Targeting 报告且无配对搜索词报告 → 无法分析
      if (!searchReport || !searchReport.filePath) {
        return errorResponse('缺少搜索词报告，无法触发分析（引擎要求搜索词报告为主报告）', 'MISSING_SEARCH_REPORT', 422);
      }

      // 3. E3：无 targeting → degraded 模式（合法 200，不阻断）
      const degraded = !targetingReport;

      // 4. E4：本报告或配对报告 consistencyCheck.warning → 422 阻断（REQ-001-6，无 force 参数）
      const consistencyCheck = (report.consistencyCheck ?? pairedReport?.consistencyCheck ?? null) as
        | { spendDiffPct?: number | null; ordersDiffPct?: number | null; dateMismatch?: boolean; warning?: boolean }
        | null;
      if (consistencyCheck?.warning) {
        return errorResponse(
          '双报告口径偏差超过 15%，请核对后重新上传配对报告',
          'CONSISTENCY_MISMATCH',
          422,
          [
            { field: 'consistency', message: `花费偏差 ${consistencyCheck.spendDiffPct ?? '?'}%，订单偏差 ${consistencyCheck.ordersDiffPct ?? '?'}%` },
          ]
        );
      }

      // 5. 并发守卫：原子置 ANALYZING（UPLOADED/ANALYZE_FAILED/ANALYZED → ANALYZING，E8 重跑允许）
      const guard = await prisma.adReport.updateMany({
        where: { id: report.id, analyzeStatus: { not: 'ANALYZING' } },
        data: { analyzeStatus: 'ANALYZING' },
      });
      if (guard.count === 0) return conflictResponse('报告正在分析中，请稍候', 'ANALYSIS_IN_PROGRESS');

      // 6. 引擎参数（AC-4：null 值不传参 → 引擎动态计算，禁硬编码）
      const settings = (report.adAccount.settings ?? {}) as Record<string, unknown>;
      const opts: EngineOptions = {
        ...(typeof settings.breakEvenAcos === 'number' && { breakEvenAcos: settings.breakEvenAcos }),
        ...(typeof settings.negateClicks === 'number' && { negateClicks: settings.negateClicks }),
        ...(typeof settings.stopSpend === 'number' && { stopSpend: settings.stopSpend }),
        startDate: report.startDate.toISOString().slice(0, 10), // B11：透传 YYYY-MM-DD
        endDate: report.endDate.toISOString().slice(0, 10),
      };

      // 7. 引擎跑批（事务外，120s 超时 + 1 次重试在 engine-client 内，§6.3）
      let result: EngineResult;
      try {
        result = await runAdsEngine({
          searchPath: searchReport.filePath ?? '',
          targetingPath: targetingReport?.filePath ?? undefined,
          opts,
        });
      } catch (error) {
        // 8. E2/E7：失败 → ANALYZE_FAILED + analyzeError 全量落库（可重试）
        // duck-typing 读取 EngineError 字段（engine-client 契约：{exitCode, stderr, attempts, timedOut}）
        const e = error as { exitCode?: number | null; stderr?: string; attempts?: number; message?: string } | null;
        const analyzeError = {
          exitCode: e?.exitCode ?? null,
          stderr: (e?.stderr ?? e?.message ?? String(error)).slice(0, 4000),
          attempts: e?.attempts ?? 1,
          durationMs: Date.now() - startedAt,
        };
        await prisma.adReport.update({
          where: { id: report.id },
          data: {
            analyzeStatus: 'ANALYZE_FAILED',
            analyzeError: analyzeError as Prisma.InputJsonValue,
          },
        });
        await writeAdsAuditLog({
          action: 'ANALYZE',
          entityType: 'AdReport',
          entityId: report.id,
          userId: session.id,
          details: { ok: false, opts, degraded, pairing, ...analyzeError },
          request,
        });
        console.error('广告引擎分析失败:', error);
        return errorResponse('广告引擎分析失败', 'ENGINE_FAILED', 502, [
          { field: 'engine', message: analyzeError.stderr.slice(0, 300) },
        ]);
      }

      // 9. 组装决策行（§5.3 步骤 1：补充 recommendationId/reportId/adAccountId；actionReason 兜底）
      const mainReportId = targetingReport?.id ?? searchReport.id;
      const rows: DecisionRow[] = [];
      const base = {
        adAccountId: report.adAccountId,
        recommendationId: '', // 事务内补
        reportId: mainReportId,
        amazonCampaignId: null,
        adGroupId: null,
        externalId: null,
        campaignId: null,
        duplicateOf: null,
        familyL1: null,
      };

      // 9a. closeMatrix 全量（source=CLOSE_MATRIX，rowIndex → Targeting rawRows 下标）
      for (const c of result.closeMatrix ?? []) {
        rows.push({
          ...base,
          keywordText: c.keywordText || '(未知投放词)',
          matchType: c.matchType || null,
          state: c.state === 'PAUSED' || c.state === 'ENABLED' ? c.state : 'ENABLED',
          bid: c.bid ?? null,
          action: mapEngineAction(c.action),
          actionBid: c.actionBid ?? null,
          actionReason: reasonOrDefault(c.actionReason),
          rawRowIndex: c.rowIndex ?? null,
          source: 'CLOSE_MATRIX',
          acos: c.acos ?? null,
          orders: c.orders ?? null,
          spend: c.spend ?? null,
          clicks: c.clicks ?? null,
          impressions: (c as any).impr ?? null,
          ctr: c.ctr ?? null,
          // Bulk 三件套（自适配层 engine-full3 输出，批量表生成必需；架构必改项 5/I-4）
          amazonCampaignId: (c as any).amazonCampaignId ?? null,
          adGroupId: (c as any).adGroupId ?? null,
          externalId: (c as any).externalId ?? null,
        });
      }

      // 9b. negateList（source=NEGATE：否定对象是搜索词，rowIndex → 搜索词 rawRows 下标）
      for (const n of result.negateList ?? []) {
        rows.push({
          ...base,
          keywordText: n.term || '(未知搜索词)',
          matchType: 'negativeExact',
          state: 'ENABLED',
          bid: null,
          action: 'NEGATE',
          actionBid: null,
          actionReason: reasonOrDefault(n.reason),
          rawRowIndex: n.rowIndex ?? null,
          source: 'NEGATE',
          acos: n.acos ?? null,
          orders: n.orders ?? null,
          spend: n.spend ?? null,
          clicks: n.clicks ?? null,
          impressions: null,
          ctr: null,
          reportId: searchReport.id, // 否定行行索引指向搜索词报告
        });
      }

      // 9c. expandTable（source=EXPAND：新建精准候选；仅「值得拓词」产出）
      // 新建精准需 Ad Group ID：从该族主词（mainTarget）在 closeMatrix 的行继承（新词建在主词所在广告组）
      const mainTargetAdGroup = new Map<string, { adGroupId: string | null; amazonCampaignId: string | null; bid: number | null }>();
      for (const c of result.closeMatrix ?? []) {
        const key = (c.keywordText ?? '').toLowerCase();
        if (!mainTargetAdGroup.has(key)) {
          mainTargetAdGroup.set(key, {
            adGroupId: (c as any).adGroupId ?? null,
            amazonCampaignId: (c as any).amazonCampaignId ?? null,
            bid: c.bid ?? null,
          });
        }
      }
      for (const e of result.expandTable ?? []) {
        const worthExpanding = e.verdict.includes('值得拓词') || (e as any).expand === true;
        if (!worthExpanding) continue;
        const inherited = mainTargetAdGroup.get(String(e.mainTarget ?? '').toLowerCase());
        const mainBid = inherited?.bid ?? null;
        // ★ 拓词动作（用户纠正：开 BROAD 探测 → 收割，不只新建精准）
        //   HARVEST_EXACT：出单增量搜索词提炼精准（bid=主词×0.85 收割档）
        //   OPEN_BROAD/REVISE_BROAD：新建 BROAD 探测词（bid=主词×0.5 探测档）
        const actionType = String((e as any).actionType ?? 'NONE');
        const harvestBid = mainBid != null ? Math.max(0.2, Math.round(mainBid * 0.85 * 100) / 100) : null;
        const probeBid = mainBid != null ? Math.max(0.2, Math.round(mainBid * 0.5 * 100) / 100) : null;

        if (actionType.includes('HARVEST_EXACT')) {
          const harvest = ((e as any).harvestTerms ?? []) as Array<{ term?: string; orders?: unknown }>;
          const terms = harvest.length > 0 ? harvest : []; // 出单增量搜索词 → 提炼精准（收割）
          for (const h of terms) {
            if (!h.term) continue;
            rows.push({
              ...base,
              keywordText: String(h.term),
              matchType: 'EXACT',
              state: 'ENABLED',
              bid: harvestBid,
              action: 'EXPAND', // 收割：新建精准
              actionBid: null,
              actionReason: `收割提炼精准（${e.verdict}；搜索词出单 ${h.orders ?? 0} 单）`,
              rawRowIndex: null,
              source: 'EXPAND',
              acos: null,
              orders: Number(h.orders ?? 0) || null,
              spend: null,
              clicks: null,
              impressions: null,
              ctr: null,
              adGroupId: inherited?.adGroupId ?? null,
              amazonCampaignId: inherited?.amazonCampaignId ?? null,
              familyL1: e.family || null,
            });
          }
        }

        if (actionType.includes('OPEN_BROAD') || actionType.includes('REVISE_BROAD')) {
          const probe = ((e as any).probeTerms ?? []) as string[];
          for (const pt of probe) {
            if (!pt) continue;
            rows.push({
              ...base,
              keywordText: pt,
              matchType: 'BROAD', // 探测词：广泛匹配
              state: 'ENABLED',
              bid: probeBid,
              action: 'EXPAND_BROAD', // 新建广泛探测
              actionBid: null,
              actionReason: `${actionType.includes('REVISE_BROAD') ? '换变体' : '开广泛探测'}（${e.verdict}；bid=主词×0.5）`,
              rawRowIndex: null,
              source: 'EXPAND',
              acos: null,
              orders: null,
              spend: null,
              clicks: null,
              impressions: null,
              ctr: null,
              adGroupId: inherited?.adGroupId ?? null,
              amazonCampaignId: inherited?.amazonCampaignId ?? null,
              familyL1: e.family || null,
            });
          }
        }

        // 兼容旧契约：无 actionType 时按原逻辑兜底（主词新建精准）
        if (actionType === 'NONE' && (e as any).expand === true) {
          const inheritBid = harvestBid;
          rows.push({
            ...base,
            keywordText: e.mainTarget || e.family || '(待拓词)',
            matchType: 'EXACT',
            state: 'ENABLED',
            bid: inheritBid,
            action: 'EXPAND',
            actionBid: null,
            actionReason: reasonOrDefault(e.verdict),
            rawRowIndex: null,
            source: 'EXPAND',
            acos: null,
            orders: e.mainOrders ?? null,
            spend: null,
            clicks: e.incrementalClicks ?? null,
            impressions: null,
            ctr: null,
            adGroupId: inherited?.adGroupId ?? null,
            amazonCampaignId: inherited?.amazonCampaignId ?? null,
            familyL1: e.family || null,
          });
        }
      }

      // 9d. layerCheck.ladderWarnings（source=LAYER_CHECK：仅结构化警告产出决策行；字符串警告留在 result 展示）
      for (const w of result.layerCheck?.ladderWarnings ?? []) {
        if (typeof w !== 'object' || w === null) continue;
        const obj = w as Record<string, unknown>;
        const keywordText = (obj.targeting as string) ?? (obj.keywordText as string) ?? null;
        if (!keywordText) continue;
        const bid = typeof obj.bid === 'number' ? obj.bid : null;
        const suggestedBid = typeof obj.suggestedBid === 'number' ? obj.suggestedBid : null;
        rows.push({
          ...base,
          keywordText: String(keywordText),
          matchType: (obj.matchType as string) ?? null,
          state: 'ENABLED',
          bid,
          action: suggestedBid == null ? 'KEEP' : suggestedBid < (bid ?? 0) ? 'LOWER_BID' : suggestedBid > (bid ?? 0) ? 'RAISE_BID' : 'KEEP',
          actionBid: suggestedBid,
          actionReason: reasonOrDefault(obj.reason),
          rawRowIndex: null,
          source: 'LAYER_CHECK',
          acos: null,
          orders: null,
          spend: null,
          clicks: null,
          impressions: null,
          ctr: null,
          familyL1: (obj.family as string) ?? null,
        });
      }

      // 10. 事务落库（§11.2：AdCampaign upsert → AdRecommendation.create → AdKeyword 合并写入，原子性）
      let recommendationId = '';
      try {
        await prisma.$transaction(async (tx) => {
          // 10a. AdCampaign upsert（键 (adAccountId, externalId)=amazonCampaignId；当前引擎不产 campaign 列为 no-op）
          const campaignIdByAmazon = new Map<string, string>();
          for (const row of rows) {
            if (!row.amazonCampaignId) continue;
            const camp = await tx.adCampaign.upsert({
              where: { adAccountId_externalId: { adAccountId: row.adAccountId, externalId: row.amazonCampaignId } },
              create: {
                adAccountId: row.adAccountId,
                externalId: row.amazonCampaignId,
                name: `campaign-${row.amazonCampaignId}`,
                status: 'ENABLED',
                currency: report.adAccount.marketplaceId ? 'USD' : undefined,
              },
              update: {},
            });
            campaignIdByAmazon.set(row.amazonCampaignId, camp.id);
          }

          // 10b. AdRecommendation.create（result 全量契约快照，单一事实源 R4）
          const rec = await tx.adRecommendation.create({
            data: {
              adReportId: mainReportId,
              adAccountId: report.adAccountId,
              version: result.version || 'unknown',
              result: result as unknown as Prisma.InputJsonValue,
              params: { ...opts, degraded } as Prisma.InputJsonValue,
            },
          });
          recommendationId = rec.id;

          // 10c. AdKeyword 写入（§5.3 步骤 3：内存合并 → 探测 → createMany 新增 + update 覆盖已存在）
          const merged = mergeRows(rows.map((r) => ({ ...r, recommendationId: rec.id, campaignId: campaignIdByAmazon.get(r.amazonCampaignId ?? '') ?? null })));
          const existing = await tx.adKeyword.findMany({
            where: { recommendationId: rec.id },
            select: { id: true, externalId: true, rawRowIndex: true, keywordText: true, matchType: true, source: true },
          });
          const existingByKey = new Map<string, string>();
          for (const e of existing) {
            existingByKey.set(
              mergeKeyOf({
                externalId: e.externalId,
                rawRowIndex: e.rawRowIndex,
                keywordText: e.keywordText,
                matchType: e.matchType,
                source: e.source,
              }),
              e.id
            );
          }
          const toCreate: Prisma.AdKeywordCreateManyInput[] = [];
          const toUpdate: Array<{ id: string; data: Prisma.AdKeywordUncheckedUpdateInput }> = [];
          for (const row of merged) {
            const data: Prisma.AdKeywordUncheckedUpdateInput = {
              adAccountId: row.adAccountId,
              campaignId: row.campaignId,
              amazonCampaignId: row.amazonCampaignId,
              adGroupId: row.adGroupId,
              externalId: row.externalId,
              keywordText: row.keywordText,
              matchType: row.matchType ?? '', // matchType 为非空列，null 兜底空串
              state: row.state,
              bid: row.bid,
              familyL1: row.familyL1,
              duplicateOf: row.duplicateOf,
              action: row.action,
              actionBid: row.actionBid,
              actionReason: row.actionReason,
              rawRowIndex: row.rawRowIndex,
              source: row.source,
              acos: row.acos,
              orders: row.orders,
              spend: row.spend,
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              reportId: row.reportId,
              recommendationId: rec.id,
            };
            const existingId = existingByKey.get(mergeKeyOf(row));
            if (existingId) {
              toUpdate.push({ id: existingId, data });
            } else {
              toCreate.push({ ...data, isSelected: false } as Prisma.AdKeywordCreateManyInput);
            }
          }
          if (toCreate.length > 0) await tx.adKeyword.createMany({ data: toCreate });
          for (const u of toUpdate) {
            await tx.adKeyword.update({ where: { id: u.id }, data: u.data });
          }
        });
      } catch (txError) {
        // 事务失败：引擎已成功但落库失败 → 报告置 ANALYZE_FAILED（§11.2，可重试无残留）
        await prisma.adReport.update({
          where: { id: report.id },
          data: {
            analyzeStatus: 'ANALYZE_FAILED',
            analyzeError: {
              exitCode: null,
              stderr: `事务落库失败: ${txError instanceof Error ? txError.message.slice(0, 2000) : String(txError)}`,
              attempts: 1,
              durationMs: Date.now() - startedAt,
            } as Prisma.InputJsonValue,
          },
        });
        console.error('分析结果落库失败:', txError);
        return errorResponse('分析结果保存失败', 'INTERNAL_ERROR', 500);
      }

      // 11. 状态 ANALYZED（事务后独立更新，§11.2）
      await prisma.adReport.update({
        where: { id: report.id },
        data: { analyzeStatus: 'ANALYZED', analyzedAt: new Date() },
      });

      // 12. 审计（参数/degraded/pairing/耗时）
      await writeAdsAuditLog({
        action: 'ANALYZE',
        entityType: 'AdReport',
        entityId: report.id,
        userId: session.id,
        details: {
          ok: true,
          recommendationId,
          opts,
          degraded,
          pairing,
          attempts: 1,
          durationMs: Date.now() - startedAt,
          keywordRows: mergedRowsCount(rows),
        },
        request,
      });

      // 13. 200 响应（§17-7：recommendationId, degraded, pairing）
      return successResponse(
        { recommendationId, degraded, pairing },
        degraded ? '分析完成（降级模式：缺少投放报告）' : '分析完成'
      );
    } catch (error) {
      console.error('触发分析失败:', error);
      return errorResponse('触发分析失败', 'INTERNAL_ERROR', 500);
    }
  }
);

/** 审计辅助：决策行来源分布 */
function mergedRowsCount(rows: DecisionRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.source] = (counts[r.source] ?? 0) + 1;
  return counts;
}
