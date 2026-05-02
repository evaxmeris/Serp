/**
 * 数据仪表盘页面
 * 综合数据概览和关键指标 - 从真实 API 获取数据
 */

'use client';

import { useState, useEffect } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function DashboardPage() {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [period]);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period });
      const response = await fetch(`/api/v1/reports/dashboard?${params}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '获取数据失败');
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || '数据格式错误');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '加载仪表盘失败';
      console.error('加载仪表盘失败:', error);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  }

  function getTrendIcon(growth: number) {
    if (growth > 0) return <span className="text-green-600">↑</span>;
    if (growth < 0) return <span className="text-red-600">↓</span>;
    return <span className="text-gray-600">→</span>;
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
          <div className="flex items-center gap-3">
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
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : data ? (
        <>
          {/* KPI 卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
            {[
              { key: 'revenue', label: '销售额', isCurrency: true },
              { key: 'profit', label: '利润', isCurrency: true },
              { key: 'orders', label: '订单数', isCurrency: false },
              { key: 'customers', label: '客户数', isCurrency: false },
              { key: 'inventory', label: '库存数量', isCurrency: false },
            ].map((item) => {
              const kpi = data.kpis?.[item.key];
              if (!kpi) return null;
              return (
                <div key={item.key} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <p className="text-sm text-gray-600">{item.label}</p>
                  <div className="flex items-end justify-between mt-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {item.isCurrency ? formatCurrency(kpi.value) : kpi.value.toLocaleString()}
                    </p>
                    <div className={`flex items-center text-sm ${kpi.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {getTrendIcon(kpi.growth)}
                      <span className="ml-1">{Math.abs(kpi.growth)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top 产品和库存预警 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 产品 */}
            {data.topProducts && data.topProducts.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 产品</h2>
                <div className="space-y-4">
                  {data.topProducts.map((product: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-300'}`}>
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(product.revenue)}</p>
                        {product.growth !== undefined && (
                          <p className={`text-sm ${product.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {product.growth >= 0 ? '+' : ''}{product.growth}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 客户 */}
            {data.topCustomers && data.topCustomers.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 客户</h2>
                <div className="space-y-4">
                  {data.topCustomers.map((customer: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-300'}`}>
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{customer.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(customer.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 库存预警 */}
            {data.inventoryAlerts && data.inventoryAlerts.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">库存预警</h2>
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
            )}
          </div>

          {/* 销售趋势图表 */}
          {data.salesTrend && data.salesTrend.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">销售趋势图表</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number) => [formatCurrency(value), '销售额']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 销售趋势明细 */}
          {data.salesTrend && data.salesTrend.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">销售趋势</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">月份</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">销售额</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">环比</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.salesTrend.map((item: any, index: number) => {
                      const prevRevenue = index > 0 ? data.salesTrend[index - 1].revenue : 0;
                      const change = prevRevenue > 0 ? ((item.revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : '—';
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(item.revenue)}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${change !== '—' ? (Number(change) >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
                            {change !== '—' ? `${Number(change) >= 0 ? '+' : ''}${change}%` : change}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 待办事项 */}
          {data.tasks && data.tasks.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">待办事项</h2>
              <div className="space-y-2">
                {data.tasks.map((task: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{task.title}</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {task.count} 项
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <EmptyState
            title="暂无数据"
            description="暂无仪表盘数据，添加业务数据后将自动生成"
          />
        </div>
      )}
    </div>
  );
}
