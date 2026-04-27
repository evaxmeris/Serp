'use client';

/**
 * 物流服务商详情页面
 *
 * 功能：
 * - 显示服务商完整信息（含证件图片预览区）
 * - 下方显示该服务商的报价列表
 * - 报价可新增/编辑/删除
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  FileText,
} from 'lucide-react';
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

// 物流报价数据类型
interface LogisticsQuotation {
  id: string;
  providerId: string;
  region: string;
  transportMethod: string;
  transitDays: number;
  pricePerKg: number;
  pricePerCbm?: number | null;
  minimumCharge?: number;
  validFrom?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 状态标签映射
const PROVIDER_STATUS: Record<string, string> = {
  ACTIVE: '正常',
  INACTIVE: '停用',
  BLACKLISTED: '黑名单',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
};

// 运输方式标签
const TRANSPORT_METHOD: Record<string, string> = {
  SEA: '海运',
  AIR: '空运',
  LAND: '陆运',
  RAIL: '铁路',
  EXPRESS: '快递',
};

// 报价表单初始值
const emptyQuotationForm = {
  region: '',
  transportMethod: 'SEA',
  transitDays: 3,
  pricePerKg: 0,
  pricePerCbm: '',
  minimumCharge: '',
  validFrom: '',
  validUntil: '',
  notes: '',
};

export default function LogisticsProviderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const providerId = params.id as string;
  const { toasts, removeToast, toast } = useToast();

  // 服务商数据
  const [provider, setProvider] = useState<LogisticsProvider | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  // 报价数据
  const [quotations, setQuotations] = useState<LogisticsQuotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(true);

  // Dialog 状态
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<LogisticsQuotation | null>(null);
  const [deletingQuotation, setDeletingQuotation] = useState<LogisticsQuotation | null>(null);
  const [quotationForm, setQuotationForm] = useState(emptyQuotationForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quotationErrors, setQuotationErrors] = useState<Record<string, string>>({});

  // 加载服务商信息
  useEffect(() => {
    if (!providerId) return;
    fetchProvider();
    fetchQuotations();
  }, [providerId]);

  const fetchProvider = async () => {
    setLoadingProvider(true);
    try {
      // 直接调用 GET /api/v1/logistics/providers/[id] 获取服务商详情
      const res = await fetch(`/api/v1/logistics/providers/${providerId}`);
      const result = await res.json();

      if (result.success && result.data) {
        setProvider(result.data);
      }
    } catch (error) {
      console.error('获取服务商详情失败:', error);
    } finally {
      setLoadingProvider(false);
    }
  };

  const fetchQuotations = async () => {
    setLoadingQuotations(true);
    try {
      const res = await fetch(`/api/v1/logistics/providers/${providerId}/quotations`);
      const result = await res.json();
      const data = result.data ?? [];
      setQuotations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取报价列表失败:', error);
    } finally {
      setLoadingQuotations(false);
    }
  };

  // 打开新增报价 Dialog
  const openCreateQuotation = () => {
    setEditingQuotation(null);
    setQuotationForm(emptyQuotationForm);
    setQuotationErrors({});
    setIsFormDialogOpen(true);
  };

  // 打开编辑报价 Dialog
  const openEditQuotation = (q: LogisticsQuotation) => {
    setEditingQuotation(q);
    setQuotationForm({
      region: q.region || '',
      transportMethod: q.transportMethod || 'SEA',
      transitDays: q.transitDays || 3,
      pricePerKg: q.pricePerKg || 0,
      pricePerCbm: q.pricePerCbm != null ? String(q.pricePerCbm) : '',
      minimumCharge: q.minimumCharge != null ? String(q.minimumCharge) : '',
      validFrom: q.validFrom ? q.validFrom.slice(0, 10) : '',
      validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
      notes: q.notes || '',
    });
    setQuotationErrors({});
    setIsFormDialogOpen(true);
  };

  // 报价表单验证
  const validateQuotationForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!quotationForm.region.trim()) {
      newErrors.region = '区域不能为空';
    }
    if (!quotationForm.transportMethod) {
      newErrors.transportMethod = '运输方式不能为空';
    }
    if (!quotationForm.transitDays || Number(quotationForm.transitDays) <= 0) {
      newErrors.transitDays = '运输天数必须大于 0';
    }
    if (!quotationForm.pricePerKg || Number(quotationForm.pricePerKg) <= 0) {
      newErrors.pricePerKg = '单价(元/kg)必须大于 0';
    }
    setQuotationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存报价
  const handleSaveQuotation = async () => {
    if (!validateQuotationForm()) {
      toast.error('请修正表单错误');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...quotationForm,
        transitDays: Number(quotationForm.transitDays),
        pricePerKg: Number(quotationForm.pricePerKg),
        pricePerCbm: quotationForm.pricePerCbm ? Number(quotationForm.pricePerCbm) : undefined,
        minimumCharge: quotationForm.minimumCharge ? Number(quotationForm.minimumCharge) : undefined,
      };

      const url = editingQuotation
        ? `/api/v1/logistics/providers/${providerId}/quotations/${editingQuotation.id}`
        : `/api/v1/logistics/providers/${providerId}/quotations`;
      const method = editingQuotation ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(editingQuotation ? '报价更新成功' : '报价添加成功');
        setIsFormDialogOpen(false);
        setEditingQuotation(null);
        fetchQuotations();
      } else {
        toast.error(result.message || '操作失败');
      }
    } catch (error) {
      console.error('保存报价失败:', error);
      toast.error('操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除报价
  const handleDeleteQuotation = async () => {
    if (!deletingQuotation) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/logistics/providers/${providerId}/quotations/${deletingQuotation.id}`,
        { method: 'DELETE' }
      );
      const result = await res.json();
      if (result.success) {
        toast.success('报价删除成功');
        setIsDeleteDialogOpen(false);
        setDeletingQuotation(null);
        fetchQuotations();
      } else {
        toast.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除报价失败:', error);
      toast.error('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  // 更新报价表单字段
  const updateQuotationField = (field: string, value: string | number) => {
    setQuotationForm((prev) => ({ ...prev, [field]: value }));
    if (quotationErrors[field]) {
      setQuotationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // 证件图片预览组件
  const DocImagePreview = ({ src, label }: { src?: string | null; label: string }) => {
    if (!src) return null;
    return (
      <div className="border rounded-lg p-3 bg-gray-50">
        <p className="text-xs text-gray-500 mb-2">{label}</p>
        <img
          src={src}
          alt={label}
          className="max-h-48 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(src, '_blank')}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            img.parentElement!.innerHTML =
              '<p class="text-xs text-gray-400">图片加载失败</p>';
          }}
        />
      </div>
    );
  };

  if (loadingProvider) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="text-center py-16">加载中...</div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">物流服务商不存在</p>
          <Button onClick={() => router.push('/logistics/providers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8 space-y-6">
      {/* 返回按钮 */}
      <Button variant="ghost" onClick={() => router.push('/logistics/providers')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回列表
      </Button>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* 服务商基本信息 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{provider.companyName}</CardTitle>
            <Badge className={STATUS_COLORS[provider.status] || 'bg-gray-100'}>
              {PROVIDER_STATUS[provider.status] || provider.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 公司信息 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase">公司信息</h4>
              <div>
                <Label className="text-xs text-gray-400">公司名称</Label>
                <p className="text-sm font-medium">{provider.companyName}</p>
              </div>
              {provider.taxId && (
                <div>
                  <Label className="text-xs text-gray-400">税号</Label>
                  <p className="text-sm">{provider.taxId}</p>
                </div>
              )}
              {provider.companyAddress && (
                <div>
                  <Label className="text-xs text-gray-400">公司地址</Label>
                  <p className="text-sm">{provider.companyAddress}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-gray-400">创建时间</Label>
                <p className="text-sm">
                  {new Date(provider.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>

            {/* 法人信息 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase">法人信息</h4>
              {provider.legalRepName ? (
                <div>
                  <Label className="text-xs text-gray-400">法人姓名</Label>
                  <p className="text-sm">{provider.legalRepName}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">未填写</p>
              )}
            </div>

            {/* 联系人信息 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase">联系人信息</h4>
              <div>
                <Label className="text-xs text-gray-400">联系人</Label>
                <p className="text-sm font-medium">{provider.contactName}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-400">联系电话</Label>
                <p className="text-sm">{provider.contactPhone}</p>
              </div>
            </div>
          </div>

          {/* 证件图片预览 */}
          {(provider.businessLicense ||
            provider.legalRepIdFront ||
            provider.legalRepIdBack ||
            provider.contactIdFront ||
            provider.contactIdBack) && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">证件图片</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <DocImagePreview
                  src={provider.businessLicense}
                  label="营业执照"
                />
                <DocImagePreview
                  src={provider.legalRepIdFront}
                  label="法人身份证正面"
                />
                <DocImagePreview
                  src={provider.legalRepIdBack}
                  label="法人身份证反面"
                />
                <DocImagePreview
                  src={provider.contactIdFront}
                  label="联系人身份证正面"
                />
                <DocImagePreview
                  src={provider.contactIdBack}
                  label="联系人身份证反面"
                />
              </div>
            </div>
          )}

          {/* 备注 */}
          {provider.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <Label className="text-xs text-gray-400">备注</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{provider.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报价管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              报价列表
              <span className="text-sm text-gray-400 ml-2">
                ({quotations.length} 条)
              </span>
            </CardTitle>
            <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateQuotation}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增报价
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingQuotation ? '编辑报价' : '新增报价'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="region">线路/区域 *</Label>
                      <Input
                        id="region"
                        placeholder="如：欧洲、北美、东南亚"
                        value={quotationForm.region}
                        onChange={(e) => updateQuotationField('region', e.target.value)}
                        className={quotationErrors.region ? 'border-red-500' : ''}
                      />
                      {quotationErrors.region && (
                        <p className="text-red-500 text-xs mt-1">{quotationErrors.region}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="transportMethod">运输方式 *</Label>
                      <Select
                        value={quotationForm.transportMethod}
                        onValueChange={(v) => updateQuotationField('transportMethod', v)}
                      >
                        <SelectTrigger id="transportMethod">
                          <SelectValue placeholder="选择方式" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TRANSPORT_METHOD).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {quotationErrors.transportMethod && (
                        <p className="text-red-500 text-xs mt-1">
                          {quotationErrors.transportMethod}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="transitDays">运输天数 *</Label>
                      <Input
                        id="transitDays"
                        type="number"
                        min={1}
                        value={quotationForm.transitDays}
                        onChange={(e) =>
                          updateQuotationField('transitDays', Number(e.target.value))
                        }
                        className={quotationErrors.transitDays ? 'border-red-500' : ''}
                      />
                      {quotationErrors.transitDays && (
                        <p className="text-red-500 text-xs mt-1">
                          {quotationErrors.transitDays}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="pricePerKg">单价(元/kg) *</Label>
                      <Input
                        id="pricePerKg"
                        type="number"
                        step="0.01"
                        min={0}
                        value={quotationForm.pricePerKg}
                        onChange={(e) =>
                          updateQuotationField('pricePerKg', Number(e.target.value))
                        }
                        className={quotationErrors.pricePerKg ? 'border-red-500' : ''}
                      />
                      {quotationErrors.pricePerKg && (
                        <p className="text-red-500 text-xs mt-1">
                          {quotationErrors.pricePerKg}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pricePerCbm">单价(元/m³)</Label>
                      <Input
                        id="pricePerCbm"
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="按体积计价（可选）"
                        value={quotationForm.pricePerCbm}
                        onChange={(e) => updateQuotationField('pricePerCbm', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="minimumCharge">最低收费</Label>
                      <Input
                        id="minimumCharge"
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="最低收费（可选）"
                        value={quotationForm.minimumCharge}
                        onChange={(e) => updateQuotationField('minimumCharge', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="validFrom">生效日期</Label>
                      <Input
                        id="validFrom"
                        type="date"
                        value={quotationForm.validFrom}
                        onChange={(e) => updateQuotationField('validFrom', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="validUntil">失效日期</Label>
                      <Input
                        id="validUntil"
                        type="date"
                        value={quotationForm.validUntil}
                        onChange={(e) => updateQuotationField('validUntil', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="quotationNotes">备注</Label>
                    <Input
                      id="quotationNotes"
                      placeholder="备注信息"
                      value={quotationForm.notes}
                      onChange={(e) => updateQuotationField('notes', e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsFormDialogOpen(false);
                      setEditingQuotation(null);
                    }}
                  >
                    取消
                  </Button>
                  <Button onClick={handleSaveQuotation} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingQuotations ? (
            <div className="text-center py-8">加载报价中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>线路/区域</TableHead>
                    <TableHead>运输方式</TableHead>
                    <TableHead>运输天数</TableHead>
                    <TableHead>单价(元/kg)</TableHead>
                    <TableHead>单价(元/m³)</TableHead>
                    <TableHead>最低收费</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.region}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TRANSPORT_METHOD[q.transportMethod] || q.transportMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>{q.transitDays} 天</TableCell>
                      <TableCell>¥{q.pricePerKg?.toFixed(2)}</TableCell>
                      <TableCell>
                        {q.pricePerCbm != null ? `¥${q.pricePerCbm.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {q.minimumCharge != null ? `¥${q.minimumCharge.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {q.validFrom || q.validUntil ? (
                          <>
                            {q.validFrom
                              ? new Date(q.validFrom).toLocaleDateString('zh-CN')
                              : '不限'}
                            {' ~ '}
                            {q.validUntil
                              ? new Date(q.validUntil).toLocaleDateString('zh-CN')
                              : '不限'}
                          </>
                        ) : (
                          '永久有效'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditQuotation(q)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setDeletingQuotation(q);
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

              {quotations.length === 0 && !loadingQuotations && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  暂无报价数据，点击「新增报价」添加
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除报价确认 Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除报价</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              确定要删除「{deletingQuotation?.region}」(
              {TRANSPORT_METHOD[deletingQuotation?.transportMethod || ''] || '-'}
              ) 的报价吗？此操作不可撤销。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingQuotation(null);
              }}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteQuotation}
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
