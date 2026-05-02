'use client';

/**
 * 新建发票页面
 * /invoices/new
 * 订单选择 -> 自动填充明细 -> 编辑 -> 保存
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { useFormDraft, useLeaveConfirmation } from '@/lib/use-form-draft';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

interface OrderItem {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceForm {
  type: string;
  currency: string;
  exchangeRate: string;
  taxRate: string;
  discountRate: string;
  invoiceDate: string;
  dueDate: string;
  issuerName: string;
  issuerAddress: string;
  issuerTaxId: string;
  issuerPhone: string;
  recipientName: string;
  recipientAddress: string;
  recipientTaxId: string;
  notes: string;
  terms: string;
  orderId: string;
  customerId: string;
  items: OrderItem[];
}

const emptyForm: InvoiceForm = {
  type: 'PROFORMA',
  currency: 'USD',
  exchangeRate: '1.0',
  taxRate: '0',
  discountRate: '0',
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  issuerName: 'Trade ERP Co., Ltd.',
  issuerAddress: '',
  issuerTaxId: '',
  issuerPhone: '',
  recipientName: '',
  recipientAddress: '',
  recipientTaxId: '',
  notes: '',
  terms: '',
  orderId: '',
  customerId: '',
  items: [{ productName: '', sku: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog: ConfirmDlg } = useConfirm();
  const [form, setForm] = useState<InvoiceForm>({ ...emptyForm, items: [{ ...emptyForm.items[0] }] });
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // 草稿自动保存 & 离开确认
  const isDirty = JSON.stringify(form) !== JSON.stringify(emptyForm);
  const { loadDraft, clearDraft } = useFormDraft('invoice-new', form, isDirty, saving);
  useLeaveConfirmation(isDirty);

  // 页面加载时恢复草稿
  useEffect(() => {
    const draft = loadDraft() as InvoiceForm | null;
    if (draft) {
      setForm(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/v1/customers?limit=200');
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('加载客户失败:', e);
    } finally {
      setPageLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    if (!orderId) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`);
      const result = await res.json();
      const order = result.data;
      if (order) {
        setSelectedOrder(order);
        const items = (order.items || []).map((item: any) => ({
          productName: item.productName || '',
          sku: item.productSku || '',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          totalPrice: Number(item.amount || Number(item.unitPrice || 0) * Number(item.quantity || 1)),
        }));
        if (items.length > 0) {
          setForm((prev) => ({
            ...prev,
            items,
            customerId: order.customerId || prev.customerId,
            recipientName: order.customer?.companyName || prev.recipientName,
            currency: order.currency || 'USD',
            orderId: order.id,
          }));
        }
      }
    } catch (e) {
      console.error('加载订单失败:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleOrderSearch = async (search: string) => {
    if (!search) {
      setOrders([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/orders?search=${encodeURIComponent(search)}&limit=20`);
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('搜索订单失败:', e);
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    // 自动计算总价
    if (field === 'quantity' || field === 'unitPrice') {
      items[index].totalPrice = Number(items[index].quantity) * Number(items[index].unitPrice);
    }
    setForm({ ...form, items });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { productName: '', sku: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
    });
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const update = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleSave = async () => {
    if (!form.issuerName) {
      toast.error('请填写开票方名称');
      return;
    }
    setSaving(true);
    try {
      // 计算到期日：如果没填，给默认30天
      const payload = {
        ...form,
        items: form.items.filter((item) => item.productName),
        exchangeRate: Number(form.exchangeRate),
        taxRate: Number(form.taxRate) / 100,
        discountRate: Number(form.discountRate) / 100,
      };
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.message || '创建失败');
        return;
      }
      clearDraft();
      toast.success('发票创建成功');
      router.push(`/invoices/${result.data.id}`);
    } catch (e) {
      console.error('保存失败:', e);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const subtotal = form.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const taxAmount = subtotal * (Number(form.taxRate) / 100);
  const discountAmount = subtotal * (Number(form.discountRate) / 100);
  const totalAmount = subtotal + taxAmount - discountAmount;

  if (pageLoading) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <Skeleton className="h-9 w-32 mb-4" />
        <Skeleton className="h-9 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-52 w-full rounded-lg" />
            <Skeleton className="h-52 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => router.push('/invoices')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />返回发票列表
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">新建发票</h1>
        <p className="mt-1 text-gray-500">填写发票信息，可选择从订单自动导入明细</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 订单关联 */}
          <Card>
            <CardHeader>
              <CardTitle>关联订单（可选）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <Label>搜索订单号</Label>
                  <Input
                    placeholder="输入订单号搜索..."
                    onChange={(e) => handleOrderSearch(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>选择订单</Label>
                  <Select
                    value={form.orderId}
                    onValueChange={(v) => {
                      update('orderId', v);
                      fetchOrderItems(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择订单..." />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.orderNo} - {o.customer?.companyName || ''} ({o.currency} {Number(o.totalAmount).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {loadingOrders && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载订单中...
                </div>
              )}
              {selectedOrder && !loadingOrders && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  ✓ 已加载订单 {selectedOrder.orderNo} 的商品明细
                </div>
              )}
            </CardContent>
          </Card>

          {/* 商品明细 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>商品明细</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />添加行
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">产品名称</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-20">数量</TableHead>
                      <TableHead className="w-28">单价</TableHead>
                      <TableHead className="w-28">总价</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            value={item.productName}
                            onChange={(e) => updateItem(i, 'productName', e.target.value)}
                            placeholder="产品名称"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.sku}
                            onChange={(e) => updateItem(i, 'sku', e.target.value)}
                            placeholder="SKU"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {(item.quantity * item.unitPrice).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeItem(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 金额汇总 */}
              <div className="mt-4 space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between">
                  <span>小计：</span>
                  <span className="font-medium">{form.currency} {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>税率 ({form.taxRate}%)：</span>
                  <span className="font-medium">{form.currency} {taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>折扣 ({form.discountRate}%)：</span>
                  <span className="font-medium text-red-500">-{form.currency} {discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>合计：</span>
                  <span>{form.currency} {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 备注和条款 */}
          <Card>
            <CardHeader>
              <CardTitle>备注与条款</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>备注</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="发票备注（可选）"
                  rows={3}
                />
              </div>
              <div>
                <Label>付款条款</Label>
                <Textarea
                  value={form.terms}
                  onChange={(e) => update('terms', e.target.value)}
                  placeholder="例如：T/T 30% deposit, 70% before shipment"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧 - 基本信息 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>发票类型 *</Label>
                <Select value={form.type} onValueChange={(v) => update('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROFORMA">形式发票 (PI)</SelectItem>
                    <SelectItem value="COMMERCIAL">商业发票 (CI)</SelectItem>
                    <SelectItem value="TAX">税务发票</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>币种</Label>
                  <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">$ USD</SelectItem>
                      <SelectItem value="CNY">¥ CNY</SelectItem>
                      <SelectItem value="EUR">€ EUR</SelectItem>
                      <SelectItem value="GBP">£ GBP</SelectItem>
                      <SelectItem value="JPY">¥ JPY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>汇率</Label>
                  <Input type="number" value={form.exchangeRate} onChange={(e) => update('exchangeRate', e.target.value)} step="0.01" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>发票日期</Label>
                  <Input type="date" value={form.invoiceDate} onChange={(e) => update('invoiceDate', e.target.value)} />
                </div>
                <div>
                  <Label>到期日</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>税率 (%)</Label>
                  <Input type="number" value={form.taxRate} onChange={(e) => update('taxRate', e.target.value)} min="0" max="100" step="0.1" />
                </div>
                <div>
                  <Label>折扣率 (%)</Label>
                  <Input type="number" value={form.discountRate} onChange={(e) => update('discountRate', e.target.value)} min="0" max="100" step="0.1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 开票方 */}
          <Card>
            <CardHeader>
              <CardTitle>开票方信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>公司名称 *</Label>
                <Input value={form.issuerName} onChange={(e) => update('issuerName', e.target.value)} />
              </div>
              <div>
                <Label>地址</Label>
                <Input value={form.issuerAddress} onChange={(e) => update('issuerAddress', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>税号</Label>
                  <Input value={form.issuerTaxId} onChange={(e) => update('issuerTaxId', e.target.value)} />
                </div>
                <div>
                  <Label>电话</Label>
                  <Input value={form.issuerPhone} onChange={(e) => update('issuerPhone', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 收票方 */}
          <Card>
            <CardHeader>
              <CardTitle>收票方信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>客户</Label>
                <Select
                  value={form.customerId}
                  onValueChange={(v) => {
                    const c = customers.find((c) => c.id === v);
                    update('customerId', v);
                    if (c) {
                      update('recipientName', c.companyName);
                      update('recipientAddress', c.address || '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择客户..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName} ({c.country || '-'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>公司名称</Label>
                <Input value={form.recipientName} onChange={(e) => update('recipientName', e.target.value)} />
              </div>
              <div>
                <Label>地址</Label>
                <Input value={form.recipientAddress} onChange={(e) => update('recipientAddress', e.target.value)} />
              </div>
              <div>
                <Label>税号</Label>
                <Input value={form.recipientTaxId} onChange={(e) => update('recipientTaxId', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中...
              </>
            ) : (
              '保存发票'
            )}
          </Button>
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDlg />
    </div>
  );
}
