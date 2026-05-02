'use client';

/**
 * Trade ERP 根布局组件
 * 包含全局导航（Navbar + Sidebar）和内容区
 * 集成全局键盘快捷键系统
 * 
 * @作者 应亮
 * @创建日期 2026-04-08
 * @最后更新 2026-05-02
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar, { getCurrentUserRole, UserRole } from '@/components/Sidebar';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { usePreferences, applyTheme } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

interface RootLayoutContentProps {
  children: React.ReactNode;
}

// ============================================================
// 内联组件：连接 KeyboardShortcutsProvider 的 help 状态
// 与 KeyboardShortcutsHelp 弹窗组件
// ============================================================

function KeyboardShortcutsHelpBridge() {
  const { showHelp, closeHelp } = useKeyboardShortcuts();
  return (
    <KeyboardShortcutsHelp
      open={showHelp}
      onOpenChange={(open) => {
        if (!open) closeHelp();
      }}
    />
  );
}

// ============================================================
// 主布局组件
// ============================================================

/**
 * 布局内容组件（客户端）
 * 管理 Sidebar 状态并与内容区联动
 * 包裹 KeyboardShortcutsProvider 以启用全局快捷键
 */
export default function RootLayoutContent({ children }: RootLayoutContentProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { preferences, loaded } = usePreferences();

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
      // 默认：桌面展开，平板折叠，手机也展开（确保能看到分组名和菜单）
      const isTablet = window.innerWidth < 1200 && window.innerWidth >= 768;
      setSidebarCollapsed(isTablet);
    }
    
    setMounted(true);
  }, []); // 空依赖，只在挂载时执行一次

  // 应用主题偏好
  useEffect(() => {
    if (loaded) {
      applyTheme(preferences.theme);

      // 监听系统主题变化（当主题为 system 时）
      if (preferences.theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme('system');
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    }
  }, [preferences.theme, loaded]);

  // 监听路由变化（移动端自动关闭 Sidebar）
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarMobileOpen(false);
    }
  }, [pathname]);

  // 监听全局 toggle-sidebar 事件（由键盘快捷键触发）
  useEffect(() => {
    const handleToggleSidebar = () => {
      toggleSidebar();
    };
    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('toggle-sidebar', handleToggleSidebar);
  }, [sidebarCollapsed]);

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
    <KeyboardShortcutsProvider>
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
        <KeyboardShortcutsHelpBridge />
      </div>
    </KeyboardShortcutsProvider>
  );
}
