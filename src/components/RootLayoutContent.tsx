'use client';

/**
 * Trade ERP 根布局组件
 * 包含全局导航（Navbar + Sidebar）和内容区
 * 
 * @作者 应亮
 * @创建日期 2026-04-08
 * @最后更新 2026-04-08
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar, { getCurrentUserRole, UserRole } from '@/components/Sidebar';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { cn } from '@/lib/utils';

interface RootLayoutContentProps {
  children: React.ReactNode;
}

/**
 * 布局内容组件（客户端）
 * 管理 Sidebar 状态并与内容区联动
 */
export default function RootLayoutContent({ children }: RootLayoutContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 初始化：获取用户角色和 Sidebar 状态偏好
  useEffect(() => {
    const loadUserRole = async () => {
      const userRole = await getCurrentUserRole();
      setRole(userRole);
    };
    loadUserRole();
    
    // 从 localStorage 读取用户偏好
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      setSidebarCollapsed(savedCollapsed === 'true');
    } else {
      // 默认：桌面展开，平板折叠，手机隐藏
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth < 1200 && window.innerWidth >= 768;
      setSidebarCollapsed(isTablet || isMobile);
    }
    
    setMounted(true);
  }, []);

  // 监听路由变化（移动端自动关闭 Sidebar）
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarMobileOpen(false);
    }
  }, [pathname]);

  // 键盘快捷键：Ctrl+B 切换 Sidebar, Ctrl+D 跳转仪表盘, ? 显示快捷键帮助
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B / Cmd+B: 切换侧边栏
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      // Ctrl+D / Cmd+D: 跳转仪表盘
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        router.push('/dashboard');
      }
      // ?: 显示快捷键帮助（同时支持 Shift+/ 因为实际按键是 Shift+/ 得到 ?）
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShortcutHelpOpen(true);
      }
      // Esc: 关闭移动端侧边栏 / 关闭快捷键帮助
      if (e.key === 'Escape') {
        if (sidebarMobileOpen) {
          setSidebarMobileOpen(false);
        }
        if (shortcutHelpOpen) {
          setShortcutHelpOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed, sidebarMobileOpen, shortcutHelpOpen, router]);

  /**
   * 切换 Sidebar 折叠状态
   */
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  // 服务端渲染期间只显示内容
  if (!mounted) {
    return <>{children}</>;
  }

  // 登录/注册页面不显示导航
  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* 顶部导航栏 */}
      <Navbar />
      
      {/* 左侧导航栏 */}
      <Sidebar
        currentRole={role}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        mobileOpen={sidebarMobileOpen}
        onMobileClose={() => setSidebarMobileOpen(false)}
      />
      
      {/* 主内容区 - 响应式调整左边距 */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300 ease-in-out pt-16',
          // 移动端：无左边距
          'pl-0',
          // 平板及以上：根据折叠状态调整
          'lg:pl-16',
          sidebarCollapsed
            ? 'lg:pl-16'      // 折叠状态：64px
            : 'lg:pl-64'      // 展开状态：256px
        )}
      >
        {children}
      </main>
      <KeyboardShortcutsHelp 
        open={shortcutHelpOpen} 
        onOpenChange={setShortcutHelpOpen}
      />
    </div>
  );
}
