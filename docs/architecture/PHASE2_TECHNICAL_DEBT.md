# Phase 2 技术债务清单

**创建日期:** 2026-03-14  
**负责人:** Trade ERP 开发团队  
**审查人:** 系统架构师  
**优先级定义:** 🔴 高 | 🟡 中 | 🟢 低

---

## 📊 债务概览

| 优先级 | 数量 | 预计工作量 | 截止日期 |
|--------|------|------------|----------|
| 🔴 高 | 4 项 | 11 小时 | Phase 2 前 |
| 🟡 中 | 4 项 | 13 小时 | Phase 2 期间 |
| 🟢 低 | 3 项 | 14 小时 | Phase 3 |
| **总计** | **11 项** | **38 小时** | - |

---

## 🔴 高优先级（Phase 2 前必须修复）

### TD-001: Dashboard API 使用 `any` 类型

**严重性:** 🔴 高  
**类型:** 类型安全  
**位置:** `src/app/api/dashboard/*.ts`  
**影响:** 类型安全缺失，易引发运行时错误  
**预计工作量:** 2 小时

**问题详情:**
```typescript
// ❌ 当前代码
const where: any = {};
const stats: any = {};

// ESLint 报告：
src/app/api/dashboard/customers/route.ts:   8 处 any 类型
src/app/api/dashboard/orders/route.ts:      9 处 any 类型
src/app/api/dashboard/overview/route.ts:    7 处 any 类型
```

**修复方案:**
```typescript
// ✅ 定义接口
interface DashboardQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}

interface CustomerStats {
  total: number;
  active: number;
  newThisMonth: number;
  topCountries: Array<{ country: string; count: number }>;
}

// ✅ 使用具体类型
const where: {
  status?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
} = {};

const stats: CustomerStats = {
  total: 0,
  active: 0,
  newThisMonth: 0,
  topCountries: [],
};
```

**验收标准:**
- [ ] 所有 `any` 类型替换为具体接口
- [ ] ESLint 无 `@typescript-eslint/no-explicit-any` 警告
- [ ] TypeScript 编译通过

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-002: 缺少认证中间件

**严重性:** 🔴 高  
**类型:** 安全  
**位置:** 全局 API  
**影响:** 所有 API 公开访问，数据泄露风险  
**预计工作量:** 4 小时

**问题详情:**
```typescript
// ❌ 当前所有 API 无认证检查
export async function GET(request: Request) {
  // 任何人都可以访问
  const data = await prisma.customer.findMany();
  return NextResponse.json({ success: true, data });
}
```

**修复方案:**
```typescript
// ✅ 创建认证中间件
// src/middleware/auth.ts
import { getSession } from 'next-auth/react';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface AuthSession {
  user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'USER' | 'VIEWER';
  };
}

/**
 * 验证用户认证
 * @param request 请求对象
 * @returns 认证失败返回错误响应，成功返回 null
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { 
          success: false, 
          error: '未认证',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }
    
    return null; // 认证通过
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: '认证服务错误',
        code: 'AUTH_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * 验证用户角色
 * @param session 会话对象
 * @param requiredRole 所需角色
 * @returns 无权限返回错误响应，有权限返回 null
 */
export function requireRole(
  session: AuthSession, 
  requiredRole: string
): NextResponse | null {
  if (session.user.role !== requiredRole && requiredRole !== 'ADMIN') {
    return NextResponse.json(
      { 
        success: false, 
        error: '无权限执行此操作',
        code: 'FORBIDDEN'
      },
      { status: 403 }
    );
  }
  return null;
}

// ✅ API 中使用
// src/app/api/v1/customers/route.ts
import { requireAuth } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  
  // ... 业务逻辑
}
```

**验收标准:**
- [ ] 所有 `/api/v1/*` 路由添加认证检查
- [ ] 未认证请求返回 401
- [ ] 无权限请求返回 403
- [ ] 编写认证中间件单元测试

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-003: 产品调研 API 缺少输入验证

**严重性:** 🔴 高  
**类型:** 安全  
**位置:** `src/app/api/product-research/*.ts`  
**影响:** 恶意输入可能导致数据损坏或安全漏洞  
**预计工作量:** 3 小时

**问题详情:**
```typescript
// ❌ 当前代码 - 仅手动验证必填字段
if (!name || !categoryId) {
  return NextResponse.json(
    { success: false, error: '产品名称和所属品类为必填项' },
    { status: 400 }
  );
}

// 问题：
// - 无长度限制
// - 无类型检查
// - 无数值范围验证
// - 无 XSS 防护
```

**修复方案:**
```typescript
// ✅ 创建 Zod 验证器
// src/lib/validators/product-research.ts
import { z } from 'zod';

// 创建产品调研
export const CreateProductResearchSchema = z.object({
  name: z
    .string()
    .min(1, '产品名称不能为空')
    .max(200, '产品名称不能超过 200 个字符'),
  
  nameEn: z
    .string()
    .max(200, '英文名称不能超过 200 个字符')
    .optional(),
  
  categoryId: z
    .string()
    .cuid('品类 ID 格式不正确'),
  
  brand: z
    .string()
    .max(100, '品牌名称不能超过 100 个字符')
    .optional(),
  
  brandEn: z
    .string()
    .max(100, '英文品牌名称不能超过 100 个字符')
    .optional(),
  
  model: z
    .string()
    .max(100, '型号不能超过 100 个字符')
    .optional(),
  
  manufacturer: z
    .string()
    .max(200, '制造商名称不能超过 200 个字符')
    .optional(),
  
  costPrice: z
    .number()
    .positive('成本价必须为正数')
    .optional()
    .nullable(),
  
  salePrice: z
    .number()
    .positive('销售价必须为正数')
    .optional()
    .nullable(),
  
  currency: z
    .enum(['CNY', 'USD', 'EUR', 'GBP'], '不支持的货币类型')
    .default('CNY'),
  
  moq: z
    .number()
    .int('最小起订量必须为整数')
    .positive('最小起订量必须为正数')
    .optional()
    .nullable(),
  
  leadTime: z
    .number()
    .int('交货期必须为整数')
    .positive('交货期必须为正数')
    .optional()
    .nullable(),
  
  weight: z
    .number()
    .positive('重量必须为正数')
    .optional()
    .nullable(),
  
  volume: z
    .number()
    .positive('体积必须为正数')
    .optional()
    .nullable(),
  
  attributes: z
    .array(z.object({
      attributeId: z.string().cuid('属性 ID 格式不正确'),
      valueText: z.string().max(500, '属性值不能超过 500 个字符').optional(),
      valueNumber: z.number().optional(),
      valueBoolean: z.boolean().optional(),
      valueDate: z.string().datetime('日期格式不正确').optional(),
      valueOptions: z.array(z.string()).optional(),
      unit: z.string().max(20, '单位不能超过 20 个字符').optional(),
      notes: z.string().max(500, '备注不能超过 500 个字符').optional(),
    }))
    .optional(),
  
  tags: z
    .array(z.string().max(50))
    .max(10, '最多添加 10 个标签')
    .optional(),
  
  notes: z
    .string()
    .max(2000, '备注不能超过 2000 个字符')
    .optional(),
});

// 更新产品调研
export const UpdateProductResearchSchema = CreateProductResearchSchema.partial();

// 查询参数验证
export const ProductResearchQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(100).optional(),
  categoryId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
  brand: z.string().max(100).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  conclusion: z.enum(['RECOMMENDED', 'NOT_RECOMMENDED', 'NEEDS_MORE_RESEARCH']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
```

```typescript
// ✅ API 中使用验证器
// src/app/api/product-research/products/route.ts
import { CreateProductResearchSchema } from '@/lib/validators/product-research';
import { validationErrorResponse, extractZodErrors } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = CreateProductResearchSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;
    // ... 业务逻辑
  } catch (error) {
    // ... 错误处理
  }
}
```

**验收标准:**
- [ ] 所有产品调研 API 添加 Zod 验证
- [ ] 验证错误返回清晰的字段级错误信息
- [ ] 编写验证器单元测试
- [ ] 测试边界值（最大长度、负数等）

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-004: ESLint 警告未修复

**严重性:** 🔴 高  
**类型:** 代码质量  
**位置:** 多处  
**影响:** 代码质量下降，潜在 bug 风险  
**预计工作量:** 2 小时

**问题详情:**
```bash
$ npm run lint

/Users/apple/clawd/trade-erp/src/app/api/auth/login/route.ts
  41:13  warning  'passwordHash' is assigned a value but never used

/Users/apple/clawd/trade-erp/src/app/api/auth/me/route.ts
  4:27  warning  'request' is defined but never used

/Users/apple/clawd/trade-erp/src/app/api/auth/register/route.ts
  44:27  warning  '_' is assigned a value but never used

/Users/apple/clawd/trade-erp/scripts/seed-v0.4.js
  7:26  error  A `require()` style import is forbidden
```

**修复方案:**
```typescript
// ✅ 移除未使用变量
// src/app/api/auth/login/route.ts
// 删除未使用的 passwordHash 赋值

// src/app/api/auth/me/route.ts
export async function GET() { // 移除未使用的 request 参数
  // ...
}

// src/app/api/auth/register/route.ts
const { _, ...rest } = body; // 明确忽略

// scripts/seed-v0.4.js
import fs from 'fs'; // 使用 ES6 import 代替 require
```

**验收标准:**
- [ ] `npm run lint` 无警告和错误
- [ ] CI/CD 流程中集成 ESLint 检查

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

## 🟡 中优先级（Phase 2 期间修复）

### TD-005: 产品对比页面组件过大

**严重性:** 🟡 中  
**类型:** 可维护性  
**位置:** `src/app/product-research/comparisons/page.tsx`  
**影响:** 代码难以维护，559 行单文件  
**预计工作量:** 3 小时

**问题详情:**
```
src/app/product-research/comparisons/page.tsx: 559 行
- 包含产品选择、表格渲染、对比逻辑、保存功能
- 违反单一职责原则
- 难以单元测试
```

**修复方案:**
```typescript
// 拆分为多个组件
src/app/product-research/comparisons/
├── page.tsx                    # 主页面（50 行）- 路由和布局
├── ProductComparisonTable.tsx  # 对比表格（150 行）
├── ProductSelectorDialog.tsx   # 产品选择器（100 行）
├── ComparisonHeader.tsx        # 表头（80 行）
├── ComparisonActions.tsx       # 操作按钮（50 行）
└── hooks/
    └── useProductComparison.ts # 对比逻辑（100 行）
```

**验收标准:**
- [ ] 主页面控制在 100 行以内
- [ ] 每个子组件有清晰的单一职责
- [ ] 提取自定义 Hook 管理状态
- [ ] 所有组件有中文注释

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-006: 缺少全局状态管理

**严重性:** 🟡 中  
**类型:** 架构  
**位置:** 全局  
**影响:** 组件间状态共享困难，重复数据获取  
**预计工作量:** 4 小时

**问题详情:**
```typescript
// ❌ 当前：每个组件独立管理状态
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);

// 问题：
// - 重复数据获取
// - 状态同步困难
// - 无缓存机制
```

**修复方案:**
```typescript
// ✅ 使用 TanStack Query（已安装但未使用）
// src/hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error('获取产品列表失败');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
    gcTime: 30 * 60 * 1000,   // 30 分钟垃圾回收
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateProductData) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('创建失败');
      return res.json();
    },
    onSuccess: () => {
      // 自动刷新产品列表
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ✅ 在组件中使用
function ProductsPage() {
  const { data, isLoading, error } = useProducts({ search: '' });
  const createProduct = useCreateProduct();
  
  // ...
}
```

**验收标准:**
- [ ] 所有数据获取迁移到 TanStack Query
- [ ] 配置合理的缓存时间
- [ ] 实现乐观更新
- [ ] 编写使用文档

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-007: 图片无懒加载

**严重性:** 🟡 中  
**类型:** 性能  
**位置:** 多处  
**影响:** 首屏加载慢，流量浪费  
**预计工作量:** 2 小时

**问题详情:**
```typescript
// ❌ 当前：普通 img 标签
<img src={product.mainImage} alt={product.name} />
```

**修复方案:**
```typescript
// ✅ 使用 Next.js Image 组件
import Image from 'next/image';

<Image
  src={product.mainImage || '/placeholder.png'}
  alt={product.name}
  width={200}
  height={200}
  loading="lazy"
  placeholder="blur"
  blurDataURL={product.thumbnail}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

**验收标准:**
- [ ] 所有产品图片使用 Next.js Image
- [ ] 配置合适的占位图
- [ ] 响应式图片尺寸
- [ ] 测试懒加载效果

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-008: 数据库查询无缓存

**严重性:** 🟡 中  
**类型:** 性能  
**位置:** 全局  
**影响:** 重复查询数据库，响应慢  
**预计工作量:** 4 小时

**问题详情:**
```typescript
// ❌ 每次请求都查询数据库
const categories = await prisma.productCategory.findMany();
```

**修复方案:**
```typescript
// ✅ 使用 React cache（Next.js 16）
import { cache } from 'react';

export const getProductCategories = cache(async () => {
  return await prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
  });
});

// API 中使用
export async function GET() {
  const categories = await getProductCategories();
  return NextResponse.json({ success: true, data: categories });
}

// ✅ 或使用内存缓存（Phase 2）
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 300 }); // 5 分钟

export async function getProductCategories() {
  const cached = cache.get('categories');
  if (cached) return cached;
  
  const categories = await prisma.productCategory.findMany();
  cache.set('categories', categories);
  return categories;
}
```

**验收标准:**
- [ ] 品类、模板等静态数据添加缓存
- [ ] 配置合理的 TTL
- [ ] 实现缓存失效机制
- [ ] 监控缓存命中率

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

## 🟢 低优先级（Phase 3 优化）

### TD-009: 缺少单元测试

**严重性:** 🟢 低  
**类型:** 质量  
**位置:** `tests/`  
**影响:** 回归测试困难，重构风险大  
**预计工作量:** 8 小时

**修复方案:**
```typescript
// tests/api/product-research.test.ts
import { POST } from '@/app/api/product-research/products/route';
import { prisma } from '@/lib/prisma';

describe('Product Research API', () => {
  beforeEach(async () => {
    // 清理测试数据
    await prisma.productResearch.deleteMany();
  });

  describe('POST /api/product-research/products', () => {
    it('应该成功创建产品调研', async () => {
      const request = new Request('http://localhost/api/product-research/products', {
        method: 'POST',
        body: JSON.stringify({
          name: '测试产品',
          categoryId: 'test-category-id',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('测试产品');
    });

    it('应该拒绝缺少必填字段的请求', async () => {
      const request = new Request('http://localhost/api/product-research/products', {
        method: 'POST',
        body: JSON.stringify({ name: '测试产品' }), // 缺少 categoryId
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
    });
  });
});
```

**验收标准:**
- [ ] 核心 API 测试覆盖率 > 80%
- [ ] CI/CD 自动运行测试
- [ ] 测试数据隔离

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-010: 缺少 API 文档

**严重性:** 🟢 低  
**类型:** 文档  
**位置:** `docs/api/`  
**影响:** 开发效率低，集成困难  
**预计工作量:** 4 小时

**修复方案:**
```markdown
# API 文档 - 产品调研模块

## 创建产品调研

### 请求
```http
POST /api/product-research/products
Content-Type: application/json
```

### 请求体
```json
{
  "name": "产品名称",
  "categoryId": "品类 ID",
  "brand": "品牌",
  "costPrice": 100.00,
  "salePrice": 200.00
}
```

### 响应
```json
{
  "success": true,
  "code": "CREATED",
  "data": { ... },
  "message": "创建成功",
  "timestamp": "2026-03-14T10:00:00Z"
}
```
```

**验收标准:**
- [ ] 所有 API 端点有文档
- [ ] 包含请求/响应示例
- [ ] 标注认证要求

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

### TD-011: 错误日志不规范

**严重性:** 🟢 低  
**类型:** 可维护性  
**位置:** 全局  
**影响:** 问题排查困难  
**预计工作量:** 2 小时

**修复方案:**
```typescript
// ✅ 统一日志格式
import { logger } from '@/lib/logger';

try {
  // ... 业务逻辑
} catch (error) {
  logger.error('创建产品调研失败', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    userId: session?.user?.id,
    body: sanitizedBody, // 脱敏
  });
  
  return errorResponse('创建失败', 'INTERNAL_ERROR');
}
```

**验收标准:**
- [ ] 统一日志格式
- [ ] 敏感信息脱敏
- [ ] 日志分级（info/warn/error）

**负责人:** _待分配_  
**状态:** ⏳ 待开始

---

## 📈 债务趋势图

```
Phase 2 前    Phase 2 中    Phase 3
   4 项   →      4 项    →     3 项
  (11h)        (13h)       (14h)
```

---

## 🎯 行动计划

### Week 1 (Phase 2 前)
- [ ] TD-001: Dashboard API 类型定义 (2h)
- [ ] TD-002: 认证中间件 (4h)
- [ ] TD-003: 产品调研 API 验证 (3h)
- [ ] TD-004: ESLint 修复 (2h)

### Week 2-3 (Phase 2 期间)
- [ ] TD-005: 产品对比页面拆分 (3h)
- [ ] TD-006: TanStack Query 集成 (4h)
- [ ] TD-007: 图片懒加载 (2h)
- [ ] TD-008: 数据库缓存 (4h)

### Week 4+ (Phase 3)
- [ ] TD-009: 单元测试 (8h)
- [ ] TD-010: API 文档 (4h)
- [ ] TD-011: 日志规范 (2h)

---

**最后更新:** 2026-03-14  
**下次审查:** 2026-03-18
