'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  TrendingUp,
  Users,
  Building2,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  CircleDollarSign,
  Inbox,
  Truck,
  Ship,
  User,
  Scale,
  Upload,
  ShieldCheck,
  GitBranch,
  DollarSign,
  Link,
  Swords,
  Receipt,
  Warehouse,
  Globe,
  RefreshCw,
} from 'lucide-react';

export type UserRole =
  | 'ADMIN'
  | 'SALES'
  | 'PURCHASING'
  | 'WAREHOUSE'
  | 'VIEWER';

export interface MenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  roles: UserRole[];
}

export interface MenuGroup {
  group: string;
  items: MenuItem[];
}

/**
 * 完整菜单配置 - 12 个一级模块
 * 外贸ERP标准架构：仪表盘→客户→供应商→产品→产品开发→报价→订单→采购→仓储物流→财务管理→报表→系统设置
 */
const menuConfig: MenuGroup[] = [
  {
    group: '仪表盘',
    items: [
      {
        key: 'dashboard',
        label: '数据仪表盘',
        icon: LayoutDashboard,
        href: '/dashboard',
        roles: ['ADMIN', 'SALES', 'PURCHASING', 'WAREHOUSE', 'VIEWER'],
      },
    ],
  },
  {
    group: '客户管理',
    items: [
      {
        key: 'customers',
        label: '客户列表',
        icon: Users,
        href: '/customers',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
  {
    group: '供应商管理',
    items: [
      {
        key: 'suppliers',
        label: '供应商列表',
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
        icon: FileText,
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
    group: '产品开发',
    items: [
      {
        key: 'research-dashboard',
        label: '调研看板',
        icon: LayoutDashboard,
        href: '/product-research/dashboard',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'research-products',
        label: '产品调研',
        icon: Search,
        href: '/product-research/products',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'competitors',
        label: '竞品分析',
        icon: Swords,
        href: '/competitors',
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
        key: 'research-import',
        label: '数据导入',
        icon: Upload,
        href: '/product-research/import',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
  {
    group: '报价管理',
    items: [
      {
        key: 'quotations',
        label: '报价列表',
        icon: CircleDollarSign,
        href: '/quotations',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
  {
    group: '订单管理',
    items: [
      {
        key: 'orders',
        label: '订单列表',
        icon: ShoppingCart,
        href: '/orders',
        roles: ['ADMIN', 'SALES'],
      },
    ],
  },
  {
    group: '采购管理',
    items: [
      {
        key: 'purchase-orders',
        label: '采购订单',
        icon: Receipt,
        href: '/purchase-orders',
        roles: ['ADMIN', 'PURCHASING'],
      },
      {
        key: 'inbound-orders',
        label: '采购入库',
        icon: Inbox,
        href: '/inbound-orders',
        roles: ['ADMIN', 'PURCHASING', 'WAREHOUSE'],
      },
    ],
  },
  {
    group: '仓储物流',
    items: [
      {
        key: 'inventory',
        label: '库存管理',
        icon: Warehouse,
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
      {
        key: 'logistics-providers',
        label: '物流服务商',
        icon: Truck,
        href: '/logistics/providers',
        roles: ['ADMIN', 'PURCHASING'],
      },
      {
        key: 'logistics-orders',
        label: '物流订单',
        icon: Ship,
        href: '/logistics/orders',
        roles: ['ADMIN', 'PURCHASING'],
      },
      {
        key: 'shipments',
        label: '发货记录',
        icon: Globe,
        href: '/shipments',
        roles: ['ADMIN', 'WAREHOUSE'],
      },
    ],
  },
  {
    group: '财务管理',
    items: [
      {
        key: 'finance',
        label: '财务管理',
        icon: DollarSign,
        href: '/finance',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    group: '报表中心',
    items: [
      {
        key: 'reports',
        label: '报表中心',
        icon: TrendingUp,
        href: '/reports',
        roles: ['ADMIN'],
      },
      {
        key: 'report-subscriptions',
        label: '订阅管理',
        icon: BarChart3,
        href: '/reports/subscriptions',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    group: '系统设置',
    items: [
      {
        key: 'settings-users',
        label: '用户及权限',
        icon: User,
        href: '/settings/users',
        roles: ['ADMIN'],
      },
      {
        key: 'settings-roles',
        label: '角色管理',
        icon: ShieldCheck,
        href: '/settings/roles',
        roles: ['ADMIN'],
      },
      {
        key: 'approval-workflows',
        label: '审批流程',
        icon: GitBranch,
        href: '/settings/approval-workflows',
        roles: ['ADMIN'],
      },
      {
        key: 'warehouses',
        label: '仓库配置',
        icon: Package,
        href: '/settings/warehouses',
        roles: ['ADMIN'],
      },
      {
        key: 'platforms',
        label: '平台账号',
        icon: Link,
        href: '/settings/platforms',
        roles: ['ADMIN'],
      },
      {
        key: 'sync',
        label: '数据同步',
        icon: RefreshCw,
        href: '/sync',
        roles: ['ADMIN'],
      },
      {
        key: 'settings',
        label: '系统配置',
        icon: Settings,
        href: '/settings',
        roles: ['ADMIN'],
      },
    ],
  },
];

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

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  useEffect(() => {
    const handleToggleMobileMenu = () => {
      setIsMobileOpen(true);
    };
    window.addEventListener('toggle-mobile-menu', handleToggleMobileMenu);
    return () => window.removeEventListener('toggle-mobile-menu', handleToggleMobileMenu);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
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
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  const filteredMenu = filterMenuByRole(currentRole);

  const handleOverlayClick = () => {
    setIsMobileOpen(false);
    onMobileClose?.();
  };

  const handleMenuClick = (href: string) => {
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
      onMobileClose?.();
    }
    router.push(href);
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out h-screen pt-16',
          isCollapsed ? 'w-16' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
        role="navigation"
        aria-label="侧边导航"
      >
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {filteredMenu.map((group) => (
            <div key={group.group} className="mb-4">
              {!isCollapsed && (
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-2">
                  {group.group}
                </div>
              )}
              <ul className="space-y-1">
                {(() => {
                  const matchingItems = group.items.filter(
                    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
                  );
                  const bestMatch = matchingItems.length > 0
                    ? matchingItems.reduce((a, b) => a.href.length > b.href.length ? a : b)
                    : null;

                  return group.items.map((item) => {
                    const isActive = bestMatch?.key === item.key;
                    return (
                      <li key={item.key}>
                        <button
                          onClick={() => handleMenuClick(item.href)}
                          className={cn(
                            'flex items-center w-full rounded-lg transition-all duration-200 group',
                            isActive
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                            isCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5 gap-3'
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
                  });
                })()}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className={cn('w-full flex items-center justify-center', isCollapsed ? 'p-2' : 'p-2 gap-2')}
            aria-label={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="text-sm">收起</span></>}
          </Button>
        </div>
      </aside>

      {!isMobileOpen && (
        <button
          className="fixed top-4 left-4 z-30 lg:hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 shadow-md"
          onClick={() => setIsMobileOpen(true)}
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

export const getCurrentUserRole = async (): Promise<UserRole> => {
  if (typeof window === 'undefined') return 'ADMIN';
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.role) return user.role as UserRole;
    }
  } catch {}
  return 'ADMIN';
};
