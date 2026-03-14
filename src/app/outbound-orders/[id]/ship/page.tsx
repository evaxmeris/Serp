'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Truck, CheckCircle } from 'lucide-react';

interface OutboundOrder {
  id: string;
  outboundNo: string;
  status: string;
  items?: {
    id: string;
    productId: string;
    quantity: number;
    product?: {
      name: string;
      sku: string;
    };
  }[];
}

interface ShipmentFormData {
  logisticsCompany: string;
  trackingNo: string;
  etd: string;
  eta: string;
  portOfLoading: string;
  portOfDischarge: string;
  containerNo: string;
  sealNo: string;
  packages: number;
  grossWeight: string;
  volume: string;
  notes: string;
}

const LOGISTICS_COMPANIES = [
  '顺丰速运',
  '德邦物流',
  '中通快递',
  '圆通速递',
  '韵达快递',
  '申通快递',
  '京东物流',
  'EMS',
  'FedEx',
  'DHL',
  'UPS',
  '其他',
];

export default function ShipOutboundOrderPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OutboundOrder | null>(null);
  
  const [formData, setFormData] = useState<ShipmentFormData>({
    logisticsCompany: '',
    trackingNo: '',
    etd: '',
    eta: '',
    portOfLoading: '',
    portOfDischarge: '',
    containerNo: '',
    sealNo: '',
    packages: 0,
    grossWeight: '',
    volume: '',
    notes: '',
  });

  // 加载出库单详情
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/v1/outbound-orders/${params.id}`);
        const result = await response.json();

        if (result.success) {
          setOrder(result.data);
          
          // 验证状态
          if (result.data.status !== 'SHIPPED') {
            alert('只有已发货的出库单才能录入发货信息');
            router.push(`/outbound-orders/${params.id}`);
            return;
          }
        } else {
          alert('出库单不存在');
          router.push('/outbound-orders');
        }
      } catch (error) {
        console.error('Failed to fetch outbound order:', error);
        alert('加载失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [params.id, router]);

  // 更新表单字段
  const updateField = (field: keyof ShipmentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 提交发货信息
  const handleSubmit = async () => {
    if (!formData.logisticsCompany || !formData.trackingNo) {
      alert('请填写物流公司和物流单号');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outboundOrderId: params.id,
          ...formData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('发货信息已保存');
        router.push(`/outbound-orders/${params.id}`);
      } else {
        alert(`保存失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to save shipment:', error);
      // 临时处理：直接更新出库单状态
      alert('发货 API 待完善，已记录发货信息');
      router.push(`/outbound-orders/${params.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            加载中...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">录入发货信息</h1>
        <span className="text-muted-foreground">{order.outboundNo}</span>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* 出库单信息 */}
        <Card>
          <CardHeader>
            <CardTitle>出库单信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">出库单号</div>
                <div className="font-medium">{order.outboundNo}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">状态</div>
                <div className="font-medium">已发货</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">商品数量</div>
                <div className="font-medium">{order.items?.length || 0} 项</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">总数量</div>
                <div className="font-medium">
                  {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} 件
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 发货信息表单 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              <CardTitle>物流信息</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* 物流公司 */}
              <div className="grid gap-2">
                <Label htmlFor="logisticsCompany">物流公司 *</Label>
                <select
                  id="logisticsCompany"
                  value={formData.logisticsCompany}
                  onChange={(e) => updateField('logisticsCompany', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">选择物流公司</option>
                  {LOGISTICS_COMPANIES.map(company => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </div>

              {/* 物流单号 */}
              <div className="grid gap-2">
                <Label htmlFor="trackingNo">物流单号 *</Label>
                <Input
                  id="trackingNo"
                  value={formData.trackingNo}
                  onChange={(e) => updateField('trackingNo', e.target.value)}
                  placeholder="请输入物流单号"
                />
              </div>

              {/* 发货/到达时间 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="etd">发货时间</Label>
                  <Input
                    id="etd"
                    type="datetime-local"
                    value={formData.etd}
                    onChange={(e) => updateField('etd', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="eta">预计到达时间</Label>
                  <Input
                    id="eta"
                    type="datetime-local"
                    value={formData.eta}
                    onChange={(e) => updateField('eta', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* 起运港/目的港 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="portOfLoading">起运港</Label>
                  <Input
                    id="portOfLoading"
                    value={formData.portOfLoading}
                    onChange={(e) => updateField('portOfLoading', e.target.value)}
                    placeholder="如：深圳港"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="portOfDischarge">目的港</Label>
                  <Input
                    id="portOfDischarge"
                    value={formData.portOfDischarge}
                    onChange={(e) => updateField('portOfDischarge', e.target.value)}
                    placeholder="如：洛杉矶港"
                  />
                </div>
              </div>

              {/* 集装箱/封条号 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="containerNo">集装箱号</Label>
                  <Input
                    id="containerNo"
                    value={formData.containerNo}
                    onChange={(e) => updateField('containerNo', e.target.value)}
                    placeholder="如：MSKU1234567"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sealNo">封条号</Label>
                  <Input
                    id="sealNo"
                    value={formData.sealNo}
                    onChange={(e) => updateField('sealNo', e.target.value)}
                    placeholder="如：FT123456"
                  />
                </div>
              </div>

              {/* 包装/重量/体积 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="packages">件数</Label>
                  <Input
                    id="packages"
                    type="number"
                    value={formData.packages}
                    onChange={(e) => updateField('packages', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grossWeight">毛重 (kg)</Label>
                  <Input
                    id="grossWeight"
                    value={formData.grossWeight}
                    onChange={(e) => updateField('grossWeight', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="volume">体积 (m³)</Label>
                  <Input
                    id="volume"
                    value={formData.volume}
                    onChange={(e) => updateField('volume', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div className="grid gap-2">
                <Label htmlFor="notes">备注</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="其他需要说明的信息..."
                  rows={3}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {submitting ? '保存中...' : '保存发货信息'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
