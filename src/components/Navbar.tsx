'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Home, BarChart3 } from 'lucide-react';
import Link from 'next/link';

// 导航栏组件 - 包含登出功能
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  // 处理登出
  const handleLogout = () => {
    // 清除本地存储的用户信息
    localStorage.removeItem('user');
    // 跳转到登录页
    router.push('/login');
    router.refresh();
  };

  // 获取当前用户信息
  const getUser = () => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  };

  const user = getUser();

  // 如果在登录/注册页面，不显示导航栏
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <nav className="bg-white border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo 和品牌 */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Home className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-lg text-zinc-900 dark:text-white">Trade ERP</span>
            </Link>

            {/* 主导航 */}
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant={pathname === '/' ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href="/">首页</Link>
              </Button>
              <Button
                variant={pathname === '/dashboard' ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href="/dashboard">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  看板
                </Link>
              </Button>
            </div>
          </div>

          {/* 右侧：用户信息 + 登出按钮 */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span>👤</span>
                <span>{user.email}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-600 hover:text-red-600 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4 mr-1" />
              登出
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
