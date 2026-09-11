'use client';

/**
 * 生成批量表按钮（REQ-005）
 *
 * 流程：POST /bulk-table { recommendationId, confirmEmpty } → 返回 { xlsxUrl,
 *       readmeUrl, stats } → 触发 xlsx 下载。
 * 分支：
 *  - E6 NO_ACTIONS（422）：ConfirmationDialog「执行清单为空，确认生成空表？」
 *    → 确认后重发 confirmEmpty:true；
 *  - E5 BULK_SELF_CHECK_FAILED（422）：Dialog 列出缺 ID 行明细（≤20 行）；
 *  - 成功：toast 展示分类统计（关闭/改价/否定/新建）。
 * R3 使用说明：按钮下方常驻提示 + 「下载使用说明.txt」次按钮（readmeUrl）。
 * 权限：无 ads:edit → 按钮隐藏（viewer 兜底）。
 */

import { useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useGenerateBulkTable, type AdsApiError } from '@/hooks/use-ads';
import type { AdBulkTableResponse } from '@/types/ads';
import { useAdsPerms } from './shared';

export interface BulkTableButtonProps {
  recommendationId: string;
}

/** 触发浏览器下载（xlsx / 说明 txt） */
function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function BulkTableButton({ recommendationId }: BulkTableButtonProps) {
  const { toast, toasts, removeToast } = useToast();
  const { canEdit } = useAdsPerms();
  const generate = useGenerateBulkTable();

  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [selfCheckDetails, setSelfCheckDetails] = useState<unknown>(null);
  const [lastResult, setLastResult] = useState<AdBulkTableResponse | null>(null);

  /** 首次请求不传 confirmEmpty；E6 → 确认弹窗 → 重发 confirmEmpty:true */
  async function handleGenerate(confirmEmpty = false) {
    try {
      const res = await generate.mutateAsync({ recommendationId, confirmEmpty });
      setLastResult(res);
      triggerDownload(res.xlsxUrl);
      toast.success(
        `批量表已生成：关闭 ${res.stats.close} / 改价 ${res.stats.bidChange} / 否定 ${res.stats.negate} / 新建 ${res.stats.create}`
      );
    } catch (e) {
      const err = e as AdsApiError;
      // E6：无勾选动作 → 确认弹窗
      if (err?.code === 'NO_ACTIONS') {
        setConfirmEmptyOpen(true);
        return;
      }
      // E5：批量表自检失败 → 缺 ID 行明细 Dialog
      if (err?.code === 'BULK_SELF_CHECK_FAILED') {
        setSelfCheckDetails(err?.details ?? err?.message);
        toast.error(err?.message || '批量表自检失败');
        return;
      }
      toast.error(err?.message || '生成批量表失败');
    }
  }

  if (!canEdit) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => handleGenerate(false)} disabled={generate.isPending} size="sm">
          {generate.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-1 size-4" />
          )}
          {generate.isPending ? '正在生成批量表…' : '生成并下载批量表(xlsx)'}
        </Button>
        {lastResult?.readmeUrl && (
          <Button variant="outline" size="sm" onClick={() => triggerDownload(lastResult.readmeUrl!)}>
            <Download className="mr-1 size-4" />
            下载使用说明.txt
          </Button>
        )}
      </div>

      {/* R3 使用说明常驻提示 */}
      <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
        ⚠ 执行前请先到亚马逊后台「批量操作」下载现有表格：(1) 作回滚备份 (2)
        核对列名（中文列名/列序不同则按你的模板重排）——详见随表下载的《批量表使用说明.txt》。
      </p>

      {/* E6：空清单确认弹窗 */}
      <ConfirmationDialog
        open={confirmEmptyOpen}
        onOpenChange={setConfirmEmptyOpen}
        title="执行清单为空"
        description="当前没有已勾选的执行动作，确认生成空表？"
        confirmText="确认生成空表"
        cancelText="取消"
        loading={generate.isPending}
        onConfirm={() => {
          setConfirmEmptyOpen(false);
          handleGenerate(true);
        }}
      />

      {/* E5：批量表自检失败明细（缺 ID 行，≤20 行；Dialog 必带 key prop） */}
      {selfCheckDetails !== null && (
        <Dialog key="bulk-self-check" open onOpenChange={(open) => !open && setSelfCheckDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                批量表自检失败
              </DialogTitle>
              <DialogDescription>
                以下行缺少必填 ID（campaignId / adGroupId / externalId），无法生成批量表。请重新勾选或联系管理员。
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border text-sm">
              {Array.isArray(selfCheckDetails) ? (
                <ul className="divide-y divide-border">
                  {selfCheckDetails.slice(0, 20).map((d, i) => (
                    <li key={i} className="px-3 py-1.5 break-all">
                      {typeof d === 'string' ? d : JSON.stringify(d)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-muted-foreground">
                  {typeof selfCheckDetails === 'string' ? selfCheckDetails : JSON.stringify(selfCheckDetails)}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelfCheckDetails(null)}>知道了</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
