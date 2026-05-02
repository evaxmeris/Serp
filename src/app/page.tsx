import { redirect } from 'next/navigation';

// ============================================================
// 注意：以下数据（sprintData, quickLinks, researchLinks, authLinks 等）
// 是原开发进度展示页的数据，如需迁移到 /dashboard 页，请使用这些数据。
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  FileText,
  Users,
  Truck,
  TrendingUp,
  DollarSign,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  UserCog,
  LogIn,
  UserPlus,
  Key,
  FlaskConical,
  ClipboardList,
  GitCompare,
  LayoutDashboard,
  Building2,
  Mail,
  CircleDollarSign,
  PackageCheck,
  Inbox,
  User,
} from 'lucide-react';

// 模块开发进度数据
const sprintData = [
  {
    sprint: 'Sprint 1',
    module: '供应商与采购',
    status: 'completed',
    progress: 100,
    apiCount: 12,
    pageCount: 4,
    testPass: '100%',
    icon: ShoppingCart,
  },
  {
    sprint: 'Sprint 2',
    module: '报价与销售',
    status: 'completed',
    progress: 100,
    apiCount: 16,
    pageCount: 5,
    testPass: '100%',
    icon: FileText,
  },
  {
    sprint: 'Sprint 3',
    module: '产品与客户',
    status: 'completed',
    progress: 100,
    apiCount: 14,
    pageCount: 4,
    testPass: '100%',
    icon: Users,
  },
  {
    sprint: 'Sprint 4',
    module: '入库与库存',
    status: 'completed',
    progress: 100,
    apiCount: 9,
    pageCount: 4,
    testPass: '100%',
    icon: Package,
  },
  {
    sprint: 'Phase 2',
    module: '产品调研（新增）',
    status: 'completed',
    progress: 100,
    apiCount: 13,
    pageCount: 6,
    testPass: '100%',
    icon: FlaskConical,
  },
  {
    sprint: 'Sprint 5',
    module: '出库管理',
    status: 'completed',
    progress: 100,
    apiCount: 7,
    pageCount: 5,
    testPass: '100%',
    icon: Truck,
  },
  {
    sprint: 'Phase 3',
    module: '产品一键转化（新增）',
    status: 'completed',
    progress: 100,
    apiCount: 2,
    pageCount: 1,
    testPass: '100%',
    icon: CheckCircle,
  },
  {
    sprint: 'Sprint 6',
    module: '财务报表',
    status: 'completed',
    progress: 100,
    apiCount: 10,
    pageCount: 6,
    testPass: '100%',
    icon: TrendingUp,
  },
];

const statusConfig = {
  completed: {
    label: '已完成',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  testing: {
    label: '测试中',
    color: 'bg-blue-100 text-blue-800',
    icon: AlertCircle,
  },
  pending: {
    label: '待开发',
    color: 'bg-gray-100 text-gray-800',
    icon: Clock,
  },
} as const;

type StatusKey = keyof typeof statusConfig;

const quickLinks = [
  { name: '供应商', path: '/suppliers', icon: Building2 },
  { name: '采购订单', path: '/purchase-orders', icon: Package },
  { name: '询盘', path: '/inquiries', icon: Mail },
  { name: '报价', path: '/quotations', icon: CircleDollarSign },
  { name: '销售订单', path: '/orders', icon: ShoppingCart },
  { name: '客户', path: '/customers', icon: Users },
  { name: '产品', path: '/products', icon: PackageCheck },
  { name: '入库单', path: '/inbound-orders', icon: Inbox },
  { name: '库存', path: '/inventory', icon: BarChart3 },
  { name: '出库单', path: '/outbound-orders', icon: Truck },
  { name: '财务报表', path: '/reports', icon: TrendingUp },
];

// Phase 2 产品调研模块快捷入口
const researchLinks = [
  { name: '品类管理', path: '/product-research/categories', icon: ClipboardList },
  { name: '属性模板', path: '/product-research/templates', icon: FlaskConical },
  { name: '产品列表', path: '/product-research/products', icon: Package },
  { name: '产品对比', path: '/product-research/comparisons', icon: GitCompare },
  { name: '数据看板', path: '/product-research/dashboard', icon: LayoutDashboard },
];

const authLinks = [
  { name: '登录', path: '/login', icon: LogIn, description: '访问系统' },
  { name: '注册', path: '/register', icon: UserPlus, description: '创建账号' },
  { name: '用户管理', path: '/users', icon: User, description: '管理用户' },
];

// 根路由重定向到 /dashboard（仪表盘）
export default function HomePage() {
  redirect('/dashboard');
}
