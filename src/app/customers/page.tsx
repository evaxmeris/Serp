'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ToastContainer, useToast } from '@/components/ui/toast';
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
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Tag, CheckSquare, Square, Eye, Edit, Trash2 } from 'lucide-react';
import { CustomerBatchImportDialog } from '@/components/batch-operations/CustomerBatchImportDialog';
import { CustomerBatchTagsDialog } from '@/components/batch-operations/CustomerBatchTagsDialog';

interface Customer {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  status: string;
  tags?: string[];
  createdAt: string;
  _count?: {
    inquiries: number;
    orders: number;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CustomersPage() {
  const { toasts, removeToast, toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [newCustomer, setNewCustomer] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    country: '',
  });
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    country: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (customers.length > 0 && customers.length === selectedIds.size) {
          setSelectedIds(new Set());
        } else {
          setSelectedIds(new Set(customers.map(p => p.id)));
        }
        e.preventDefault();
      }
      // Esc 取消选择
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customers, selectedIds]);

  useEffect(() => {
    fetchCustomers();
    fetchAvailableTags();
  }, [search, page]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${search}&page=${page}&limit=20`);
      const data = await res.json();
      setCustomers(data.data || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const res = await fetch('/api/customers/tags');
      const data = await res.json();
      if (data.tags) {
        setAvailableTags(data.tags);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      const data = await res.json();

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewCustomer({
          companyName: '',
          contactName: '',
          email: '',
          phone: '',
          country: '',
        });
        fetchCustomers();
        toast.success('客户创建成功');
      } else {
        toast.error(`创建失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to create customer:', error);
      toast.error('创建失败，请重试');
    }
  };

  // 批量选择
  const toggleSelectAll = () => {
    if (customers.length === selectedIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleImportComplete = () => {
    fetchCustomers();
  };

  const handleTagsComplete = () => {
    fetchCustomers();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditForm({
      companyName: customer.companyName || '',
      contactName: customer.contactName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      country: customer.country || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingCustomer) return;
    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (res.ok) {
        setIsEditDialogOpen(false);
        setEditingCustomer(null);
        fetchCustomers();
        toast.success('客户更新成功');
      } else {
        toast.error(`更新失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to update customer:', error);
      toast.error('更新失败，请重试');
    }
  };

  const confirmDelete = (customer: Customer) => {
    setDeletingId(customer.id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/customers/${deletingId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchCustomers();
        toast.success('客户删除成功');
      } else {
        toast.error(`删除失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('删除失败，请重试');
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">客户管理</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                批量导入
              </Button>
              {selectedCount > 0 && (
                <Button variant="outline" onClick={() => setTagsDialogOpen(true)}>
                  <Tag className="h-4 w-4 mr-2" />
                  批量标签
                </Button>
              )}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新增客户
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增客户</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-company">公司名称 *</Label>
                      <Input
                        id="create-company"
                        placeholder="请输入公司名称"
                        value={newCustomer.companyName}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, companyName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-contact">联系人</Label>
                      <Input
                        id="create-contact"
                        placeholder="请输入联系人姓名"
                        value={newCustomer.contactName}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, contactName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-email">邮箱</Label>
                      <Input
                        id="create-email"
                        type="email"
                        placeholder="请输入邮箱"
                        value={newCustomer.email}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-phone">电话</Label>
                      <Input
                        id="create-phone"
                        placeholder="请输入电话号码"
                        value={newCustomer.phone}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-country">国家/地区</Label>
                      <Input
                        id="create-country"
                        placeholder="如：CN, US, DE"
                        value={newCustomer.country}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, country: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreate}>保存</Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="搜索客户..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCount === customers.length && customers.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>公司名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead>国家</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead className="text-center">询盘</TableHead>
                    <TableHead className="text-center">订单</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id} className={selectedIds.has(customer.id) ? 'bg-muted' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(customer.id)}
                          onCheckedChange={() => toggleSelect(customer.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer.companyName}
                      </TableCell>
                      <TableCell>{customer.contactName || '-'}</TableCell>
                      <TableCell>{customer.email || '-'}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell>{customer.country || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {customer.tags?.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {customer.tags && customer.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{customer.tags.length - 3}
                            </Badge>
                          )}
                          {(!customer.tags || customer.tags.length === 0) && '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{customer._count?.inquiries || 0}</TableCell>
                      <TableCell className="text-center">{customer._count?.orders || 0}</TableCell>
                      <TableCell>
                        {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleEdit(customer)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => confirmDelete(customer)}
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
            </div>
          )}

          {customers.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              暂无客户数据
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
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
                  disabled={page === pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}

          {/* 底部悬浮批量操作栏 */}
          {selectedCount > 0 && (
            <>
              <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
                <div className="container mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedCount === customers.length ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      已选择 {selectedCount} / {customers.length} 项
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                      取消选择 (Esc)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setTagsDialogOpen(true)}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      批量标签
                    </Button>
                  </div>
                </div>
              </div>
              <div className="h-20" />
            </>
          )}
        </CardContent>
      </Card>

      {/* 批量导入对话框 */}
      <CustomerBatchImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      {/* 批量标签对话框 */}
      <CustomerBatchTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        selectedCustomers={Array.from(selectedIds).map(id => {
          const customer = customers.find(c => c.id === id);
          return {
            id,
            companyName: customer?.companyName || '',
            tags: customer?.tags || [],
          };
        })}
        availableTags={availableTags}
        onComplete={handleTagsComplete}
      />

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑客户</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-company">公司名称 *</Label>
              <Input
                id="edit-company"
                placeholder="请输入公司名称"
                value={editForm.companyName}
                onChange={(e) =>
                  setEditForm({ ...editForm, companyName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact">联系人</Label>
              <Input
                id="edit-contact"
                placeholder="请输入联系人姓名"
                value={editForm.contactName}
                onChange={(e) =>
                  setEditForm({ ...editForm, contactName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">邮箱</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="请输入邮箱"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">电话</Label>
              <Input
                id="edit-phone"
                placeholder="请输入电话号码"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">国家/地区</Label>
              <Input
                id="edit-country"
                placeholder="如：CN, US, DE"
                value={editForm.country}
                onChange={(e) =>
                  setEditForm({ ...editForm, country: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              确定要删除这个客户吗？此操作不可撤销。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast 通知容器 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
