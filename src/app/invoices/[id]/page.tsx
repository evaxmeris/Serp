'use client';

/**
 * 发票详情/编辑页面
 * /invoices/[id]
 * 打印样式预览，状态操作（SEND/CONFIRM/PAID/CANCEL）
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Send, CheckCircle, DollarSign, XCircle, Printer, Loader2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

interface InvoiceItem {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  status: string;
  orderId: string | null;
  customerId: string | null;
  invoiceDate: string;
  dueDate: string | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  totalAmount: number;
  issuerName: string;
  issuerAddress: string | null;
  issuerTaxId: string | null;
  issuerPhone: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientTaxId: string | null;
  items: InvoiceItem[] | string;
  notes: string | null;
  terms: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; orderNo: string; totalAmount: number; currency: string } | null;
  customer?: { id: string; companyName: string; email: string | null; phone: string | null; address: string | null } | null;
}

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  SENT: '已发送',
  CONFIRMED: '已确认',
  PAID: '已付款',
  CANCELLED: '已取消',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const typeLabels: Record<string, string> = {
  PROFORMA: '形式发票 (PI)',
  COMMERCIAL: '商业发票 (CI)',
  TAX: '税务发票',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog: ConfirmDlg } = useConfirm();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; title: string; message: string } | null>(null);

  // 编辑表单
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/invoices/${id}`);
      const result = await res.json();
      if (result.data) {
        setInvoice(result.data);
        // 解析 items
        const items = typeof result.data.items === 'string'
          ? JSON.parse(result.data.items)
          : result.data.items;
        setForm({
          ...result.data,
          items: Array.isArray(items) ? items : [],
          invoiceDate: result.data.invoiceDate?.slice(0, 10) || '',
          dueDate: result.data.dueDate?.slice(0, 10) || '',
        });
      }
    } catch (e) {
      console.error('加载发票失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusAction = async (action: string) => {
    setSaving(true);
    try {
      let url = `/api/v1/invoices/${id}`;
      let method = 'PUT';
      let body: any = {};

      if (action === 'send') {
        url = `/api/v1/invoices/${id}/send`;
        method = 'POST';
      } else if (action === 'confirm') {
        body = { status: 'CONFIRMED' };
      } else if (action === 'paid') {
        body = { status: 'PAID' };
      } else if (action === 'cancel') {
        body = { status: 'CANCELLED' };
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'POST' ? JSON.stringify(body) : undefined,
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.message || '操作失败');
        return;
      }
      setConfirmDialog(null);
      fetchInvoice();
    } catch (e) {
      console.error('操作失败:', e);
      toast.error('操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        exchangeRate: Number(form.exchangeRate),
        taxRate: Number(form.taxRate),
        discountRate: Number(form.discountRate),
        items: form.items.filter((i: any) => i.productName),
        invoiceDate: form.invoiceDate || undefined,
        dueDate: form.dueDate || null,
      };
      const res = await fetch(`/api/v1/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.message || '保存失败');
        return;
      }
      setEditing(false);
      fetchInvoice();
    } catch (e) {
      console.error('保存失败:', e);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
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
    setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== index) });
  };

  if (loading) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <Skeleton className="h-9 w-32 mb-4" />
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="p-8 border-b">
            <Skeleton className="h-6 w-64 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-8 p-8 border-b">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 mb-3" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 mb-3" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="p-8 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <Button variant="ghost" onClick={() => router.push('/invoices')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />返回发票列表
        </Button>
        <div className="text-center py-20 text-gray-500">
          <p className="text-xl">未找到该发票</p>
        </div>
      </div>
    );
  }

  const items: InvoiceItem[] = Array.isArray(form.items) ? form.items : [];

  // 计算金额
  const calcSubtotal = items.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
  const calcTaxRate = Number(form.taxRate || 0);
  const calcDiscountRate = Number(form.discountRate || 0);
  const calcTaxAmount = calcSubtotal * calcTaxRate;
  const calcDiscountAmount = calcSubtotal * calcDiscountRate;
  const calcTotalAmount = calcSubtotal + calcTaxAmount - calcDiscountAmount;

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => router.push('/invoices')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />返回发票列表
      </Button>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{invoice.invoiceNo}</h1>
          <Badge className={statusColors[invoice.status]}>{statusLabels[invoice.status]}</Badge>
          <Badge className="bg-purple-100 text-purple-800">{typeLabels[invoice.type]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 打印按钮 */}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />打印
          </Button>

          {/* 状态操作按钮 */}
          {invoice.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={() => setEditing(!editing)}>
                <Edit className="h-4 w-4 mr-2" />编辑
              </Button>
              <Button onClick={() => setConfirmDialog({ action: 'send', title: '发送发票', message: '确定将此发票标记为已发送？' })}>
                <Send className="h-4 w-4 mr-2" />发送
              </Button>
            </>
          )}
          {invoice.status === 'SENT' && (
            <>
              <Button variant="outline" className="text-yellow-600 border-yellow-300" onClick={() => setConfirmDialog({ action: 'confirm', title: '确认发票', message: '确定将此发票标记为已确认？' })}>
                <CheckCircle className="h-4 w-4 mr-2" />确认
              </Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setConfirmDialog({ action: 'cancel', title: '取消发票', message: '确定取消此发票？' })}>
                <XCircle className="h-4 w-4 mr-2" />取消
              </Button>
            </>
          )}
          {invoice.status === 'CONFIRMED' && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setConfirmDialog({ action: 'paid', title: '标记已付款', message: '确定将此发票标记为已付款？' })}>
              <DollarSign className="h-4 w-4 mr-2" />标记已付款
            </Button>
          )}
          {invoice.status === 'DRAFT' && (
            <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setConfirmDialog({ action: 'cancel', title: '取消发票', message: '确定取消此发票？' })}>
              <XCircle className="h-4 w-4 mr-2" />取消
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        /* ======== 编辑模式 ======== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* 商品明细编辑 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>商品明细</CardTitle>
                <Button variant="outline" size="sm" onClick={addItem}>
                  添加行
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品名称</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-20">数量</TableHead>
                      <TableHead className="w-28">单价</TableHead>
                      <TableHead className="w-28">总价</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={item.productName} onChange={(e) => updateItem(i, 'productName', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={item.sku || ''} onChange={(e) => updateItem(i, 'sku', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} min="1" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} min="0" step="0.01" />
                        </TableCell>
                        <TableCell className="font-medium">{(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeItem(i)}>X</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3 space-y-1 text-sm border-t pt-3">
                  <div className="flex justify-between"><span>小计：</span><span className="font-medium">{form.currency} {calcSubtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>税率 ({calcTaxRate}%)：</span><span>{form.currency} {calcTaxAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>折扣 ({calcDiscountRate}%)：</span><span className="text-red-500">-{form.currency} {calcDiscountAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t pt-2"><span>合计：</span><span>{form.currency} {calcTotalAmount.toFixed(2)}</span></div>
                </div>
              </CardContent>
            </Card>
            {/* 备注 */}
            <Card>
              <CardHeader><CardTitle>备注与条款</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>备注</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                <div><Label>付款条款</Label><Textarea value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} /></div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧编辑 */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>发票类型</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROFORMA">形式发票 (PI)</SelectItem>
                      <SelectItem value="COMMERCIAL">商业发票 (CI)</SelectItem>
                      <SelectItem value="TAX">税务发票</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>币种</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>汇率</Label><Input type="number" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} step="0.01" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>发票日期</Label><Input type="date" value={form.invoiceDate || ''} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></div>
                  <div><Label>到期日</Label><Input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>税率 (%)</Label><Input type="number" value={calcTaxRate * 100} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) / 100 })} min="0" step="0.1" /></div>
                  <div><Label>折扣率 (%)</Label><Input type="number" value={calcDiscountRate * 100} onChange={(e) => setForm({ ...form, discountRate: Number(e.target.value) / 100 })} min="0" step="0.1" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>开票方</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>名称</Label><Input value={form.issuerName || ''} onChange={(e) => setForm({ ...form, issuerName: e.target.value })} /></div>
                <div><Label>地址</Label><Input value={form.issuerAddress || ''} onChange={(e) => setForm({ ...form, issuerAddress: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>税号</Label><Input value={form.issuerTaxId || ''} onChange={(e) => setForm({ ...form, issuerTaxId: e.target.value })} /></div>
                  <div><Label>电话</Label><Input value={form.issuerPhone || ''} onChange={(e) => setForm({ ...form, issuerPhone: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>收票方</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>名称</Label><Input value={form.recipientName || ''} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} /></div>
                <div><Label>地址</Label><Input value={form.recipientAddress || ''} onChange={(e) => setForm({ ...form, recipientAddress: e.target.value })} /></div>
                <div><Label>税号</Label><Input value={form.recipientTaxId || ''} onChange={(e) => setForm({ ...form, recipientTaxId: e.target.value })} /></div>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setEditing(false); fetchInvoice(); }}>取消</Button>
              <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中</> : '保存'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ======== 预览模式 ======== */
        <div className="bg-white border rounded-lg shadow-sm print:shadow-none print:border-none">
          {/* 发票头部 */}
          <div className="p-8 border-b print:break-inside-avoid">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {invoice.type === 'PROFORMA' ? 'PROFORMA INVOICE' : invoice.type === 'COMMERCIAL' ? 'COMMERCIAL INVOICE' : 'TAX INVOICE'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">发票号: {invoice.invoiceNo}</p>
              </div>
              <div className="text-right text-sm">
                <p>日期: {new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                {invoice.dueDate && <p>到期日: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
              </div>
            </div>
          </div>

          {/* 双方信息 */}
          <div className="grid grid-cols-2 gap-8 p-8 border-b print:break-inside-avoid">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">开票方</h3>
              <p className="font-medium">{invoice.issuerName}</p>
              {invoice.issuerAddress && <p className="text-sm text-gray-600">{invoice.issuerAddress}</p>}
              {invoice.issuerTaxId && <p className="text-sm text-gray-600">税号: {invoice.issuerTaxId}</p>}
              {invoice.issuerPhone && <p className="text-sm text-gray-600">电话: {invoice.issuerPhone}</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">收票方</h3>
              <p className="font-medium">{invoice.recipientName || '-'}</p>
              {invoice.recipientAddress && <p className="text-sm text-gray-600">{invoice.recipientAddress}</p>}
              {invoice.recipientTaxId && <p className="text-sm text-gray-600">税号: {invoice.recipientTaxId}</p>}
              {invoice.customer?.email && <p className="text-sm text-gray-600">邮箱: {invoice.customer.email}</p>}
            </div>
          </div>

          {/* 商品明细 */}
          <div className="p-8 border-b print:break-inside-avoid">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">总价</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-sm text-gray-500">{item.sku || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{invoice.currency} {Number(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{invoice.currency} {Number(item.totalPrice).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 金额汇总 */}
            <div className="mt-4 ml-auto w-72 space-y-1 text-sm">
              <div className="flex justify-between"><span>小计：</span><span>{invoice.currency} {invoice.subtotal.toFixed(2)}</span></div>
              {invoice.taxRate > 0 && <div className="flex justify-between"><span>税率 ({(invoice.taxRate * 100).toFixed(1)}%)：</span><span>{invoice.currency} {invoice.taxAmount.toFixed(2)}</span></div>}
              {invoice.discountRate > 0 && <div className="flex justify-between text-red-600"><span>折扣 ({(invoice.discountRate * 100).toFixed(1)}%)：</span><span>-{invoice.currency} {invoice.discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>合计：</span>
                <span>{invoice.currency} {invoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 备注与条款 */}
          {(invoice.notes || invoice.terms) && (
            <div className="p-8 text-sm text-gray-600">
              {invoice.notes && (
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-700 mb-1">备注：</h4>
                  <p className="whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">付款条款：</h4>
                  <p className="whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* 关联订单 */}
          {invoice.order && (
            <div className="p-8 border-t text-sm text-gray-500">
              关联订单: {invoice.order.orderNo} | 订单金额: {invoice.order.currency} {Number(invoice.order.totalAmount).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* 确认对话框 */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">{confirmDialog?.message}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>取消</Button>
            <Button onClick={() => handleStatusAction(confirmDialog!.action)} disabled={saving}>
              {saving ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDlg />
    </div>
  );
}