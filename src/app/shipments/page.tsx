'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, Edit, Truck } from 'lucide-react';

/**
 * 发货管理页面
 * 管理出库单的发货信息，包括物流公司、运单号等
 */

interface Shipment {
  id: string;
  outboundOrderId: string;
  logisticsCompany?: string;
  trackingNo?: string;
  shippedAt?: string;
  deliveryAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  packages?: number;
  grossWeight?: number;
  volume?: number;
  shippingCost?: number;
  notes?: string;
  outboundOrder: {
    id: string;
    outboundNo: string;
    status: string;
    items: {
      id: string;
      productId: string;
      quantity: number;
      product: {
        id: string;
        name: string;
        sku: string;
      };
    }[];
  };
}

interface ShipmentsResponse {
  success: boolean;
  data: {
    items: Shipment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export default function ShipmentsPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 编辑对话框状态
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    logisticsCompany: '',
    trackingNo: '',
    deliveryAddress: '',
    receiverName: '',
    receiverPhone: '',
    packages: '',
    grossWeight: '',
    volume: '',
    shippingCost: '',
    notes: '',
    shippedAt: '',
  });

  /**
   * 获取发货列表
   */
  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
      });

      const res = await fetch(`/api/v1/shipments?${params}`);
      const data: ShipmentsResponse = await res.json();

      if (data.success) {
        setShipments(data.data.items);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [page]);

  /**
   * 处理搜索
   */
  const handleSearch = () => {
    setPage(1);
    fetchShipments();
  };

  /**
   * 打开编辑对话框
   */
  const handleEdit = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setEditForm({
      logisticsCompany: shipment.logisticsCompany || '',
      trackingNo: shipment.trackingNo || '',
      deliveryAddress: shipment.deliveryAddress || '',
      receiverName: shipment.receiverName || '',
      receiverPhone: shipment.receiverPhone || '',
      packages: shipment.packages?.toString() || '',
      grossWeight: shipment.grossWeight?.toString() || '',
      volume: shipment.volume?.toString() || '',
      shippingCost: shipment.shippingCost?.toString() || '',
      notes: shipment.notes || '',
      shippedAt: shipment.shippedAt ? new Date(shipment.shippedAt).toISOString().slice(0, 16) : '',
    });
    setShowEditDialog(true);
  };

  /**
   * 保存发货信息
   */
  const handleSave = async () => {
    if (!editingShipment) return;

    try {
      const res = await fetch('/api/v1/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: editingShipment.id,
          ...editForm,
          packages: editForm.packages ? parseInt(editForm.packages) : undefined,
          grossWeight: editForm.grossWeight ? parseFloat(editForm.grossWeight) : undefined,
          volume: editForm.volume ? parseFloat(editForm.volume) : undefined,
          shippingCost: editForm.shippingCost ? parseFloat(editForm.shippingCost) : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert('发货信息保存成功');
        setShowEditDialog(false);
        fetchShipments();
      } else {
        alert(data.message || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save shipment:', error);
      alert('保存失败');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">发货管理</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="搜索物流单号、收货人..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>

          {/* 数据表格 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>出库单号</TableHead>
                    <TableHead>物流公司</TableHead>
                    <TableHead>物流单号</TableHead>
                    <TableHead>收货人</TableHead>
                    <TableHead>发货时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    shipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">
                          {shipment.outboundOrder.outboundNo}
                        </TableCell>
                        <TableCell>
                          {shipment.logisticsCompany || '-'}
                        </TableCell>
                        <TableCell>
                          {shipment.trackingNo || '-'}
                        </TableCell>
                        <TableCell>
                          {shipment.receiverName || '-'}
                        </TableCell>
                        <TableCell>
                          {shipment.shippedAt
                            ? new Date(shipment.shippedAt).toLocaleString('zh-CN')
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(shipment)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    共 {total} 条记录，第 {page}/{totalPages} 页
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

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑发货信息</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label>物流公司</Label>
              <Input
                value={editForm.logisticsCompany}
                onChange={(e) => setEditForm({ ...editForm, logisticsCompany: e.target.value })}
                placeholder="如：顺丰、DHL 等"
              />
            </div>
            <div>
              <Label>物流单号</Label>
              <Input
                value={editForm.trackingNo}
                onChange={(e) => setEditForm({ ...editForm, trackingNo: e.target.value })}
                placeholder="运单号"
              />
            </div>
            <div className="col-span-2">
              <Label>收货地址</Label>
              <Input
                value={editForm.deliveryAddress}
                onChange={(e) => setEditForm({ ...editForm, deliveryAddress: e.target.value })}
                placeholder="详细收货地址"
              />
            </div>
            <div>
              <Label>收货人</Label>
              <Input
                value={editForm.receiverName}
                onChange={(e) => setEditForm({ ...editForm, receiverName: e.target.value })}
                placeholder="收货人姓名"
              />
            </div>
            <div>
              <Label>收货电话</Label>
              <Input
                value={editForm.receiverPhone}
                onChange={(e) => setEditForm({ ...editForm, receiverPhone: e.target.value })}
                placeholder="联系电话"
              />
            </div>
            <div>
              <Label>包裹数</Label>
              <Input
                type="number"
                value={editForm.packages}
                onChange={(e) => setEditForm({ ...editForm, packages: e.target.value })}
                placeholder="包裹数量"
              />
            </div>
            <div>
              <Label>毛重 (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.grossWeight}
                onChange={(e) => setEditForm({ ...editForm, grossWeight: e.target.value })}
                placeholder="毛重"
              />
            </div>
            <div>
              <Label>体积 (m³)</Label>
              <Input
                type="number"
                step="0.001"
                value={editForm.volume}
                onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                placeholder="体积"
              />
            </div>
            <div>
              <Label>运费</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.shippingCost}
                onChange={(e) => setEditForm({ ...editForm, shippingCost: e.target.value })}
                placeholder="运费金额"
              />
            </div>
            <div className="col-span-2">
              <Label>备注</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="备注信息"
              />
            </div>
            <div className="col-span-2">
              <Label>发货时间</Label>
              <Input
                type="datetime-local"
                value={editForm.shippedAt}
                onChange={(e) => setEditForm({ ...editForm, shippedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
