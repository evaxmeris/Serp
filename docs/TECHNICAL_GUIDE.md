# Trade ERP 开发技术指导

**日期:** 2026-03-06  
**版本:** v1.0  
**作者:** 系统架构师

---

## 1. 开发环境配置

### 1.1 前置要求

```bash
# Node.js >= 20.x
node -v

# npm >= 10.x
npm -v

# PostgreSQL >= 15
psql --version

# Git
git --version
```

### 1.2 环境搭建

```bash
# 克隆项目
git clone <repo-url>
cd trade-erp

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 编辑 .env，配置数据库连接
# DATABASE_URL="postgresql://user:password@localhost:5432/trade_erp?schema=public"

# 启动数据库 (使用 Docker)
docker-compose up -d db

# 等待数据库就绪后，初始化数据库
npx prisma generate
npx prisma db push

# (可选) 填充示例数据
npx prisma db seed

# 启动开发服务器
npm run dev
```

### 1.3 目录结构规范

```
trade-erp/
├── prisma/
│   ├── schema.prisma        # 数据库模型
│   ├── migrations/          # 数据库迁移
│   └── seeds/               # 种子数据
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/          # API v1 版本
│   │   │       ├── orders/  # 订单 API
│   │   │       ├── suppliers/
│   │   │       └── ...
│   │   ├── (dashboard)/     # 仪表板页面组
│   │   ├── (auth)/          # 认证页面组
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/              # 基础 UI 组件 (shadcn)
│   │   ├── business/        # 业务组件
│   │   │   ├── orders/
│   │   │   ├── customers/
│   │   │   └── ...
│   │   └── shared/          # 共享组件
│   ├── hooks/               # 自定义 Hooks
│   ├── lib/
│   │   ├── prisma.ts        # Prisma 客户端
│   │   ├── auth.ts          # 认证工具
│   │   ├── validators/      # Zod 验证器
│   │   └── utils.ts         # 工具函数
│   ├── types/               # TypeScript 类型定义
│   └── middleware.ts        # 中间件
├── public/                  # 静态资源
├── tests/                   # 测试文件
├── docs/                    # 文档
└── scripts/                 # 脚本工具
```

---

## 2. 编码规范

### 2.1 TypeScript 规范

```typescript
// ✅ 好的实践

// 1. 使用明确的类型定义
interface Order {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
}

// 2. 使用枚举定义状态
enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

// 3. 使用 Zod 进行运行时验证
import { z } from 'zod';

const createOrderSchema = z.object({
  customerId: z.string().cuid(),
  items: z.array(z.object({
    productId: z.string().cuid().optional(),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  notes: z.string().max(1000).optional(),
});

// 4. 使用异步/等待处理异步操作
async function getOrderById(id: string): Promise<Order | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, customer: true },
  });
  return order;
}

// 5. 使用可选链和空值合并
const customerName = order?.customer?.companyName ?? '未知客户';
```

```typescript
// ❌ 避免的做法

// 1. 避免使用 any
// function processData(data: any) { ... }  // ❌
function processData(data: unknown) { ... }  // ✅

// 2. 避免嵌套的 Promise
// order.getItems().then(items => { ... })  // ❌
const items = await order.getItems();  // ✅

// 3. 避免魔法数字
// if (status === 1) { ... }  // ❌
if (status === OrderStatus.CONFIRMED) { ... }  // ✅
```

### 2.2 API 路由规范

```typescript
// src/app/api/v1/orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createOrderSchema, listOrdersSchema } from '@/lib/validators/order';
import { APIResponse, PaginatedResponse } from '@/types/api';

// GET /api/v1/orders
export async function GET(request: NextRequest) {
  try {
    // 1. 认证检查
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 参数验证
    const searchParams = request.nextUrl.searchParams;
    const validatedParams = listOrdersSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      // ...
    });

    // 3. 构建查询条件
    const { page, limit, status, customerId, search } = validatedParams;
    const where: any = {};

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { customer: { companyName: { contains: search } } },
      ];
    }

    // 4. 执行查询
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true } },
          items: { select: { id: true, quantity: true, amount: true } },
          _count: { select: { items: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // 5. 返回统一格式响应
    return NextResponse.json<APIResponse<PaginatedResponse<any>>>({
      success: true,
      code: 'SUCCESS',
      data: {
        items: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // 6. 统一错误处理
    console.error('[GET /api/v1/orders] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/orders
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      );
    }

    // 解析并验证请求体
    const body = await request.json();
    const validatedData = createOrderSchema.parse(body);

    // 使用事务创建订单
    const order = await prisma.$transaction(async (tx) => {
      // 1. 生成订单号
      const orderNo = await generateOrderNo(tx);

      // 2. 计算总金额
      const totalAmount = validatedData.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice * (1 - (item.discountRate || 0)),
        0
      );

      // 3. 创建订单
      const createdOrder = await tx.order.create({
        data: {
          orderNo,
          customerId: validatedData.customerId,
          currency: validatedData.currency || 'USD',
          totalAmount,
          paymentTerms: validatedData.paymentTerms,
          deliveryDate: validatedData.deliveryDate,
          salesRepId: session.user.id,
          items: {
            create: validatedData.items.map(item => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      // 4. 创建操作日志
      await tx.auditLog.create({
        data: {
          action: 'ORDER_CREATED',
          entityType: 'Order',
          entityId: createdOrder.id,
          userId: session.user.id,
          details: { orderNo },
        },
      });

      return createdOrder;
    });

    return NextResponse.json(
      {
        success: true,
        code: 'CREATED',
        data: order,
        message: '订单创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    // 错误处理同上
  }
}
```

### 2.3 数据库操作规范

```typescript
// ✅ 好的实践

// 1. 使用事务处理相关操作
async function confirmOrder(orderId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // 创建生产记录
    for (const item of order.items) {
      await tx.productionRecord.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          plannedStartDate: new Date(),
          plannedEndDate: addDays(new Date(), 30),
        },
      });
    }

    // 记录日志
    await tx.auditLog.create({
      data: {
        action: 'ORDER_CONFIRMED',
        entityType: 'Order',
        entityId: orderId,
        userId,
      },
    });

    return order;
  });
}

// 2. 使用 include 避免 N+1 查询
const orders = await prisma.order.findMany({
  include: {
    customer: true,
    items: { include: { product: true } },
    salesRep: { select: { id: true, name: true } },
  },
});

// 3. 使用 select 只获取需要的字段
const orderSummary = await prisma.order.findUnique({
  where: { id: orderId },
  select: {
    id: true,
    orderNo: true,
    totalAmount: true,
    status: true,
    customer: {
      select: { companyName: true },
    },
  },
});

// 4. 使用批量操作
await prisma.orderItem.createMany({
  data: items.map(item => ({
    orderId,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })),
});

// 5. 使用乐观锁处理并发
async function updateInventory(productId: string, quantity: number) {
  const result = await prisma.inventoryItem.update({
    where: {
      id_productId_warehouse: {
        productId,
        warehouse: 'MAIN',
      },
      // 乐观锁：版本号匹配
      version: currentVersion,
    },
    data: {
      quantity: { increment: quantity },
      version: { increment: 1 },
    },
  });
  return result;
}
```

---

## 3. 组件开发规范

### 3.1 业务组件结构

```typescript
// src/components/business/orders/OrderList.tsx

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Order } from '@/types';
import { OrderTable } from './OrderTable';
import { OrderFilters } from './OrderFilters';
import { Pagination } from '@/components/ui/pagination';
import { fetchOrders } from '@/lib/api/orders';

interface OrderListProps {
  initialFilters?: OrderFilters;
}

export function OrderList({ initialFilters }: OrderListProps) {
  const [filters, setFilters] = useState(initialFilters ?? {});
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', filters, page],
    queryFn: () => fetchOrders({ ...filters, page }),
  });

  if (error) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div className="space-y-4">
      <OrderFilters filters={filters} onChange={setFilters} />
      
      <OrderTable 
        orders={data?.items ?? []} 
        loading={isLoading}
      />
      
      {data?.pagination && (
        <Pagination
          currentPage={page}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

### 3.2 表单组件规范

```typescript
// src/components/business/orders/OrderForm.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOrderSchema, type CreateOrderInput } from '@/lib/validators/order';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OrderItemsEditor } from './OrderItemsEditor';

interface OrderFormProps {
  onSubmit: (data: CreateOrderInput) => Promise<void>;
  onCancel: () => void;
}

export function OrderForm({ onSubmit, onCancel }: OrderFormProps) {
  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      currency: 'USD',
      items: [],
    },
  });

  const handleSubmit = async (data: CreateOrderInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // 错误处理
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* 客户选择 */}
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>客户</FormLabel>
              <FormControl>
                <CustomerSelect {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 商品列表编辑器 */}
        <FormField
          control={form.control}
          name="items"
          render={({ field }) => (
            <FormItem>
              <FormLabel>商品明细</FormLabel>
              <FormControl>
                <OrderItemsEditor 
                  items={field.value} 
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 提交按钮 */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '提交中...' : '创建订单'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## 4. 测试规范

### 4.1 单元测试

```typescript
// tests/unit/validators/order.test.ts

import { describe, it, expect } from 'vitest';
import { createOrderSchema } from '@/lib/validators/order';

describe('createOrderSchema', () => {
  it('should validate valid order data', () => {
    const validData = {
      customerId: 'clxxx123',
      items: [
        {
          productName: 'Test Product',
          quantity: 10,
          unitPrice: 100,
        },
      ],
    };

    const result = createOrderSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject empty items', () => {
    const invalidData = {
      customerId: 'clxxx123',
      items: [],
    };

    const result = createOrderSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['items']);
  });

  it('should reject negative quantity', () => {
    const invalidData = {
      customerId: 'clxxx123',
      items: [
        {
          productName: 'Test Product',
          quantity: -1,
          unitPrice: 100,
        },
      ],
    };

    const result = createOrderSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

### 4.2 集成测试

```typescript
// tests/integration/orders.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestUser, createTestCustomer } from '../helpers';

describe('Orders API', () => {
  let authToken: string;
  let customerId: string;

  beforeAll(async () => {
    // 创建测试用户并登录
    const user = await createTestUser();
    authToken = await login(user);

    // 创建测试客户
    const customer = await createTestCustomer();
    customerId = customer.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create an order', async () => {
    const orderData = {
      customerId,
      items: [
        { productName: 'Product A', quantity: 10, unitPrice: 100 },
      ],
    };

    const response = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(orderData),
    });

    expect(response.status).toBe(201);
    const order = await response.json();
    expect(order.data.orderNo).toBeDefined();
  });

  it('should get order list', async () => {
    const response = await fetch('/api/v1/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.items).toBeInstanceOf(Array);
  });
});
```

---

## 5. 性能优化

### 5.1 数据库查询优化

```typescript
// ✅ 使用索引字段进行查询
const orders = await prisma.order.findMany({
  where: {
    customerId: 'clxxx',  // 有索引
    status: 'PENDING',    // 有索引
  },
});

// ❌ 避免全文搜索
const orders = await prisma.order.findMany({
  where: {
    notes: { contains: 'urgent' },  // 无索引，慢查询
  },
});

// ✅ 使用全文搜索 (PostgreSQL)
const orders = await prisma.$queryRaw`
  SELECT * FROM orders
  WHERE to_tsvector('simple', notes) @@ to_tsquery('simple', 'urgent')
`;
```

### 5.2 缓存策略

```typescript
// src/lib/cache.ts

import { cache } from 'react';
import { unstable_cache } from 'next/cache';

// 使用 React cache 进行请求去重
export const getOrderById = cache(async (id: string) => {
  return prisma.order.findUnique({
    where: { id },
    include: { items: true, customer: true },
  });
});

// 使用 Next.js unstable_cache 进行数据缓存
export const getOrderStatistics = unstable_cache(
  async (period: string) => {
    // 计算统计数据的逻辑
    return statistics;
  },
  ['order-statistics'],
  { revalidate: 3600 } // 1 小时重新验证
);
```

### 5.3 分页优化

```typescript
// 使用游标分页代替偏移分页（大数据量时）
const orders = await prisma.order.findMany({
  take: 20,
  skip: 0,
  orderBy: { createdAt: 'desc' },
});

// 下一页
const nextOrders = await prisma.order.findMany({
  take: 20,
  skip: 0,
  cursor: { id: lastOrderId },
  orderBy: { createdAt: 'desc' },
});
```

---

## 6. 安全最佳实践

### 6.1 输入验证

```typescript
// 始终验证用户输入
import { z } from 'zod';

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
  notes: z.string().max(1000).optional(),
  deliveryDate: z.string().datetime().optional(),
});

// 在 API 中使用
const validatedData = updateOrderSchema.parse(requestBody);
```

### 6.2 权限检查

```typescript
// 中间件进行权限检查
export async function checkOrderPermission(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { salesRepId: true },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  // 只有订单负责人或管理员可以操作
  if (order.salesRepId !== userId && !isAdmin(userId)) {
    throw new Error('无权操作此订单');
  }
}
```

### 6.3 敏感数据保护

```typescript
// 不要在日志中记录敏感信息
console.log(`Order ${order.id} created`);  // ✅
console.log(`Order created with data: ${JSON.stringify(order)}`);  // ❌ 可能包含敏感信息

// 密码哈希
import bcrypt from 'bcryptjs';
const passwordHash = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, passwordHash);
```

---

## 7. 调试技巧

### 7.1 Prisma 查询日志

```typescript
// prisma/client.ts
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});
```

### 7.2 API 调试

```bash
# 使用 curl 测试 API
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer <token>"

# 使用 jq 格式化 JSON 输出
curl -s http://localhost:3000/api/v1/orders | jq .
```

---

## 8. 部署指南

### 8.1 Docker 部署

```bash
# 构建镜像
docker build -t trade-erp .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  trade-erp
```

### 8.2 Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产部署
vercel --prod
```

---

## 9. 常见问题

### Q1: 如何处理数据库迁移冲突？

```bash
# 重置迁移历史
npx prisma migrate resolve --applied "migration_name"

# 或创建新迁移
npx prisma migrate dev --create-only
```

### Q2: 如何处理大文件上传？

```typescript
// 使用分片上传
// 1. 请求上传 URL
const { uploadUrl, fileId } = await api.getUploadUrl({ filename, size });

// 2. 分片上传
await uploadToS3(uploadUrl, fileChunk);

// 3. 完成上传
await api.completeUpload({ fileId });
```

---

*文档结束*
