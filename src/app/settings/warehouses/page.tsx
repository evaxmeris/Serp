'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Search, Package } from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  manager: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

interface WarehouseFormData {
  name: string;
  code: string;
  address: string;
  manager: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const emptyForm: WarehouseFormData = {
  name: '',
  code: '',
  address: '',
  manager: '',
  phone: '',
  status: 'ACTIVE',
};

export default function WarehouseSettingsPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState<WarehouseFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Warehouse | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/v1/warehouses?${params}`);
      const data = await res.json();

      if (data.success) {
        setWarehouses(data.data.items || []);
        setTotal(data.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchWarehouses();
  };

  const openCreateDialog = () => {
    setEditingWarehouse(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || '',
      manager: warehouse.manager || '',
      phone: warehouse.phone || '',
      status: warehouse.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('请输入仓库名称');
      return;
    }
    if (!formData.code.trim()) {
      alert('请输入仓库编码');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingWarehouse
        ? `/api/v1/warehouses/${editingWarehouse.id}`
        : '/api/v1/warehouses';

      const method = editingWarehouse ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        alert(editingWarehouse ? '仓库更新成功' : '仓库创建成功');
        setDialogOpen(false);
        fetchWarehouses();
      } else {
        alert(data.message || '操作失败');
      }
    } catch (error) {
      console.error('Failed to submit:', error);
      alert('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (warehouse: Warehouse) => {
    try {
      const res = await fetch(`/api/v1/warehouses/${warehouse.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        alert('仓库删除成功');
        setDeleteConfirm(null);
        fetchWarehouses();
      } else {
        alert(data.message || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('删除失败');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-2xl">仓库管理</CardTitle>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              新建仓库
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 搜索和筛选 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="搜索仓库名称、编码、地址..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="ACTIVE">启用中</SelectItem>
                <SelectItem value="INACTIVE">已停用</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead>仓库编码</TableHead>
                    <TableHead>仓库名称</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>联系电话</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        暂无仓库数据，请点击"新建仓库"添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    warehouses.map((wh) => (
                      <TableRow key={wh.id}>
                        <TableCell>
                          <Badge variant="secondary">{wh.code}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{wh.name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {wh.address || '-'}
                        </TableCell>
                        <TableCell>{wh.manager || '-'}</TableCell>
                        <TableCell>{wh.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={wh.status === 'ACTIVE' ? 'default' : 'destructive'}>
                            {wh.status === 'ACTIVE' ? '启用中' : '已停用'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(wh)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeleteConfirm(wh)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {total > 20 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">共 {total} 条记录</div>
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
                      disabled={warehouses.length < 20}
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

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWarehouse ? '编辑仓库' : '新建仓库'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>仓库名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：深圳主仓库"
                />
              </div>
              <div>
                <Label>仓库编码 *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="如：SZ-MAIN"
                  className="uppercase"
                />
              </div>
            </div>
            <div>
              <Label>仓库地址</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="详细地址"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>负责人</Label>
                <Input
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  placeholder="负责人姓名"
                />
              </div>
              <div>
                <Label>联系电话</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="联系电话"
                />
              </div>
            </div>
            <div>
              <Label>状态</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as 'ACTIVE' | 'INACTIVE' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用中</SelectItem>
                  <SelectItem value="INACTIVE">已停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              确定要删除仓库 <strong>{deleteConfirm?.name}</strong> 吗？
            </p>
            <p className="text-sm text-gray-500 mt-2">
              如果该仓库有关联的库存记录或出入库单，将无法删除。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
