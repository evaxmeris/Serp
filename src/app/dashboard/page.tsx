'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  Plus,
  ShoppingCart,
  Download,
  Package,
  Search,
  Edit,
  UserPlus,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentUserRole } from '@/components/Sidebar';
import { UserRole } from '@/components/Sidebar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useToast, ToastContainer } from '@/components/ui/toast';

// 关键指标卡片数据结构
interface MetricCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  getValue: (data: DashboardData) => string | number;
  secondary?: string;
  roles: UserRole[];
}

// 快捷操作
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  roles: UserRole[];
}

// 待办事项
interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing';
}

interface DashboardData {
  overview: {
    pendingOrders: number;
    lowStockAlerts: number;
    pendingApprovals: number;
    pendingPayments: number;
    todaySales: number;
    monthlyGrossMargin: number;
  };
  salesTrend: Array<{ date: string; amount: number }>;
  channelDistribution: Array<{ name: string; value: number }>;
  recentTodos: TodoItem[];
  recentApprovals: TodoItem[];
}

// 根据角色获取要显示的指标卡片
const getMetricCards = (role: UserRole): MetricCard[] => {
  const allCards: MetricCard[] = [
    {
      id: 'pendingOrders',
      title: '待办订单',
      icon: <ClipboardList className="h-8 w-8" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      getValue: (data) => data.overview.pendingOrders,
      roles: ['admin', 'sales', 'warehouse'],
    },
    {
      id: 'lowStock',
      title: '库存预警',
      icon: <AlertTriangle className="h-8 w-8" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      getValue: (data) => `${data.overview.lowStockAlerts} 款`,
      roles: ['admin', 'purchasing', 'warehouse'],
    },
    {
      id: 'pendingApprovals',
      title: '审批待办',
      icon: <FileText className="h-8 w-8" />,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      getValue: (data) => data.overview.pendingApprovals,
      roles: ['admin'],
    },
    {
      id: 'pendingPayments',
      title: '待收款',
      icon: <DollarSign className="h-8 w-8" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      getValue: (data) => `$${data.overview.pendingPayments.toLocaleString()}`,
      roles: ['admin'],
    },
    {
      id: 'todaySales',
      title: '今日销售额',
      icon: <TrendingUp className="h-8 w-8" />,
      color: 'text-green-600',
      bgColor: 'bg-emerald-50',
      getValue: (data) => `$${data.overview.todaySales.toLocaleString()}`,
      roles: ['admin', 'sales'],
    },
    {
      id: 'monthlyMargin',
      title: '本月毛利率',
      icon: <BarChart3 className="h-8 w-8" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      getValue: (data) => `${data.overview.monthlyGrossMargin.toFixed(1)}%`,
      roles: ['admin'],
    },
  ];

  return allCards.filter(card => card.roles.includes(role)).slice(0, 5);
};

// 根据角色获取快捷操作
const getQuickActions = (role: UserRole): QuickAction[] => {
  const allActions: QuickAction[] = [
    { id: 'new-order', label: '➕ 新建订单', icon: <Plus className="h-5 w-5" />, href: '/orders/new', roles: ['admin', 'sales'] },
    { id: 'purchase-in', label: '📥 采购入库', icon: <Download className="h-5 w-5" />, href: '/inbound-orders/new', roles: ['admin', 'purchasing', 'warehouse'] },
    { id: 'ship-order', label: '📤 发货处理', icon: <Package className="h-5 w-5" />, href: '/outbound-orders/new', roles: ['admin', 'warehouse'] },
    { id: 'inventory-search', label: '🔍 库存查询', icon: <Search className="h-5 w-5" />, href: '/inventory', roles: ['admin', 'warehouse', 'purchasing'] },
    { id: 'expense', label: '📝 报销申请', icon: <Edit className="h-5 w-5" />, href: '/expenses/new', roles: ['admin', 'sales', 'purchasing', 'warehouse'] },
    { id: 'new-customer', label: '➕ 新建客户', icon: <UserPlus className="h-5 w-5" />, href: '/customers/new', roles: ['admin', 'sales'] },
    { id: 'new-purchase', label: '🛒 新建采购', icon: <ShoppingCart className="h-5 w-5" />, href: '/purchase-orders/new', roles: ['admin', 'purchasing'] },
    { id: 'inventory-report', label: '📊 库存报表', icon: <BarChart3 className="h-5 w-5" />, href: '/reports/inventory', roles: ['admin'] },
  ];

  return allActions.filter(action => action.roles.includes(role));
};

export default function DashboardPage() {
  const { toast, toasts, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState('7');
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');

  useEffect(() => {
    const loadRole = async () => {
      const role = await getCurrentUserRole();
      setCurrentRole(role);
    };
    loadRole();
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在挂载时执行一次

  useEffect(() => {
    if (period) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // 模拟数据 - 当 API 不可用时使用
  const getMockData = (): DashboardData => ({
    overview: { pendingOrders: 18, lowStockAlerts: 5, pendingApprovals: 3, pendingPayments: 24500, todaySales: 12800, monthlyGrossMargin: 43.25 },
    salesTrend: [{ date: '周一', amount: 3200 }, { date: '周二', amount: 4500 }, { date: '周三', amount: 3800 }, { date: '周四', amount: 5200 }, { date: '周五', amount: 6100 }, { date: '周六', amount: 4800 }, { date: '周日', amount: 5900 }],
    channelDistribution: [{ name: 'Alibaba', value: 45 }, { name: 'Amazon', value: 30 }, { name: 'TikTok', value: 15 }, { name: '其他', value: 10 }],
    recentTodos: [{ id: '1', title: '#1001', description: '张三 - 万圣节夜光笔 100pcs', status: 'pending' }, { id: '2', title: '#1002', description: '李四 - 圣诞帽 50pcs', status: 'processing' }, { id: '3', title: '#1003', description: '王五 - 发光手环 200pcs', status: 'pending' }],
    recentApprovals: [{ id: '1', title: '李四处', description: '差旅费报销 800元', status: 'pending' }, { id: '2', title: '王五', description: '采购申请 1200元', status: 'pending' }, { id: '3', title: '赵六', description: '绩效提成 3588元', status: 'pending' }],
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/overview?days=${period}`);
      const result = await response.json();
      if (result.success) {
        const apiData = result.data;
        const adaptedData: DashboardData = {
          overview: {
            pendingOrders: apiData.alerts?.pendingOrders ?? 0,
            lowStockAlerts: apiData.alerts?.lowStockItems ?? 0,
            pendingApprovals: apiData.alerts?.pendingApprovals ?? 0,
            pendingPayments: 0,
            todaySales: apiData.sales?.totalRevenue ?? 0,
            monthlyGrossMargin: apiData.sales?.growth ?? 0,
          },
          salesTrend: [],
          channelDistribution: [],
          recentTodos: [],
          recentApprovals: [],
        };
        setData(adaptedData);
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const metricCards = data ? getMetricCards(currentRole) : [];
  const quickActions = getQuickActions(currentRole);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* Skeleton for time range selector */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
        {/* Skeleton for metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 h-[100px] flex items-center">
              <Skeleton className="h-12 w-12 rounded-lg mr-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton for chart area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-6">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-56 mb-4" />
              <Skeleton className="h-[200px] w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (<>
    <div className="p-4 md:p-6 space-y-6">
        {/* 页面标题和筛选器 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-28px font-bold text-zinc-900 dark:text-white">
              📊 经营看板
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              概览您的业务运营数据
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="14">近 14 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
              <SelectItem value="90">近 90 天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 关键指标卡片 - 响应式 4列 → 2列 → 1列 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
          {metricCards.map((card) => (
            <Card key={card.id} className="h-[100px] overflow-hidden">
              <CardContent className="p-4 h-full flex items-center">
                <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center mr-4 flex-shrink-0`}>
                  <div className={card.color}>{card.icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {data && card.getValue(data)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 图表区域 - 两个图表并排 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">近 {parseInt(period)} 日销售额趋势</CardTitle>
              <CardDescription>📈 折线图展示销售趋势变化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.salesTrend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number) => [`¥${value.toLocaleString()}`, '销售额']}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">销售渠道占比</CardTitle>
              <CardDescription>🍋 饼图展示各渠道销售分布</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.channelDistribution ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {['#3b82f6', '#22c55e', '#a855f7', '#f97316'].map((color, idx) => (
                        <Cell key={idx} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number) => [`${value}%`, '占比']}
                    />
                    <Legend verticalAlign="bottom" height={30} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 快捷操作区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">⚡ 快捷操作</CardTitle>
            <CardDescription>根据您的角色配置常用操作入口</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all"
                  asChild
                >
                  <Link href={action.href}>
                    {action.icon}
                    <span className="text-sm font-medium">{action.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 待办区域 - 两列响应式 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">最近待办订单</CardTitle>
              <CardDescription>需要处理的近期订单</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data?.recentTodos.map((todo) => (
                  <li key={todo.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-white">{todo.title}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        todo.status === 'pending'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }`}>
                        {todo.status === 'pending' ? '待处理' : '处理中'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{todo.description}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-center">
                <Button variant="ghost" asChild>
                  <Link href="/orders">
                    查看全部 →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">最近审批</CardTitle>
              <CardDescription>等待您审批的事项</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data?.recentApprovals.map((item) => (
                  <li key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-white">{item.title}</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        待审批
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-center">
                <Button variant="ghost" asChild>
                  <Link href="/approvals">
                    查看全部 →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>);
}
