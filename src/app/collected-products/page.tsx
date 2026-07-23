'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/card';
import { Download, RefreshCw, CheckCircle, XCircle, Eye, Trash2, Globe } from 'lucide-react';

const STATUS_OPTIONS = [
  { key: '', label: '全部', color: '' },
  { key: 'collected', label: '待梳理', color: 'bg-gray-100 text-gray-700' },
  { key: 'organizing', label: '梳理中', color: 'bg-blue-100 text-blue-700' },
  { key: 'ready', label: '梳理完成', color: 'bg-cyan-100 text-cyan-700' },
  { key: 'published', label: '已发布', color: 'bg-green-100 text-green-700' },
  { key: 'error', label: '发布失败', color: 'bg-red-100 text-red-700' },
  { key: 'discarded', label: '已废弃', color: 'bg-gray-100 text-gray-400' },
];

const SOURCE_OPTIONS = [
  { key: '', label: '全部平台' },
  { key: 'alibaba', label: '阿里国际站' },
  { key: '1688', label: '1688' },
];

interface Product {
  id: string;
  title: string;
  titleEn: string | null;
  source: string;
  pipelineStatus: string;
  price: number | null;
  currency: string;
  hasImage: boolean;
  hasVariants: boolean;
  productId: string | null;
  woocommerceId: number | null;
  collectedAt: string;
}

export default function CollectedProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const resp = await fetch(`/api/collected-products?${params}`);
      const data = await resp.json();
      if (data.success && data.data) {
        setProducts(data.data.items);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sourceFilter, debouncedSearch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // 切筛选时回到第一页
  useEffect(() => { setPage(1); }, [statusFilter, sourceFilter, debouncedSearch]);

  const selectedCount = selectedIds.size;

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.key === status);
    if (!opt || !opt.color) return null;
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  const getSourceLabel = (source: string) => {
    const opt = SOURCE_OPTIONS.find(s => s.key === source);
    return opt?.label || source;
  };

  const handleBatchPublish = async () => {
    if (selectedCount === 0) return;
    const resp = await fetch('/api/collected-products/batch-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    const data = await resp.json();
    if (data.success) {
      alert(`批量发布完成：成功 ${data.data.success} 个，失败 ${data.data.failed} 个`);
      fetchProducts();
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          {/* 状态标签页 */}
          <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-3 mb-4">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setStatusFilter(opt.key); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                  statusFilter === opt.key
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 操作栏 */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="搜索标题/SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              >
                {SOURCE_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchProducts}>
              <RefreshCw className="h-4 w-4 mr-1" /> 刷新
            </Button>
          </div>

          {/* 批量操作栏 */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-md">
              <span className="text-sm text-blue-700">已选 {selectedCount} 项</span>
              <Button size="sm" onClick={handleBatchPublish}>
                <Globe className="h-4 w-4 mr-1" /> 发布到独立站
              </Button>
            </div>
          )}

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 w-8">
                    <input
                      type="checkbox"
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(new Set(products.map(p => p.id)));
                        else setSelectedIds(new Set());
                      }}
                      checked={products.length > 0 && selectedIds.size === products.length}
                    />
                  </th>
                  <th className="pb-2 px-2">主图</th>
                  <th className="pb-2 px-2">标题</th>
                  <th className="pb-2 px-2">来源</th>
                  <th className="pb-2 px-2">价格</th>
                  <th className="pb-2 px-2">状态</th>
                  <th className="pb-2 px-2">Woo ID</th>
                  <th className="pb-2 px-2">采集时间</th>
                  <th className="pb-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">加载中...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">暂无采集产品</td></tr>
                ) : products.map(p => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/collected-products/${p.id}`)}
                  >
                    <td className="py-2.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className={`w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-xs`}>
                        {p.hasImage ? '🖼' : '📷'}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 max-w-xs">
                      <div className="truncate font-medium">{p.titleEn || p.title}</div>
                      {p.titleEn && <div className="truncate text-gray-400 text-xs">{p.title}</div>}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="text-xs text-gray-500">{getSourceLabel(p.source)}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      {p.price ? `${p.currency} ${p.price}` : '-'}
                    </td>
                    <td className="py-2.5 px-2">{getStatusBadge(p.pipelineStatus)}</td>
                    <td className="py-2.5 px-2 text-xs text-gray-400">
                      {p.woocommerceId || '-'}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-gray-500">
                      {new Date(p.collectedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/collected-products/${p.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
            <span className="text-sm text-gray-500">共 {total} 条</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
