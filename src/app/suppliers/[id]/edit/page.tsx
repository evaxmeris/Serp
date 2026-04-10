'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastContainer, useToast } from '@/components/ui/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

interface Supplier {
  id: string;
  supplierNo: string;
  companyName: string;
  companyEn?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  website?: string;
  products?: string;
  status: string;
  type: string;
  level: string;
  creditTerms?: string;
  currency?: string;
  notes?: string;
}

const SUPPLIER_STATUS: Record<string, string> = {
  ACTIVE: '正常',
  INACTIVE: '停用',
  BLACKLISTED: '黑名单',
  PENDING: '待审核',
};

const SUPPLIER_TYPE: Record<string, string> = {
  DOMESTIC: '国内供应商',
  OVERSEAS: '海外供应商',
};

const SUPPLIER_LEVEL: Record<string, string> = {
  STRATEGIC: '战略供应商',
  PREFERRED: '优选供应商',
  NORMAL: '普通供应商',
  RESTRICTED: '限制供应商',
};

export default function SupplierEditPage() {
  const params = useParams();
  const router = useRouter();
  const { toasts, removeToast, toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    companyEn: '',
    contactName: '',
    contactTitle: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    city: '',
    province: '',
    country: '',
    website: '',
    products: '',
    status: 'ACTIVE',
    type: 'DOMESTIC',
    level: 'NORMAL',
    creditTerms: '',
    currency: 'CNY',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supplierId = params.id as string;

  // 邮箱验证
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // 允许为空
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 电话验证（支持国际格式）
  const validatePhone = (phone: string): boolean => {
    if (!phone) return true; // 允许为空
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = '公司名称不能为空';
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = '电话格式不正确';
    }

    if (formData.mobile && !validatePhone(formData.mobile)) {
      newErrors.mobile = '手机格式不正确';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    fetchSupplier();
  }, [supplierId]);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/suppliers/${supplierId}`);
      const result = await res.json();

      if (result.success && result.data) {
        const data = result.data;
        setSupplier(data);
        setFormData({
          companyName: data.companyName || '',
          companyEn: data.companyEn || '',
          contactName: data.contactName || '',
          contactTitle: data.contactTitle || '',
          email: data.email || '',
          phone: data.phone || '',
          mobile: data.mobile || '',
          address: data.address || '',
          city: data.city || '',
          province: data.province || '',
          country: data.country || '',
          website: data.website || '',
          products: data.products || '',
          status: data.status || 'ACTIVE',
          type: data.type || 'DOMESTIC',
          level: data.level || 'NORMAL',
          creditTerms: data.creditTerms || '',
          currency: data.currency || 'CNY',
          notes: data.notes || '',
        });
      } else {
        alert('加载供应商信息失败');
        router.push('/suppliers');
      }
    } catch (error) {
      console.error('Failed to fetch supplier:', error);
      alert('加载失败');
      router.push('/suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 表单验证
    if (!validateForm()) {
      toast.error('请修正表单错误');
      return;
    }
    
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (result.success) {
        toast.success('供应商信息已更新');
        setTimeout(() => {
          router.push(`/suppliers/${supplierId}`);
        }, 1000);
      } else {
        toast.error(`更新失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to update supplier:', error);
      toast.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/suppliers/${supplierId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl">编辑供应商 - {supplier?.companyName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>公司名称 *</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                  className={errors.companyName ? 'border-red-500' : ''}
                />
                {errors.companyName && (
                  <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
                )}
              </div>
              <div>
                <Label>英文名称</Label>
                <Input
                  value={formData.companyEn}
                  onChange={(e) => setFormData({ ...formData, companyEn: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>联系人</Label>
                <Input
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>
              <div>
                <Label>职位</Label>
                <Input
                  value={formData.contactTitle}
                  onChange={(e) => setFormData({ ...formData, contactTitle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>邮箱</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <Label>电话</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>手机</Label>
                <Input
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className={errors.mobile ? 'border-red-500' : ''}
                />
                {errors.mobile && (
                  <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>
                )}
              </div>
              <div>
                <Label>国家/地区</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>地址</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>城市</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label>省份</Label>
                <Input
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                />
              </div>
              <div>
                <Label>网站</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>主营产品</Label>
              <Input
                value={formData.products}
                onChange={(e) => setFormData({ ...formData, products: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUPPLIER_STATUS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>类型</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUPPLIER_TYPE).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>等级</Label>
                <Select
                  value={formData.level}
                  onValueChange={(value) => setFormData({ ...formData, level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUPPLIER_LEVEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>信用条款</Label>
                <Input
                  value={formData.creditTerms}
                  onChange={(e) => setFormData({ ...formData, creditTerms: e.target.value })}
                />
              </div>
              <div>
                <Label>币种</Label>
                <Input
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>备注</Label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[100px]"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/suppliers/${supplierId}`)}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Toast 通知容器 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
