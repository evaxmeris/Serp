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
    status: 'ready',
  },
  {
    title: '产品管理',
    description: '产品目录、价格、库存管理',
    href: '/products',
    icon: '📦',
    status: 'ready',
  },
  {
    title: '询盘管理',
    description: '询盘录入、跟进、转化追踪',
    href: '/inquiries',
    icon: '📧',
    status: 'ready',
  },
  {
    title: '报价管理',
    description: '报价单生成、版本管理',
    href: '/quotations',
    icon: '💰',
    status: 'dev',
  },
  {
    title: '订单管理',
    description: '销售订单、收款、发货',
    href: '/orders',
    icon: '📋',
    status: 'dev',
  },
  {
    title: '采购管理',
    description: '供应商、采购单、入库',
    href: '/purchases',
    icon: '🏭',
    status: 'dev',
  },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
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
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4">欢迎使用 Trade ERP</h2>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            外贸行业 ERP 管理系统
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              ✅ 3 个模块已就绪
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
              🚧 3 个模块开发中
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card 
              key={module.href} 
              className={`hover:shadow-lg transition-shadow ${
                module.status === 'dev' ? 'opacity-75' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{module.icon}</span>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    module.status === 'ready'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {module.status === 'ready' ? '已就绪' : '开发中'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  {module.description}
                </p>
                <Link href={module.href}>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={module.status === 'dev'}
                  >
                    {module.status === 'ready' ? '进入模块 →' : '即将上线'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-zinc-500 text-sm">
          <p>Trade ERP v0.3.0 - 开发中</p>
          <p className="mt-2">
            <a href="/test" className="hover:underline">测试页面</a>
          </p>
        </div>
      </div>
    </div>
  );
}
