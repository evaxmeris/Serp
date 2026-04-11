'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface PurchaseOrder {
  id: string;
  poNo: string;
  status: string;
  currency: string;
  totalAmount: number;
  deliveryDate: string | null;
  paymentTerms: string | null;
  notes: string | null;
  supplierId: string;
}

const PURCHASE_STATUS: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PRODUCTION: '生产中',
  READY: '待收货',
  RECEIVED: '已收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export default function PurchaseEditPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    currency: '',
    deliveryDate: '',
    paymentTerms: '',
    notes: '',
    totalAmount: 0,
  });

  useEffect(() => {
    if (params.id) {
      fetchPurchaseDetail(params.id as string);
    }
  }, [params.id]);

  const fetchPurchaseDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases/${id}`);
      const data = await res.json();
      if (data) {
        setPurchase(data);
        setFormData({
          status: data.status,
          currency: data.currency,
          deliveryDate: data.deliveryDate ? data.deliveryDate.split('T')[0] : '',
          paymentTerms: data.paymentTerms || '',
          notes: data.notes || '',
          totalAmount: data.totalAmount,
        });
      }
    } catch (error) {
      console.error('Failed to fetch purchase detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!purchase) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalAmount: parseFloat(formData.totalAmount as unknown as string),
          deliveryDate: formData.deliveryDate || null,
        }),
      });

      if (res.ok) {
        toast.success('采购单更新成功');
        router.push(`/purchases/${purchase.id}`);
      } else {
        toast.error('更新采购单失败');
      }
    } catch (error) {
      console.error('Failed to update purchase:', error);
      toast.error('更新采购单失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">采购单不存在</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">编辑采购单 {purchase.poNo}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">状态</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURCHASE_STATUS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">币种</label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNY">CNY - 人民币</SelectItem>
                    <SelectItem value="USD">USD - 美元</SelectItem>
                    <SelectItem value="EUR">EUR - 欧元</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">交货日期</label>
                <Input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">付款条件</label>
                <Input
                  placeholder="月结 30 天等"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">总金额</label>
              <Input
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">备注</label>
              <Input
                placeholder="备注信息"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => router.back()}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
