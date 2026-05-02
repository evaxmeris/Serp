'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GlobalSearch from '@/components/ui/global-search';
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
  ChevronDown,
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
  History,
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
 * 完整菜单配置 - 8 个一级模块
 * 按业务性质分类：总览→产品中心→业务中心→供应链→仓储物流→财务管理→报表中心→系统设置
 */
const menuConfig: MenuGroup[] = [
  {
    group: '总览',
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
    group: '产品中心',
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
    group: '业务中心',
    items: [
      {
        key: 'customers',
        label: '客户列表',
        icon: Users,
        href: '/customers',
        roles: ['ADMIN', 'SALES'],
      },
      {
        key: 'quotations',
        label: '报价列表',
        icon: CircleDollarSign,
        href: '/quotations',
        roles: ['ADMIN', 'SALES'],
      },
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
    group: '供应链',
    items: [
      {
        key: 'suppliers',
        label: '供应商列表',
        icon: Building2,
        href: '/suppliers',
        roles: ['ADMIN', 'PURCHASING'],
      },
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
      {
        key: 'production-records',
        label: '生产管理',
        icon: Package,
        href: '/production',
        roles: ['ADMIN', 'PURCHASING', 'WAREHOUSE'],
      },
      {
        key: 'quality-checks',
        label: '质检管理',
        icon: ShieldCheck,
        href: '/quality',
        roles: ['ADMIN', 'WAREHOUSE'],
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
        key: 'invoices',
        label: '发票管理',
        icon: FileText,
        href: '/invoices',
        roles: ['ADMIN', 'SALES'],
      },
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
        key: 'audit-logs',
        label: '审计日志',
        icon: History,
        href: '/settings/audit-logs',
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
  // 手机端打开侧边栏时，强制展开显示文字
  const effectiveCollapsed = isMobileOpen ? false : isCollapsed;
  // 分组折叠状态 - 默认展开所有分组
  const allGroupNames = menuConfig.map(g => g.group);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(allGroupNames));

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

  // 切换分组展开/折叠
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const navRef = useRef<HTMLDivElement>(null);

  // 初始化分组状态 + 自动展开当前页所在分组 + 滚动到可见位置
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    // 找到当前路径匹配的分组
    let activeGroup: string | null = null;
    for (const group of filteredMenu) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          activeGroup = group.group;
          break;
        }
      }
      if (activeGroup) break;
    }
    
    const initialExpanded = new Set<string>();
    if (isMobile && activeGroup) {
      // 手机端只展开当前激活的分组
      initialExpanded.add(activeGroup);
    } else if (!isMobile) {
      // 桌面端全展开
      allGroupNames.forEach(g => initialExpanded.add(g));
    }
    setExpandedGroups(initialExpanded);
    
    // 滚动到激活项
    setTimeout(() => {
      if (navRef.current) {
        const activeEl = navRef.current.querySelector('[aria-current="page"]');
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, 100);
  }, []); // 只在挂载时执行

  // 路径变化时自动展开并滚动到激活菜单
  useEffect(() => {
    if (!pathname) return;
    // 找到当前路径匹配的分组
    for (const group of filteredMenu) {
      const hasActive = group.items.some(
        item => pathname === item.href || pathname.startsWith(item.href + '/')
      );
      if (hasActive) {
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.add(group.group);
          return next;
        });
        // 滚动到激活项
        setTimeout(() => {
          if (navRef.current) {
            const activeEl = navRef.current.querySelector('[aria-current="page"]');
            if (activeEl) {
              activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }, 100);
        break;
      }
    }
  }, [pathname]);

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
          effectiveCollapsed ? 'w-16' : 'w-max max-w-[220px] lg:w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
        role="navigation"
        aria-label="侧边导航"
      >
        <nav ref={navRef} className="flex-1 overflow-y-auto py-2 px-3">
          {filteredMenu.map((group) => {
            const isExpanded = expandedGroups.has(group.group);
            // 取第一个菜单项的图标作为分组图标
            const GroupIcon = group.items[0]?.icon;
            return (
              <div key={group.group} className="mb-1">
                {!effectiveCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.group)}
                    className="flex items-center gap-2 w-full text-base font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-l-[3px] border-blue-400/60 pl-[9px] pr-3 py-2 rounded-r-lg bg-zinc-50/80 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {GroupIcon && <GroupIcon className="h-5 w-5 flex-shrink-0" />}
                    <span className="flex-1 text-left">{group.group}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        isExpanded ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>
                )}
                {isExpanded && (
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
                                  : 'text-gray-900 dark:text-gray-100 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                                effectiveCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5 gap-2',
                              )}
                              title={effectiveCollapsed ? item.label : undefined}
                              aria-current={isActive ? 'page' : undefined}
                              aria-label={effectiveCollapsed ? item.label : undefined}
                            >
                              <div className="flex-shrink-0">
                                <item.icon className="h-5 w-5" />
                              </div>
                              {!effectiveCollapsed && (
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
                )}
              </div>
            );
          })}
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
