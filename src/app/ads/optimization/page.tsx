'use client';

/**
 * 投流优化中心（M1 主页面）— FE 设计 §1/§2 布局
 * 上传卡 → 账户总览 → 族级 Tabs → 四区 Tabs → 执行摘要 + 批量表按钮
 * 组件内部自取数据（useAdsReportResult/useAdsKeywords），页面只编排 + 传 recommendationId
 */
import { useState } from 'react';
import { useAdsAccounts, useAdsApiStatus } from '@/hooks/use-ads';
import { ReportUploadCard } from '@/components/ads/ReportUploadCard';
import { AccountSummaryCards } from '@/components/ads/AccountSummaryCards';
import { FamilyOverviewTable } from '@/components/ads/FamilyOverviewTable';
import { CloseMatrixTable } from '@/components/ads/CloseMatrixTable';
import { NegateListTable } from '@/components/ads/NegateListTable';
import { ExpandTable } from '@/components/ads/ExpandTable';
import { ExpandKeywordsTable } from '@/components/ads/ExpandKeywordsTable';
import { LayerCheckPanel } from '@/components/ads/LayerCheckPanel';
import { ExecutionSummaryBar } from '@/components/ads/ExecutionSummaryBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

export default function AdsOptimizationPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  const { data: accounts } = useAdsAccounts({});
  const { data: apiStatus } = useAdsApiStatus(selectedAccountId || null);

  const handleAnalyzed = (recId: string, isDegraded?: boolean) => {
    setActiveRecommendationId(recId);
    setDegraded(!!isDegraded);
  };

  const handleAccountChange = (id: string) => {
    setSelectedAccountId(id);
    setActiveRecommendationId(null); // 切换账户 → 清空当前决策（FE 设计 §2 切换行为）
    setDegraded(false);
  };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-semibold">投流优化中心</h1>
        <p className="text-sm text-muted-foreground">
          上传搜索词 + Targeting 双报告，v20 决策引擎分析 → 勾选执行清单 → 下载批量操作表
        </p>
      </div>

      {/* M2 API 接入状态提示条 */}
      {apiStatus && (
        <div className={`rounded-md border px-3 py-2 text-sm ${apiStatus.configured ? 'border-green-300 bg-green-50 text-green-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
          {apiStatus.configured
            ? `✅ Ads API 已配置（${apiStatus.marketplace} / ${apiStatus.profileId}）：可自动拉取报告与执行（dry-run 默认）`
            : `ℹ️ ${apiStatus.message}`}
        </div>
      )}

      {/* 1. 上传/分析驱动区 */}
      <ReportUploadCard
        accountId={selectedAccountId}
        onAccountChange={handleAccountChange}
        onAnalyzed={handleAnalyzed}
      />

      {activeRecommendationId == null ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            上传报告并点击「开始分析」后展示决策结果
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2. 账户总览 */}
          <AccountSummaryCards recommendationId={activeRecommendationId} accountId={selectedAccountId} />

          {/* 3. 族级总览 */}
          <FamilyOverviewTable recommendationId={activeRecommendationId} />

          {/* 4. 四区 Tabs */}
          <Tabs defaultValue="closeMatrix">
            <TabsList>
              <TabsTrigger value="closeMatrix">关闭矩阵</TabsTrigger>
              <TabsTrigger value="negate">否定清单</TabsTrigger>
              <TabsTrigger value="expand">拓词</TabsTrigger>
              <TabsTrigger value="layer">层级核对</TabsTrigger>
            </TabsList>
            <TabsContent value="closeMatrix">
              <CloseMatrixTable recommendationId={activeRecommendationId} degraded={degraded} />
            </TabsContent>
            <TabsContent value="negate">
              <NegateListTable recommendationId={activeRecommendationId} />
            </TabsContent>
            <TabsContent value="expand">
              <ExpandTable recommendationId={activeRecommendationId} />
              <ExpandKeywordsTable recommendationId={activeRecommendationId} />
            </TabsContent>
            <TabsContent value="layer">
              <LayerCheckPanel recommendationId={activeRecommendationId} degraded={degraded} />
            </TabsContent>
          </Tabs>

          {/* 5. 执行摘要 + 批量表 */}
          <ExecutionSummaryBar recommendationId={activeRecommendationId} degraded={degraded} />
        </>
      )}
    </div>
  );
}
