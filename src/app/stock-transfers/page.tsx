'use client';

/**
 * 调拨单（国内仓 ↔ 海外仓）
 * 列表 + 状态过滤 + 行内操作（发货 / 收货 / 取消）+ 明细展开
 * 数据源：/api/v1/stock-transfers、/api/v1/stock-transfers/:id/{ship,receive,cancel}
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import {
  ChevronDown,
  ChevronRight,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CreateTransferDialog from '@/components/stock-transfers/create-transfer-dialog';
import {
  ReceiveDialog,
  ShipDialog,
} from '@/components/stock-transfers/transfer-action-dialogs';
import {
  DIRECTION_LABEL,
  TRANSFER_STATUS_COLOR,
  TRANSFER_STATUS_LABEL,
  formatDateTime,
  sumQuantity,
  sumReceived,
  transferFrom,
  transferTo,
  type StockTransfer,
} from '@/components/stock-transfers/types';

const PAGE_SIZE = 20;

export default function StockTransfersPage() {
  const { toasts, removeToast, toast } = useToast();
  const { confirm, ConfirmDialog: ConfirmDlg } = useConfirm();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [direction, setDirection] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shipTarget, setShipTarget] = useState<StockTransfer | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<StockTransfer | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(timer);
  }, []);

  const showError = useCallback((message: string) => toast.error(message), [toast]);
  const showSuccess = useCallback((message: string) => toast.success(message), [toast]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status !== 'ALL') params.set('status', status);
      if (direction !== 'ALL') params.set('direction', direction);
      const res = await fetch(`/api/v1/stock-transfers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTransfers(data.data.items || []);
        setTotal(data.data.pagination?.total ?? 0);
        setTotalPages(data.data.pagination?.totalPages ?? 0);
      } else {
        toast.error(data.message || '获取调拨单失败');
      }
    } catch (e) {
      console.error('获取调拨单失败:', e);
      toast.error('获取调拨单失败');
    } finally {
      setLoading(false);
    }
  }, [page, status, direction, toast]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    setPage(1);
  }, [status, direction]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return transfers;
    return transfers.filter(
      t =>
        t.transferNo.toLowerCase().includes(kw) ||
        (transferFrom(t)?.name || '').toLowerCase().includes(kw) ||
        (transferTo(t)?.name || '').toLowerCase().includes(kw)
    );
  }, [transfers, keyword]);

  const handleCancel = async (transfer: StockTransfer) => {
    const ok = await confirm({
      title: '取消调拨单',
      description: `确定取消 ${transfer.transferNo} 吗？源仓库存会回补，取消后不可恢复。`,
      confirmText: '确认取消',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/stock-transfers/${transfer.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || '调拨单已取消');
        fetchTransfers();
      } else {
        toast.error(data.message || '取消失败');
      }
    } catch (e) {
      console.error('取消调拨单失败:', e);
      toast.error('取消失败');
    }
  };

  const statusTabs: Array<{ value: string; label: string }> = [
    { value: 'ALL', label: '全部状态' },
    { value: 'DRAFT', label: '待发货' },
    { value: 'IN_TRANSIT', label: '在途' },
    { value: 'RECEIVED', label: '已收货' },
    { value: 'CANCELLED', label: '已取消' },
  ];

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
              <CardTitle className="text-2xl">调拨单</CardTitle>
              <CardDescription className="mt-1">
                国内仓 ↔ 海外仓调拨：创建即扣源仓库存，发货后在途，对方仓收货入库
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={fetchTransfers} disabled={loading}>
                <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                刷新
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新建调拨单
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选：右对齐 */}
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索单号 / 仓库（当前页）"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="全部方向" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部方向</SelectItem>
                <SelectItem value="DOMESTIC_TO_OVERSEAS">国内 → 海外</SelectItem>
                <SelectItem value="OVERSEAS_TO_DOMESTIC">海外 → 国内</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                {statusTabs.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-40 shrink-0" />
                  <Skeleton className="h-5 w-24 shrink-0" />
                  <Skeleton className="h-5 w-1/4" />
                  <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
                  <Skeleton className="h-5 w-20 shrink-0 ml-auto" />
                  <Skeleton className="h-8 w-32 shrink-0 ml-auto" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              title={
                keyword || status !== 'ALL' || direction !== 'ALL'
                  ? '当前筛选下暂无调拨单'
                  : '暂无调拨单'
              }
              description={
                keyword || status !== 'ALL' || direction !== 'ALL'
                  ? '换个状态/方向或清空筛选条件再看'
                  : '创建一张国内 → 海外调拨单，把货发到海外仓'
              }
              action={
                keyword || status !== 'ALL' || direction !== 'ALL' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setKeyword('');
                      setStatus('ALL');
                      setDirection('ALL');
                    }}
                  >
                    清空筛选
                  </Button>
                ) : (
                  <Button onClick={() => setCreateOpen(true)}>新建调拨单</Button>
                )
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-44">单号</TableHead>
                    <TableHead className="w-28">方向</TableHead>
                    <TableHead>源仓 → 目标仓</TableHead>
                    <TableHead className="w-28 text-right">件数</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-40">物流单号</TableHead>
                    <TableHead className="w-44">创建时间</TableHead>
                    <TableHead className="w-44 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(t => {
                    const from = transferFrom(t);
                    const to = transferTo(t);
                    const expanded = expandedId === t.id;
                    const qty = sumQuantity(t);
                    const received = sumReceived(t);
                    return (
                      <Fragment key={t.id}>
                        <TableRow className="hover:bg-muted/40">
                          <TableCell className="px-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setExpandedId(expanded ? null : t.id)}
                              aria-label={expanded ? '收起明细' : '展开明细'}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium font-mono text-sm">
                            {t.transferNo}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {DIRECTION_LABEL[t.direction]}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1 text-sm">
                              <span className="font-medium">{from?.name || '-'}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium">{to?.name || '-'}</span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {from?.code || '-'} → {to?.code || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="font-medium">{qty}</div>
                            {(t.status === 'IN_TRANSIT' || t.status === 'RECEIVED') && (
                              <div className="text-xs text-muted-foreground">
                                已收 {received}/{qty}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={TRANSFER_STATUS_COLOR[t.status]}>
                              {TRANSFER_STATUS_LABEL[t.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.logisticsOrder ? (
                              <div>
                                <div className="font-mono">{t.logisticsOrder.orderNo}</div>
                                {t.logisticsOrder.trackingNo && (
                                  <div className="text-xs text-muted-foreground">
                                    {t.logisticsOrder.trackingNo}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateTime(t.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {t.status === 'DRAFT' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => setShipTarget(t)}
                                    title="发货"
                                  >
                                    <Truck className="mr-1 h-3.5 w-3.5" />
                                    发货
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancel(t)}
                                    title="取消"
                                  >
                                    <XCircle className="mr-1 h-3.5 w-3.5" />
                                    取消
                                  </Button>
                                </>
                              )}
                              {t.status === 'IN_TRANSIT' && (
                                <Button size="sm" onClick={() => setReceiveTarget(t)}>
                                  <PackageCheck className="mr-1 h-3.5 w-3.5" />
                                  收货
                                </Button>
                              )}
                              {(t.status === 'RECEIVED' || t.status === 'CANCELLED') && (
                                <span className="text-xs text-muted-foreground">只读</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {expanded && (
                          <TableRow key={`${t.id}-detail`} className="bg-muted/20">
                            <TableCell colSpan={9} className="p-0">
                              <div className="px-6 py-3">
                                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>备注：{t.notes || '-'}</span>
                                  <span>发货：{formatDateTime(t.shippedAt)}</span>
                                  <span>收货：{formatDateTime(t.receivedAt)}</span>
                                  <span>取消：{formatDateTime(t.cancelledAt)}</span>
                                </div>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-muted-foreground">
                                      <th className="py-1 text-left font-medium">产品</th>
                                      <th className="py-1 text-left font-medium">SKU</th>
                                      <th className="py-1 text-right font-medium">调拨数量</th>
                                      <th className="py-1 text-right font-medium">已发</th>
                                      <th className="py-1 text-right font-medium">已收</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {t.items.map(item => (
                                      <tr key={item.id} className="border-t border-border/50">
                                        <td className="py-1">{item.product?.name || '-'}</td>
                                        <td className="py-1 font-mono text-xs">
                                          {item.product?.sku || '-'}
                                        </td>
                                        <td className="py-1 text-right tabular-nums">
                                          {item.quantity}
                                        </td>
                                        <td className="py-1 text-right tabular-nums">
                                          {item.shippedQty}
                                        </td>
                                        <td className="py-1 text-right tabular-nums">
                                          {item.receivedQty}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <CreateTransferDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={message => {
          showSuccess(message);
          setPage(1);
          fetchTransfers();
        }}
        onError={showError}
      />

      <ShipDialog
        open={!!shipTarget}
        onOpenChange={open => !open && setShipTarget(null)}
        transfer={shipTarget}
        onSuccess={message => {
          showSuccess(message);
          fetchTransfers();
        }}
        onError={showError}
      />

      <ReceiveDialog
        open={!!receiveTarget}
        onOpenChange={open => !open && setReceiveTarget(null)}
        transfer={receiveTarget}
        onSuccess={message => {
          showSuccess(message);
          fetchTransfers();
        }}
        onError={showError}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDlg />
    </div>
  );
}

