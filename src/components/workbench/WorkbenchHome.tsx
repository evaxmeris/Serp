'use client';

/**
 * 角色工作台首屏（二期前端包 B）
 *
 * 数据来源：GET /api/v1/workbench[?role=xxx]
 *   - 按登录角色返回待办聚合（todos / alerts / summary）
 *   - 管理员可用 ?role= 预览其他角色视角（view-as）
 *
 * 页面结构：
 *   1) 问候区：角色中文名 + 今日日期 + 数据更新时间 + 刷新
 *   2) 告警区：红色条（对账超阈值 / 平台同步失败 等，count > 0 才显示）
 *   3) 待办卡片组：每待办一张卡（大数字 + 单位），有 href 可点击跳列表页，无 href 为统计卡
 *   4) 管理员角色切换器（预览模式标记，切换后带 ?role= 重新拉取）
 *   5) 常用功能区（原首页快捷入口，保留在工作台下方）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  Globe2,
  Inbox,
  LayoutDashboard,
  Loader2,
  Mail,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Scale,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// ============================================================
// 类型（与 src/lib/workbench.ts 的 WorkbenchPayload 对齐）
// ============================================================

interface WorkbenchTodo {
  key: string;
  label: string;
  count: number;
  amount?: number;
  unit?: string;
  href?: string;
  hint?: string;
}

interface WorkbenchPayload {
  role: string;
  roleName: string;
  roleDisplay: string;
  roles: string[];
  scope: 'global' | 'self' | string;
  generatedAt: string;
  todos: WorkbenchTodo[];
  alerts: Record<string, number>;
  summary: Record<string, unknown>;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type LoadState = 'loading' | 'ready' | 'error' | 'unauthorized';

// ============================================================
// 常量
// ============================================================

/** 管理员可在角色切换器中预览的视角 */
const VIEW_AS_ROLES: Array<{ value: string; label: string }> = [
  { value: '', label: '我的视角（默认）' },
  { value: 'owner', label: '老板 / 决策' },
  { value: 'ops', label: '运营' },
  { value: 'finance', label: '财务' },
  { value: 'purchasing', label: '采购' },
  { value: 'warehouse', label: '仓管' },
  { value: 'sales', label: '业务' },
];

/** 告警 key → 文案与跳转（接口 alerts 里的字段） */
const ALERT_META: Record<string, { label: string; href?: string; unit: string }> = {
  reconcileAlerts: { label: '对账差异超阈值', href: '/overseas/reconcile', unit: '条' },
  platformSyncFailures24h: {
    label: '平台同步失败（近 24 小时）',
    href: '/settings/sync-logs?status=failed',
    unit: '次',
  },
  pendingReplenishmentSuggestions: {
    label: '补货建议待处理',
    href: '/replenishment/suggestions?status=PENDING',
    unit: '条',
  },
};

/** 待办 key → 图标 */
const TODO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  todayOrders: ShoppingCart,
  inventoryValue: Boxes,
  overseasTotalAvailable: Globe2,
  alerts: AlertTriangle,
  reconcileAlerts: Scale,
  platformSyncFailures24h: RefreshCw,
  pendingReplenishmentSuggestions: PackagePlus,
  ordersAwaitingPayment: Wallet,
  supplierPaymentsPending: CreditCard,
  monthIncome: TrendingUp,
  monthExpense: TrendingDown,
  pendingPurchaseOrders: ClipboardList,
  pendingReceiptPurchaseOrders: Truck,
  pendingInboundOrders: Inbox,
  draftTransfers: ArrowLeftRight,
  inTransitTransfers: Truck,
  pendingOutboundOrders: PackageCheck,
  myInquiriesInProgress: Mail,
  quotationsToSend: FileText,
  myOrdersInProgress: ShoppingCart,
};

/** 数量 > 0 时需要标红的待办（真待办/告警类） */
const ATTENTION_KEYS = new Set([
  'reconcileAlerts',
  'platformSyncFailures24h',
  'pendingReplenishmentSuggestions',
  'alerts',
]);

/** 以「金额」为主显示的纯统计卡（无数量语义）；其余一律数量为主、金额为辅 */
const AMOUNT_PRIMARY_KEYS = new Set(['inventoryValue', 'monthIncome', 'monthExpense']);

/** 常用功能区（原首页快捷入口，保留在工作台下方） */
const QUICK_LINKS = [
  { name: '供应商', path: '/suppliers', icon: Building2 },
  { name: '采购订单', path: '/purchase-orders', icon: ClipboardList },
  { name: '询盘', path: '/inquiries', icon: Mail },
  { name: '报价', path: '/quotations', icon: CircleDollarSign },
  { name: '销售订单', path: '/orders', icon: ShoppingCart },
  { name: '客户', path: '/customers', icon: Users },
  { name: '产品', path: '/products', icon: PackageCheck },
  { name: '入库单', path: '/inbound-orders', icon: Inbox },
  { name: '库存', path: '/inventory', icon: Boxes },
  { name: '出库单', path: '/outbound-orders', icon: Truck },
  { name: '财务报表', path: '/reports', icon: TrendingUp },
  { name: '海外仓', path: '/overseas', icon: Globe2 },
];

/** 快捷操作（原首页「快捷操作」区，按当前工作台角色过滤） */
const QUICK_ACTIONS: Array<{
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}> = [
  {
    id: 'new-order',
    label: '新建订单',
    href: '/orders/new',
    icon: ShoppingCart,
    roles: ['admin', 'owner', 'sales'],
  },
  {
    id: 'new-purchase',
    label: '新建采购',
    href: '/purchase-orders/new',
    icon: ClipboardList,
    roles: ['admin', 'owner', 'purchasing'],
  },
  {
    id: 'purchase-in',
    label: '采购入库',
    href: '/inbound-orders/new',
    icon: Inbox,
    roles: ['admin', 'owner', 'purchasing', 'warehouse'],
  },
  {
    id: 'ship-order',
    label: '发货处理',
    href: '/outbound-orders/new',
    icon: Truck,
    roles: ['admin', 'owner', 'warehouse'],
  },
  {
    id: 'inventory-search',
    label: '库存查询',
    href: '/inventory',
    icon: Boxes,
    roles: ['admin', 'owner', 'warehouse', 'purchasing'],
  },
  {
    id: 'new-customer',
    label: '新建客户',
    href: '/customers/new',
    icon: Users,
    roles: ['admin', 'owner', 'sales'],
  },
  {
    id: 'reconcile',
    label: '海外仓对账',
    href: '/overseas/reconcile',
    icon: Scale,
    roles: ['admin', 'owner', 'ops', 'finance'],
  },
];

// ============================================================
// 工具函数
// ============================================================

const amountFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const countFormatter = new Intl.NumberFormat('zh-CN');

function formatAmount(amount: number): string {
  return `¥${amountFormatter.format(amount)}`;
}

/** 百万级金额压缩显示（万），避免卡片数字撑破 */
function formatAmountCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `¥${(amount / 10000).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} 万`;
  }
  return formatAmount(amount);
}

function greetingByHour(hour: number): string {
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function todayLabel(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function isAdminPayload(data: WorkbenchPayload | null): boolean {
  if (!data) return false;
  const roles = [...(data.roles ?? []), data.role, data.roleName].filter(Boolean);
  return roles.some(r => r === 'admin' || r === 'super-admin' || r === 'super_admin');
}

function isAttention(todo: WorkbenchTodo): boolean {
  return ATTENTION_KEYS.has(todo.key) && todo.count > 0;
}

// ============================================================
// 子组件
// ============================================================

function TodoCard({ todo, index }: { todo: WorkbenchTodo; index: number }) {
  const Icon = TODO_ICONS[todo.key] ?? LayoutDashboard;
  const hasAmount = typeof todo.amount === 'number';
  const amountValue = (todo.amount ?? 0) as number;
  const amountPrimary = hasAmount && AMOUNT_PRIMARY_KEYS.has(todo.key);
  const clickable = Boolean(todo.href);
  const attention = isAttention(todo);

  // 纯统计卡以金额为主显示；待办卡以数量为主，金额作为补充说明
  const primaryText = amountPrimary ? formatAmountCompact(amountValue) : countFormatter.format(todo.count);
  const secondaryText = amountPrimary ? undefined : todo.unit;
  const amountLine =
    hasAmount && !amountPrimary && amountValue > 0 ? `合计 ${formatAmount(amountValue)}` : undefined;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            attention
              ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {clickable ? (
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">统计</span>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm leading-snug text-muted-foreground" title={todo.label}>
          {todo.label}
        </p>
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'break-all text-3xl font-bold tabular-nums tracking-tight md:text-4xl',
              attention ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            )}
          >
            {primaryText}
          </span>
          {secondaryText ? (
            <span className="text-xs font-medium text-muted-foreground">{secondaryText}</span>
          ) : null}
        </p>
        {amountLine ? (
          <p className="text-xs font-medium text-muted-foreground">{amountLine}</p>
        ) : null}
      </div>

      {todo.hint ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80" title={todo.hint}>
          {todo.hint}
        </p>
      ) : null}

      {clickable ? (
        <p className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          查看列表 →
        </p>
      ) : null}
    </>
  );

  const baseClass = cn(
    'flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 md:p-5',
    clickable && 'group cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
    attention && 'border-red-200 dark:border-red-900/60'
  );

  if (clickable) {
    return (
      <Link
        href={todo.href as string}
        className={cn(baseClass, 'animate-in fade-in-0 slide-in-from-bottom-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
        style={{ animationDelay: `${index * 40}ms` }}
        data-todo-key={todo.key}
        aria-label={`${todo.label}，${primaryText}${secondaryText ? `，${secondaryText}` : ''}，点击查看列表`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={cn(baseClass, 'animate-in fade-in-0 slide-in-from-bottom-1')}
      style={{ animationDelay: `${index * 40}ms` }}
      data-todo-key={todo.key}
    >
      {body}
    </div>
  );
}

function TodoCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="mt-3 h-3 w-full" />
    </div>
  );
}

function WorkbenchSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="工作台加载中">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <TodoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function WorkbenchHome() {
  const { toast, toasts, removeToast } = useToast();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [data, setData] = useState<WorkbenchPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [roleParam, setRoleParam] = useState('');
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);

  // 首屏：读取 URL 上的 ?role=（管理员预览），并取当前用户
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('role') ?? '';
    setRoleParam(fromUrl);
    setMounted(true);
    setNow(new Date());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!cancelled && json?.success && json.data) {
          setUser({
            id: json.data.id,
            name: json.data.name ?? json.data.email ?? '',
            email: json.data.email ?? '',
            role: json.data.role ?? '',
          });
        }
      })
      .catch(() => {
        /* 用户名拿不到不影响工作台主体 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWorkbench = useCallback(
    async (role: string, options?: { silent?: boolean }) => {
      const seq = ++requestSeq.current;
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoadState('loading');
      }
      setErrorMessage('');

      try {
        const query = role ? `?role=${encodeURIComponent(role)}` : '';
        const res = await fetch(`/api/v1/workbench${query}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        if (seq !== requestSeq.current) return;

        if (res.status === 401 || res.status === 403) {
          setData(null);
          setLoadState('unauthorized');
          return;
        }

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          const msg = json?.error || json?.message || `接口暂时不可用（HTTP ${res.status}）`;
          setData(null);
          setErrorMessage(msg);
          setLoadState('error');
          if (options?.silent) toast.error(`刷新失败：${msg}`);
          return;
        }

        const payload = json.data as WorkbenchPayload;
        setData(payload);
        setLoadState('ready');
        if (options?.silent) toast.success('工作台已刷新');
      } catch (e) {
        if (seq !== requestSeq.current) return;
        const msg = e instanceof Error ? e.message : '网络异常';
        setData(null);
        setErrorMessage(msg);
        setLoadState('error');
        if (options?.silent) toast.error(`刷新失败：${msg}`);
      } finally {
        if (seq === requestSeq.current) setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!mounted) return;
    loadWorkbench(roleParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, roleParam]);

  const adminView = isAdminPayload(data);

  const handleRoleChange = (next: string) => {
    if (next === roleParam) return;
    setRoleParam(next);
    const url = next ? `/dashboard?role=${encodeURIComponent(next)}` : '/dashboard';
    window.history.replaceState(null, '', url);
    const label = VIEW_AS_ROLES.find(r => r.value === next)?.label ?? next;
    toast.info(next ? `预览模式：正在查看「${label}」视角` : '已回到我的默认视角');
  };

  const alerts = useMemo(() => {
    if (!data?.alerts) return [] as Array<{ key: string; label: string; count: number; unit: string; href?: string }>;
    return Object.entries(data.alerts)
      .filter(([key, count]) => key !== 'total' && typeof count === 'number' && count > 0)
      .map(([key, count]) => {
        const meta = ALERT_META[key] ?? { label: key, unit: '项' };
        return { key, label: meta.label, count, unit: meta.unit, href: meta.href };
      });
  }, [data]);

  const totalAlerts = data?.alerts?.total ?? alerts.reduce((sum, a) => sum + a.count, 0);
  /** 该角色是否带告警口径（空对象代表接口没给这类数据，不谎报“暂无告警”） */
  const hasAlertsData = Boolean(data && Object.keys(data.alerts ?? {}).length > 0);

  const summaryNote = typeof data?.summary?.note === 'string' ? (data.summary.note as string) : '';

  const quickActions = useMemo(() => {
    const role = data?.role ?? '';
    return QUICK_ACTIONS.filter(action => action.roles.includes(role));
  }, [data?.role]);

  /** 下拉选项：URL 里带了非下拉内的 role（如 viewer）时补一项，避免 select 显示空白 */
  const viewAsOptions = useMemo(() => {
    if (!roleParam || VIEW_AS_ROLES.some(r => r.value === roleParam)) return VIEW_AS_ROLES;
    return [
      ...VIEW_AS_ROLES,
      { value: roleParam, label: `${data?.roleDisplay ?? roleParam}（URL 指定）` },
    ];
  }, [roleParam, data?.roleDisplay]);

  const greeting = now ? greetingByHour(now.getHours()) : '你好';
  const displayName = user?.name?.trim() || '';
  const roleDisplay = data?.roleDisplay ?? '';
  const previewing = adminView && Boolean(roleParam) && data?.role !== 'admin';

  return (
    <>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
        {loadState === 'loading' ? (
          <WorkbenchSkeleton />
        ) : loadState === 'unauthorized' ? (
          <Card className="animate-in fade-in-0">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Eye className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">需要登录后查看工作台</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                登录状态已失效，请重新登录。登录后将按你的角色自动展示待办与告警。
              </p>
              <Button asChild className="mt-2">
                <Link href="/login">去登录</Link>
              </Button>
            </CardContent>
          </Card>
        ) : loadState === 'error' ? (
          <Card className="animate-in fade-in-0 border-red-200 dark:border-red-900/60">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <p className="text-lg font-medium text-foreground">工作台数据加载失败</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {errorMessage ? `${errorMessage}，` : ''}
                暂时取不到待办汇总，请稍后重试。你的业务数据没有异常，只是这次没能汇总。
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={() => loadWorkbench(roleParam)}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  重新加载
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/orders">直接去订单列表</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 问候区 */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
                    {greeting}
                    {displayName ? `，${displayName}` : ''}
                  </h1>
                  {roleDisplay ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {roleDisplay}工作台
                    </span>
                  ) : null}
                  {previewing ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      预览模式
                    </span>
                  ) : null}
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {now ? todayLabel(now) : '—'}
                  </span>
                  {data ? (
                    <span className="text-xs text-muted-foreground/80">
                      数据更新于 {timeLabel(data.generatedAt)}
                    </span>
                  ) : null}
                  {data?.scope === 'self' ? (
                    <span className="text-xs text-muted-foreground/80">（个人视角）</span>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {adminView ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 shadow-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <label htmlFor="view-as" className="text-xs font-medium text-muted-foreground">
                      预览视角
                    </label>
                    <select
                      id="view-as"
                      value={roleParam}
                      onChange={e => handleRoleChange(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="切换预览角色"
                    >
                      {viewAsOptions.map(r => (
                        <option key={r.value || 'default'} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadWorkbench(roleParam, { silent: true })}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  刷新
                </Button>
              </div>
            </header>

            {/* 预览模式提示条 */}
            {previewing ? (
              <div className="animate-in fade-in-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <span>
                  预览模式：当前展示的是「{roleDisplay}」视角的待办，仅用于巡检，不影响你本人角色的权限。
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                  onClick={() => handleRoleChange('')}
                >
                  回到我的视角
                </button>
              </div>
            ) : null}

            {/* 告警区 */}
            {alerts.length > 0 ? (
              <section
                aria-label="告警"
                className="animate-in fade-in-0 space-y-2 rounded-xl border border-red-200 bg-red-50/80 p-3 dark:border-red-900/60 dark:bg-red-950/30"
              >
                <div className="flex items-center gap-2 px-1">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
                    需要关注（{totalAlerts} 项）
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {alerts.map(a => {
                    const content = (
                      <>
                        <span className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200">
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                            {countFormatter.format(a.count)}
                          </span>
                          {a.label}
                        </span>
                        {a.href ? <ArrowRight className="h-4 w-4 shrink-0 text-red-500" /> : null}
                      </>
                    );
                    return a.href ? (
                      <Link
                        key={a.key}
                        href={a.href}
                        className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white/70 px-3 py-2 transition-colors hover:bg-white dark:border-red-900/50 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                        data-alert-key={a.key}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={a.key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white/70 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30"
                        data-alert-key={a.key}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : hasAlertsData ? (
              <div className="animate-in fade-in-0 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                <span className="text-base leading-none">✓</span>
                暂无告警，对账差异与同步任务状态正常
              </div>
            ) : null}

            {/* 待办卡片组 */}
            <section aria-label="待办" className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-foreground">今日待办</h2>
                <span className="text-xs text-muted-foreground">
                  共 {data?.todos?.length ?? 0} 项 · 点击卡片进入对应列表
                </span>
              </div>

              {data && data.todos.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5">
                  {data.todos.map((todo, index) => (
                    <TodoCard key={todo.key} todo={todo} index={index} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <ClipboardList className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-base font-medium text-foreground">该角色当前没有待办</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                      {summaryNote || '所有事项都已处理完毕。如需分配工作台角色，请联系管理员。'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* 常用功能区（原首页快捷入口 + 快捷操作） */}
            <section aria-label="常用功能" className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-foreground">常用功能</h2>
                <span className="text-xs text-muted-foreground">常用模块快捷入口</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {QUICK_LINKS.map(link => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={`${link.name}-${link.path}`}
                      href={link.path}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-medium text-foreground">{link.name}</span>
                    </Link>
                  );
                })}
              </div>

              {quickActions.length > 0 ? (
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="mb-3 text-sm font-semibold text-foreground">快捷操作</p>
                  <div className="flex flex-wrap gap-2">
                    {quickActions.map(action => {
                      const Icon = action.icon;
                      return (
                        <Button key={action.id} variant="outline" size="sm" asChild>
                          <Link href={action.href} className="gap-1.5">
                            <Icon className="h-4 w-4" />
                            {action.label}
                          </Link>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
