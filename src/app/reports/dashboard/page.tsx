/**
 * 数据仪表盘页面
 * 综合数据概览和关键指标
 */

'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // 示例仪表盘数据
  const sampleData = {
    kpis: {
      revenue: { value: 2580000, growth: 12.5, trend: 'up' },
      profit: { value: 380000, growth: 8.3, trend: 'up' },
      orders: { value: 1250, growth: -3.2, trend: 'down' },
      customers: { value: 380, growth: 15.8, trend: 'up' },
      inventory: { value: 4580000, growth: 5.1, trend: 'up' }
    },
    topProducts: [
      { name: '产品 A', revenue: 450000, growth: 25 },
      { name: '产品 B', revenue: 380000, growth: 18 },
      { name: '产品 C', revenue: 320000, growth: -5 }
    ],
    inventoryAlerts: [
      { sku: 'PROD-002', name: '产品 B', quantity: 50, type: 'low' },
      { sku: 'PROD-003', name: '产品 C', quantity: 0, type: 'out' }
    ]
  };

  useEffect(() => {
    loadDashboard();
  }, [period]);

  async function loadDashboard() {
    setLoading(true);
    try {
      setData(sampleData);
    } catch (error) {
      console.error('加载仪表盘失败:', error);
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

  function getTrendIcon(trend: string) {
    if (trend === 'up') {
      return <span className="text-green-600">↑</span>;
    } else if (trend === 'down') {
      return <span className="text-red-600">↓</span>;
    }
    return <span className="text-gray-600">→</span>;
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">数据仪表盘</h1>
          <p className="mt-2 text-gray-600">企业经营数据概览</p>
        </div>
        <div className="text-center py-12 text-gray-500">
          <p>请选择统计周期并点击「加载报表」查看数据</p>
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
            <h1 className="text-3xl font-bold text-gray-900">数据仪表盘</h1>
            <p className="mt-2 text-gray-600">企业经营数据概览</p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="week">本周</option>
            <option value="month">本月</option>
            <option value="quarter">本季</option>
            <option value="year">本年</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : data ? (
        <>
          {/* KPI 卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
            {Object.entries(data.kpis).map(([key, value]: [string, any]) => (
              <div key={key} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <p className="text-sm text-gray-600">
                  {key === 'revenue' && '销售额'}
                  {key === 'profit' && '利润'}
                  {key === 'orders' && '订单数'}
                  {key === 'customers' && '客户数'}
                  {key === 'inventory' && '库存价值'}
                </p>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {key === 'orders' || key === 'customers' ? value.value.toLocaleString() : formatCurrency(value.value)}
                  </p>
                  <div className={`flex items-center text-sm ${value.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getTrendIcon(value.trend)}
                    <span className="ml-1">{Math.abs(value.growth)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Top 产品和库存预警 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 产品 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🏆 Top 产品</h2>
              <div className="space-y-4">
                {data.topProducts.map((product: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'}`}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(product.revenue)}</p>
                      <p className={`text-sm ${product.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {product.growth >= 0 ? '+' : ''}{product.growth}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 库存预警 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 库存预警</h2>
              <div className="space-y-3">
                {data.inventoryAlerts.map((alert: any, index: number) => (
                  <div key={index} className={`p-3 rounded-lg ${alert.type === 'out' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{alert.name}</p>
                        <p className="text-sm text-gray-600">SKU: {alert.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${alert.type === 'out' ? 'text-red-600' : 'text-yellow-600'}`}>
                          库存：{alert.quantity}
                        </p>
                        <p className={`text-sm ${alert.type === 'out' ? 'text-red-600' : 'text-yellow-600'}`}>
                          {alert.type === 'out' ? '缺货' : '低库存'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500">暂无数据</p>
        </div>
      )}
    </div>
  );
}
