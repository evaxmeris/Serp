'use client';

/**
 * 物流服务商管理页面
 *
 * 功能：
 * - 列表展示：搜索框 + 状态筛选 + 新建按钮 + 表格(card 包裹)
 * - 表格列：公司名称、联系人、电话、专线区域数（报价数）、状态、操作(编辑/删除)
 * - Dialog 新建/编辑表单：公司名称、税号、地址、营业执照上传区、法人信息、联系人信息(含身份证)
 * - 删除确认 Dialog
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';

// 物流服务商数据类型
interface LogisticsProvider {
  id: string;
  companyName: string;
  taxId?: string | null;
  companyAddress?: string | null;
  businessLicense?: string | null;
  legalRepName?: string | null;
  legalRepIdFront?: string | null;
  legalRepIdBack?: string | null;
  contactName: string;
  contactPhone: string;
  contactIdFront?: string | null;
  contactIdBack?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    quotations: number;
    orders: number;
  };
}

// 状态标签映射
const PROVIDER_STATUS: Record<string, string> = {
  ACTIVE: '正常',
  INACTIVE: '停用',
  BLACKLISTED: '黑名单',
};

// 状态颜色映射
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
};

// 新建/编辑表单初始值
const emptyForm = {
  companyName: '',
  taxId: '',
  companyAddress: '',
  businessLicense: '',
  legalRepName: '',
  legalRepIdFront: '',
  legalRepIdBack: '',
  contactName: '',
  contactPhone: '',
  contactIdFront: '',
  contactIdBack: '',
  status: 'ACTIVE',
  notes: '',
};

export default function LogisticsProvidersPage() {
  const router = useRouter();
  const { toasts, removeToast, toast } = useToast();

  // 列表数据
  const [providers, setProviders] = useState<LogisticsProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Dialog 状态
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LogisticsProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<LogisticsProvider | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 加载数据
  useEffect(() => {
    fetchProviders();
  }, [page, search, statusFilter]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/v1/logistics/providers?${params}`);
      const result = await res.json();

      const data = result.data?.items ?? result.data ?? [];
      setProviders(Array.isArray(data) ? data : []);
      setTotalPages(result.pagination?.totalPages || result.data?.pagination?.totalPages || 1);
      setTotal(result.pagination?.total || result.data?.pagination?.total || 0);
    } catch (error) {
      console.error('获取物流服务商列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  };

  // 打开新建 Dialog
  const openCreateDialog = () => {
    setEditingProvider(null);
    setFormData(emptyForm);
    setErrors({});
    setIsFormDialogOpen(true);
  };

  // 打开编辑 Dialog
  const openEditDialog = (provider: LogisticsProvider) => {
    setEditingProvider(provider);
    setFormData({
      companyName: provider.companyName || '',
      taxId: provider.taxId || '',
      companyAddress: provider.companyAddress || '',
      businessLicense: provider.businessLicense || '',
      legalRepName: provider.legalRepName || '',
      legalRepIdFront: provider.legalRepIdFront || '',
      legalRepIdBack: provider.legalRepIdBack || '',
      contactName: provider.contactName || '',
      contactPhone: provider.contactPhone || '',
      contactIdFront: provider.contactIdFront || '',
      contactIdBack: provider.contactIdBack || '',
      status: provider.status || 'ACTIVE',
      notes: provider.notes || '',
    });
    setErrors({});
    setIsFormDialogOpen(true);
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) {
      newErrors.companyName = '公司名称不能为空';
    }
    if (!formData.contactName.trim()) {
      newErrors.contactName = '联系人不能为空';
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = '联系电话不能为空';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存（新建/编辑）
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('请修正表单错误');
      return;
    }

    setSaving(true);
    try {
      const url = editingProvider
        ? `/api/v1/logistics/providers/${editingProvider.id}`
        : '/api/v1/logistics/providers';
      const method = editingProvider ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(editingProvider ? '物流服务商更新成功' : '物流服务商创建成功');
        setIsFormDialogOpen(false);
        setEditingProvider(null);
        setFormData(emptyForm);
        fetchProviders();
      } else {
        toast.error(result.message || '操作失败');
      }
    } catch (error) {
      console.error('保存物流服务商失败:', error);
      toast.error('操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!deletingProvider) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/logistics/providers/${deletingProvider.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        toast.success('物流服务商删除成功');
        setIsDeleteDialogOpen(false);
        setDeletingProvider(null);
        fetchProviders();
      } else {
        toast.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除物流服务商失败:', error);
      toast.error('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  // 更新表单字段
  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">物流服务商管理</CardTitle>
            <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">新增物流服务商</span>
                  <span className="sm:hidden">新增</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>
                    {editingProvider ? '编辑物流服务商' : '新增物流服务商'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* 公司信息 */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 border-b pb-1">公司信息</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="companyName">公司名称 *</Label>
                      <Input
                        id="companyName"
                        placeholder="公司名称"
                        value={formData.companyName}
                        onChange={(e) => updateField('companyName', e.target.value)}
                        className={errors.companyName ? 'border-red-500' : ''}
                      />
                      {errors.companyName && (
                        <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="taxId">税号</Label>
                      <Input
                        id="taxId"
                        placeholder="统一社会信用代码"
                        value={formData.taxId}
                        onChange={(e) => updateField('taxId', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="companyAddress">公司地址</Label>
                    <Input
                      id="companyAddress"
                      placeholder="详细地址"
                      value={formData.companyAddress}
                      onChange={(e) => updateField('companyAddress', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>营业执照</Label>
                    <FileUpload
                      currentUrl={formData.businessLicense}
                      onUpload={(url) => updateField('businessLicense', url)}
                      accept="image/*"
                    />
                  </div>

                  {/* 法人信息 */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 border-b pb-1">法人信息</h4>
                  </div>
                  <div>
                    <Label htmlFor="legalRepName">法人姓名</Label>
                    <Input
                      id="legalRepName"
                      placeholder="法人姓名"
                      value={formData.legalRepName}
                      onChange={(e) => updateField('legalRepName', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>法人身份证正面</Label>
                      <FileUpload currentUrl={formData.legalRepIdFront} onUpload={(url) => updateField('legalRepIdFront', url)} accept="image/*" />
                    </div>
                    <div>
                      <Label>法人身份证反面</Label>
                      <FileUpload currentUrl={formData.legalRepIdBack} onUpload={(url) => updateField('legalRepIdBack', url)} accept="image/*" />
                    </div>
                  </div>

                  {/* 联系人信息 */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 border-b pb-1">联系人信息</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName">联系人 *</Label>
                      <Input
                        id="contactName"
                        placeholder="联系人姓名"
                        value={formData.contactName}
                        onChange={(e) => updateField('contactName', e.target.value)}
                        className={errors.contactName ? 'border-red-500' : ''}
                      />
                      {errors.contactName && (
                        <p className="text-red-500 text-xs mt-1">{errors.contactName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="contactPhone">联系电话 *</Label>
                      <Input
                        id="contactPhone"
                        placeholder="联系电话"
                        value={formData.contactPhone}
                        onChange={(e) => updateField('contactPhone', e.target.value)}
                        className={errors.contactPhone ? 'border-red-500' : ''}
                      />
                      {errors.contactPhone && (
                        <p className="text-red-500 text-xs mt-1">{errors.contactPhone}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>联系人身份证正面</Label>
                      <FileUpload currentUrl={formData.contactIdFront} onUpload={(url) => updateField('contactIdFront', url)} accept="image/*" />
                    </div>
                    <div>
                      <Label>联系人身份证反面</Label>
                      <FileUpload currentUrl={formData.contactIdBack} onUpload={(url) => updateField('contactIdBack', url)} accept="image/*" />
                    </div>
                  </div>

                  {/* 状态 */}
                  <div>
                    <Label htmlFor="formStatus">状态</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => updateField('status', value)}
                    >
                      <SelectTrigger id="formStatus">
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROVIDER_STATUS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 备注 */}
                  <div>
                    <Label htmlFor="notes">备注</Label>
                    <Input
                      id="notes"
                      placeholder="备注信息"
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsFormDialogOpen(false);
                      setEditingProvider(null);
                    }}
                  >
                    取消
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <CardContent>
          {/* 筛选栏 */}
          <form onSubmit={handleSearch} className="mb-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索公司名称/联系人/电话..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(PROVIDER_STATUS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline">
                搜索
              </Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                重置
              </Button>
            </div>
          </form>

          {/* 表格 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead>专线区域数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(providers) &&
                    providers.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">
                          {provider.companyName}
                        </TableCell>
                        <TableCell>{provider.contactName || '-'}</TableCell>
                        <TableCell>{provider.contactPhone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {provider._count?.quotations ?? 0} 条报价
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={STATUS_COLORS[provider.status] || 'bg-gray-100'}
                          >
                            {PROVIDER_STATUS[provider.status] || provider.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/logistics/providers/${provider.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              查看
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(provider)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                setDeletingProvider(provider);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              {providers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  暂无物流服务商数据
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    共 {total} 条记录，第 {page} / {totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除确认 Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              确定要删除物流服务商「{deletingProvider?.companyName}」吗？此操作不可撤销。
            </p>
            {deletingProvider?._count?.orders && deletingProvider._count.orders > 0 && (
              <p className="text-sm text-red-500 mt-2">
                注意：该服务商关联了 {deletingProvider._count.orders} 个物流订单，删除前请先处理订单。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingProvider(null);
              }}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
