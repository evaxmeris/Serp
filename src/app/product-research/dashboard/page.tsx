'use client';

/**
 * 产品调研看板 - Product Research Dashboard
 * 
 * 功能：
 * - 数据概览卡片（总数/状态/结论/毛利率）
 * - 品类分布饼图
 * - 调研进度看板
 * - 价格分布柱状图
 * - 毛利率 Top 10 对比图
 * 
 * 路由：/product-research/dashboard
 * 作者：Trade ERP 开发团队
 * 创建日期：2026-03-13
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Package, TrendingUp, CheckCircle, Clock, DollarSign, ArrowLeft } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface Product {
  id: string;
  name: string;
  costPrice: number | null;
  salePrice: number | null;
  status: string;
  conclusion: string | null;
  categoryId: string;
  category: {
    name: string;
  } | null;
  createdAt: string;
}

interface OverviewStats {
  total: number;
  byStatus: Record<string, number>;
  byConclusion: Record<string, number>;
  avgMargin: number;
}

// ============================================
// 颜色配置
// ============================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  REVIEW: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  ARCHIVED: '#8b5cf6',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '调研中',
  REVIEW: '待审核',
  APPROVED: '已完成',
  REJECTED: '已拒绝',
  ARCHIVED: '已归档',
};

const CONCLUSION_COLORS: Record<string, string> = {
  recommended: '#10b981',
  alternative: '#3b82f6',
  eliminated: '#ef4444',
};

const CONCLUSION_LABELS: Record<string, string> = {
  recommended: '推荐',
  alternative: '备选',
  eliminated: '淘汰',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

// ============================================
// 主组件
// ============================================

export default function DashboardPage() {
  const router = useRouter();

  // 数据状态
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats | null>(null);

  // 图表数据
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [priceRangeData, setPriceRangeData] = useState<any[]>([]);
  const [marginTop10Data, setMarginTop10Data] = useState<any[]>([]);

  // ============================================
  // 加载数据
  // ============================================

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/product-research/products?limit=1000');
      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        setProducts(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 数据统计
  // ============================================

  const calculateStats = (data: Product[]) => {
    // 总数
    const total = data.length;

    // 按状态分组
    const byStatus: Record<string, number> = {};
    data.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    // 按结论分组
    const byConclusion: Record<string, number> = {};
    data.forEach(p => {
      if (p.conclusion) {
        byConclusion[p.conclusion] = (byConclusion[p.conclusion] || 0) + 1;
      }
    });

    // 平均毛利率
    const margins = data
      .filter(p => p.costPrice && p.salePrice && p.salePrice > 0)
      .map(p => ((p.salePrice! - p.costPrice!) / p.salePrice!) * 100);
    const avgMargin = margins.length > 0
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0;

    setStats({ total, byStatus, byConclusion, avgMargin });

    // 品类分布
    const categoryMap: Record<string, number> = {};
    data.forEach(p => {
      const categoryName = p.category?.name || '未分类';
      categoryMap[categoryName] = (categoryMap[categoryName] || 0) + 1;
    });
    setCategoryData(
      Object.entries(categoryMap)
        .map(([name, value], idx) => ({ name, value, color: PIE_COLORS[idx % PIE_COLORS.length] }))
        .sort((a, b) => b.value - a.value)
    );

    // 价格分布
    const priceRanges = [
      { range: '$0-50', min: 0, max: 50, count: 0 },
      { range: '$50-100', min: 50, max: 100, count: 0 },
      { range: '$100-200', min: 100, max: 200, count: 0 },
      { range: '$200-500', min: 200, max: 500, count: 0 },
      { range: '$500+', min: 500, max: Infinity, count: 0 },
    ];
    data.forEach(p => {
      if (p.salePrice) {
        const range = priceRanges.find(r => p.salePrice! >= r.min && p.salePrice! < r.max);
        if (range) range.count++;
      }
    });
    setPriceRangeData(priceRanges);

    // 毛利率 Top 10
    const productsWithMargin = data
      .filter(p => p.costPrice && p.salePrice && p.salePrice > 0)
      .map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        margin: ((p.salePrice! - p.costPrice!) / p.salePrice!) * 100,
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10);
    setMarginTop10Data(productsWithMargin);
  };

  // ============================================
  // 空状态
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-gray-600">加载数据中...</div>
        </div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.push('/product-research/products')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
          <h1 className="text-2xl font-bold">产品调研看板</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">暂无数据</h3>
            <p className="text-gray-500 mb-4">先添加一些产品数据吧</p>
            <Button onClick={() => router.push('/product-research/import')}>
              导入产品数据
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // 页面渲染
  // ============================================

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面头部 */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/product-research/products')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
        <h1 className="text-2xl font-bold">产品调研看板</h1>
      </div>

      {/* 数据概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总产品数</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">调研中</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus['IN_PROGRESS'] || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus['APPROVED'] || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">推荐产品</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byConclusion['recommended'] || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均毛利率</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 品类分布饼图 */}
        <Card>
          <CardHeader>
            <CardTitle>品类分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 调研进度看板 */}
        <Card>
          <CardHeader>
            <CardTitle>调研进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(stats.byStatus).map(([status, count]) => {
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge style={{ backgroundColor: STATUS_COLORS[status] }}>
                      {STATUS_LABELS[status]}
                    </Badge>
                    <span className="text-sm font-medium">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* 第二行图表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 价格分布柱状图 */}
        <Card>
          <CardHeader>
            <CardTitle>价格分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priceRangeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 毛利率 Top 10 */}
        <Card>
          <CardHeader>
            <CardTitle>毛利率 Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginTop10Data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={120} />
                  <RechartsTooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Bar dataKey="margin" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// 导入 Button 组件
// ============================================

import { Button } from '@/components/ui/button';
