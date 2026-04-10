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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  id: string;
  orderNo: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  status: string;
}

interface BatchResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

interface OrderBatchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrders: OrderItem[];
  onConfirmComplete: (result: BatchResult) => void;
}

export function OrderBatchConfirmDialog({
  open,
  onOpenChange,
  selectedOrders,
  onConfirmComplete,
}: OrderBatchConfirmDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  // 只允许确认待确认订单
  const validOrders = selectedOrders.filter(o => o.status === 'PENDING');
  const invalidOrders = selectedOrders.filter(o => o.status !== 'PENDING');

  const handleConfirm = async () => {
    if (validOrders.length === 0) {
      alert('没有可确认的订单');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/orders/batch/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: validOrders.map(o => o.id),
        }),
      });

      const batchResult: BatchResult = await response.json();
      setResult(batchResult);
      onConfirmComplete(batchResult);
    } catch (error) {
      setResult({
        total: validOrders.length,
        success: 0,
        failed: validOrders.length,
        errors: [{
          id: '',
          message: error instanceof Error ? error.message : '批量确认失败',
        }],
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setProcessing(false);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>批量确认订单</DialogTitle>
          <DialogDescription>
            批量确认选中的待确认订单，确认后订单状态将变为"已确认"
          </DialogDescription>
        </DialogHeader>

        {/* 无效订单提示 */}
        {invalidOrders.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="font-medium text-yellow-600">
                有 {invalidOrders.length} 个订单无法确认
              </p>
            </div>
            <p className="text-sm text-yellow-600">
              只有状态为"待确认"的订单才能确认，这些订单将被跳过
            </p>
          </div>
        )}

        {/* 订单预览 */}
        {!result && (
          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>当前状态</TableHead>
                  <TableHead>可确认</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={order.status !== 'PENDING' ? 'bg-gray-50' : ''}
                  >
                    <TableCell className="font-medium">{order.orderNo}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-right">
                      {order.currency} {order.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge>{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {order.status === 'PENDING' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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

            {result.success === result.total && invalidOrders.length === 0 && (
              <div className="flex items-center justify-center p-4 text-green-600 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                <span>全部确认成功！</span>
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
              onClick={handleConfirm}
              disabled={processing || validOrders.length === 0}
            >
              {processing ? '确认中...' : `确认 ${validOrders.length} 个订单`}
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
