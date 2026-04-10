'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, BarChart3, TrendingUp, Menu } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';
import { useState } from 'react';

// 导航栏组件 - 包含用户头像下拉菜单
export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          {/* 左侧：Logo 和汉堡菜单 */}
          <div className="flex items-center gap-4">
            {/* 移动端汉堡菜单按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => {
                // 触发自定义事件，Sidebar 监听
                window.dispatchEvent(new CustomEvent('toggle-mobile-menu'));
              }}
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </Button>

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
              <Button
                variant={pathname.startsWith('/reports') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href="/reports">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  报表
                </Link>
              </Button>
            </div>
          </div>

          {/* 右侧：用户头像下拉菜单 */}
          <div className="flex items-center gap-4">
            {user && (
              <UserAvatar
                user={{
                  name: user.name,
                  email: user.email,
                  avatarUrl: user.avatarUrl,
                  status: 'online',
                }}
                size="md"
                showStatus={true}
                showName={false}
              />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
