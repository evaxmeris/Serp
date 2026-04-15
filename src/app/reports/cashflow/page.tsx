/**
 * 现金流报表页面
 * 展示企业现金流入流出情况
 */

'use client';

import { useState } from 'react';

export default function CashflowReportPage() {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // 示例现金流数据
  const sampleData = {
    operatingActivities: {
      cashInflow: 1500000,
      cashOutflow: 1200000,
      netCashflow: 300000,
    },
    investingActivities: {
      cashInflow: 200000,
      cashOutflow: 500000,
      netCashflow: -300000,
    },
    financingActivities: {
      cashInflow: 800000,
      cashOutflow: 600000,
      netCashflow: 200000,
    },
    summary: {
      totalInflow: 2500000,
      totalOutflow: 2300000,
      netChange: 200000,
      openingBalance: 1800000,
      closingBalance: 2000000,
    },
    receivables: {
      total: 450000,
      overdue: 80000,
      overdueRate: 17.8,
    },
    payables: {
      total: 380000,
      overdue: 50000,
      overdueRate: 13.2,
    },
  };

  async function loadReport() {
    setLoading(true);
    try {
      // TODO: 调用 API 获取实际数据
      // const response = await fetch(`/api/v1/reports/cashflow?startDate=${startDate}&endDate=${endDate}&period=${period}`);
      // const result = await response.json();
      // setData(result.data);
      
      // 使用示例数据
      setData(sampleData);
    } catch (error) {
      console.error('加载现金流报表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!data) {
      alert('请先加载报表数据');
      return;
    }

    setExporting(true);
    setExportSuccess(false);
    
    try {
      // TODO: 调用 API 导出报表
      await new Promise(resolve => setTimeout(resolve, 1000));
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">💰 现金流报表</h1>
          <p className="text-muted-foreground">监控企业现金流入流出，保障资金安全</p>
        </div>
        <div className="text-center py-12 text-gray-500">
          <p>请选择统计周期并点击「加载报表」查看数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">💰 现金流报表</h1>
        <p className="text-muted-foreground">
          监控企业现金流入流出，保障资金安全
        </p>
      </div>

      {/* 筛选条件 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">统计周期</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="day">日报</option>
            <option value="week">周报</option>
            <option value="month">月报</option>
            <option value="quarter">季报</option>
            <option value="year">年报</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={loadReport}
            disabled={loading}
            className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '加载中...' : '加载报表'}
          </button>
          <button
            onClick={handleExport}
            disabled={!data || exporting}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/80 disabled:opacity-50"
          >
            {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          ✅ 报表导出成功！
        </div>
      )}

      {data && (
        <>
          {/* 核心指标 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">总流入</div>
              <div className="text-2xl font-bold text-green-600">¥{data.summary.totalInflow.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">总流出</div>
              <div className="text-2xl font-bold text-red-600">¥{data.summary.totalOutflow.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">净变化</div>
              <div className={`text-2xl font-bold ${data.summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ¥{data.summary.netChange.toLocaleString()}
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">期初余额</div>
              <div className="text-2xl font-bold">¥{data.summary.openingBalance.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">期末余额</div>
              <div className="text-2xl font-bold">¥{data.summary.closingBalance.toLocaleString()}</div>
            </div>
          </div>

          {/* 三大活动现金流 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* 经营活动 */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">🔄 经营活动现金流</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>现金流入</span>
                  <span className="text-green-600">¥{data.operatingActivities.cashInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>现金流出</span>
                  <span className="text-red-600">¥{data.operatingActivities.cashOutflow.toLocaleString()}</span>
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
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">📈 投资活动现金流</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>现金流入</span>
                  <span className="text-green-600">¥{data.investingActivities.cashInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>现金流出</span>
                  <span className="text-red-600">¥{data.investingActivities.cashOutflow.toLocaleString()}</span>
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
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">💵 筹资活动现金流</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>现金流入</span>
                  <span className="text-green-600">¥{data.financingActivities.cashInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>现金流出</span>
                  <span className="text-red-600">¥{data.financingActivities.cashOutflow.toLocaleString()}</span>
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

          {/* 应收应付 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">📤 应收账款</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>应收账款总额</span>
                  <span className="font-medium">¥{data.receivables.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>逾期金额</span>
                  <span className="text-red-600">¥{data.receivables.overdue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>逾期率</span>
                  <span className={data.receivables.overdueRate > 20 ? 'text-red-600' : 'text-yellow-600'}>
                    {data.receivables.overdueRate}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">📥 应付账款</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>应付账款总额</span>
                  <span className="font-medium">¥{data.payables.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>逾期金额</span>
                  <span className="text-red-600">¥{data.payables.overdue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>逾期率</span>
                  <span className={data.payables.overdueRate > 20 ? 'text-red-600' : 'text-yellow-600'}>
                    {data.payables.overdueRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>请选择筛选条件并点击"加载报表"</p>
        </div>
      )}
    </div>
  );
}
