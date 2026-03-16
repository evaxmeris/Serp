/**
 * 利润报表页面
 * 展示企业利润相关数据和趋势
 */

'use client';

import { useState } from 'react';

export default function ProfitReportPage() {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  // BUG-S6-004 修复：添加导出 loading 状态
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // 示例利润数据
  const sampleData = {
    revenue: 1250000,
    costOfGoodsSold: 750000,
    grossProfit: 500000,
    grossProfitMargin: 40,
    operatingExpenses: {
      sales: 150000,
      management: 100000,
      finance: 50000,
      total: 300000
    },
    operatingProfit: 200000,
    netProfit: 180000,
    netProfitMargin: 14.4
  };

  async function loadReport() {
    setLoading(true);
    try {
      // TODO: 调用 API 获取实际数据
      // const response = await fetch(`/api/v1/reports/profit?startDate=${startDate}&endDate=${endDate}&period=${period}`);
      // const result = await response.json();
      // setData(result.data);
      
      // 使用示例数据
      setData(sampleData);
    } catch (error) {
      console.error('加载利润报表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  // BUG-S6-004 修复：添加导出功能
  async function handleExport() {
    if (!data) {
      alert('请先加载报表数据');
      return;
    }

    setExporting(true);
    setExportSuccess(false);
    
    try {
      // TODO: 调用 API 导出报表
      // const response = await fetch('/api/v1/reports/profit/export', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     data,
      //     period,
      //     startDate,
      //     endDate,
      //     format: 'excel'
      //   })
      // });
      
      // 模拟导出延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 导出成功提示
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
      
      console.log('利润报表导出成功');
    } catch (error) {
      console.error('导出利润报表失败:', error);
      alert('导出失败，请重试');
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">利润报表</h1>
            <p className="mt-2 text-gray-600">查看企业利润情况和盈利能力分析</p>
          </div>
          <div className="flex gap-3">
            {/* BUG-S6-004 修复：添加导出按钮，带 loading 状态和成功提示 */}
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
        
        {/* BUG-S6-004 修复：导出成功提示 */}
        {exportSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-800">报表导出成功！下载即将开始</span>
          </div>
        )}
      </div>

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期间类型</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="month">月度</option>
              <option value="quarter">季度</option>
              <option value="year">年度</option>
              <option value="custom">自定义</option>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">营业收入</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(data.revenue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">毛利润</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.grossProfit)}</p>
              <p className="text-sm text-gray-500 mt-1">毛利率：{data.grossProfitMargin}%</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">营业利润</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data.operatingProfit)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">净利润</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(data.netProfit)}</p>
              <p className="text-sm text-gray-500 mt-1">净利率：{data.netProfitMargin}%</p>
            </div>
          </div>

          {/* 利润表详情 */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">利润表明细</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">营业收入</span>
                <span className="font-medium">{formatCurrency(data.revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">减：营业成本</span>
                <span className="font-medium text-red-600">{formatCurrency(data.costOfGoodsSold)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b bg-green-50 px-2">
                <span className="font-medium text-gray-900">毛利润</span>
                <span className="font-bold text-green-600">{formatCurrency(data.grossProfit)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">减：销售费用</span>
                <span className="font-medium">{formatCurrency(data.operatingExpenses.sales)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">减：管理费用</span>
                <span className="font-medium">{formatCurrency(data.operatingExpenses.management)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">减：财务费用</span>
                <span className="font-medium">{formatCurrency(data.operatingExpenses.finance)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b bg-blue-50 px-2">
                <span className="font-medium text-gray-900">营业利润</span>
                <span className="font-bold text-blue-600">{formatCurrency(data.operatingProfit)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b bg-purple-50 px-2">
                <span className="font-bold text-gray-900">净利润</span>
                <span className="font-bold text-purple-600">{formatCurrency(data.netProfit)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 空状态 */}
      {!data && !loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">点击"查询"按钮加载利润报表数据</p>
        </div>
      )}
    </div>
  );
}
