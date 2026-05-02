/**
 * 利润报表页面
 * 展示企业利润相关数据和趋势 — 接入真实 API 数据
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

// ============================================
// 类型定义
// ============================================

interface ProfitSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: {
    platformFee: number;
    logisticsFee: number;
    otherFees: number;
    total: number;
  };
  netProfit: number;
  netProfitMargin: number;
  orderCount: number;
}

interface TrendItem {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface GroupedItem {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  orderCount: number;
}

interface CompareData {
  revenue: number;
  cost: number;
  profit: number;
  revenueGrowth: number;
  costGrowth: number;
  profitGrowth: number;
}

interface ProfitReportData {
  summary: ProfitSummary;
  trends: TrendItem[];
  groupedData: GroupedItem[] | null;
  compare: CompareData | null;
  yoy: CompareData | null;
  period: { start: string; end: string; type: string };
}

// ============================================
// 默认日期范围：最近3个月
// ============================================

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function ProfitReportPage() {
  const defaults = getDefaultDateRange();
  const [period, setPeriod] = useState('month');
  const [groupBy, setGroupBy] = useState('none');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [compare, setCompare] = useState(true);
  const [yoy, setYoy] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfitReportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  // 自动加载
  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        period,
        compare: String(compare),
        yoy: String(yoy),
      });
      if (groupBy !== 'none') {
        params.set('groupBy', groupBy);
      }

      const response = await fetch(
        `/api/v1/reports/profit?${params.toString()}`,
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${response.status})`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '数据获取失败');
      }
      setData(result.data);
    } catch (err) {
      console.error('加载利润报表失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!data) {
      toast.warning('请先加载报表数据');
      return;
    }
    setExporting(true);
    setExportSuccess(false);
    try {
      // 调用导出 API
      const response = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'profit',
          data,
          period,
          startDate,
          endDate,
          format: 'excel',
        }),
      });

      if (response.ok) {
        // 尝试下载
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `利润报表_${startDate}_${endDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('导出利润报表失败:', error);
      toast.warning('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(value);
  }

  function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  function renderGrowthBadge(value: number) {
    if (value === 0) return <span className="text-gray-500">持平</span>;
    const isPositive = value > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 text-sm font-medium ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
      </span>
    );
  }

  return (
    <>
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">利润报表</h1>
            <p className="mt-2 text-gray-600">
              查看企业利润情况和盈利能力分析（自动从订单/采购/物流数据计算）
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={!data || exporting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  导出中...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
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
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-green-800">报表导出成功！</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <span className="text-red-800">{error}</span>
          </div>
        )}
      </div>

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              期间类型
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="month">月度</option>
              <option value="quarter">季度</option>
              <option value="year">年度</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分组维度
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">不分组 (汇总)</option>
              <option value="product">按产品</option>
              <option value="customer">按客户</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              对比上期
            </label>
            <div className="flex items-center h-[42px]">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-600">启用</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              同比(上年同期)
            </label>
            <div className="flex items-center h-[42px]">
              <input
                type="checkbox"
                checked={yoy}
                onChange={(e) => setYoy(e.target.checked)}
                className="h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="ml-2 text-sm text-gray-600">启用</span>
            </div>
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

      {/* 加载状态 */}
      {loading && (
        <div className="bg-white rounded-lg shadow-md p-12 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-6 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-6">
                <Skeleton className="h-5 w-36 mb-4" />
                <Skeleton className="h-48 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 数据内容 */}
      {!loading && data && (
        <>
          {/* 利润汇总卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">营业收入</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(data.summary.totalRevenue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.summary.orderCount} 笔订单
              </p>
              {data.compare && (
                <div className="mt-1 text-xs">
                  环比: {renderGrowthBadge(data.compare.revenueGrowth)}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">总成本</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(data.summary.totalCost)}
              </p>
              <p className="text-xs text-gray-400 mt-1">含采购 + 物流 + 平台费</p>
              {data.compare && (
                <div className="mt-1 text-xs">
                  环比: {renderGrowthBadge(data.compare.costGrowth)}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">毛利润</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(data.summary.grossProfit)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                毛利率：{data.summary.grossProfitMargin}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">净利润</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {formatCurrency(data.summary.netProfit)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                净利率：{data.summary.netProfitMargin}%
              </p>
              {data.compare && (
                <div className="mt-1 text-xs">
                  环比: {renderGrowthBadge(data.compare.profitGrowth)}
                </div>
              )}
            </div>
          </div>

          {/* 费用构成 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 利润表明细 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                利润表明细
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">营业收入</span>
                  <span className="font-medium">
                    {formatCurrency(data.summary.totalRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">减：采购成本</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(data.summary.totalCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b bg-green-50 px-2">
                  <span className="font-medium text-gray-900">毛利润</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(data.summary.grossProfit)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({data.summary.grossProfitMargin}%)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">减：物流费用</span>
                  <span className="font-medium">
                    {formatCurrency(data.summary.operatingExpenses.logisticsFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">减：平台费用</span>
                  <span className="font-medium">
                    {formatCurrency(data.summary.operatingExpenses.platformFee)}
                  </span>
                  <span className="text-xs text-gray-400">(估算 5%)</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">减：其他费用</span>
                  <span className="font-medium">
                    {formatCurrency(data.summary.operatingExpenses.otherFees)}
                  </span>
                  <span className="text-xs text-gray-400">(估算 1%)</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b bg-purple-50 px-2">
                  <span className="font-bold text-gray-900">净利润</span>
                  <span className="font-bold text-purple-600">
                    {formatCurrency(data.summary.netProfit)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({data.summary.netProfitMargin}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 费用构成概况 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                费用构成
              </h2>
              {data.summary.totalRevenue > 0 ? (
                <div className="space-y-6">
                  {/* 水平柱状图 - 费用构成 */}
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        { name: '采购成本', 金额: data.summary.totalCost, fill: '#ef4444' },
                        { name: '物流费用', 金额: data.summary.operatingExpenses.logisticsFee, fill: '#eab308' },
                        { name: '平台费用', 金额: data.summary.operatingExpenses.platformFee, fill: '#f97316' },
                        { name: '其他费用', 金额: data.summary.operatingExpenses.otherFees, fill: '#6b7280' },
                      ]}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                      <Bar dataKey="金额" fill="#8884d8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* 百分比明细 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: '采购成本', value: data.summary.totalCost, color: 'text-red-600' },
                      { label: '物流费用', value: data.summary.operatingExpenses.logisticsFee, color: 'text-yellow-600' },
                      { label: '平台费用', value: data.summary.operatingExpenses.platformFee, color: 'text-orange-600' },
                      { label: '其他费用', value: data.summary.operatingExpenses.otherFees, color: 'text-gray-600' },
                    ].map((item) => {
                      const pct = data.summary.totalRevenue > 0
                        ? ((item.value / data.summary.totalRevenue) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <div key={item.label} className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className={`text-lg font-bold ${item.color}`}>{formatCurrency(item.value)}</div>
                          <div className="text-xs text-gray-500 mt-1">{item.label} ({pct}%)</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="暂无利润数据"
                  description="还没有利润相关数据，录入业务单据后将自动生成"
                />
              )}
            </div>
          </div>

          {/* 利润趋势 (按时段) */}
          {data.trends.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                利润趋势（按{period === 'year' ? '年' : period === 'quarter' ? '季度' : '月'}）
              </h2>
              {/* 折线图 */}
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.trends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="收入" strokeWidth={2} />
                  <Line type="monotone" dataKey="cost" stroke="#ef4444" name="成本" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#22c55e" name="利润" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        期间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        收入
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        成本
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        利润
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        利润率
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.trends.map((trend, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {trend.period}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(trend.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(trend.cost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={
                              trend.profit >= 0
                                ? 'text-green-600 font-medium'
                                : 'text-red-600 font-medium'
                            }
                          >
                            {formatCurrency(trend.profit)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={
                              trend.margin >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {trend.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 分组数据 (按产品/客户) */}
          {data.groupedData && data.groupedData.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                按{groupBy === 'product' ? '产品' : '客户'}利润分析
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {groupBy === 'product' ? '产品名称' : '客户名称'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        收入
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        成本
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        利润
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        利润率
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        订单数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        占比
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.groupedData.map((item, index) => {
                      const pct =
                        data.summary.totalRevenue > 0
                          ? (
                              (item.revenue / data.summary.totalRevenue) *
                              100
                            ).toFixed(1)
                          : '0.0';
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.cost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={
                                item.profit >= 0
                                  ? 'text-green-600 font-medium'
                                  : 'text-red-600 font-medium'
                              }
                            >
                              {formatCurrency(item.profit)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={
                                item.margin >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {item.margin}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.orderCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 对比上期 (环比) */}
          {data.compare && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                环比对比（上期: {formatCurrency(data.compare.revenue)}）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600">收入增长</p>
                  <p className="text-xl font-bold mt-1">
                    {renderGrowthBadge(data.compare.revenueGrowth)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600">成本增长</p>
                  <p className="text-xl font-bold mt-1">
                    {renderGrowthBadge(data.compare.costGrowth)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600">利润增长</p>
                  <p className="text-xl font-bold mt-1">
                    {renderGrowthBadge(data.compare.profitGrowth)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 同比(上年同期)分析 */}
          {data.yoy && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                同比分析（上年同期: {formatCurrency(data.yoy.revenue)}）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-600">收入同比增长</p>
                  <p className="text-xl font-bold mt-1">
                    {renderGrowthBadge(data.yoy.revenueGrowth)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-600">成本同比增长</p>
                  <p className="text-xl font-bold mt-1">
                    {renderGrowthBadge(data.yoy.costGrowth)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-600">利润同比增长</p>
                  <p className="text-xl font-bold mt-1">
                    {renderGrowthBadge(data.yoy.profitGrowth)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 空状态 */}
      {!loading && !data && !error && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">
            设置筛选条件后点击"查询"按钮加载利润报表数据
          </p>
        </div>
      )}
    </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </>
  );
}
