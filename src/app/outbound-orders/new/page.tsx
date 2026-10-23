'use client';

/**
 * 创建出库单
 * 第一期适配：
 *  - 出库类型（销售/样品/赠品/内部领用/调拨）
 *  - SALE 必选销售订单；其他类型隐藏订单选择器并把备注标为必填
 *  - 仓库在出库单级别指定（后端 CreateOutboundOrderSchema.warehouseId 必填）
 *  - 服务端 422 按 field 映射为友好提示（备注/销售订单/仓库/商品）
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Search, Trash2, Warehouse as WarehouseIcon, Package, Info } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

type OutboundType = 'SALE' | 'SAMPLE' | 'GIFT' | 'INTERNAL' | 'TRANSFER';

const OUTBOUND_TYPES: { value: OutboundType; label: string; hint: string }[] = [
  { value: 'SALE', label: '销售出库', hint: '必须关联销售订单，按订单明细出库' },
  { value: 'SAMPLE', label: '样品', hint: '无销售订单，需在备注说明送样对象/用途' },
  { value: 'GIFT', label: '赠品', hint: '无销售订单，需在备注说明赠送对象/用途' },
  { value: 'INTERNAL', label: '内部领用', hint: '无销售订单，需在备注说明领用部门/用途' },
  { value: 'TRANSFER', label: '调拨', hint: '无销售订单，需在备注说明调拨去向' },
];

const TYPE_LABEL: Record<string, string> = OUTBOUND_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<string, string>,
);

/** 服务端 422 的 field → 表单字段中文名，用于拼出友好提示 */
const FIELD_LABELS: Record<string, string> = {
  orderId: '销售订单',
  outboundType: '出库类型',
  warehouseId: '出库仓库',
  notes: '备注',
  items: '商品明细',
  productId: '商品',
  quantity: '出库数量',
  unitPrice: '单价',
  batchNo: '批次号',
};

/** 后端报错里会带出库类型枚举码（SAMPLE 等），转成中文更易读 */
const translateTypeCodes = (message: string) =>
  message
    .replace(/\bSALE\b/g, '销售出库')
    .replace(/\bSAMPLE\b/g, '样品')
    .replace(/\bGIFT\b/g, '赠品')
    .replace(/\bINTERNAL\b/g, '内部领用')
    .replace(/\bTRANSFER\b/g, '调拨');

interface ApiError {
  field: string;
  message: string;
}

interface SalesOrder {
  id: string;
  orderNo: string;
  status: string;
  customer?: { id: string; companyName: string } | null;
}

interface OrderDetailItem {
  id: string;
  quantity: number;
  shippedQty: number;
  unitPrice: number;
  product?: { id: string; sku: string; name: string } | null;
  productName?: string | null;
  productSku?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
}

interface ItemRow {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  maxQuantity?: number;
  batchNo?: string;
}

export default function CreateOutboundOrderPage() {
  const router = useRouter();
  const { toast, toasts, removeToast } = useToast();
  const { ConfirmDialog } = useConfirm();

  const [outboundType, setOutboundType] = useState<OutboundType>('SALE');
  const [notes, setNotes] = useState('');

  // 仓库（出库单级别）
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehousesLoading, setWarehousesLoading] = useState(true);

  // 销售订单（仅 SALE）
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  // 商品明细
  const [items, setItems] = useState<ItemRow[]>([]);

  // 商品（非 SALE 手工加行）
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [orderLoading, setOrderLoading] = useState(false);

  const isSale = outboundType === 'SALE';

  /* ---------------------------- 基础数据 ---------------------------- */

  useEffect(() => {
    const load = async () => {
      setWarehousesLoading(true);
      try {
        const res = await fetch('/api/v1/warehouses?status=ACTIVE&limit=100');
        const data = await res.json();
        const list: Warehouse[] = data?.data?.items || [];
        setWarehouses(list);
        if (list.length > 0) setWarehouseId((prev) => prev || list[0].id);
      } catch (e) {
        console.error('加载仓库失败', e);
      } finally {
        setWarehousesLoading(false);
      }
    };
    load();
  }, []);

  const loadOrders = useCallback(async (search = '') => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', page: '1' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      const payload = data?.data || data;
      setOrders(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      console.error('加载销售订单失败', e);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // 首次进入 + 切回 SALE 时拉订单
  useEffect(() => {
    if (isSale && orders.length === 0) loadOrders('');
  }, [isSale, orders.length, loadOrders]);

  // 商品搜索（非 SALE 类型才需要）
  useEffect(() => {
    if (isSale) return;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '100', page: '1', status: 'ACTIVE' });
        if (productSearch) params.set('search', productSearch);
        const res = await fetch(`/api/v1/products?${params.toString()}`);
        const data = await res.json();
        const payload = data?.data || data;
        setProducts(Array.isArray(payload?.items) ? payload.items : []);
      } catch (e) {
        console.error('加载商品失败', e);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [isSale, productSearch]);

  /* ---------------------------- 类型切换 ---------------------------- */

  const handleTypeChange = (value: string) => {
    const next = value as OutboundType;
    setOutboundType(next);
    setFieldErrors({});
    setSelectedOrderId('');
    setSelectedOrder(null);
    setItems([]);
    if (next !== 'SALE') setNotes('');
  };

  /* ---------------------------- 订单明细 ---------------------------- */

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setFieldErrors((p) => ({ ...p, orderId: '' }));
    const brief = orders.find((o) => o.id === orderId) || null;
    setSelectedOrder(brief);
    if (!orderId) {
      setItems([]);
      return;
    }
    setOrderLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      const detail = data?.data || data;
      const detailItems: OrderDetailItem[] = Array.isArray(detail?.items) ? detail.items : [];
      setSelectedOrder({
        id: detail.id,
        orderNo: detail.orderNo,
        status: detail.status,
        customer: detail.customer || brief?.customer || null,
      });
      setItems(
        detailItems.map((it) => {
          const remaining = Math.max(0, Number(it.quantity || 0) - Number(it.shippedQty || 0));
          return {
            productId: it.product?.id || '',
            productName: it.product?.name || it.productName || '',
            productSku: it.product?.sku || it.productSku || '',
            quantity: remaining,
            unitPrice: Number(it.unitPrice || 0),
            maxQuantity: remaining,
            batchNo: '',
          };
        }),
      );
    } catch (e) {
      console.error('加载订单明细失败', e);
      toast.error('加载订单明细失败，请重试');
    } finally {
      setOrderLoading(false);
    }
  };

  const addManualItem = () => {
    setItems((prev) => [
      ...prev,
      { productId: '', productName: '', productSku: '', quantity: 1, unitPrice: 0, batchNo: '' },
    ]);
    setFieldErrors((p) => ({ ...p, items: '' }));
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleProductPick = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateItem(index, {
      productId,
      productName: product?.name || '',
      productSku: product?.sku || '',
      unitPrice:
        Number(product?.salePrice ?? product?.costPrice ?? 0) ||
        items[index]?.unitPrice ||
        0,
    });
  };

  const totalAmount = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);

  /* ---------------------------- 提交 ---------------------------- */

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!warehouseId) errs.warehouseId = '请选择出库仓库';
    if (isSale && !selectedOrderId) errs.orderId = '销售出库必须关联销售订单';
    if (!isSale && items.length === 0) errs.items = '请至少添加一项商品';
    if (isSale && items.length === 0) errs.items = '该销售订单暂无可出库明细';
    if (items.some((it) => !it.productId)) errs.items = '存在未选择商品的明细行';
    if (items.some((it) => Number(it.quantity) <= 0)) errs.items = '出库数量必须大于 0';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.warning(Object.values(errs)[0]);
      return;
    }

    // 备注必填交由服务端校验（422 field=notes），前端只做红星与提示，保证与后端规则一致
    const payload = {
      outboundType,
      warehouseId,
      notes: notes.trim(),
      ...(isSale ? { orderId: selectedOrderId } : {}),
      items: items.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        batchNo: it.batchNo || undefined,
      })),
    };

    setSubmitting(true);
    setFieldErrors({});
    try {
      const res = await fetch('/api/v1/outbound-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        toast.success('出库单创建成功');
        // 详情页路由在 dev 环境存在挂起问题，创建后回到列表（列表已显示新单据）
        // 稍作延迟让成功提示可见，再跳转
        setTimeout(() => router.push('/outbound-orders'), 700);
        return;
      }

      // 422：把 errors[].field 映射成中文并落到对应输入框下
      const apiErrors: ApiError[] = Array.isArray(result?.errors) ? result.errors : [];
      if (apiErrors.length > 0) {
        const mapped: Record<string, string> = {};
        const pretty = apiErrors.map((e) => {
          const label = FIELD_LABELS[e.field] || e.field;
          const msg = translateTypeCodes(e.message);
          mapped[e.field] = msg;
          return `${label}：${msg}`;
        });
        setFieldErrors(mapped);
        toast.error(pretty.join('；'));
      } else {
        toast.error(result?.message || '创建失败，请重试');
      }
    } catch (e) {
      console.error('创建出库单失败', e);
      toast.error('网络异常，创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const typeMeta = OUTBOUND_TYPES.find((t) => t.value === outboundType)!;

  return (
    <>
      <div className="container mx-auto py-6 px-4 space-y-6 fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/outbound-orders')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">创建出库单</h1>
            <p className="text-sm text-muted-foreground mt-1">
              按出库类型区分是否关联销售订单；非销售出库需填写备注留痕
            </p>
          </div>
        </div>

        {/* 出库信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              出库信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">
                  出库类型 <span className="text-destructive">*</span>
                </Label>
                <Select value={outboundType} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTBOUND_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{typeMeta.hint}</p>
              </div>

              <div>
                <Label className="mb-1.5 block">
                  出库仓库 <span className="text-destructive">*</span>
                </Label>
                {warehousesLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setFieldErrors((p) => ({ ...p, warehouseId: '' })); }}>
                    <SelectTrigger className={fieldErrors.warehouseId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="选择出库仓库" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}（{wh.code}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {fieldErrors.warehouseId && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.warehouseId}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">
                备注 {!isSale && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setFieldErrors((p) => ({ ...p, notes: '' })); }}
                placeholder={
                  isSale
                    ? '选填，例如：客户要求分批发货'
                    : '必填：说明本次出库用途/去向，例如「XX 展会样品，寄往迪拜客户」'
                }
                className={`min-h-[72px] ${fieldErrors.notes ? 'border-destructive' : ''}`}
              />
              <p className={`text-xs mt-1 ${fieldErrors.notes ? 'text-destructive' : 'text-muted-foreground'}`}>
                {fieldErrors.notes
                  ? `备注：${fieldErrors.notes}`
                  : isSale
                    ? '选填'
                    : `${typeMeta.label}出库必须填写备注，说明用途/去向`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 销售订单（仅 SALE） */}
        {isSale && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                关联销售订单 <span className="text-destructive">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <Input
                  placeholder="搜索销售订单号 / 客户名称"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadOrders(orderSearch)}
                  className="sm:max-w-sm"
                />
                <Button variant="outline" onClick={() => loadOrders(orderSearch)} disabled={ordersLoading}>
                  <Search className="h-4 w-4 mr-1" />
                  {ordersLoading ? '搜索中...' : '搜索'}
                </Button>
              </div>

              {ordersLoading && orders.length === 0 ? (
                <Skeleton className="h-9 w-full" />
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  未找到销售订单。若本次不关联订单，请把出库类型改为「样品 / 赠品 / 内部领用 / 调拨」。
                </p>
              ) : (
                <Select value={selectedOrderId} onValueChange={handleSelectOrder}>
                  <SelectTrigger className={fieldErrors.orderId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="选择销售订单" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.orderNo} · {o.customer?.companyName || '无客户'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fieldErrors.orderId && <p className="text-xs text-destructive">{fieldErrors.orderId}</p>}

              {selectedOrder && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 rounded-md bg-muted text-sm">
                  <div>
                    <span className="text-muted-foreground">订单号：</span>
                    <span className="font-medium">{selectedOrder.orderNo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">客户：</span>
                    <span className="font-medium">{selectedOrder.customer?.companyName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    <span className="font-medium">{selectedOrder.status}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 商品明细 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
                商品明细 {!isSale && <span className="text-destructive">*</span>}
              </CardTitle>
              {!isSale && (
                <Button variant="outline" size="sm" onClick={addManualItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加商品
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isSale && (
              <div className="mb-3">
                <Input
                  placeholder="搜索商品名称 / SKU"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="sm:max-w-sm"
                />
              </div>
            )}

            {isSale && orderLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {isSale ? '选择销售订单后自动带出可出库明细' : '点击右上角「添加商品」选择要出库的商品'}
              </p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[240px]">商品</TableHead>
                      <TableHead className="w-[110px] text-right">可出库</TableHead>
                      <TableHead className="w-[120px]">出库数量</TableHead>
                      <TableHead className="w-[120px]">单价</TableHead>
                      <TableHead className="w-[140px]">批次号</TableHead>
                      <TableHead className="w-[120px] text-right">金额</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {isSale ? (
                            <div>
                              <div className="font-medium">{item.productName || '—'}</div>
                              <div className="text-xs text-muted-foreground">{item.productSku}</div>
                            </div>
                          ) : (
                            <Select value={item.productId} onValueChange={(v) => handleProductPick(index, v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="选择商品" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}（{p.sku}）
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {isSale ? item.maxQuantity ?? '—' : '—'}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={isSale ? item.maxQuantity : undefined}
                            value={item.quantity}
                            onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                            className="w-24 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                            className="w-28 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.batchNo || ''}
                            onChange={(e) => updateItem(index, { batchNo: e.target.value })}
                            placeholder="选填"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {fieldErrors.items && <p className="text-xs text-destructive mt-2">{fieldErrors.items}</p>}

            <Separator className="my-4" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-lg font-semibold">总金额：¥{totalAmount.toFixed(2)}</div>
              <div className="flex gap-3 sm:justify-end">
                <Button variant="outline" onClick={() => router.push('/outbound-orders')}>
                  取消
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? '创建中...' : '创建出库单'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </>
  );
}
