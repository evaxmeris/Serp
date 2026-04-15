/**
 * 库存报表页面
 * 展示库存数据和分析
 */

'use client';

import { useState } from 'react';

export default function InventoryReportPage() {
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // 示例库存数据
  const sampleData = {
    summary: {
      totalItems: 2500,
      totalQuantity: 15800,
      totalValue: 4580000,
      lowStockItems: 45,
      outOfStockItems: 12,
      overstockItems: 28
    },
    items: [
      { sku: 'PROD-001', name: '产品 A', quantity: 500, value: 125000, status: 'normal' },
      { sku: 'PROD-002', name: '产品 B', quantity: 50, value: 15000, status: 'low' },
      { sku: 'PROD-003', name: '产品 C', quantity: 0, value: 0, status: 'out' },
      { sku: 'PROD-004', name: '产品 D', quantity: 2000, value: 480000, status: 'over' }
    ],
    byCategory: [
      { name: '电子产品', items: 800, value: 1850000 },
      { name: '服装服饰', items: 650, value: 980000 },
      { name: '家居用品', items: 520, value: 750000 },
      { name: '其他', items: 530, value: 1000000 }
    ]
  };

  async function loadReport() {
    setLoading(true);
    try {
      setData(sampleData);
    } catch (error) {
      console.error('加载库存报表失败:', error);
    } finally {
      setLoading(false);
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

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">库存报表</h1>
          <p className="mt-2 text-gray-600">分析库存结构和周转情况</p>
        </div>
        <div className="text-center py-12 text-gray-500">
          <p>请选择统计条件并点击「加载报表」查看数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">库存报表</h1>
            <p className="mt-2 text-gray-600">监控库存状态和周转情况</p>
          </div>
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '加载中...' : '刷新数据'}
          </button>
        </div>
      </div>

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              查询
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
        </>
      )}

      {/* 空状态 */}
      {!data && !loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">点击"查询"按钮加载库存报表数据</p>
        </div>
      )}
    </div>
  );
}
