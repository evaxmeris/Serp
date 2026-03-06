'use client';

import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn: string | null;
  category: string | null;
  specification: string | null;
  unit: string;
  costPrice: number;
  salePrice: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    nameEn: '',
    category: '',
    specification: '',
    unit: 'PCS',
    costPrice: '',
    salePrice: '',
    currency: 'USD',
  });

  useEffect(() => {
    fetchProducts();
  }, [search, statusFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          costPrice: parseFloat(newProduct.costPrice) || 0,
          salePrice: parseFloat(newProduct.salePrice) || 0,
        }),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewProduct({
          sku: '',
          name: '',
          nameEn: '',
          category: '',
          specification: '',
          unit: 'PCS',
          costPrice: '',
          salePrice: '',
          currency: 'USD',
        });
        fetchProducts();
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">产品管理</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>新增产品</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>新增产品</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <Input
                    placeholder="SKU *"
                    value={newProduct.sku}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, sku: e.target.value })
                    }
                  />
                  <Input
                    placeholder="产品名称 *"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="英文名称"
                    value={newProduct.nameEn}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, nameEn: e.target.value })
                    }
                  />
                  <Input
                    placeholder="分类"
                    value={newProduct.category}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, category: e.target.value })
                    }
                  />
                  <Input
                    placeholder="规格"
                    value={newProduct.specification}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, specification: e.target.value })
                    }
                  />
                  <Select
                    value={newProduct.unit}
                    onValueChange={(value) =>
                      setNewProduct({ ...newProduct, unit: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="单位" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PCS">PCS (件)</SelectItem>
                      <SelectItem value="SET">SET (套)</SelectItem>
                      <SelectItem value="KG">KG (千克)</SelectItem>
                      <SelectItem value="M">M (米)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="成本价"
                    type="number"
                    step="0.01"
                    value={newProduct.costPrice}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, costPrice: e.target.value })
                    }
                  />
                  <Input
                    placeholder="销售价"
                    type="number"
                    step="0.01"
                    value={newProduct.salePrice}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, salePrice: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleCreate}>保存</Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="搜索 SKU 或名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="ACTIVE">在售</SelectItem>
                <SelectItem value="DISCONTINUED">停产</SelectItem>
                <SelectItem value="DEVELOPING">开发中</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>英文名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>成本价</TableHead>
                  <TableHead>销售价</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.sku}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.nameEn || '-'}</TableCell>
                    <TableCell>{product.category || '-'}</TableCell>
                    <TableCell>{product.specification || '-'}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>
                      {product.currency} {product.costPrice.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {product.currency} {product.salePrice.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          product.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : product.status === 'DISCONTINUED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {product.status === 'ACTIVE'
                          ? '在售'
                          : product.status === 'DISCONTINUED'
                          ? '停产'
                          : '开发中'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {products.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              暂无产品数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
