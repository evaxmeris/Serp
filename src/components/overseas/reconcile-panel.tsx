'use client';

/**
 * 海外仓 - 平台对账（台账可用量 ↔ 平台镜像快照可售量）
 * GET  /api/v1/overseas/reconcile?warehouseId=&platformCode=&marketplaceId=&status=&threshold=
 * POST /api/v1/overseas/reconcile/resolve  拉平（差异调整流水 PLATFORM_DIFF）
 *
 * 口径：本地台账是过程权威，平台可售仅做参考；差异只能通过差异调整单拉平，禁止静默改数。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CloudOff, RefreshCw, Scale } from 'lucide-react';
import { formatDateTime, type OverseasWarehouse } from './types';
import ResolveDiffDialog from './resolve-diff-dialog';
import {
  ALL_VALUE,
  MARKETPLACE_OPTIONS,
  PLATFORM_OPTIONS,
  RECONCILE_STATUS_COLOR,
  RECONCILE_STATUS_LABEL,
  formatSigned,
  marketplaceLabel,
  type ReconcileResponse,
  type ReconcileRow,
  type ReconcileStatus,
} from './reconcile-types';

interface Props {
  warehouses: OverseasWarehouse[];
  warehouseCode: string;
  onWarehouseChange: (code: string) => void;
  onDataChanged: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  /** 把行数/告警数回传给外层标签徽章 */
  onSummary?: (summary: { total: number; alertCount: number }) => void;
}

const PAGE_SIZE = 50;

const STATUS_FILTERS: { value: ReconcileStatus | typeof ALL_VALUE; label: string }[] = [
  { value: ALL_VALUE, label: '全部状态' },
  { value: 'DIFF', label: '差异（DIFF）' },
  { value: 'PLATFORM_ONLY', label: '仅平台（PLATFORM_ONLY）' },
  { value: 'LOCAL_ONLY', label: '仅本地（LOCAL_ONLY）' },
  { value: 'MATCH', label: '一致（MATCH）' },
];

export default function ReconcilePanel({
  warehouses,
  warehouseCode,
  onWarehouseChange,
  onDataChanged,
  onSuccess,
  onError,
  onSummary,
}: Props) {
  const [platformCode, setPlatformCode] = useState('amazon');
  const [marketplaceId, setMarketplaceId] = useState(ALL_VALUE);
  const [status, setStatus] = useState<ReconcileStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ReconcileRow[]>([]);
  const [summary, setSummary] = useState<ReconcileResponse['summary'] | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resolveRow, setResolveRow] = useState<ReconcileRow | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!warehouseCode) {
      setRows([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        warehouseId: warehouseCode,
        platformCode,
      });
      if (marketplaceId !== ALL_VALUE) params.set('marketplaceId', marketplaceId);
      const res = await fetch(`/api/v1/overseas/reconcile?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const payload = data.data as ReconcileResponse;
        setRows(payload.rows || []);
        setSummary(payload.summary || null);
        setThreshold(payload.threshold ?? 5);
        setLastSnapshotAt(payload.summary?.lastSnapshotAt ?? null);
        // 一条快照都没有 → 空态引导（去数据同步触发 FBA 库存同步）
        setHasSnapshot((payload.rows || []).some(r => (r.marketplaces?.length ?? 0) > 0));
        onSummary?.({
          total: payload.summary?.total ?? 0,
          alertCount: payload.summary?.alertCount ?? 0,
        });
      } else {
        onError(data.error || data.message || '获取对账报表失败');
        setRows([]);
        setSummary(null);
      }
    } catch (e) {
      console.error('获取对账报表失败:', e);
      onError('获取对账报表失败');
    } finally {
      setLoading(false);
    }
  }, [warehouseCode, platformCode, marketplaceId, onError, onSummary]);

  // refreshKey 只作为「手动刷新」触发器，不参与请求参数
  useEffect(() => {
    fetchReport();
  }, [fetchReport, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [warehouseCode, platformCode, marketplaceId, status, onlyDiff]);

  // 状态过滤 + 只看差异（客户端过滤，接口已按差异优先排序）
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (onlyDiff && r.status === 'MATCH') return false;
      if (status !== ALL_VALUE && r.status !== status) return false;
      return true;
    });
  }, [rows, status, onlyDiff]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 0;
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const alertCount = summary?.alertCount ?? 0;

  const openResolve = (row: ReconcileRow) => {
    setResolveRow(row);
    setResolveOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* 筛选条：右对齐 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Select value={warehouseCode || undefined} onValueChange={onWarehouseChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="选择海外仓" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map(w => (
              <SelectItem key={w.id} value={w.code}>
                {w.name}（{w.code}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platformCode} onValueChange={setPlatformCode}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="平台" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={marketplaceId} onValueChange={setMarketplaceId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="站点" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>全部站点（汇总）</SelectItem>
            {MARKETPLACE_OPTIONS.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={v => setStatus(v as ReconcileStatus | typeof ALL_VALUE)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Switch id="only-diff" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
          <Label htmlFor="only-diff" className="cursor-pointer whitespace-nowrap text-sm">
            只看差异
          </Label>
        </div>

        <Button
          variant="outline"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading || !warehouseCode}
        >
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          刷新
        </Button>
      </div>

      {/* 告警条 */}
      {!loading && hasSnapshot && alertCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            有 <span className="font-semibold tabular-nums">{alertCount}</span> 行差异超过阈值
            （|差异| &gt; {threshold} 件），建议优先拉平或核对实物。
          </span>
        </div>
      )}

      {/* 汇总 */}
      {!loading && hasSnapshot && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['MATCH', 'DIFF', 'LOCAL_ONLY', 'PLATFORM_ONLY'] as ReconcileStatus[]).map(s => (
            <Card key={s}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {RECONCILE_STATUS_LABEL[s]}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s}</span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{summary[s]}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="ml-auto h-5 w-16" />
              <Skeleton className="ml-auto h-5 w-16" />
              <Skeleton className="ml-auto h-5 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      ) : !warehouseCode ? (
        <EmptyState
          icon={<Scale className="h-8 w-8 text-gray-400" />}
          title="请选择海外仓"
          description="选择仓库后对比本地台账可用量与平台可售量"
        />
      ) : !hasSnapshot ? (
        <EmptyState
          icon={<CloudOff className="h-8 w-8 text-gray-400" />}
          title="尚无平台快照"
          description="请先在数据同步触发 FBA 库存同步，同步完成后再回到本页对账"
          action={
            <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重新检查
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={onlyDiff || status !== ALL_VALUE ? '当前筛选下没有行' : '没有需要对账的 SKU'}
          description={
            onlyDiff || status !== ALL_VALUE
              ? '试试把「只看差异」关掉，或切换状态筛选'
              : '本地台账与平台快照都为空'
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {warehouseCode} · {platformCode} · {marketplaceLabel(marketplaceId === ALL_VALUE ? null : marketplaceId)}
              {lastSnapshotAt ? ` · 最近快照 ${formatDateTime(lastSnapshotAt)}` : ''}
            </span>
            <span>
              共 {filtered.length} 行（阈值 {threshold} 件）
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">SKU</TableHead>
                <TableHead>产品名称</TableHead>
                <TableHead className="w-24 text-right">本地台账</TableHead>
                <TableHead className="w-24 text-right">平台可售</TableHead>
                <TableHead className="w-24 text-right">差异</TableHead>
                <TableHead className="w-28">状态</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(row => (
                <TableRow key={row.sku} className={row.alert ? 'bg-red-50/50 dark:bg-red-500/5' : undefined}>
                  <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                  <TableCell className="text-sm">
                    {row.productName || <span className="text-muted-foreground">未知产品</span>}
                    {row.asin && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                        {row.asin}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.localQty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.platformQty === null ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      row.platformQty
                    )}
                  </TableCell>
                  <TableCell
                    className={
                      row.diff === 0
                        ? 'text-right tabular-nums text-muted-foreground'
                        : row.diff > 0
                          ? 'text-right font-medium tabular-nums text-amber-600'
                          : 'text-right font-medium tabular-nums text-red-600'
                    }
                  >
                    {row.diff === 0 ? '0' : formatSigned(row.diff)}
                    {row.alert && (
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={RECONCILE_STATUS_COLOR[row.status]}>
                      {RECONCILE_STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === 'LOCAL_ONLY' ? (
                      <span className="text-xs text-muted-foreground" title="没有平台快照，无法拉平">
                        无快照
                      </span>
                    ) : row.status === 'MATCH' ? (
                      <span className="text-xs text-muted-foreground">无需处理</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => openResolve(row)}>
                        拉平
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <ResolveDiffDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        row={resolveRow}
        warehouseCode={warehouseCode}
        platformCode={platformCode}
        marketplaceId={marketplaceId === ALL_VALUE ? null : marketplaceId}
        onSuccess={message => {
          onSuccess(message);
          setRefreshKey(k => k + 1);
          onDataChanged();
        }}
        onError={onError}
      />
    </div>
  );
}
