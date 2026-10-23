'use client';

/**
 * 补货建议
 *  GET  /api/v1/replenishment/suggestions?overseasWarehouseId=&status=&page=
 *  POST /api/v1/replenishment/generate
 *  POST /api/v1/replenishment/suggestions/[id]/convert | /dismiss
 *
 * 口径（与后端 lib/replenishment.ts 一致）：净可用 = 在库 + 在途 − 预留；
 * 建议量 = ceil(再订货点 + 日均 × 补货周期 − 净可用)，参数在生成时快照，事后不重算。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PackageSearch, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OverseasWarehouse } from '@/components/overseas/types';
import SuggestionTable from '@/components/replenishment/suggestion-table';
import GenerateDialog, { type GenerateTotals } from '@/components/replenishment/generate-dialog';
import ConvertDialog from '@/components/replenishment/convert-dialog';
import DismissDialog from '@/components/replenishment/dismiss-dialog';
import {
  STATUS_LABEL,
  fmtInt,
  type ReplenishmentSuggestion,
  type SuggestionCounts,
  type SuggestionStatus,
} from '@/components/replenishment/types';

type TabKey = 'ALL' | SuggestionStatus;

const PAGE_SIZE = 50;

interface Option {
  id: string;
  name: string;
  code?: string;
}

export default function ReplenishmentPage() {
  const { toasts, removeToast, toast } = useToast();

  const [warehouses, setWarehouses] = useState<OverseasWarehouse[]>([]);
  const [warehouseCode, setWarehouseCode] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ReplenishmentSuggestion[]>([]);
  const [counts, setCounts] = useState<SuggestionCounts>({
    PENDING: 0,
    APPROVED: 0,
    CONVERTED: 0,
    DISMISSED: 0,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pendingQty, setPendingQty] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [entered, setEntered] = useState(false);

  // 生成
  const [generateOpen, setGenerateOpen] = useState(false);

  // 转单 / 忽略
  const [convertTarget, setConvertTarget] = useState<{
    suggestion: ReplenishmentSuggestion;
    target: 'PURCHASE_ORDER' | 'STOCK_TRANSFER';
  } | null>(null);
  const [dismissTarget, setDismissTarget] = useState<ReplenishmentSuggestion | null>(null);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [domesticWarehouses, setDomesticWarehouses] = useState<Option[]>([]);
  const [domesticLoading, setDomesticLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(timer);
  }, []);

  const showError = useCallback((message: string) => toast.error(message), [toast]);
  const showSuccess = useCallback((message: string) => toast.success(message), [toast]);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/overseas/warehouses?limit=100&page=1');
      const data = await res.json();
      if (data.success) {
        const list = (data.data.items || []) as OverseasWarehouse[];
        setWarehouses(list);
        setWarehouseCode(prev => prev || list[0]?.code || '');
      }
    } catch (e) {
      console.error('获取海外仓列表失败:', e);
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        includeZero: 'true',
      });
      if (warehouseCode) params.set('overseasWarehouseId', warehouseCode);
      if (activeTab !== 'ALL') params.set('status', activeTab);
      const res = await fetch(`/api/v1/replenishment/suggestions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items || []);
        setCounts(
          data.data.summary?.counts ?? { PENDING: 0, APPROVED: 0, CONVERTED: 0, DISMISSED: 0 },
        );
        setTotal(data.data.pagination?.total ?? 0);
        setTotalPages(data.data.pagination?.totalPages ?? 0);
        setPendingQty(data.data.summary?.suggestedQty?.PENDING ?? 0);
      } else {
        showError(data.error || data.message || '获取补货建议失败');
      }
    } catch (e) {
      console.error('获取补货建议失败:', e);
      showError('获取补货建议失败');
    } finally {
      setLoading(false);
    }
  }, [warehouseCode, activeTab, page, showError]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // refreshKey 只作为「生成/转单后刷新」触发器，不参与请求参数
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [warehouseCode, activeTab]);

  const allCount = useMemo(
    () => counts.PENDING + counts.APPROVED + counts.CONVERTED + counts.DISMISSED,
    [counts],
  );

  const activeWarehouse = warehouses.find(w => w.code === warehouseCode);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const ensureSuppliers = useCallback(async () => {
    if (suppliers.length > 0 || suppliersLoading) return;
    setSuppliersLoading(true);
    try {
      const res = await fetch('/api/v1/suppliers?limit=200&page=1');
      const data = await res.json();
      if (data.success) {
        setSuppliers(
          (data.data.items || []).map((s: { id: string; companyName?: string; supplierNo?: string }) => ({
            id: s.id,
            name: s.companyName || s.supplierNo || s.id,
          })),
        );
      }
    } catch (e) {
      console.error('加载供应商失败:', e);
    } finally {
      setSuppliersLoading(false);
    }
  }, [suppliers.length, suppliersLoading]);

  const ensureDomesticWarehouses = useCallback(async () => {
    if (domesticWarehouses.length > 0 || domesticLoading) return;
    setDomesticLoading(true);
    try {
      const res = await fetch('/api/v1/warehouses?limit=100&page=1');
      const data = await res.json();
      if (data.success) {
        setDomesticWarehouses(
          (data.data.items || []).map((w: { id: string; name: string; code?: string }) => ({
            id: w.id,
            name: w.name,
            code: w.code,
          })),
        );
      }
    } catch (e) {
      console.error('加载国内仓库失败:', e);
    } finally {
      setDomesticLoading(false);
    }
  }, [domesticWarehouses.length, domesticLoading]);

  const handleGenerateDone = (totals: GenerateTotals) => {
    toast.success(
      `生成完成：新增 ${totals.created} / 刷新 ${totals.refreshed} / 清除 ${totals.cleared}（共 ${totals.rows} 行参与计算）`,
    );
    refresh();
  };

  const handleConvert = (suggestion: ReplenishmentSuggestion, target: 'PURCHASE_ORDER' | 'STOCK_TRANSFER') => {
    setConvertTarget({ suggestion, target });
    if (target === 'PURCHASE_ORDER') ensureSuppliers();
    else ensureDomesticWarehouses();
  };

  const tabItems: { key: TabKey; label: string; count: number }[] = [
    { key: 'PENDING', label: STATUS_LABEL.PENDING, count: counts.PENDING },
    { key: 'APPROVED', label: STATUS_LABEL.APPROVED, count: counts.APPROVED },
    { key: 'CONVERTED', label: STATUS_LABEL.CONVERTED, count: counts.CONVERTED },
    { key: 'DISMISSED', label: STATUS_LABEL.DISMISSED, count: counts.DISMISSED },
    { key: 'ALL', label: '全部', count: allCount },
  ];

  return (
    <div
      className={cn(
        'container mx-auto py-6 px-4 transition-opacity duration-300',
        entered ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl">补货建议</CardTitle>
              <CardDescription className="mt-1">
                按平台销量与头程时效测算海外仓补货量，一键转采购单 / 调拨单草稿
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                刷新
              </Button>
              <Button
                onClick={() => setGenerateOpen(true)}
                disabled={!warehouseCode}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                生成建议
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选：右对齐 */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {activeWarehouse ? (
                <>
                  <span>目标仓</span>
                  <span className="font-medium text-foreground">{activeWarehouse.name}</span>
                </>
              ) : (
                <span>全部海外仓</span>
              )}
              <span className="ml-2">
                待处理建议量合计：{fmtInt(pendingQty)} 件
              </span>
            </div>
            <Select
              value={warehouseCode || undefined}
              onValueChange={v => {
                setWarehouseCode(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
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
          </div>

          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)}>
            <TabsList variant="line" className="mb-5 w-full justify-start gap-1 border-b">
              {tabItems.map(t => (
                <TabsTrigger key={t.key} value={t.key} className="flex-none px-4">
                  {t.label}
                  <Badge
                    variant={t.key === 'PENDING' && t.count > 0 ? 'default' : 'secondary'}
                    className="ml-1 text-[10px] px-1.5 py-0"
                  >
                    {t.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab}>
              {!loading && items.length === 0 ? (
                allCount === 0 ? (
                  <EmptyState
                    icon={<PackageSearch className="h-8 w-8 text-gray-400" />}
                    title="还没有补货建议"
                    description="点击右上角「生成建议」，系统按近 30 天平台订单估日均销量、结合头程时效与安全库存算出建议补货量"
                    action={
                      <Button onClick={() => setGenerateOpen(true)} disabled={!warehouseCode}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        生成建议
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<PackageSearch className="h-8 w-8 text-gray-400" />}
                    title={`没有「${STATUS_LABEL[activeTab as SuggestionStatus]}」状态的建议`}
                    description="切换其他状态标签页查看，或重新生成建议"
                  />
                )
              ) : (
                <>
                  <SuggestionTable
                    items={items}
                    loading={loading}
                    onConvert={handleConvert}
                    onDismiss={s => setDismissTarget(s)}
                  />
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <GenerateDialog
        open={generateOpen}
        onOpenChange={open => setGenerateOpen(open)}
        warehouseCode={warehouseCode}
        warehouseName={activeWarehouse?.name}
        onDone={totals => {
          handleGenerateDone(totals);
        }}
        onError={msg => {
          showError(msg);
        }}
      />

      <ConvertDialog
        open={!!convertTarget}
        onOpenChange={open => {
          if (!open) setConvertTarget(null);
        }}
        suggestion={convertTarget?.suggestion ?? null}
        target={convertTarget?.target ?? 'PURCHASE_ORDER'}
        suppliers={suppliers}
        suppliersLoading={suppliersLoading}
        warehouses={domesticWarehouses}
        warehousesLoading={domesticLoading}
        onSuccess={message => {
          showSuccess(message);
          refresh();
        }}
        onError={showError}
      />

      <DismissDialog
        open={!!dismissTarget}
        onOpenChange={open => {
          if (!open) setDismissTarget(null);
        }}
        suggestion={dismissTarget}
        onSuccess={message => {
          showSuccess(message);
          refresh();
        }}
        onError={showError}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
