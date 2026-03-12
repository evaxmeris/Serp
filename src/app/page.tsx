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
    status: 'testing',
    progress: 95,
    apiCount: 9,
    pageCount: 4,
    testPass: '95.7%',
    icon: Package,
  },
  {
    sprint: 'Sprint 5',
    module: '出库管理',
    status: 'pending',
    progress: 0,
    apiCount: 8,
    pageCount: 4,
    testPass: '-',
    icon: Truck,
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
              整体完成度：80%
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
