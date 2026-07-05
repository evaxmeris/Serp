'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastContainer, useToast } from '@/components/ui/toast';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  User,
  Edit,
  Trash2,
  FileText,
  ShoppingCart,
  MessageSquare,
  Receipt,
  Users,
  Clock,
  Plus,
  Send,
} from 'lucide-react';

// ─── 类型定义 ───

interface CustomerContact {
  id: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface Inquiry {
  id: string;
  inquiryNo: string;
  source: string | null;
  status: string;
  priority: string;
  products: string | null;
  quantity: number | null;
  targetPrice: string | null;
  currency: string;
  requirements: string | null;
  createdAt: string;
  followUps?: FollowUp[];
  _count?: { followUps: number };
}

interface FollowUp {
  id: string;
  type: string;
  content: string | null;
  createdAt: string;
}

interface Quotation {
  id: string;
  quotationNo: string;
  totalAmount: string;
  status: string;
  currency: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNo: string;
  totalAmount: string;
  status: string;
  currency: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  totalAmount: string;
  status: string;
  currency: string;
  createdAt: string;
}

interface CustomerDetail {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
  website: string | null;
  source: string | null;
  status: string;
  creditLevel: string | null;
  notes: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string } | null;
  contacts: CustomerContact[];
  inquiries: Inquiry[];
  quotations: Quotation[];
  orders: Order[];
  invoices: Invoice[];
  _count: {
    contacts: number;
    inquiries: number;
    quotations: number;
    orders: number;
    invoices: number;
  };
}

// ─── 状态标签颜色 ───

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE:      { label: '活跃',    color: 'bg-green-100 text-green-700 border-green-200' },
  INACTIVE:    { label: '静默',    color: 'bg-gray-100 text-gray-500 border-gray-200' },
  LEAD:        { label: '线索',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  NEGOTIATING: { label: '洽谈中',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  LOST:        { label: '流失',    color: 'bg-red-100 text-red-700 border-red-200' },
};

const SOURCE_COLORS: Record<string, string> = {
  '阿里国际站': 'bg-orange-100 text-orange-700',
  'OKKI':       'bg-purple-100 text-purple-700',
  '独立站':     'bg-blue-100 text-blue-700',
  '展会':       'bg-teal-100 text-teal-700',
};

// ─── 格式化 ───

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── 页面组件 ───

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast, toasts, removeToast } = useToast();
  const id = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑对话框
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    website: '',
    source: '',
    notes: '',
    creditLevel: '',
  });

  // 跟进对话框
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({ type: 'NOTE', content: '' });

  // 联系人对话框
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '', position: '', email: '', phone: '', isPrimary: false,
  });

  // 删除确认
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ─── 获取客户详情 ───

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || '获取客户信息失败');
        return;
      }
      setCustomer(data.data);
    } catch (e) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  // ─── 编辑客户 ───

  const openEdit = () => {
    if (!customer) return;
    setEditForm({
      companyName: customer.companyName,
      contactName: customer.contactName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      country: customer.country || '',
      address: customer.address || '',
      website: customer.website || '',
      source: customer.source || '',
      notes: customer.notes || '',
      creditLevel: customer.creditLevel || '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!customer) return;
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success('客户信息已更新');
        setEditOpen(false);
        fetchCustomer();
      } else {
        const data = await res.json();
        toast.error(data.message || data.error || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  // ─── 删除客户 ───

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('客户已删除');
        setDeleteOpen(false);
        router.back();
      } else {
        const data = await res.json();
        toast.error(data.message || '删除失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  // ─── 添加跟进 ───

  const handleAddFollowUp = async () => {
    if (!newFollowUp.content.trim()) return;
    try {
      const res = await fetch(`/api/customers/${id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFollowUp),
      });
      if (res.ok) {
        toast.success('跟进已记录');
        setFollowUpOpen(false);
        setNewFollowUp({ type: 'NOTE', content: '' });
        fetchCustomer();
      } else {
        const data = await res.json();
        toast.error(data.message || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  // ─── 添加联系人 ───

  const handleAddContact = async () => {
    if (!contactForm.name.trim()) return;
    try {
      const res = await fetch(`/api/customers/${id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        toast.success('联系人已添加');
        setContactOpen(false);
        setContactForm({ name: '', position: '', email: '', phone: '', isPrimary: false });
        fetchCustomer();
      } else {
        const data = await res.json();
        toast.error(data.message || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  // ─── 加载状态 ───

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> 返回客户列表
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-gray-500 mb-4">{error || '客户不存在'}</p>
            <Button onClick={fetchCustomer}>重试</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusStyle = STATUS_MAP[customer.status] || { label: customer.status, color: 'bg-gray-100 text-gray-500' };
  const sourceColor = SOURCE_COLORS[customer.source || ''] || 'bg-gray-100 text-gray-500';

  // ─── 主页面 ───

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.companyName}</h1>
            <p className="text-sm text-gray-500">
              {customer.contactName && `${customer.contactName} · `}
              创建于 {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFollowUpOpen(true)}>
            <Clock className="h-4 w-4 mr-1" /> 跟进
          </Button>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Edit className="h-4 w-4 mr-1" /> 编辑
          </Button>
          <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> 删除
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: User, label: '联系人', count: customer._count.contacts, color: 'text-blue-500 bg-blue-50' },
          { icon: MessageSquare, label: '询盘', count: customer._count.inquiries, color: 'text-purple-500 bg-purple-50' },
          { icon: FileText, label: '报价', count: customer._count.quotations, color: 'text-amber-500 bg-amber-50' },
          { icon: ShoppingCart, label: '订单', count: customer._count.orders, color: 'text-green-500 bg-green-50' },
          { icon: Receipt, label: '发票', count: customer._count.invoices, color: 'text-indigo-500 bg-indigo-50' },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 主体：两列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 左侧：客户基本信息 */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 客户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={statusStyle.color}>{statusStyle.label}</Badge>
                {customer.source && <Badge className={sourceColor}>{customer.source}</Badge>}
                {customer.creditLevel && <Badge className="bg-gray-100 text-gray-600">{customer.creditLevel}</Badge>}
              </div>

              <InfoRow icon={User} label="联系人" value={customer.contactName} />
              <InfoRow icon={Mail} label="邮箱" value={customer.email} href={`mailto:${customer.email}`} />
              <InfoRow icon={Phone} label="电话" value={customer.phone} href={`tel:${customer.phone}`} />
              <InfoRow icon={MapPin} label="国家" value={customer.country} />
              <InfoRow icon={MapPin} label="地址" value={customer.address} />
              <InfoRow icon={Globe} label="网站" value={customer.website} href={customer.website ? `//${customer.website}` : undefined} />

              {customer.owner && (
                <div className="pt-2 border-t">
                  <span className="text-gray-400">负责人：</span>
                  <span className="font-medium">{customer.owner.name}</span>
                </div>
              )}

              {customer.notes && (
                <div className="pt-2 border-t">
                  <span className="text-gray-400 block mb-1">备注：</span>
                  <p className="text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 联系人卡片 */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> 联系人
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setContactOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.contacts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无联系人</p>
              ) : (
                customer.contacts.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <div className="p-1.5 bg-gray-100 rounded-full">
                      <User className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {c.name}
                        {c.isPrimary && <Badge className="ml-1 bg-blue-100 text-blue-700 text-[10px] px-1">主</Badge>}
                      </p>
                      {c.position && <p className="text-xs text-gray-400">{c.position}</p>}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {c.email && <a href={`mailto:${c.email}`} className="text-xs text-blue-500 hover:underline">{c.email}</a>}
                        {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：活动时间线 */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> 近期活动
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {(customer.inquiries.length + customer.quotations.length + customer.orders.length) === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">暂无活动记录</p>
              ) : (
                <Timeline customer={customer} />
              )}
            </CardContent>
          </Card>

          {/* 关联数据快捷查看：询盘/报价/订单 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickListCard
              title="询盘"
              icon={MessageSquare}
              iconColor="text-purple-500"
              items={customer.inquiries}
              renderItem={(i: Inquiry) => (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{i.inquiryNo}</p>
                    <p className="text-xs text-gray-400">{i.products?.slice(0, 40) || '—'}</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 text-[10px] shrink-0 ml-2">
                    {i.status}
                  </Badge>
                </div>
              )}
              viewMoreLink={`/inquiries?customerId=${customer.id}`}
            />
            <QuickListCard
              title="订单"
              icon={ShoppingCart}
              iconColor="text-green-500"
              items={customer.orders}
              renderItem={(o: Order) => (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{o.orderNo}</p>
                    <p className="text-xs text-gray-400">{formatDate(o.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-medium">{o.currency} {Number(o.totalAmount).toLocaleString()}</p>
                    <Badge className="bg-green-100 text-green-700 text-[10px]">{o.status}</Badge>
                  </div>
                </div>
              )}
              viewMoreLink={`/orders?customerId=${customer.id}`}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickListCard
              title="报价"
              icon={FileText}
              iconColor="text-amber-500"
              items={customer.quotations}
              renderItem={(q: Quotation) => (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{q.quotationNo}</p>
                    <p className="text-xs text-gray-400">{formatDate(q.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-medium">{q.currency} {Number(q.totalAmount).toLocaleString()}</p>
                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">{q.status}</Badge>
                  </div>
                </div>
              )}
              viewMoreLink={`/quotations?customerId=${customer.id}`}
            />
            <QuickListCard
              title="发票"
              icon={Receipt}
              iconColor="text-indigo-500"
              items={customer.invoices}
              renderItem={(inv: Invoice) => (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNo}</p>
                    <p className="text-xs text-gray-400">{formatDate(inv.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-medium">{inv.currency} {Number(inv.totalAmount).toLocaleString()}</p>
                    <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">{inv.status}</Badge>
                  </div>
                </div>
              )}
              viewMoreLink={`/invoices?customerId=${customer.id}`}
            />
          </div>
        </div>
      </div>

      {/* ─── 编辑客户对话框 ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑客户信息</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>公司名称</Label>
              <Input value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} />
            </div>
            <div>
              <Label>联系人</Label>
              <Input value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })} />
            </div>
            <div>
              <Label>邮箱</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>电话</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>国家</Label>
              <Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>地址</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div>
              <Label>网站</Label>
              <Input value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
            </div>
            <div>
              <Label>客户来源</Label>
              <Select value={editForm.source} onValueChange={(v) => setEditForm({ ...editForm, source: v })}>
                <SelectTrigger><SelectValue placeholder="选择来源" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="阿里国际站">阿里国际站</SelectItem>
                  <SelectItem value="OKKI">OKKI</SelectItem>
                  <SelectItem value="独立站">独立站</SelectItem>
                  <SelectItem value="展会">展会</SelectItem>
                  <SelectItem value="朋友介绍">朋友介绍</SelectItem>
                  <SelectItem value="其他">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>客户等级</Label>
              <Select value={editForm.creditLevel} onValueChange={(v) => setEditForm({ ...editForm, creditLevel: v })}>
                <SelectTrigger><SelectValue placeholder="选择等级" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - 重点</SelectItem>
                  <SelectItem value="B">B - 潜力</SelectItem>
                  <SelectItem value="C">C - 一般</SelectItem>
                  <SelectItem value="D">D - 静默</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>备注</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 跟进对话框 ─── */}
      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录跟进</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>跟进方式</Label>
              <Select value={newFollowUp.type} onValueChange={(v) => setNewFollowUp({ ...newFollowUp, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">电话</SelectItem>
                  <SelectItem value="EMAIL">邮件</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="NOTE">备注</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>跟进内容</Label>
              <Input
                value={newFollowUp.content}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, content: e.target.value })}
                placeholder="记录本次跟进的沟通内容..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpOpen(false)}>取消</Button>
            <Button onClick={handleAddFollowUp}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 新增联系人对话框 ─── */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增联系人</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>姓名 *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
            </div>
            <div>
              <Label>职位</Label>
              <Input value={contactForm.position} onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })} />
            </div>
            <div>
              <Label>邮箱</Label>
              <Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            </div>
            <div>
              <Label>电话</Label>
              <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>取消</Button>
            <Button onClick={handleAddContact}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 删除确认对话框 ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">确定要删除客户「{customer.companyName}」吗？此操作将同时删除该客户的所有关联数据（询盘、报价、订单等）。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 子组件 ───

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  const inner = (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-gray-400 text-xs">{label}</span>
        <p className="text-gray-700 truncate">{value}</p>
      </div>
    </div>
  );
  if (href) return <a href={href} className="hover:bg-gray-50 rounded px-1 -mx-1 block">{inner}</a>;
  return inner;
}

function Timeline({ customer }: { customer: CustomerDetail }) {
  // 合并所有事件
  const events: { date: Date; type: string; content: string; label: string; color: string }[] = [];

  customer.inquiries.forEach((i) => {
    events.push({
      date: new Date(i.createdAt),
      type: 'inquiry',
      content: `询盘 ${i.inquiryNo}${i.products ? ' — ' + i.products.slice(0, 60) : ''}`,
      label: '询盘',
      color: 'bg-purple-500',
    });
    (i.followUps || []).forEach((f) => {
      events.push({
        date: new Date(f.createdAt),
        type: 'follow-up',
        content: f.content || '(无内容)',
        label: f.type === 'CALL' ? '电话' : f.type === 'EMAIL' ? '邮件' : '跟进',
        color: 'bg-blue-500',
      });
    });
  });

  customer.quotations.forEach((q) => {
    events.push({
      date: new Date(q.createdAt),
      type: 'quotation',
      content: `报价 ${q.quotationNo} — ${q.currency} ${Number(q.totalAmount).toLocaleString()}`,
      label: '报价',
      color: 'bg-amber-500',
    });
  });

  customer.orders.forEach((o) => {
    events.push({
      date: new Date(o.createdAt),
      type: 'order',
      content: `订单 ${o.orderNo} — ${o.currency} ${Number(o.totalAmount).toLocaleString()}`,
      label: '订单',
      color: 'bg-green-500',
    });
  });

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="relative pl-8 space-y-0">
      {events.slice(0, 20).map((e, i) => (
        <div key={i} className="relative pb-6 last:pb-0">
          {i < events.length - 1 && (
            <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200" />
          )}
          <div className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-white ${e.color}`} />
          <div>
            <p className="text-xs text-gray-400">{e.date.toLocaleDateString('zh-CN')}</p>
            <p className="text-sm text-gray-700">{e.content}</p>
          </div>
        </div>
      ))}
      {events.length > 20 && (
        <p className="text-sm text-gray-400 text-center py-2">...还有 {events.length - 20} 条记录</p>
      )}
    </div>
  );
}

function QuickListCard({ title, icon: Icon, iconColor, items, renderItem, viewMoreLink }: {
  title: string;
  icon: any;
  iconColor: string;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  viewMoreLink?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">暂无{title}</p>
        ) : (
          items.slice(0, 5).map((item: any) => (
            <div key={item.id} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
              {renderItem(item)}
            </div>
          ))
        )}
        {viewMoreLink && items.length > 0 && (
          <a href={viewMoreLink} className="block text-center text-xs text-blue-500 hover:underline pt-1">
            查看全部 {items.length} 条{title} →
          </a>
        )}
      </CardContent>
    </Card>
  );
}
