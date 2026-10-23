'use client';

/**
 * 海外仓工作台
 * 标签页：仓库概况 | 库存台账 | 库存流水 | 平台对账（数量徽章）
 * 数据源：/api/v1/overseas/warehouses、/api/v1/overseas/inventory、/api/v1/overseas/inventory/movements
 *        /api/v1/overseas/reconcile
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import CreateWarehouseDialog from '@/components/overseas/create-warehouse-dialog';
import WarehouseOverview from '@/components/overseas/warehouse-overview';
import InventoryLedger from '@/components/overseas/inventory-ledger';
import MovementTable from '@/components/overseas/movement-table';
import ReconcilePanel from '@/components/overseas/reconcile-panel';
import type { OverseasWarehouse } from '@/components/overseas/types';

type TabKey = 'overview' | 'ledger' | 'movements' | 'reconcile';

export default function OverseasWarehousePage() {
  const { toasts, removeToast, toast } = useToast();
  const [warehouses, setWarehouses] = useState<OverseasWarehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [movementTotal, setMovementTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedCode, setSelectedCode] = useState('');
  const [reconcileSummary, setReconcileSummary] = useState({ total: 0, alertCount: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(timer);
  }, []);

  const showError = useCallback((message: string) => toast.error(message), [toast]);
  const showSuccess = useCallback((message: string) => toast.success(message), [toast]);

  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const res = await fetch('/api/v1/overseas/warehouses?limit=100&page=1');
      const data = await res.json();
      if (data.success) {
        const list = (data.data.items || []) as OverseasWarehouse[];
        setWarehouses(list);
        setSelectedCode(prev => prev || list[0]?.code || '');
      } else {
        toast.error(data.message || '获取海外仓列表失败');
      }
    } catch (e) {
      console.error('获取海外仓列表失败:', e);
      toast.error('获取海外仓列表失败');
    } finally {
      setWarehousesLoading(false);
    }
  }, [toast]);

  const fetchCounts = useCallback(async () => {
    try {
      const [ledgerRes, mvRes] = await Promise.all([
        fetch('/api/v1/overseas/inventory?limit=1&page=1'),
        fetch('/api/v1/overseas/inventory/movements?limit=1&page=1'),
      ]);
      const ledgerData = await ledgerRes.json();
      const mvData = await mvRes.json();
      if (ledgerData.success) setLedgerTotal(ledgerData.data.pagination?.total ?? 0);
      if (mvData.success) setMovementTotal(mvData.data.pagination?.total ?? 0);
    } catch (e) {
      console.error('获取海外仓统计失败:', e);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, dataVersion]);

  // 平台对账徽章：标签未展开时也给出行数（对账面板展开后会通过 onSummary 覆盖）
  useEffect(() => {
    if (!selectedCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/overseas/reconcile?warehouseId=${encodeURIComponent(selectedCode)}&platformCode=amazon`
        );
        const data = await res.json();
        if (!cancelled && data.success) {
          setReconcileSummary({
            total: data.data.summary?.total ?? 0,
            alertCount: data.data.summary?.alertCount ?? 0,
          });
        }
      } catch (e) {
        console.error('获取对账概览失败:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCode, dataVersion]);

  const refreshAll = useCallback(() => {
    fetchWarehouses();
    fetchCounts();
  }, [fetchWarehouses, fetchCounts]);

  // 台账/流水发生变更后：刷新统计徽章 + 仓库卡片数字（在库/可用来自 warehouses 接口）
  const handleDataChanged = useCallback(() => {
    setDataVersion(v => v + 1);
    fetchWarehouses();
  }, [fetchWarehouses]);

  const goTo = useCallback((tab: TabKey, code?: string) => {
    if (code) setSelectedCode(code);
    setActiveTab(tab);
  }, []);

  const tabCounts = useMemo(
    () => ({
      overview: warehouses.length,
      ledger: ledgerTotal,
      movements: movementTotal,
      reconcile: reconcileSummary.total,
    }),
    [warehouses.length, ledgerTotal, movementTotal, reconcileSummary.total]
  );

  // 稳定回调：ReconcilePanel 内部把它放进 fetch 依赖，不能每次渲染换新引用
  const handleReconcileSummary = useCallback(
    (summary: { total: number; alertCount: number }) => {
      setReconcileSummary(prev =>
        prev.total === summary.total && prev.alertCount === summary.alertCount ? prev : summary
      );
    },
    []
  );

  return (
    <div
      className={cn(
        'container mx-auto py-6 px-4 transition-opacity duration-300',
        entered ? 'opacity-100' : 'opacity-0'
      )}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl">海外仓</CardTitle>
              <CardDescription className="mt-1">
                海外仓台账、差异调整与国内 ↔ 海外调拨的统一入口
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refreshAll} disabled={warehousesLoading}>
                <RefreshCw className={cn('mr-2 h-4 w-4', warehousesLoading && 'animate-spin')} />
                刷新
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新建海外仓
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)}>
            <TabsList variant="line" className="mb-5 w-full justify-start gap-1 border-b">
              <TabsTrigger value="overview" className="flex-none px-4">
                仓库概况
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {tabCounts.overview}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="ledger" className="flex-none px-4">
                库存台账
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {tabCounts.ledger}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="movements" className="flex-none px-4">
                库存流水
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {tabCounts.movements}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reconcile" className="flex-none px-4">
                平台对账
                <Badge
                  className={cn(
                    'ml-1 text-[10px] px-1.5 py-0',
                    reconcileSummary.alertCount > 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                      : ''
                  )}
                  variant={reconcileSummary.alertCount > 0 ? 'default' : 'secondary'}
                >
                  {tabCounts.reconcile}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <WarehouseOverview
                warehouses={warehouses}
                loading={warehousesLoading}
                onViewLedger={code => goTo('ledger', code)}
                onViewMovements={code => goTo('movements', code)}
                onCreate={() => setCreateOpen(true)}
              />
            </TabsContent>

            <TabsContent value="ledger">
              <InventoryLedger
                warehouses={warehouses}
                warehouseCode={selectedCode}
                onWarehouseChange={setSelectedCode}
                onDataChanged={handleDataChanged}
                onSuccess={showSuccess}
                onError={showError}
              />
            </TabsContent>

            <TabsContent value="movements">
              <MovementTable
                warehouses={warehouses}
                warehouseCode={selectedCode}
                onWarehouseChange={setSelectedCode}
                onError={showError}
              />
            </TabsContent>

            <TabsContent value="reconcile">
              <ReconcilePanel
                warehouses={warehouses}
                warehouseCode={selectedCode}
                onWarehouseChange={setSelectedCode}
                onDataChanged={handleDataChanged}
                onSuccess={showSuccess}
                onError={showError}
                onSummary={handleReconcileSummary}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateWarehouseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={created => {
          setSelectedCode(created.code);
          refreshAll();
        }}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
