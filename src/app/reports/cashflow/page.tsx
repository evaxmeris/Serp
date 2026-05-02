/**
 * 现金流报表页面
 * 展示企业现金流入流出情况 - 从真实 API 获取数据
 */

'use client';

import { useState } from 'react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function CashflowReportPage() {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        period,
      });
      const response = await fetch(`/api/v1/reports/cashflow?${params}`);
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
      const msg = error instanceof Error ? error.message : '加载现金流报表失败';
      console.error('加载现金流报表失败:', error);
      setError(msg);
      toast.error(msg);
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
      const response = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'cashflow',
          data,
          period,
          startDate,
          endDate,
          format: 'excel',
        }),
      });

      if (!response.ok) throw new Error('导出失败');

      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('spreadsheetml')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `现金流报表_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">现金流报表</h1>
            <p className="mt-2 text-gray-600">监控企业现金流入流出，保障资金安全</p>
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

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">统计周期</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="day">日报</option>
              <option value="week">周报</option>
              <option value="month">月报</option>
              <option value="quarter">季报</option>
              <option value="year">年报</option>
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
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '查询中...' : '查询'}
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

      {data && (
        <>
          {/* 核心指标 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">总流入</p>
              <p className="text-2xl font-bold text-green-600 mt-1">¥{data.summary.totalInflow.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">总流出</p>
              <p className="text-2xl font-bold text-red-600 mt-1">¥{data.summary.totalOutflow.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">净变化</p>
              <p className={`text-2xl font-bold mt-1 ${data.summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ¥{data.summary.netCashflow.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">期初余额</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">¥{data.summary.openingBalance.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <p className="text-sm text-gray-600">期末余额</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">¥{data.summary.closingBalance.toLocaleString()}</p>
            </div>
          </div>

          {/* 三大活动现金流 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* 经营活动 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">经营活动现金流</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">现金流入</span>
                  <span className="text-green-600 font-medium">¥{data.operatingActivities.cashInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">现金流出</span>
                  <span className="text-red-600 font-medium">¥{data.operatingActivities.cashOutflow.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>净额</span>
                  <span className={data.operatingActivities.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ¥{data.operatingActivities.netCashflow.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 投资活动 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">投资活动现金流</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">现金流入</span>
                  <span className="text-green-600 font-medium">¥{data.investingActivities.cashInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">现金流出</span>
                  <span className="text-red-600 font-medium">¥{data.investingActivities.cashOutflow.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>净额</span>
                  <span className={data.investingActivities.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ¥{data.investingActivities.netCashflow.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 筹资活动 */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">筹资活动现金流</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">现金流入</span>
                  <span className="text-green-600 font-medium">¥{data.financingActivities.cashInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">现金流出</span>
                  <span className="text-red-600 font-medium">¥{data.financingActivities.cashOutflow.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>净额</span>
                  <span className={data.financingActivities.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ¥{data.financingActivities.netCashflow.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 趋势 - 图表 */}
          {data.trends && data.trends.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">现金流趋势图表</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'inflow') return [`¥${value.toLocaleString()}`, '流入'];
                        if (name === 'outflow') return [`¥${value.toLocaleString()}`, '流出'];
                        if (name === 'net') return [`¥${value.toLocaleString()}`, '净额'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="inflow" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="inflow" />
                    <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="outflow" />
                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="net" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 趋势 - 明细表格 */}
          {data.trends && data.trends.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">现金流趋势</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">流入</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">流出</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">净额</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.trends.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">¥{t.inflow.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">¥{t.outflow.toLocaleString()}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ¥{t.net.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 应收应付 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">应收账款</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">应收账款总额</span>
                  <span className="font-medium">¥{data.receivables.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">逾期金额</span>
                  <span className="text-red-600">¥{data.receivables.overdue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">逾期率</span>
                  <span className={data.receivables.overdueRate > 20 ? 'text-red-600' : 'text-yellow-600'}>
                    {data.receivables.overdueRate}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">应付账款</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">应付账款总额</span>
                  <span className="font-medium">¥{data.payables.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">逾期金额</span>
                  <span className="text-red-600">¥{data.payables.overdue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">逾期率</span>
                  <span className={data.payables.overdueRate > 20 ? 'text-red-600' : 'text-yellow-600'}>
                    {data.payables.overdueRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 空状态 */}
      {!data && !loading && !error && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">设置筛选条件后点击"查询"按钮加载现金流报表数据</p>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
