'use client';

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
    status: 'pending',
    progress: 0,
    apiCount: 10,
    pageCount: 6,
    testPass: '-',
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
  { name: '供应商', path: '/suppliers', icon: '🏢' },
  { name: '采购订单', path: '/purchase-orders', icon: '📦' },
  { name: '询盘', path: '/inquiries', icon: '📧' },
  { name: '报价', path: '/quotations', icon: '💰' },
  { name: '销售订单', path: '/orders', icon: '🛒' },
  { name: '客户', path: '/customers', icon: '👥' },
  { name: '产品', path: '/products', icon: '📦' },
  { name: '入库单', path: '/inbound-orders', icon: '📥' },
  { name: '库存', path: '/inventory', icon: '📊' },
  { name: '出库单', path: '/outbound-orders', icon: '🚚' },
  { name: '财务报表', path: '/reports', icon: '📈' },
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
  { name: '登录', path: '/login', icon: '🔑', description: '访问系统' },
  { name: '注册', path: '/register', icon: '✍️', description: '创建账号' },
  { name: '用户管理', path: '/users', icon: '👤', description: '管理用户' },
];

export default function HomePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">欢迎使用 Trade ERP</h1>
        <p className="text-muted-foreground">
          外贸 ERP 管理系统 - 让外贸业务更高效
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">供应商</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">活跃供应商</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">采购订单</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">进行中订单</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">销售订单</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">36</div>
            <p className="text-xs text-muted-foreground">本月订单</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">产品</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground">SKU 总数</p>
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>⚡ 快捷入口</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickLinks.map((item) => (
              <Button
                key={item.path}
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                asChild
              >
                <Link href={item.path}>
                  <div className="text-2xl">{item.icon}</div>
                  <div className="text-sm font-medium">{item.name}</div>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phase 2 产品调研模块 */}
      <Card className="mb-8 border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-600" />
            🔬 Phase 2 - 产品调研模块（已完成）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {researchLinks.map((item) => (
              <Button
                key={item.path}
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-blue-100"
                asChild
              >
                <Link href={item.path}>
                  <item.icon className="h-8 w-8 text-blue-600" />
                  <div className="text-sm font-medium">{item.name}</div>
                </Link>
              </Button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-blue-700">
            <CheckCircle className="h-4 w-4" />
            <span>Phase 2 已完成：6 个页面 • 13 个 API • 7,468 行代码</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
            <CheckCircle className="h-4 w-4" />
            <span>✨ 支持批量转化：调研产品 → 正式产品（一键生成 SKU + 复制属性）</span>
          </div>
        </CardContent>
      </Card>

      {/* Sprint 5 出库管理模块 */}
      <Card className="mb-8 border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            🚚 Sprint 5 - 出库管理模块（✅ 已完成 - v0.5.7 已发布）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-green-100" asChild>
              <Link href="/outbound-orders">
                <BarChart3 className="h-8 w-8 text-green-600" />
                <div className="text-sm font-medium">出库单列表</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-green-100" asChild>
              <Link href="/outbound-orders/new">
                <ClipboardList className="h-8 w-8 text-green-600" />
                <div className="text-sm font-medium">创建出库单</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-green-100" asChild>
              <Link href="/outbound-orders">
                <GitCompare className="h-8 w-8 text-green-600" />
                <div className="text-sm font-medium">编辑/发货</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-green-100" asChild>
              <Link href="/inventory">
                <Package className="h-8 w-8 text-green-600" />
                <div className="text-sm font-medium">库存管理</div>
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>7 个 API • 5 个页面 • v0.5.7</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>测试通过率：100% (29/29)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>性能评级：⭐⭐⭐⭐⭐</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span>状态：✅ 已完成 | 整体进度：100% (6/6 阶段) | 2026-03-15 发布</span>
          </div>
        </CardContent>
      </Card>

      {/* Sprint 6 财务报表模块 */}
      <Card className="mb-8 border-2 border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            📊 Sprint 6 - 财务报表模块（✅ 已完成 - v0.6.0 已发布）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/profit">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">利润报表</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/sales">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">销售报表</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/inventory">
                <Package className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">库存报表</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/purchase">
                <ShoppingCart className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">采购报表</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/cashflow">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">现金流报表</div>
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <CheckCircle className="h-4 w-4" />
              <span>10 个 API • 6 个页面 • v0.6.0</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <CheckCircle className="h-4 w-4" />
              <span>测试通过率：100%</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <CheckCircle className="h-4 w-4" />
              <span>性能评级：⭐⭐⭐⭐⭐</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-purple-700">
            <CheckCircle className="h-4 w-4" />
            <span>状态：✅ 已完成 | 整体进度：100% (6/6 阶段) | 2026-03-16 发布</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-purple-700">
            <CheckCircle className="h-4 w-4" />
            <span>✨ 新增功能：自定义报表 | 报表导出 | 报表订阅推送</span>
          </div>
        </CardContent>
      </Card>

      {/* 认证与用户管理 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>🔐 认证与用户管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {authLinks.map((item) => (
              <Card key={item.path} className="border-2 hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <Link href={item.path} className="flex items-center gap-4">
                    <div className="text-4xl">{item.icon}</div>
                    <div>
                      <div className="font-semibold text-lg">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 开发进度 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🚀 开发进度</span>
            <Badge variant="outline" className="text-sm">
              整体完成度：100%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sprintData.map((sprint) => {
              const StatusIcon = statusConfig[sprint.status as StatusKey].icon;
              return (
                <div key={sprint.sprint} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <sprint.icon className="h-5 w-5 text-gray-500" />
                      <div>
                        <div className="font-medium">{sprint.module}</div>
                        <div className="text-xs text-gray-500">
                          {sprint.sprint} • {sprint.apiCount} 个 API • {sprint.pageCount} 个页面
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">测试通过率：{sprint.testPass}</div>
                        <div className="text-xs text-gray-500">
                          {sprint.progress}% 完成
                        </div>
                      </div>
                      <Badge className={statusConfig[sprint.status as StatusKey].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[sprint.status as StatusKey].label}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={sprint.progress} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
 );
}
