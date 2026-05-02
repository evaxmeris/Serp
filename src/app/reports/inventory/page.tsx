/**
 * 库存报表页面
 * 展示库存数据和分析 - 支持日期范围和仓库筛选
 */

'use client';

import { useState } from 'react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function InventoryReportPage() {
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (lowStock) params.set('lowStock', 'true');
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const response = await fetch(`/api/v1/reports/inventory?${params}`);
      if (!response.ok) {
        throw new Error('请求失败');
      }
      const result = await response.json();
      const apiData = result.data;

      // 将 API 数据映射为前端展示格式
      const mappedData = {
        summary: {
          totalItems: apiData.summary.totalItems,
          totalQuantity: apiData.summary.totalQuantity,
          totalValue: apiData.summary.totalValue,
          lowStockItems: apiData.summary.lowStockItems,
          outOfStockItems: apiData.summary.outOfStockItems,
          overstockItems: apiData.summary.overstockItems
        },
        items: (apiData.items || []).map((item: any) => ({
          sku: item.product?.sku || item.product?.productNo || '-',
          name: item.product?.name || '未知产品',
          quantity: item.quantity,
          value: Number(item.quantity) * Number(item.product?.costPrice || 0),
          status: item.quantity <= 0 ? 'out' : item.quantity <= 10 ? 'low' : item.quantity > 999999 ? 'over' : 'normal'
        })),
        byCategory: (apiData.byCategory || []).map((cat: any) => ({
          name: cat.categoryName || cat.categoryId || '未知品类',
          items: cat.totalItems,
          value: Number(cat.totalValue)
        }))
      };
      setData(mappedData);
    } catch (error) {
      console.error('加载库存报表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!data) {
      toast.error('请先加载报表数据');
      return;
    }
    setExporting(true);
    setExportSuccess(false);
    try {
      // 调用真实导出 API
      const response = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'inventory',
          data,
          startDate,
          endDate,
          warehouseId,
          format: 'excel',
        }),
      });

      if (!response.ok) {
        throw new Error('导出请求失败');
      }

      // 尝试下载文件
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('spreadsheetml')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `库存报表_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(value);
  }

  function getStatusBadge(status: string) {
    const badges: any = {
      normal: 'bg-green-100 text-green-800',
      low: 'bg-yellow-100 text-yellow-800',
      out: 'bg-red-100 text-red-800',
      over: 'bg-blue-100 text-blue-800'
    };
    const labels: any = {
      normal: '正常',
      low: '低库存',
      out: '缺货',
      over: '超储'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">库存报表</h1>
            <p className="mt-2 text-gray-600">监控库存状态和周转情况</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={!data || exporting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  导出中...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  导出报表
                </>
              )}
            </button>
            <button
              onClick={loadReport}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '加载中...' : '刷新数据'}
            </button>
          </div>
        </div>

        {exportSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-800">报表导出成功！下载即将开始</span>
          </div>
        )}
      </div>

      {/* 筛选条件 - 始终显示 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">仓库</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部仓库</option>
              <option value="wh1">仓库 A</option>
              <option value="wh2">仓库 B</option>
              <option value="wh3">仓库 C</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={lowStock}
                onChange={(e) => setLowStock(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">只显示低库存</span>
            </label>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </div>
        </div>
      </div>

      {/* 关键指标卡片 */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">库存项数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.totalItems}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">总数量</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.totalQuantity}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">总价值</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data.summary.totalValue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">低库存</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{data.summary.lowStockItems}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">缺货</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{data.summary.outOfStockItems}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">超储</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{data.summary.overstockItems}</p>
            </div>
          </div>

          {/* 库存明细表格 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">库存明细</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">价值</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.items.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(item.value)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 按品类统计图表 */}
          {data.byCategory && data.byCategory.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">按品类分布图表</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'value') return [formatCurrency(value), '库存价值'];
                        return [value, name === 'items' ? '库存项数' : name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" name="value" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="items" fill="#22c55e" name="items" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 按品类统计明细 */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">按品类统计</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品类</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">库存项数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">库存价值</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">占比</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.byCategory.map((cat: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cat.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cat.items}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(cat.value)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {((cat.value / data.summary.totalValue) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 空状态 */}
      {!data && !loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">设置筛选条件后点击"查询"按钮加载库存报表数据</p>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
