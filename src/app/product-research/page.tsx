'use client';

/**
 * 产品开发模块 - 首页
 * 提供产品调研相关功能的入口
 * 
 * @作者 应亮
 * @创建日期 2026-04-09
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FlaskConical, GitCompare, LayoutDashboard, Package, Search, BarChart3 } from 'lucide-react';

export default function ProductResearchPage() {
  const features = [
    {
      title: '品类管理',
      description: '管理产品品类和分类体系',
      icon: <Package className="h-8 w-8" />,
      href: '/product-research/categories',
      color: 'bg-blue-500',
    },
    {
      title: '属性模板',
      description: '配置产品属性模板',
      icon: <Search className="h-8 w-8" />,
      href: '/product-research/templates',
      color: 'bg-green-500',
    },
    {
      title: '产品列表',
      description: '查看和管理调研产品',
      icon: <FlaskConical className="h-8 w-8" />,
      href: '/product-research/products',
      color: 'bg-purple-500',
    },
    {
      title: '产品对比',
      description: '多产品对比分析',
      icon: <GitCompare className="h-8 w-8" />,
      href: '/product-research/comparisons',
      color: 'bg-orange-500',
    },
    {
      title: '数据看板',
      description: '产品调研数据分析',
      icon: <BarChart3 className="h-8 w-8" />,
      href: '/product-research/dashboard',
      color: 'bg-red-500',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          🔬 产品开发
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          产品调研与选品管理系统
        </p>
      </div>

      {/* 功能卡片 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center text-white mb-4`}>
                {feature.icon}
              </div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={feature.href}>
                  进入
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 统计信息 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">调研产品数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">128</div>
            <p className="text-xs text-zinc-500 mt-1">本月新增 15 个</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">对比记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">24</div>
            <p className="text-xs text-zinc-500 mt-1">本周新增 3 次</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">转化产品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">36</div>
            <p className="text-xs text-zinc-500 mt-1">转化率 28%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
