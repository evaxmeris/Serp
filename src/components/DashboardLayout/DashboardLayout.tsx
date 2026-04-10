'use client';

import { useState, useEffect } from 'react';
import Sidebar, { getCurrentUserRole } from '@/components/Sidebar';
import { UserRole } from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 客户端获取用户角色和侧边栏状态偏好
    const userRole = getCurrentUserRole();
    setRole(userRole);
    
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      setCollapsed(savedCollapsed === 'true');
    } else {
      // 根据屏幕尺寸默认设置：平板以上默认展开，平板折叠
      const isTablet = window.innerWidth < 1200 && window.innerWidth >= 768;
      const isMobile = window.innerWidth < 768;
      setCollapsed(isTablet);
    }
    
    setMounted(true);
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  // 如果还没挂载（服务器渲染），只显示内容
  if (!mounted) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        currentRole={role}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      
      {/* 主内容区域 - 根据侧边栏状态调整左边距 */}
      <main
        className={cn(
          'transition-all duration-300 ease-in-out min-h-screen pt-16 lg:pt-0',
          collapsed
            ? 'lg:ml-16'  // 折叠
            : 'lg:ml-64' // 展开
        )}
      >
        {children}
      </main>
    </div>
  );
}
