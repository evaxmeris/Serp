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
  CircleDollarSign,
  Inbox,
  Truck,
  User,
  Scale,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// 角色类型定义（与 prisma/schema.prisma RoleEnum 保持一致）
// 4 个核心业务角色 + 1 个只读角色，精简易用
export type UserRole = 
  | 'ADMIN'       // 管理员：全部权限
  | 'SALES'       // 业务员：客户/报价/订单
  | 'PURCHASING'  // 采购员：供应商/采购/入库
  | 'WAREHOUSE'   // 仓管员：出入库/库存
  | 'VIEWER';     // 只读访客

// 菜单项定义
export interface MenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  roles: UserRole[]; // 允许访问的角色
  children?: MenuItem[];
}

// 菜单分组定义
export interface MenuGroup {
  group: string;
  items: MenuItem[];
}

// 完整菜单配置 - 精简 4 角色 + VIEWER
// ADMIN: 全部权限 | SALES: 客户/报价/订单 | PURCHASING: 供应商/采购/入库 | WAREHOUSE: 出入库/库存
const menuConfig: MenuGroup[] = [
  {
    group: '基础资料',
    items: [
      {
        key: 'customers',
        label: '客户管理',
        icon: Users,
        href: '/customers',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'suppliers',
        label: '供应商管理',
        icon: Building2,
        href: '/suppliers',
        roles: ['ADMIN', 'PURCHASING'],
      },
    ],
  },
  {
    group: '产品管理',
    items: [
      {
        key: 'products',
        label: '产品列表',
        icon: Package,
        href: '/products',
        roles: ['ADMIN', 'SALES', 'PURCHASING'],
      },
      {
        key: 'categories',
        label: '品类管理',
        icon: Building2,
        href: '/product-research/categories',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'templates',
        label: '属性模板',
        icon: FileText,
        href: '/product-research/templates',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
  {
    group: '采购供应链',
    items: [
      {
        key: 'inbound-orders',
        label: '采购入库',
        icon: Inbox,
        href: '/inbound-orders',
        roles: ['ADMIN', 'PURCHASING', 'WAREHOUSE'],
      },
      {
        key: 'purchases',
        label: '采购管理',
        icon: CircleDollarSign,
        href: '/purchases',
        roles: ['ADMIN', 'PURCHASING'],
      },
    ],
  },
  {
    group: '销售订单',
    items: [
      {
        key: 'orders',
        label: '订单管理',
        icon: ShoppingCart,
        href: '/orders',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'quotations',
        label: '报价管理',
        icon: CircleDollarSign,
        href: '/quotations',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
  {
    group: '仓储物流',
    items: [
      {
        key: 'inventory',
        label: '库存管理',
        icon: BarChart3,
        href: '/inventory',
        roles: ['ADMIN', 'WAREHOUSE'],
      },
      {
        key: 'outbound-orders',
        label: '出库管理',
        icon: Truck,
        href: '/outbound-orders',
        roles: ['ADMIN', 'WAREHOUSE'],
      },
    ],
  },
  {
    group: '报表分析',
    items: [
      {
        key: 'dashboard',
        label: '仪表盘',
        icon: LayoutDashboard,
        href: '/dashboard',
        roles: ['ADMIN', 'SALES', 'PURCHASING', 'WAREHOUSE', 'VIEWER'],
      },
      {
        key: 'reports',
        label: '报表中心',
        icon: TrendingUp,
        href: '/reports',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    group: '系统管理',
    items: [
      {
        key: 'users',
        label: '用户及权限',
        icon: User,
        href: '/users',
        roles: ['ADMIN'],
      },
      {
        key: 'warehouses',
        label: '仓库管理',
        icon: Package,
        href: '/settings/warehouses',
        roles: ['ADMIN'],
      },
      {
        key: 'settings',
        label: '系统设置',
        icon: Settings,
        href: '/settings',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    group: '产品开发',
    items: [
      {
        key: 'dashboard',
        label: '调研看板',
        icon: LayoutDashboard,
        href: '/product-research/dashboard',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'products',
        label: '产品调研',
        icon: Search,
        href: '/product-research/products',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'comparisons',
        label: '产品对比',
        icon: Scale,
        href: '/product-research/comparisons',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'import',
        label: '数据导入',
        icon: Upload,
        href: '/product-research/import',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
];

// 根据当前用户角色过滤菜单
const filterMenuByRole = (role: UserRole): MenuGroup[] => {
  return menuConfig
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(role))
    }))
    .filter(group => group.items.length > 0);
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

  // 监听 Navbar 的移动端菜单按钮点击
  useEffect(() => {
    const handleToggleMobileMenu = () => {
      setIsMobileOpen(true);
    };

    window.addEventListener('toggle-mobile-menu', handleToggleMobileMenu);
    return () => window.removeEventListener('toggle-mobile-menu', handleToggleMobileMenu);
  }, []);
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
          {filteredMenu.map((group) => (
            <div key={group.group} className="mb-4">
              {!isCollapsed && (
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-2">
                  {group.group}
                </div>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
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
                        aria-label={isCollapsed ? item.label : undefined}
                      >
                        <div className="flex-shrink-0">
                          <item.icon className="h-5 w-5" />
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
            </div>
          ))}
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
            aria-expanded={!isCollapsed}
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
          aria-controls="sidebar-navigation"
          aria-expanded={isMobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </>
  );
}

// 获取当前用户角色 - 直接从 localStorage 读取（登录时已保存）
// 不再发起 API 请求，避免每次页面加载都阻塞
export const getCurrentUserRole = async (): Promise<UserRole> => {
  if (typeof window === 'undefined') return 'ADMIN';
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.role) return user.role as UserRole;
    }
  } catch {
    // 忽略解析错误
  }
  return 'ADMIN';
};
