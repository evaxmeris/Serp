'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const modules = [
  {
    title: '客户管理',
    description: '管理客户档案、联系人、跟进记录',
    href: '/customers',
    icon: '🏢',
  },
  {
    title: '产品管理',
    description: '产品目录、价格、库存管理',
    href: '/products',
    icon: '📦',
  },
  {
    title: '询盘管理',
    description: '询盘录入、跟进、转化追踪',
    href: '/inquiries',
    icon: '📧',
  },
  {
    title: '报价管理',
    description: '报价单生成、版本管理',
    href: '/quotations',
    icon: '💰',
  },
  {
    title: '订单管理',
    description: '销售订单、收款、发货',
    href: '/orders',
    icon: '📋',
  },
  {
    title: '采购管理',
    description: '供应商、采购单、入库',
    href: '/purchases',
    icon: '🏭',
  },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 从 localStorage 获取用户信息
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto py-4 px-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Trade ERP</h1>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-zinc-600">
                  {user.name || user.email} ({user.role})
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  退出
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" size="sm">登录</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">注册</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto py-12 px-4">
        {/* Welcome */}
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4">欢迎使用 Trade ERP</h2>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            外贸行业 ERP 管理系统
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">客户总数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">-</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">产品数量</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">-</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">待处理询盘</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">-</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">本月订单</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">-</div>
            </CardContent>
          </Card>
        </div>

        {/* Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card key={module.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{module.icon}</span>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  {module.description}
                </p>
                <Link href={module.href}>
                  <Button variant="outline" className="w-full">
                    进入模块 →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-zinc-500 text-sm">
          <p>Trade ERP v0.2.0 - 开发中</p>
        </div>
      </div>
    </div>
  );
}
