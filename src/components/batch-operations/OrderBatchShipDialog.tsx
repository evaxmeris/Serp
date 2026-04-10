'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
}

interface BatchResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

const COMMON_CARRIERS = [
  { value: 'DHL', label: 'DHL' },
  { value: 'UPS', label: 'UPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'USPS', label: 'USPS' },
  { value: '中国邮政', label: '中国邮政' },
  { value: '顺丰速运', label: '顺丰速运' },
  { value: '圆通速递', label: '圆通速递' },
  { value: '中通快递', label: '中通快递' },
  { value: '韵达快递', label: '韵达快递' },
  { value: '申通快递', label: '申通快递' },
];

interface OrderBatchShipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrders: OrderItem[];
  onShipComplete: (result: BatchResult) => void;
}

export function OrderBatchShipDialog({
  open,
  onOpenChange,
  selectedOrders,
  onShipComplete,
}: OrderBatchShipDialogProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [carrier, setCarrier] = useState('');
  const [customCarrier, setCustomCarrier] = useState('');
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [sendNotification, setSendNotification] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // 只允许发货已确认且未发货的订单
  const validOrders = selectedOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'READY');
  const invalidOrders = selectedOrders.filter(o => !(o.status === 'CONFIRMED' || o.status === 'READY'));

  // 下载模板
  const downloadTemplate = () => {
    const csvContent = '订单号,跟踪号\n' + 'ORDER123,TRACK456789\n' + 'ORDER124,TRACK987654';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracking-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 处理 CSV 上传
  const handleCsvUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter(line => line.trim());
      const trackingMap: Record<string, string> = {};
      
      // 跳过表头
      for (let i = 1; i < lines.length; i++) {
        const [orderNo, trackingNo] = lines[i].split(',').map(s => s.trim());
        // 根据订单号匹配订单
        const order = validOrders.find(o => o.orderNo === orderNo);
        if (order && trackingNo) {
          trackingMap[order.id] = trackingNo;
        }
      }
      
      setTrackingNumbers(trackingMap);
    };
    reader.readAsText(file);
  };

  // 更新跟踪号
  const updateTrackingNumber = (orderId: string, tracking: string) => {
    setTrackingNumbers(prev => ({
      ...prev,
      [orderId]: tracking,
    }));
  };

  // 获取实际使用的承运人
  const getEffectiveCarrier = () => {
    if (carrier === 'other') {
      return customCarrier;
    }
    return carrier;
  };

  // 检查是否所有必填项都已填写
  const isComplete = () => {
    return validOrders.every(o => trackingNumbers[o.id] && getEffectiveCarrier());
  };

  const handleShip = async () => {
    const effectiveCarrier = getEffectiveCarrier();
    if (!effectiveCarrier) {
      alert('请选择或输入物流服务商');
      return;
    }

    if (!isComplete()) {
      if (!confirm('还有订单未填写跟踪号，确认继续？')) {
        return;
      }
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/orders/batch/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: validOrders.map(o => o.id),
          carrier: effectiveCarrier,
          trackingNumbers,
          sendNotification,
        }),
      });

      const batchResult: BatchResult = await response.json();
      setResult(batchResult);
      onShipComplete(batchResult);
    } catch (error) {
      setResult({
        total: validOrders.length,
        success: 0,
        failed: validOrders.length,
        errors: [{
          id: '',
          message: error instanceof Error ? error.message : '批量发货失败',
        }],
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setActiveTab('manual');
    setCarrier('');
    setCustomCarrier('');
    setTrackingNumbers({});
    setSendNotification(true);
    setProcessing(false);
    setResult(null);
    setCsvFile(null);
    onOpenChange(false);
  };

  const filledCount = Object.keys(trackingNumbers).filter(id => trackingNumbers[id]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量发货</DialogTitle>
          <DialogDescription>
            对已确认订单进行批量发货操作
          </DialogDescription>
        </DialogHeader>

        {/* 无效订单提示 */}
        {invalidOrders.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="font-medium text-yellow-600">
                有 {invalidOrders.length} 个订单无法发货
              </p>
            </div>
            <p className="text-sm text-yellow-600">
              只有已确认且未发货的订单才能发货，这些订单将被跳过
            </p>
          </div>
        )}

        {!result && validOrders.length > 0 && (
          <>
            {/* 物流服务商 */}
            <div className="space-y-2">
              <Label>物流服务商</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择物流服务商" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CARRIERS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
              {carrier === 'other' && (
                <Input
                  placeholder="请输入物流服务商名称"
                  value={customCarrier}
                  onChange={(e) => setCustomCarrier(e.target.value)}
                />
              )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">手动填写</TabsTrigger>
                <TabsTrigger value="csv">CSV 批量导入</TabsTrigger>
              </TabsList>

              <TabsContent value="manual">
                <div className="border rounded-lg max-h-[300px] overflow-y-auto mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>订单号</TableHead>
                        <TableHead>客户</TableHead>
                        <TableHead>跟踪号</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNo}</TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell>
                            <Input
                              placeholder="输入跟踪号"
                              value={trackingNumbers[order.id] || ''}
                              onChange={(e) => updateTrackingNumber(order.id, e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  已填写 {filledCount} / {validOrders.length} 个跟踪号
                </p>
              </TabsContent>

              <TabsContent value="csv">
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      上传 CSV 文件，第一列为订单号，第二列为跟踪号
                    </p>
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      下载模板
                    </Button>
                  </div>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="mb-2 text-sm text-gray-600">
                      {csvFile ? `已选择：${csvFile.name}` : '拖拽 CSV 文件到此处或点击选择'}
                    </p>
                    <label>
                      <Button variant="outline" size="sm" className="cursor-pointer">
                        选择文件
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCsvFile(file);
                              handleCsvUpload(file);
                            }
                          }}
                        />
                      </Button>
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    已匹配 {filledCount} / {validOrders.length} 个跟踪号
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendNotification"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked as boolean)}
              />
              <Label htmlFor="sendNotification" className="font-normal">
                发货后发送通知给客户
              </Label>
            </div>
          </>
        )}

        {/* 处理结果 */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">总计</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-50">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-sm text-muted-foreground">成功</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-yellow-50">
                <p className="text-2xl font-bold text-yellow-600">{invalidOrders.length}</p>
                <p className="text-sm text-muted-foreground">跳过</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-50">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-sm text-muted-foreground">失败</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="font-medium text-red-600">错误信息</p>
                </div>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.success === result.total && (
              <div className="flex items-center justify-center p-4 text-green-600 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                <span>全部发货成功！</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? '关闭' : '取消'}
          </Button>
          {!result && (
            <Button
              onClick={handleShip}
              disabled={processing || validOrders.length === 0}
            >
              {processing ? '发货中...' : `确认发货 ${validOrders.length} 个订单`}
            </Button>
          )}
          {result && result.success > 0 && (
            <Button
              onClick={() => {
                handleClose();
                window.location.reload();
              }}
            >
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
