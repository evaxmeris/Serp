'use client';

/**
 * 上传 + 分析驱动卡（REQ-ADS-001/002）
 *
 * 职责：双报告选择（FileUpload 受控）、账户选择、日期窗口、batchId 生成与
 *       沿用（架构 AD-9）、上传提交（useUploadReports）、一致性警告（E4
 *       前置可见）、开始分析（useAnalyzeReport，含 E2 重试）。
 *
 * 契约：POST /reports/upload 返回 { uploadBatchId, reports[], consistencyCheck? }；
 *       POST /reports/:id/analyze 返回 { recommendationId, degraded, pairing }。
 * 交互：上传与分析分两步按钮（REQ-001 解析落库 → REQ-002 引擎跑批）。
 */

import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useAdsAccounts, useAnalyzeReport, useUploadReports, type AdsApiError } from '@/hooks/use-ads';
import type { AdUploadResponse } from '@/types/ads';
import { FileUpload } from './FileUpload';
import { NONE_VALUE, useAdsPerms } from './shared';

export interface ReportUploadCardProps {
  /** 当前选中账户 id（页面受控；空串=未选，Select 以 NONE_VALUE 占位） */
  accountId: string;
  onAccountChange: (id: string) => void;
  /** 分析成功回调：页面据此落位 activeRecommendationId */
  onAnalyzed: (recommendationId: string) => void;
}

/** E2 引擎失败详情（卡内持久展示 + 重试） */
interface AnalyzeFailState {
  message: string;
  exitCode?: number | null;
  stderr?: string | null;
  attempts?: number | null;
  version?: string | null;
}

export function ReportUploadCard({ accountId, onAccountChange, onAnalyzed }: ReportUploadCardProps) {
  const { toast, toasts, removeToast } = useToast();
  const { canEdit } = useAdsPerms();

  // 双文件槽位（受控 File 对象）
  const [searchFile, setSearchFile] = useState<File | null>(null);
  const [targetingFile, setTargetingFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // batchId：组件挂载生成一次，分次提交（先搜索词后 Targeting）沿用同一批次号（AD-9）
  const [uploadBatchId] = useState<string>(() => crypto.randomUUID());
  const [lastUploadResult, setLastUploadResult] = useState<AdUploadResponse | null>(null);
  const [analyzeFail, setAnalyzeFail] = useState<AnalyzeFailState | null>(null);

  const accounts = useAdsAccounts({ active: true });
  const upload = useUploadReports();
  const analyze = useAnalyzeReport();

  const analyzing = analyze.isPending;

  /** 上传解析：分次提交沿用同一 batchId（后端据此配对） */
  async function handleUpload() {
    if (!searchFile && !targetingFile) return toast.warning('请至少选择一份报告');
    if (!accountId) return toast.warning('请选择广告账户');
    if (!startDate || !endDate) return toast.warning('请填写报告日期范围');
    if (endDate < startDate) return toast.error('结束日期不能早于开始日期');

    const fd = new FormData();
    fd.append('accountId', accountId);
    fd.append('startDate', startDate);
    fd.append('endDate', endDate);
    fd.append('uploadBatchId', uploadBatchId);
    if (searchFile) fd.append('searchFile', searchFile);
    if (targetingFile) fd.append('targetingFile', targetingFile);

    try {
      const res = await upload.mutateAsync(fd);
      setLastUploadResult(res);
      const rows = res.reports.reduce((n, r) => n + (r.rowCount ?? 0), 0);
      toast.success(`上传解析成功，共 ${rows} 行`);
    } catch (e) {
      // E1 PARSE_FAILED / E9 FILE_TOO_LARGE 等：错误明细由后端 errors 数组带回，卡内展示
      const err = e as AdsApiError;
      toast.error(err?.message || '上传失败');
      const details = err?.details;
      if (details && typeof details === 'object' && !Array.isArray(details)) {
        // 后端可能返回 { errors: [...] }，透传展示
        setAnalyzeFail({ message: err.message, stderr: JSON.stringify(details) });
      }
    }
  }

  /** 开始分析：目标报告 = 本批已上传的任意一份（后端按批配对找互补报告） */
  async function handleAnalyze() {
    const targetReportId = lastUploadResult?.reports[0]?.id;
    if (!targetReportId) return toast.warning('请先上传报告');

    setAnalyzeFail(null);
    try {
      const res = await analyze.mutateAsync(targetReportId);
      onAnalyzed(res.recommendationId);
      // degraded 非错误态：提示受限模式；跨批回退提示确认日期窗口（R17 缓解）
      if (res.degraded) toast.info('未上传 Targeting 报告，已进入受限分析模式');
      if (res.pairing?.mode === 'fallback') {
        toast.warning(
          `本次分析与 ${res.pairing.reportId ?? '历史报告'} 配对（跨批次回退），请确认日期窗口一致`
        );
      }
    } catch (e) {
      const err = e as AdsApiError;
      toast.error(err?.message || '分析失败');
      // E2/E7：提取 engine 失败详情（attempts/stderr/exitCode/version）
      const d = (err?.details ?? {}) as Record<string, unknown>;
      setAnalyzeFail({
        message: err?.message || '分析失败',
        exitCode: typeof d.exitCode === 'number' ? d.exitCode : null,
        stderr: typeof d.stderr === 'string' ? d.stderr : null,
        attempts: typeof d.attempts === 'number' ? d.attempts : null,
        version: typeof d.version === 'string' ? d.version : null,
      });
    }
  }

  const consistency = lastUploadResult?.consistencyCheck;
  const showConsistency =
    !!consistency && (consistency.warning === true || consistency.dateMismatch === true);
  const uploaded = lastUploadResult?.reports ?? [];

  return (
    <Card className="animate-in fade-in-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">上传报告并开始分析</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 账户 + 日期 */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>广告账户</Label>
            <Select
              value={accountId || NONE_VALUE}
              onValueChange={(v) => onAccountChange(v === NONE_VALUE ? '' : v)}
              disabled={analyzing}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择广告账户" />
              </SelectTrigger>
              <SelectContent>
                {accounts.data?.items?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.marketplace ? `（${a.marketplace.name}）` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!accounts.isLoading && (accounts.data?.items?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">
                尚未绑定启用中的广告账户，请先到「站点管理」绑定后刷新。
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>开始日期</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={analyzing}
            />
          </div>
          <div className="space-y-1.5">
            <Label>结束日期</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={analyzing}
            />
          </div>
        </div>

        {/* 双文件槽位 */}
        <div className="grid gap-3 md:grid-cols-2">
          <FileUpload
            label="搜索词报告"
            file={searchFile}
            onChange={setSearchFile}
            hint="xlsx/csv，≤50MB（用于否定清单 / 拓词提炼）"
          />
          <FileUpload
            label="Targeting 报告"
            file={targetingFile}
            onChange={setTargetingFile}
            hint="xlsx/csv，≤50MB（用于关闭矩阵 / bid 层级核对）"
          />
        </div>

        {/* 操作按钮：上传与分步独立（REQ-001/002） */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleUpload} disabled={!canEdit || analyzing || upload.isPending}>
            {upload.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <UploadCloud className="mr-1 size-4" />}
            上传报告
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyze}
            disabled={!canEdit || analyzing || !lastUploadResult}
            title={lastUploadResult ? undefined : '请先上传报告'}
          >
            {analyzing && <Loader2 className="mr-1 size-4 animate-spin" />}
            {analyzing ? '引擎分析中（约 30s）…' : '开始分析'}
          </Button>
          {!canEdit && (
            <span className="text-xs text-muted-foreground" title="无操作权限">
              无操作权限（需 ads:edit）
            </span>
          )}
        </div>

        {/* 一致性警告（E4 前置可见） */}
        {showConsistency && (
          <Alert variant="destructive" className="border-yellow-400/60 text-yellow-800 [&>svg]:text-yellow-600">
            <AlertTriangle className="size-4" />
            <AlertTitle>两报告口径不一致，请核对</AlertTitle>
            <AlertDescription>
              {consistency?.dateMismatch && <p>上传日期与报告内数据窗口不一致（不阻断）。</p>}
              {typeof consistency?.spendDiffPct === 'number' && (
                <p>
                  搜索词与 Targeting 报告口径偏差 {consistency.spendDiffPct.toFixed(1)}%
                  （正常 5-15%）；偏差 &gt;15% 时分析将被阻断，请确认两报告同账户同窗口。
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 已上传批次信息（AD-9：明确配对状态） */}
        {uploaded.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">本批次号：</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{uploadBatchId}</code>
              <span className="text-xs text-muted-foreground">（分次上传请保持此批次号）</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {uploaded.map((r) => (
                <Badge key={r.id} variant="outline">
                  {String(r.reportType)}：{r.rowCount ?? 0} 行
                </Badge>
              ))}
              {uploaded.length === 1 && (
                <span className="text-xs text-muted-foreground">
                  已上传一份，可继续上传另一份报告（同一批次）完成配对。
                </span>
              )}
            </div>
          </div>
        )}

        {/* E2 引擎失败卡（含重试，复用 analyze mutation） */}
        {analyzeFail && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              分析失败{analyzeFail.attempts != null ? `（尝试 ${analyzeFail.attempts} 次）` : ''}
            </AlertTitle>
            <AlertDescription>
              <p>{analyzeFail.message}</p>
              {analyzeFail.version && <p>引擎版本 {analyzeFail.version} 与系统契约不符，请联系管理员（E7）。</p>}
              {analyzeFail.stderr && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs">引擎错误输出（stderr）</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                    {analyzeFail.stderr}
                  </pre>
                </details>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                <RefreshCw className="mr-1 size-3.5" />
                重试分析
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Separator />
        <p className="text-xs text-muted-foreground">
          上传解析落库与引擎分析为两步操作；分析约需 30 秒，期间请勿切换账户。
        </p>
      </CardContent>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </Card>
  );
}
