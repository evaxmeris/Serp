/**
 * 采购报表页面
 * 展示采购相关数据和趋势
 */

'use client';

import { useState } from 'react';

export default function PurchaseReportPage() {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // 示例采购数据
  const sampleData = {
    totalPurchaseAmount: 850000,
    totalOrders: 156,
    averageOrderValue: 5449,
    topSuppliers: [
      { name: '供应商 A', amount: 250000, percentage: 29.4 },
      { name: '供应商 B', amount: 180000, percentage: 21.2 },
      { name: '供应商 C', amount: 150000, percentage: 17.6 },
    ],
    purchaseByCategory: [
      { category: '原材料', amount: 400000, percentage: 47.1 },
      { category: '包装材料', amount: 200000, percentage: 23.5 },
      { category: '辅料', amount: 150000, percentage: 17.6 },
    ],
    deliveryPerformance: {
      onTime: 85,
      delayed: 10,
      early: 5,
    },
    qualityMetrics: {
      passRate: 96.5,
      returnRate: 2.1,
      complaintRate: 1.4,
    },
  };

  async function loadReport() {
    setLoading(true);
    try {
      // TODO: 调用 API 获取实际数据
      // const response = await fetch(`/api/v1/reports/purchase?startDate=${startDate}&endDate=${endDate}&period=${period}`);
      // const result = await response.json();
      // setData(result.data);
      
      // 使用示例数据
      setData(sampleData);
    } catch (error) {
      console.error('加载采购报表失败:', error);
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📦 采购报表</h1>
        <p className="text-muted-foreground">
          分析采购数据，优化供应商管理
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">采购总额</div>
              <div className="text-2xl font-bold">¥{data.totalPurchaseAmount.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">订单总数</div>
              <div className="text-2xl font-bold">{data.totalOrders}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">平均订单金额</div>
              <div className="text-2xl font-bold">¥{data.averageOrderValue.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">准时交付率</div>
              <div className="text-2xl font-bold">{data.deliveryPerformance.onTime}%</div>
            </div>
          </div>

          {/* 供应商排行 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">🏆 Top 供应商</h3>
              <div className="space-y-3">
                {data.topSuppliers.map((supplier: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>{index + 1}. {supplier.name}</span>
                    <div className="text-right">
                      <div className="font-medium">¥{supplier.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{supplier.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">📊 采购品类分布</h3>
              <div className="space-y-3">
                {data.purchaseByCategory.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>{item.category}</span>
                    <div className="text-right">
                      <div className="font-medium">¥{item.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{item.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 质量指标 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">✅ 交付表现</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>准时交付</span>
                  <span className="text-green-600">{data.deliveryPerformance.onTime}%</span>
                </div>
                <div className="flex justify-between">
                  <span>延迟交付</span>
                  <span className="text-yellow-600">{data.deliveryPerformance.delayed}%</span>
                </div>
                <div className="flex justify-between">
                  <span>提前交付</span>
                  <span className="text-blue-600">{data.deliveryPerformance.early}%</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">🎯 质量指标</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>合格率</span>
                  <span className="text-green-600">{data.qualityMetrics.passRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>退货率</span>
                  <span className="text-red-600">{data.qualityMetrics.returnRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>投诉率</span>
                  <span className="text-yellow-600">{data.qualityMetrics.complaintRate}%</span>
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
