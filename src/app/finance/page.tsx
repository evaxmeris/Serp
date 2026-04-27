'use client';

/**
 * 财务管理页面
 * /finance
 * 应收应付 / 收付款 / 报销 / 利润核算
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Receipt, TrendingUp } from 'lucide-react';

export default function FinancePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(false); }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">加载中...</div>;

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-green-600" />
          财务管理
        </h1>
        <p className="mt-2 text-gray-600">管理应收账款、应付账款、收付款记录及费用报销</p>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/finance/receivables'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg"><ArrowDownCircle className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">应收账款</p>
                <p className="text-2xl font-bold text-blue-600">¥0.00</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/finance/payables'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-lg"><ArrowUpCircle className="h-6 w-6 text-red-600" /></div>
              <div>
                <p className="text-sm text-gray-500">应付账款</p>
                <p className="text-2xl font-bold text-red-600">¥0.00</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/finance/payments'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg"><DollarSign className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">收付款记录</p>
                <p className="text-2xl font-bold text-gray-900">0 笔</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/finance/reimbursements'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg"><Receipt className="h-6 w-6 text-purple-600" /></div>
              <div>
                <p className="text-sm text-gray-500">费用报销</p>
                <p className="text-2xl font-bold text-purple-600">¥0.00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">最近收款</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无收款记录</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/finance/payments'}>查看全部</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">最近付款</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无付款记录</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/finance/payments'}>查看全部</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">利润趋势</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>数据收集中</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/reports/profit'}>查看利润报表</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
