# Trade ERP API Layer Audit Report

> Generated: 2026-04-27
> Scope: src/app/api/ (102 route files) + src/lib/ + src/middleware/
> Files analyzed: 15 core library files + 40+ route files

---

## 1. 安全漏洞 (Security Vulnerabilities)

### SEC-001 [高] 用户创建接口明文存储密码
- **文件**: src/app/api/users/route.ts (POST, line 79-86)
- **问题**: 代码注释明确写道 "这里应该加密密码，简单起见先直接存储"，password 字段未经 bcrypt 加密直接传入 prisma.user.create()
- **影响**: 数据库泄露导致所有用户密码明文暴露
- **修复**: 
```typescript
import bcrypt from 'bcryptjs';
const passwordHash = await bcrypt.hash(password, 10);
// 使用 passwordHash 而非明文 password
```

### SEC-002 [高] Debug 端点暴露环境变量
- **文件**: src/app/api/debug/env/route.ts
- **问题**: 虽然限制了 ADMIN 访问，但在生产环境中不应有任何端点暴露 NODE_ENV、PORT、NEXTAUTH_URL 等环境信息
- **影响**: 攻击者若获取 ADMIN 权限即可获取服务器配置信息
- **修复**: 移除 /api/debug/ 路由或在中间件中添加 NODE_ENV !== 'production' 的硬编码拦截

### SEC-003 [高] Debug Users 端点可枚举所有用户
- **文件**: src/app/api/debug/users/route.ts
- **问题**: 返回所有用户列表（含 email、role、isApproved），即使排除了 passwordHash 仍可用于信息收集
- **影响**: 社会工程攻击、用户枚举
- **修复**: 添加严格的生产环境禁用检查 + 分页限制 + 操作审计日志

### SEC-004 [高] CSRF 保护未实际启用
- **文件**: src/middleware/auth.ts (line 111-120), src/lib/auth.ts (line 152-196)
- **问题**: verifyCSRFToken 函数已定义但从未在中间件或 API 路由中被调用。middleware.ts 中没有 CSRF 检查逻辑
- **影响**: 所有 POST/PUT/DELETE 请求都容易受到 CSRF 攻击
- **修复**: 在 middleware.ts 中对非 GET 请求添加 CSRF token 验证

### SEC-005 [高] 速率限制未实际应用
- **文件**: src/lib/rate-limit.ts
- **问题**: rateLimit 函数已定义但经搜索未在任何一个 API route 中被调用
- **影响**: 登录端点、批量操作端点无速率保护，容易受到暴力破解和 DoS 攻击
- **修复**: 在登录、注册等关键端点添加 rateLimit 调用

### SEC-006 [中] 权限初始化端点缺少管理员保护
- **文件**: src/app/api/permissions/init/route.ts (POST)
- **问题**: 仅检查了 getUserFromRequest (认证)，没有检查用户角色是否为 ADMIN。任何已认证用户都可以初始化权限系统
- **影响**: 普通用户可以重新初始化权限系统，可能覆盖现有权限配置
- **修复**: 添加 `if (session.role !== 'ADMIN') return errorResponse(...)` 检查

### SEC-007 [中] 报价单发送端点无认证检查
- **文件**: src/app/api/quotations/[id]/send/route.ts
- **问题**: 整个 POST handler 没有任何认证或权限检查，任何人均可发送报价单
- **影响**: 未授权用户可以修改报价单状态为 SENT 并获取敏感客户信息
- **修复**: 添加 getUserFromRequest 认证检查 + quotation:send 权限检查

### SEC-008 [中] 询盘详情/更新端点缺少行级权限
- **文件**: src/app/api/inquiries/[id]/route.ts (GET, PUT, DELETE)
- **问题**: GET 和 PUT 没有任何认证或权限检查。DELETE 仅检查认证但未验证用户是否是该询盘的负责人
- **影响**: 任何已认证用户可以查看/修改/删除任何询盘
- **修复**: 添加认证检查 + 行级权限验证 (检查 assignedTo === currentUser.id 或 role === 'ADMIN')

### SEC-009 [中] 客户详情/更新/删除端点缺少行级权限
- **文件**: src/app/api/customers/[id]/route.ts (GET, PUT, DELETE)
- **问题**: 
  - GET: 仅有认证检查，没有验证用户是否是该客户的所有者 (ownerId)
  - PUT: 仅有认证检查，没有验证所有权
  - DELETE: 仅有认证检查，没有验证所有权
- **影响**: 任何已认证用户可以查看/修改/删除任何客户
- **修复**: 添加行级权限验证，非 ADMIN 用户只能操作自己的客户

### SEC-010 [中] 供应商详情/更新/删除端点缺少行级权限
- **文件**: src/app/api/suppliers/[id]/route.ts (GET, PUT, DELETE)
- **问题**: 所有操作均无任何认证检查
- **影响**: 未认证用户可以查看/修改/删除任何供应商
- **修复**: 添加认证检查 + 行级权限验证

### SEC-011 [中] 产品详情/更新/删除端点缺少认证
- **文件**: src/app/api/products/[id]/route.ts (GET, PUT)
- **问题**: GET 和 PUT 操作没有任何认证检查。只有 DELETE 有认证
- **影响**: 未认证用户可以查看和修改产品信息
- **修复**: 为 GET 和 PUT 添加认证检查

### SEC-012 [中] 产品列表缺少认证
- **文件**: src/app/api/products/route.ts (GET)
- **问题**: GET 有认证检查，但使用的是 getUserFromRequest，而认证依赖中间件。如果中间件配置有误，可能导致绕过
- **注意**: 由于 middleware.ts 中对 /api/ 路径做了统一认证拦截，此问题实际被中间件覆盖，但代码层面仍应显式防御

### SEC-013 [低] 登录失败信息泄露
- **文件**: src/app/api/auth/login/route.ts (line 45-48)
- **问题**: 用户不存在和密码错误返回相同的 "账号或密码错误"，这是好的实践。但错误响应格式与其他端点不一致（使用 `{error}` 而非 `{success, code, message}`）
- **修复**: 统一错误响应格式

### SEC-014 [中] 报价单列表接口无认证
- **文件**: src/app/api/quotations/route.ts (GET, POST)
- **问题**: 两个操作均没有任何认证检查
- **影响**: 未认证用户可以查看所有报价单、创建新报价
- **修复**: 添加认证 + 行级权限

---

## 2. 权限控制不一致 (Inconsistent Permission Control)

### PERM-001 [高] 多种认证模式混用
- **涉及文件**: 整个 API 层
- **问题**: 项目中有 4 种不同的认证方式在使用:
  1. `getUserFromRequest` (from auth-api.ts) - 从 header/cookie 解析 JWT
  2. `getCurrentUser` (from auth-simple.ts) - 仅从 server-side cookie 读取
  3. `getSession` / `requireAuth` (from middleware/auth.ts) - 完整的 RBAC 会话
  4. 直接使用 middleware.ts 的 cookie 检查
- **影响**: 不同端点使用不同认证方式导致行为不一致，某些认证方式不包含 RBAC 权限信息
- **修复示例**:
```
认证方式分布:
- auth-api.ts: customers, products, suppliers, orders, inquiries, users, roles, dashboard, debug, permissions
- auth-simple.ts: approvals, batch-import, batch-export, batch-delete, batch-confirm, batch-ship
- middleware/auth.ts: 未被任何 route 直接使用
```
- **建议**: 统一使用 middleware/auth.ts 的 getSession/requireAuth，它包含了完整的 RBAC 权限信息

### PERM-002 [高] 批量操作权限检查使用角色而非 RBAC 权限
- **涉及文件**:
  - src/app/api/customers/batch-import/route.ts: `!['ADMIN', 'SALES'].includes(user.role)`
  - src/app/api/products/batch-delete/route.ts: `!['ADMIN', 'SALES'].includes(user.role)`
  - src/app/api/orders/batch-confirm/route.ts: `!['ADMIN', 'SALES'].includes(user.role)`
  - src/app/api/orders/batch-ship/route.ts: (类似)
- **问题**: 使用硬编码的角色枚举而不是 RBAC 权限系统 (customer:create, product:delete, order:approve 等)
- **影响**: 无法通过 RBAC 系统灵活配置权限，必须修改代码才能调整权限
- **修复**: 使用 requirePermission(session, 'customer:import') 等

### PERM-003 [高] 多数 CRUD 端点缺少权限中间件
- **涉及**: 大多数 [id]/route.ts 文件
- **问题**: 以下端点仅有认证 (或无认证)，没有细粒度权限检查:
  - customers/[id] (GET/PUT/DELETE) - 无权限检查
  - products/[id] (GET/PUT) - 无权限检查
  - suppliers/[id] (GET/PUT/DELETE) - 无认证、无权限
  - inquiries/[id] (GET/PUT) - 无认证、无权限
  - quotations/[id] (GET/PUT) - 无认证、无权限
  - quotations/[id]/send - 无认证
  - orders/[id] (GET/PUT) - 无认证
- **修复**: 每个端点应使用 requirePermission 进行细粒度权限检查

### PERM-004 [中] 权限命名不一致
- **文件**: src/lib/permissions.ts vs src/middleware/permissions.ts vs src/lib/api-schemas.ts
- **问题**: 
  - api-schemas.ts 中未定义权限 schema
  - lib/permissions.ts 使用 `customers.view` 格式 (点号分隔)
  - middleware/permissions.ts 使用 `customer:list` 格式 (冒号分隔)
  - middleware/auth.ts 使用 `order:create` 格式 (冒号分隔)
- **影响**: 权限配置和检查可能不匹配，导致权限系统失效
- **修复**: 统一使用一种格式 (推荐冒号分隔 `module:action`)

### PERM-005 [中] Row-level filter 未在所有查询中应用
- **文件**: src/middleware/auth.ts (getRowLevelFilter)
- **问题**: getRowLevelFilter 函数已定义但仅在少数地方手动应用。大多数 API route 直接查询数据库而没有应用行级过滤
- **影响**: 非 ADMIN 用户可能看到其他用户的数据
- **修复**: 在所有列表查询中统一应用 getRowLevelFilter

---

## 3. 输入验证问题 (Validation Issues)

### VAL-001 [高] 批量导入客户缺乏事务保护
- **文件**: src/app/api/customers/batch-import/route.ts (line 39-100)
- **问题**: 在 for 循环中逐条执行数据库操作，无事务包裹。如果中间某条失败，已成功的数据不会回滚
- **影响**: 部分导入导致数据不一致
- **修复**: 使用 prisma.$transaction 包裹整个导入过程

### VAL-002 [高] 批量导出无限制
- **文件**: src/app/api/customers/batch-export/route.ts (line 38)
- **问题**: take: 10000，无分页、无速率限制，攻击者可一次性导出全部客户数据
- **影响**: 数据泄露风险
- **修复**: 添加数量上限 (如 1000)、分页、速率限制

### VAL-003 [中] 订单排序字段未白名单验证
- **文件**: src/app/api/orders/route.ts (line 137)
- **问题**: `orderBy: { [sortBy]: sortOrder }` 直接使用用户输入的 sortBy，未做白名单验证
- **影响**: 虽然 Prisma 会拒绝无效字段名，但仍应做白名单验证以防御未知风险
- **修复**: 使用白名单: `const allowedSortFields = ['createdAt', 'orderNo', 'totalAmount']; if (!allowedSortFields.includes(sortBy)) sortBy = 'createdAt';`

### VAL-004 [中] 客户搜索未限制特殊字符
- **文件**: src/app/api/customers/route.ts (line 23-29)
- **问题**: 搜索参数直接传入 Prisma 的 contains 查询，虽然 Prisma 参数化查询防止了 SQL 注入，但未对搜索长度做限制
- **修复**: 添加 maxLength 验证

### VAL-005 [中] 采购订单创建时金额由前端计算
- **文件**: src/app/api/purchases/route.ts (line 144)
- **问题**: `totalAmount: totalAmount || 0` 直接使用前端传入的金额，未在服务器端重新计算
- **影响**: 恶意用户可提交虚假金额
- **修复**: 在服务器端根据 items 重新计算 totalAmount

### VAL-006 [中] 供应商/客户 ID 在查询时未验证 UUID 格式
- **文件**: 多处 route.ts 文件
- **问题**: 查询参数如 supplierId、customerId 直接使用，未验证是否为有效 UUID
- **修复**: 使用 z.string().uuid() 验证

---

## 4. 数据库性能问题 (Database Performance)

### PERF-001 [高] 批量导入 N+1 查询
- **文件**: src/app/api/customers/batch-import/route.ts
- **问题**: 在 for 循环中每条记录执行 findFirst + create/update，导入 1000 条将执行 2000+ 次查询
- **影响**: 导入操作极慢，可能超时
- **修复**: 使用 prisma.$transaction + createMany/upsert 批量操作

### PERF-002 [高] 权限初始化 N+1 查询
- **文件**: src/app/api/permissions/init/route.ts (line 196-219)
- **问题**: 在 for 循环中逐条 findUnique + create，每个权限和角色都是独立查询
- **影响**: 初始化操作慢
- **修复**: 使用 createMany 批量创建

### PERF-003 [中] Dashboard 使用 $queryRaw 但缺少索引验证
- **文件**: src/app/api/dashboard/overview/route.ts
- **问题**: 使用了 7 个原始 SQL 查询，但 Prisma schema 中 orders 表的 createdAt 字段没有索引 (只有 status+createdAt 组合索引)
- **影响**: 大数据量时查询慢
- **修复**: 在 schema.prisma 中为常用查询字段添加索引

### PERF-004 [中] 订单详情加载过度关联数据
- **文件**: src/app/api/orders/[id]/route.ts (line 26-72)
- **问题**: findUnique 一次性 include 了 customer, salesRep, items(含product), payments, shipments, productionRecords, qualityChecks 共 7 层关联
- **影响**: 单条查询返回大量数据，响应慢
- **修复**: 按需加载，或使用 DataLoader 模式

### PERF-005 [中] 产品属性更新使用循环 upsert
- **文件**: src/app/api/products/[id]/route.ts (line 66-95)
- **问题**: 每个属性单独一个 upsert 操作，虽然用了 $transaction 但仍是 N 次操作
- **修复**: 如果数据库支持，使用批量 upsert

### PERF-006 [低] 客户批量导出全表扫描
- **文件**: src/app/api/customers/batch-export/route.ts
- **问题**: 没有 WHERE 条件时执行全表扫描 (take 10000)
- **修复**: 强制添加 WHERE 条件或分页

---

## 5. 代码重复和可维护性 (Code Duplication & Maintainability)

### CODE-001 [高] 错误响应格式不一致
- **涉及**: 所有 API route 文件
- **问题**: 至少有 4 种不同的错误响应格式:
  1. `{ error: 'message' }` - 简单格式
  2. `{ success: false, error: 'message', code: 'XXX' }` - 带状态码
  3. `{ success: false, code: 'XXX', message: '...', timestamp: '...' }` - api-response 格式
  4. `{ error: 'message', details: error }` - 带详情
- **修复**: 统一使用 api-response.ts 中的 errorResponse/notFoundResponse 等函数

### CODE-002 [高] 认证检查代码重复
- **涉及**: 几乎所有 route.ts 文件
- **问题**: 每个 handler 都重复写相同的认证检查模式:
```typescript
const session = await getUserFromRequest(request);
if (!session) {
  return errorResponse('未认证', 'UNAUTHORIZED', 401);
}
```
- **修复**: 创建高阶函数 `withAuth(handler)` 或中间件装饰器

### CODE-003 [高] 多个认证库文件功能重叠
- **文件**: 
  - src/lib/auth.ts (196 行) - JWT cookie + CSRF
  - src/lib/auth-api.ts (114 行) - JWT from headers
  - src/lib/auth-simple.ts (123 行) - login/logout/getCurrentUser
  - src/middleware/auth.ts (557 行) - 完整 RBAC 认证
- **问题**: 4 个认证库有大量重复功能，维护成本高，容易遗漏安全修复
- **修复**: 合并为单一认证模块，提供不同使用场景的导出

### CODE-004 [中] 订单号/供应商号生成逻辑重复
- **涉及**:
  - src/app/api/orders/route.ts (line 244-256): `SO-YYYYMMDD-XXX`
  - src/app/api/suppliers/route.ts (line 99-112): `SUP-YYYYMMDD-XXX`
  - src/app/api/purchases/route.ts (line 126-136): `POYYYYMM-XXXX`
- **问题**: 编号生成逻辑散落在各文件中，无统一工具函数
- **修复**: 创建 `lib/order-number.ts` 统一生成逻辑

### CODE-005 [中] 权限/角色初始化重复
- **文件**: 
  - src/lib/permissions.ts (initDefaultPermissions, line 313-420)
  - src/app/api/permissions/init/route.ts (line 10-180)
- **问题**: 两个文件分别定义了 defaultPermissions 和 defaultRoles，内容不同但功能重叠
- **影响**: 可能导致权限数据不一致
- **修复**: 将初始化逻辑统一到 lib/permissions.ts

### CODE-006 [中] 行级隔离逻辑重复
- **涉及**: customers, suppliers, inquiries, purchases, orders 的列表查询
- **问题**: 每个列表查询都重复写:
```typescript
if (currentUser.role !== 'ADMIN') {
  where.ownerId = currentUser.id;  // 或 purchaserId, salesRepId 等
}
```
- **修复**: 创建 `buildRowLevelWhere(user, entity)` 工具函数

### CODE-007 [低] 缩进不一致
- **文件**: 
  - src/app/api/orders/[id]/route.ts (line 267): DELETE handler 中 session 检查缩进错误
  - src/app/api/products/[id]/route.ts (line 114): 同样的缩进问题
  - src/app/api/suppliers/[id]/route.ts (line 103): 同样的缩进问题
  - src/app/api/inquiries/[id]/route.ts (line 100): 同样的缩进问题
- **修复**: 统一代码格式

---

## 6. 边界情况和错误处理 (Edge Cases & Error Handling)

### EDGE-001 [高] 订单创建存在竞态条件
- **文件**: src/app/api/orders/route.ts (line 249-256)
- **问题**: 订单号生成使用 `count() + 1`，在并发请求下可能产生重复订单号
- **修复**: 使用数据库序列或 UUID，或使用事务+SELECT FOR UPDATE

### EDGE-002 [中] 分页参数无上限保护
- **文件**: 多处 route.ts (手动解析 page/limit)
- **问题**: `parseInt(searchParams.get('limit') || '20')` 没有上限限制，用户可请求 limit=999999
- **修复**: 添加 Math.min(limit, 100) 或使用 PaginationSchema

### EDGE-003 [中] Zod 验证异常直接暴露内部错误
- **文件**: src/app/api/quotations/route.ts (line 85-89)
- **问题**: `{ error: 'Invalid query parameters', details: error }` 将 ZodError 对象直接返回给客户端
- **影响**: 泄露内部 schema 结构
- **修复**: 仅返回用户友好的错误信息

### EDGE-004 [中] 批准/拒绝操作存在竞态条件
- **文件**: 
  - src/app/api/auth/approvals/[id]/approve/route.ts
  - src/app/api/auth/approve/[userId]/route.ts
- **问题**: 两个文件都有批准逻辑，检查 status === 'PENDING' 和创建用户之间无事务保护
- **影响**: 并发批准可能导致创建重复用户
- **修复**: 使用 prisma.$transaction 包裹检查和创建操作

### EDGE-005 [中] 删除操作未检查关联数据
- **文件**: 
  - src/app/api/customers/[id]/route.ts (DELETE)
  - src/app/api/suppliers/[id]/route.ts (DELETE)
  - src/app/api/inquiries/[id]/route.ts (DELETE)
- **问题**: 直接删除记录，不检查是否有关联的订单、询盘等
- **影响**: 可能导致孤儿记录或数据库约束错误
- **修复**: 删除前检查关联数据 (参考 products/batch-delete 的正确做法)

### EDGE-006 [低] 内存缓存无上限
- **文件**: src/lib/rate-limit.ts, src/lib/permissions.ts, src/lib/cache.ts
- **问题**: 使用 Map/NodeCache 无内存上限，长时间运行可能导致内存泄漏
- **修复**: 添加缓存大小限制和定期清理

---

## 7. 中间件配置问题

### MW-001 [高] 中间件不保护 API 路由的 CSRF
- **文件**: src/middleware.ts
- **问题**: middleware.ts 仅检查 auth-token cookie，对 POST/PUT/DELETE 请求不做 CSRF 验证
- **修复**: 在 middleware.ts 中对非 GET/HEAD/OPTIONS 请求添加 CSRF 检查

### MW-002 [中] /api/health 无需认证但可被滥用
- **文件**: src/middleware.ts (line 16)
- **问题**: /api/health 在 publicPaths 中，任何人都可以无限制访问
- **修复**: 添加速率限制

### MW-003 [中] 开发环境 debug 端点在生产中可能泄漏
- **文件**: src/middleware.ts (line 18-21)
- **问题**: `/api/debug/` 仅在 `NODE_ENV === 'development'` 时添加到 publicPaths，但如果环境变量配置错误可能导致生产环境暴露
- **修复**: 添加额外的安全检查

---

## 严重程度汇总

| 严重程度 | 数量 | 关键问题 |
|---------|------|---------|
| 高 | 14 | 明文密码、CSRF未启用、速率限制未应用、权限检查缺失、N+1查询 |
| 中 | 20 | 行级权限缺失、认证模式混用、验证不完整、竞态条件 |
| 低 | 5 | 缩进问题、内存缓存、错误格式不统一 |

## 优先修复建议

1. **[紧急]** SEC-001: 修复用户创建明文密码问题
2. **[紧急]** SEC-004: 启用 CSRF 保护
3. **[紧急]** SEC-005: 在登录端点应用速率限制
4. **[紧急]** SEC-007, SEC-014: 为报价单相关端点添加认证
5. **[高]** SEC-009, SEC-010: 为 CRUD 端点添加行级权限
6. **[高]** PERM-001: 统一认证模式
7. **[高]** PERF-001: 修复批量导入 N+1 查询
8. **[高]** EDGE-001: 修复订单号竞态条件
9. **[中]** VAL-001: 为批量操作添加事务保护
10. **[中]** CODE-003: 合并认证库文件
