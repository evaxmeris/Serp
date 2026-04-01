'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  TrendingUp,
  Users,
  UserRound,
  Building2,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// 角色类型定义
export type UserRole = 
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'SALES'
  | 'PURCHASING'
  | 'WAREHOUSE'
  | 'FINANCE'
  | 'PRODUCT'
  | 'USER';

// 菜单项定义
export interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  roles: UserRole[]; // 允许访问的角色
  children?: MenuItem[];
}

// 完整菜单配置 - 按功能模块分组
const menuConfig: MenuItem[] = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: '/dashboard',
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'SALES', 'PURCHASING', 'WAREHOUSE', 'FINANCE', 'PRODUCT', 'USER'],
  },
  {
    key: 'orders',
    label: '订单管理',
    icon: <ShoppingCart className="h-5 w-5" />,
    href: '/orders',
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'SALES', 'PURCHASING', 'FINANCE', 'PRODUCT', 'USER'],
  },
  {
    key: 'customers',
    label: '客户管理',
    icon: <Users className="h-5 w-5" />,
    href: '/customers',
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'SALES', 'PRODUCT'],
  },
  {
    key: 'products',
    label: '产品管理',
    icon: <Package className="h-5 w-5" />,
    href: '/products',
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'PRODUCT', 'PURCHASING'],
  },
  {
    key: 'product-research',
    label: '产品开发',
    icon: <Search className="h-5 w-5" />,
    href: '/product-research',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT'],
  },
  {
    key: 'inventory',
    label: '库存管理',
    icon: <Warehouse className="h-5 w-5" />,
    href: '/inventory',
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE', 'PURCHASING'],
  },
  {
    key: 'inbound-orders',
    label: '采购入库',
    icon: <TrendingUp className="h-5 w-5" />,
    href: '/inbound-orders',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PURCHASING', 'WAREHOUSE'],
  },
  {
    key: 'outbound-orders',
    label: '发货处理',
    icon: <Package className="h-5 w-5" />,
    href: '/outbound-orders',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'],
  },
  {
    key: 'suppliers',
    label: '供应商管理',
    icon: <Building2 className="h-5 w-5" />,
    href: '/suppliers',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PURCHASING'],
  },
  {
    key: 'purchases',
    label: '采购管理',
    icon: <DollarSign className="h-5 w-5" />,
    href: '/purchases',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PURCHASING', 'FINANCE'],
  },
  {
    key: 'reports',
    label: '报表中心',
    icon: <BarChart3 className="h-5 w-5" />,
    href: '/reports',
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'FINANCE'],
  },
  {
    key: 'users',
    label: '用户管理',
    icon: <UserRound className="h-5 w-5" />,
    href: '/users',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    key: 'settings',
    label: '系统设置',
    icon: <Settings className="h-5 w-5" />,
    href: '/settings',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
];

// 根据当前用户角色过滤菜单
const filterMenuByRole = (role: UserRole): MenuItem[] => {
  return menuConfig.filter(item => item.roles.includes(role));
};

interface SidebarProps {
  className?: string;
  currentRole: UserRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  className,
  currentRole,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(mobileOpen);

  // 同步外部状态
  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  // 键盘快捷键支持: Ctrl+B 切换折叠状态
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B 或 Command+B 切换侧边栏
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
      // Esc 关闭移动端侧边栏
      if (e.key === 'Escape' && isMobileOpen) {
        onMobileClose?.();
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed, isMobileOpen]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggleCollapse?.();
    // 保存用户偏好到 localStorage
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  // 获取过滤后的菜单
  const filteredMenu = filterMenuByRole(currentRole);

  // 移动端遮罩点击关闭
  const handleOverlayClick = () => {
    setIsMobileOpen(false);
    onMobileClose?.();
  };

  // 处理菜单点击（移动端自动关闭）
  const handleMenuClick = (href: string) => {
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
      onMobileClose?.();
    }
    router.push(href);
  };

  return (
    <>
      {/* 移动端遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* 侧边栏容器 */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out h-screen pt-16',
          isCollapsed
            ? 'w-16' // 折叠宽度（仅图标）
            : 'w-64', // 展开宽度
          // 移动端处理
          isMobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0',
          className
        )}
        role="navigation"
        aria-label="侧边导航"
      >
        {/* 菜单列表 */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {filteredMenu.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.key}>
                  <button
                    onClick={() => handleMenuClick(item.href)}
                    className={cn(
                      'flex items-center w-full rounded-lg transition-all duration-200 group',
                      isActive
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                      isCollapsed
                        ? 'justify-center px-2 py-3'
                        : 'px-3 py-2.5 gap-3'
                    )}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="flex-shrink-0">
                      {item.icon}
                    </div>
                    {!isCollapsed && (
                      <span className="text-sm font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部折叠/展开按钮 */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className={cn(
              'w-full flex items-center justify-center',
              isCollapsed ? 'p-2' : 'p-2 gap-2'
            )}
            aria-label={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm">收起</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* 移动端打开按钮 - 仅在折叠且移动端隐藏时显示 */}
      {!isMobileOpen && (
        <button
          className="fixed top-4 left-4 z-30 lg:hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 shadow-md"
          onClick={() => {
            setIsMobileOpen(true);
          }}
          aria-label="打开导航菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </>
  );
}

// 获取当前用户角色从 localStorage
export const getCurrentUserRole = (): UserRole => {
  if (typeof window === 'undefined') return 'USER';
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return 'USER';
    const user = JSON.parse(userStr);
    return (user.role as UserRole) || 'USER';
  } catch {
    return 'USER';
  }
};
