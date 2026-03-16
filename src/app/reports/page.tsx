/**
 * 报表中心页面
 * 提供所有财务报表的入口和概览
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// 报表类型定义
interface ReportType {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  path: string;
}

// 预定义的报表类型
const REPORT_TYPES: ReportType[] = [
  {
    id: 'profit',
    name: '利润报表',
    code: 'PROFIT',
    description: '查看企业利润情况，包括毛利润、净利润等关键指标',
    icon: '💰',
    color: 'bg-green-500',
    path: '/reports/profit'
  },
  {
    id: 'sales',
    name: '销售报表',
    code: 'SALES',
    description: '分析销售数据，包括销售额、订单量、客户分布等',
    icon: '📊',
    color: 'bg-blue-500',
    path: '/reports/sales'
  },
  {
    id: 'inventory',
    name: '库存报表',
    code: 'INVENTORY',
    description: '监控库存状态，包括库存量、周转率、预警信息等',
    icon: '📦',
    color: 'bg-yellow-500',
    path: '/reports/inventory'
  },
  {
    id: 'purchase',
    name: '采购报表',
    code: 'PURCHASE',
    description: '追踪采购情况，包括采购额、供应商分析等',
    icon: '🛒',
    color: 'bg-purple-500',
    path: '/reports/purchase'
  },
  {
    id: 'cashflow',
    name: '现金流量',
    code: 'CASHFLOW',
    description: '分析现金流状况，包括经营、投资、筹资活动',
    icon: '💵',
    color: 'bg-red-500',
    path: '/reports/cashflow'
  },
  {
    id: 'dashboard',
    name: '数据仪表盘',
    code: 'DASHBOARD',
    description: '综合数据概览，关键指标一目了然',
    icon: '📈',
    color: 'bg-indigo-500',
    path: '/reports/dashboard'
  },
  {
    id: 'custom',
    name: '自定义报表',
    code: 'CUSTOM',
    description: '创建和管理自定义报表配置',
    icon: '⚙️',
    color: 'bg-gray-500',
    path: '/reports/custom'
  }
];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportType[]>([]);

  useEffect(() => {
    // 加载报表列表
    loadReports();
  }, []);

  async function loadReports() {
    try {
      // TODO: 从 API 加载自定义报表
      setReports(REPORT_TYPES);
    } catch (error) {
      console.error('加载报表列表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  // 快速操作函数
  function handleExport() {
    alert('导出功能开发中...\n\n将支持：\n- Excel 格式导出\n- CSV 格式导出\n- PDF 格式导出');
  }

  function handleSubscribe() {
    alert('订阅功能开发中...\n\n将支持：\n- 邮件订阅\n- 钉钉推送\n- 微信通知');
  }

  function handleSchedule() {
    alert('定时任务功能开发中...\n\n将支持：\n- 定时生成报表\n- 定时发送订阅\n- 定时备份数据');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">报表中心</h1>
        <p className="mt-2 text-gray-600">查看和分析企业各类财务报表</p>
      </div>

      {/* 报表卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <Link
            key={report.id}
            href={report.path}
            className="block group"
          >
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200">
              <div className="flex items-start space-x-4">
                {/* 图标 */}
                <div className={`${report.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0`}>
                  {report.icon}
                </div>
                
                {/* 内容 */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {report.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {report.description}
                  </p>
                  <div className="mt-3 flex items-center text-blue-600 text-sm font-medium">
                    查看详情
                    <svg className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 快速操作 */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            📥 导出报表
          </button>
          <button
            onClick={handleSubscribe}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            📧 设置订阅
          </button>
          <button
            onClick={handleSchedule}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            ⏰ 定时任务
          </button>
        </div>
      </div>
    </div>
  );
}
