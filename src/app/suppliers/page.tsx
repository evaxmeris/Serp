'use client';

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
import { Plus, Search, Eye, Edit } from 'lucide-react';

interface Supplier {
  id: string;
  supplierNo: string;
  companyName: string;
  companyEn?: string;
  contactName: string | null;
  contactTitle?: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
  website: string | null;
  products: string | null;
  status: string;
  type: string;
  level: string;
  creditTerms: string | null;
  currency?: string;
  _count?: {
    purchaseOrders: number;
  };
  createdAt: string;
}

const SUPPLIER_STATUS: Record<string, string> = {
  ACTIVE: '正常',
  INACTIVE: '停用',
  BLACKLISTED: '黑名单',
  PENDING: '待审核',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

const SUPPLIER_TYPE: Record<string, string> = {
  DOMESTIC: '国内',
  OVERSEAS: '海外',
};

const SUPPLIER_LEVEL: Record<string, string> = {
  STRATEGIC: '战略',
  PREFERRED: '优选',
  NORMAL: '普通',
  RESTRICTED: '限制',
};

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    companyName: '',
    companyEn: '',
    contactName: '',
    contactTitle: '',
    email: '',
    phone: '',
    mobile: '',
    country: 'CN',
    address: '',
    website: '',
    products: '',
    creditTerms: '',
    notes: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, [page, search, statusFilter, typeFilter, levelFilter]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (levelFilter !== 'all') params.append('level', levelFilter);

      const res = await fetch(`/api/v1/suppliers?${params}`);
      const result: any = await res.json();
      const suppliersData = Array.isArray(result?.data)
        ? result?.data
        : result?.data?.items || [];
      setSuppliers(suppliersData);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotal(result.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
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
    setTypeFilter('all');
    setLevelFilter('all');
    setPage(1);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/v1/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewSupplier({
          companyName: '',
          companyEn: '',
          contactName: '',
          contactTitle: '',
          email: '',
          phone: '',
          mobile: '',
          country: 'CN',
          address: '',
          website: '',
          products: '',
          creditTerms: '',
          notes: '',
        });
        fetchSuppliers();
      }
    } catch (error) {
      console.error('Failed to create supplier:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">供应商管理</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新增供应商
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>新增供应商</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">公司名称 *</label>
                      <Input
                        placeholder="公司名称"
                        value={newSupplier.companyName}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, companyName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">英文名称</label>
                      <Input
                        placeholder="Company Name"
                        value={newSupplier.companyEn}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, companyEn: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">联系人</label>
                      <Input
                        placeholder="联系人姓名"
                        value={newSupplier.contactName}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, contactName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">职位</label>
                      <Input
                        placeholder="职位"
                        value={newSupplier.contactTitle}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, contactTitle: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">邮箱</label>
                      <Input
                        placeholder="email@example.com"
                        type="email"
                        value={newSupplier.email}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">电话</label>
                      <Input
                        placeholder="电话号码"
                        value={newSupplier.phone}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">手机</label>
                    <Input
                      placeholder="手机号码"
                      value={newSupplier.mobile}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, mobile: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">国家/地区</label>
                      <Input
                        placeholder="CN"
                        value={newSupplier.country}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, country: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">城市</label>
                      <Input
                        placeholder="城市"
                        value={newSupplier.address}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, address: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">网站</label>
                    <Input
                      placeholder="https://example.com"
                      value={newSupplier.website}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, website: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">供应产品</label>
                    <Input
                      placeholder="主要产品"
                      value={newSupplier.products}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, products: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">账期</label>
                    <Input
                      placeholder="如：月结 30 天"
                      value={newSupplier.creditTerms}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, creditTerms: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">备注</label>
                    <Input
                      placeholder="备注信息"
                      value={newSupplier.notes}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? '保存中...' : '保存'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <form onSubmit={handleSearch} className="mb-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索供应商..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="ACTIVE">正常</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                  <SelectItem value="BLACKLISTED">黑名单</SelectItem>
                  <SelectItem value="PENDING">待审核</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="DOMESTIC">国内</SelectItem>
                  <SelectItem value="OVERSEAS">海外</SelectItem>
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部等级</SelectItem>
                  <SelectItem value="STRATEGIC">战略</SelectItem>
                  <SelectItem value="PREFERRED">优选</SelectItem>
                  <SelectItem value="NORMAL">普通</SelectItem>
                  <SelectItem value="RESTRICTED">限制</SelectItem>
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

          {/* Table */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>供应商编号</TableHead>
                    <TableHead>公司名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>等级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>采购单</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(suppliers) && suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium text-sm">
                        {supplier.supplierNo}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{supplier.companyName}</div>
                          {supplier.companyEn && (
                            <div className="text-sm text-gray-500">{supplier.companyEn}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.contactName || '-'}</TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SUPPLIER_TYPE[supplier.type] || supplier.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SUPPLIER_LEVEL[supplier.level] || supplier.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[supplier.status] || 'bg-gray-100'}>
                          {SUPPLIER_STATUS[supplier.status] || supplier.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier._count?.purchaseOrders || 0}</TableCell>
                      <TableCell>
                        {new Date(supplier.createdAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/suppliers/${supplier.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {suppliers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  暂无供应商数据
                </div>
              )}

              {/* Pagination */}
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
    </div>
  );
}
