/**
 * 销售报表页面
 * 展示销售数据和分析
 */

'use client';

import { useState } from 'react';

export default function SalesReportPage() {
  const [period, setPeriod] = useState('month');
  const [groupBy, setGroupBy] = useState('category');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // 示例销售数据
  const sampleData = {
    summary: {
      totalRevenue: 2580000,
      totalOrders: 1250,
      totalQuantity: 8500,
      averageOrderValue: 2064,
      totalCustomers: 380
    },
    groupedData: [
      { name: '电子产品', revenue: 850000, orders: 420, quantity: 2800 },
      { name: '服装服饰', revenue: 620000, orders: 380, quantity: 3200 },
      { name: '家居用品', revenue: 480000, orders: 250, quantity: 1500 },
      { name: '美妆护肤', revenue: 380000, orders: 150, quantity: 800 },
      { name: '其他', revenue: 250000, orders: 50, quantity: 200 }
    ],
    trends: [
      { date: '2026-03-01', revenue: 85000, orders: 42 },
      { date: '2026-03-05', revenue: 92000, orders: 45 },
      { date: '2026-03-10', revenue: 78000, orders: 38 },
      { date: '2026-03-15', revenue: 105000, orders: 52 }
    ]
  };

  async function loadReport() {
    setLoading(true);
    try {
      // TODO: 调用 API 获取实际数据
      setData(sampleData);
    } catch (error) {
      console.error('加载销售报表失败:', error);
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">销售报表</h1>
            <p className="mt-2 text-gray-600">分析销售数据和业绩表现</p>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期间类型</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="day">按日</option>
              <option value="week">按周</option>
              <option value="month">按月</option>
              <option value="quarter">按季</option>
              <option value="year">按年</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分组维度</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="category">按品类</option>
              <option value="product">按产品</option>
              <option value="customer">按客户</option>
              <option value="salesRep">按销售员</option>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">销售总额</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data.summary.totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">订单总数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.totalOrders}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">销售数量</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.totalQuantity}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">平均订单</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.summary.averageOrderValue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">客户数量</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{data.summary.totalCustomers}</p>
            </div>
          </div>

          {/* 分组数据表格 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">按{groupBy === 'category' ? '品类' : groupBy === 'product' ? '产品' : groupBy === 'customer' ? '客户' : '销售员'}统计</h2>
            {/* BUG-S6-003 修复：添加 overflow-x-auto 容器，优化移动端样式 */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">销售额</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">订单数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">占比</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.groupedData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(item.revenue)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.orders}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {((item.revenue / data.summary.totalRevenue) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 趋势图表 */}
          {data.trends && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">销售趋势</h2>
              {/* BUG-S6-003 修复：添加 overflow-x-auto 容器，优化移动端样式 */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">日期</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">销售额</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">订单数</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">日均订单</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.trends.map((trend: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{trend.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(trend.revenue)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trend.orders}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round(trend.revenue / (trend.orders || 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 空状态 */}
      {!data && !loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">点击"查询"按钮加载销售报表数据</p>
        </div>
      )}
    </div>
  );
}
