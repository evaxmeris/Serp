# Trade ERP 诊断报告

> 生成时间：2026-04-15
> 项目版本：v0.9.4
> 技术栈：Next.js 16.1.6 + Prisma 6.19.2 + PostgreSQL + React 19.2.3

---

## 📊 统计摘要

| 指标 | 数值 |
|------|------|
| 扫描文件数 | 252 个 (src/) |
| TypeScript/JSX 文件 | 241 个 |
| 前端页面 (page.tsx) | 60 个 |
| API 路由 (route.ts) | 90 个 |
| 代码总行数 | ~55,829 行 |
| Prisma Schema 行数 | 2,185 行 |
| 测试文件 | 32 个 (tests/ + __tests__/) |
| 枚举类型 | 48 个 |
| 发现 🔴 Critical 问题 | 12 个 |
| 发现 ⚠️ Warning 问题 | 15 个 |
| 发现 💡 Suggestions | 11 个 |
| TypeScript 编译错误 | 8 个（全部在测试文件） |
| npm audit 漏洞 | 13 个（1 中等，11 高危，1 严重） |

---

## 🔴 Critical（必须修复）

### C1. Debug 端点暴露敏感环境变量
- **文件**: `src/app/api/debug/env/route.ts`
- **问题**: 直接返回 `NEXTAUTH_SECRET` 的明文值，任何访问 `/api/debug/env` 的人都能获取 JWT 签名密钥，从而伪造任意用户的 token
- **修复**: 立即删除此路由或添加严格的 IP 白名单 + 管理员认证。生产环境必须删除
- **影响**: 严重安全漏洞，任何人可伪造管理员身份

### C2. Debug 端点暴露用户数据
- **文件**: `src/app/api/debug/users/route.ts`
- **问题**: 返回所有用户列表（包括邮箱、角色、审批状态），无任何认证保护
- **修复**: 添加管理员权限验证，或标记为仅开发环境可用

### C3. Cookie 名称不一致导致 RBAC 认证永远失败
- **文件**: `src/middleware/auth.ts` 第 96 行
- **问题**: `middleware/auth.ts` 查找 `auth_token`（下划线），但登录时设置的 cookie 是 `auth-token`（连字符）。这意味着所有使用 `middleware/auth.ts` 的 RBAC 功能（`getSession`, `requireAuth`, `requirePermission`）永远无法获取到 token，RBAC 权限检查形同虚设
- **修复**: 将 `middleware/auth.ts` 第 96 行改为 `request.cookies.get('auth-token')`
- **影响**: RBAC 权限系统完全不可用

### C4. 47 个 API 路由缺少服务端认证验证
- **文件**: 详见以下列表
- **问题**: 以下 47 个 API 路由没有调用 `getUserFromRequest()` 或任何其他认证函数。它们完全依赖 `middleware.ts` 的 cookie 存在性检查，但 `middleware.ts` **不验证 JWT 签名**——任何非空 cookie 值都能通过。攻击者只需设置 `auth-token=fake` 即可绕过认证
- **受影响路由**:
  ```
  src/app/api/customers/[id]/route.ts
  src/app/api/customers/batch-tag/route.ts
  src/app/api/customers/batch-import/route.ts
  src/app/api/customers/batch-export/route.ts
  src/app/api/products/[id]/route.ts
  src/app/api/products/[id]/attributes/route.ts
  src/app/api/products/batch-delete/route.ts
  src/app/api/products/batch-import/route.ts
  src/app/api/products/batch-export/route.ts
  src/app/api/products/route.ts
  src/app/api/suppliers/[id]/route.ts
  src/app/api/inquiries/[id]/route.ts
  src/app/api/purchases/[id]/route.ts
  src/app/api/product-research/products/route.ts
  src/app/api/product-research/products/[id]/route.ts
  src/app/api/product-research/products/batch/route.ts
  src/app/api/product-research/products/batch-delete/route.ts
  src/app/api/product-research/comparisons/route.ts
  src/app/api/product-research/attributes/route.ts
  src/app/api/product-research/templates/route.ts
  src/app/api/product-research/templates/[id]/route.ts
  src/app/api/product-research/categories/route.ts
  src/app/api/product-research/categories/[id]/route.ts
  src/app/api/dashboard/overview/route.ts
  src/app/api/dashboard/orders/route.ts
  src/app/api/dashboard/sales/route.ts
  src/app/api/dashboard/products/route.ts
  src/app/api/dashboard/customers/route.ts
  src/app/api/permissions/route.ts
  src/app/api/permissions/[id]/route.ts
  src/app/api/permissions/init/route.ts
  src/app/api/roles/route.ts
  src/app/api/roles/create/route.ts
  src/app/api/roles/[id]/route.ts
  src/app/api/roles/[id]/permissions/route.ts
  src/app/api/user-roles/route.ts
  src/app/api/user-roles/[userId]/route.ts
  src/app/api/users/[id]/permissions/route.ts
  src/app/api/users/[id]/roles/route.ts
  src/app/api/v1/inventory/route.ts
  src/app/api/v1/inbound-orders/route.ts
  src/app/api/v1/inbound-orders/[id]/route.ts
  src/app/api/v1/inbound-orders/[id]/confirm/route.ts
  src/app/api/v1/inbound-orders/[id]/cancel/route.ts
  src/app/api/v1/outbound-orders/route.ts
  src/app/api/v1/outbound-orders/[id]/route.ts
  src/app/api/v1/outbound-orders/[id]/confirm/route.ts
  src/app/api/v1/outbound-orders/[id]/cancel/route.ts
  src/app/api/v1/outbound-orders/batch/route.ts
  src/app/api/v1/reports/*/route.ts (8 个文件)
  src/app/api/orders/[id]/route.ts (部分方法)
  ```
- **修复**: 在每个 API 路由的入口处添加 `const session = await getUserFromRequest(request); if (!session) return errorResponse(...)` 认证检查

### C5. 四层认证系统并存，逻辑混乱
- **文件**: 4 个独立的认证模块
  - `src/middleware.ts` — 中间件层，仅检查 cookie 存在性（不验证 JWT）
  - `src/middleware/auth.ts` — RBAC 认证，使用 `auth_token` cookie（名称错误）
  - `src/lib/auth-api.ts` — API 层认证，使用 `auth-token` cookie
  - `src/lib/auth-simple.ts` — 简易认证，使用 `auth-token` cookie
  - `src/middleware/checkPermission.ts` — 已废弃的 Pages Router 中间件，硬编码 `userId = 'legacy'` 完全绕过认证
  - `src/middleware/permissions.ts` — 另一套权限装饰器，使用 `getCurrentUser()`
- **问题**: 认证逻辑分散在 6 个文件中，使用不同的 cookie 名称和验证策略，没有统一的认证入口
- **修复**: 统一使用 `middleware/auth.ts`（修复 cookie 名称后）作为唯一认证源，删除或废弃其他重复模块

### C6. CSRF 防护未启用
- **文件**: `src/lib/auth.ts`（定义）, `src/middleware/auth.ts`（定义）
- **问题**: CSRF token 生成和验证函数已定义，但**没有任何 API 路由调用**。所有 POST/PUT/DELETE 请求都没有 CSRF 保护
- **修复**: 在 `middleware.ts` 或 API 路由层面统一添加 CSRF 验证

### C7. 注册接口无限流限制
- **文件**: `src/app/api/auth/register/route.ts`
- **问题**: 注册接口没有速率限制，攻击者可批量创建注册申请导致拒绝服务或垃圾数据
- **修复**: 添加 `rateLimit()` 调用，建议 10 次/小时/IP

### C8. JWT 密钥未做安全校验
- **文件**: `src/lib/auth-api.ts`, `src/lib/auth-simple.ts`, `src/middleware/auth.ts`
- **问题**: 虽然检查了 `NEXTAUTH_SECRET` 是否存在，但没有检查最小长度。如果密钥太短（如 "secret"），JWT 可被暴力破解
- **修复**: 添加最小长度检查（建议 ≥ 32 字符）

### C9. PrismaClient 多实例问题
- **文件**: `src/middleware/auth.ts` 第 17 行
- **问题**: 创建了独立的 `new PrismaClient()` 实例，而非使用 `@/lib/prisma.ts` 中的单例。这会导致连接池浪费和潜在的连接泄漏
- **修复**: 改为 `import { prisma } from '@/lib/prisma'`

### C10. 批量操作缺少事务保护
- **文件**: `src/app/api/orders/batch-ship/route.ts`, `src/app/api/orders/batch-confirm/route.ts`
- **问题**: 批量更新订单状态时，先 `findMany` 查询再逐个 `update`/`create`，如果中途失败会导致数据不一致（部分订单已更新，部分未更新）
- **修复**: 使用 `prisma.$transaction()` 包裹所有操作

### C11. `.bak` 备份文件混入源码
- **文件**: 8 个 `.bak` 文件分布在 `src/app/` 和 `src/app/api/` 中
- **问题**: 备份文件可能被 Next.js 编译或意外暴露
- **受影响文件**:
  ```
  src/app/suppliers/[id]/edit/page.tsx.bak
  src/app/profile/page.tsx.bak
  src/app/settings/page.tsx.bak
  src/app/suppliers/page.tsx.bak
  src/app/purchases/[id]/edit/page.tsx.bak
  src/app/purchases/page.tsx.bak
  src/app/api/v1/outbound-orders/stats/route.ts.bak
  src/app/api/v1/shipments/route.ts.bak
  ```
- **修复**: 删除所有 `.bak` 文件，使用 Git 进行版本管理

### C12. 生产调试端点未被排除
- **文件**: `src/middleware.ts` 第 16 行
- **问题**: `/api/debug/` 被列为 `publicPaths`，无需认证即可访问
- **修复**: 仅开发环境保留，生产环境移除或添加认证

---

## ⚠️ Warning（建议修复）

### W1. API 路径版本不统一
- **问题**: 同时存在 `/api/orders` 和 `/api/v1/orders`、`/api/suppliers` 和 `/api/v1/suppliers`、`/api/products` 和 `/api/v1/products` 两套路径。同一资源有多个入口容易导致维护混乱和逻辑不一致
- **修复**: 制定统一规范，推荐使用 `/api/v1/` 前缀，逐步废弃非版本化路径

### W2. 大量 console.log 生产环境泄漏
- **文件**: `src/lib/auth-simple.ts`（5 处 console.log）、`src/lib/cache.ts`、`src/lib/email.ts`、`src/lib/permissions.ts` 等
- **问题**: 登录过程中的详细日志（如 `console.log('密码验证:', isValid)`、`console.log('查询到的用户:', user?.email)`）在生产环境会暴露敏感信息
- **修复**: 使用结构化日志库（如 pino/winston），区分开发和生产环境

### W3. 16 个 TODO 注释未处理
- **位置**: 多处页面和组件
  - `src/app/reports/purchase/page.tsx` — TODO: 调用 API 获取实际数据
  - `src/app/reports/profit/page.tsx` — TODO: 调用 API 获取实际数据
  - `src/app/reports/cashflow/page.tsx` — TODO: 调用 API 获取实际数据
  - `src/app/reports/sales/page.tsx` — TODO: 调用 API 获取实际数据
  - `src/app/reports/custom/page.tsx` — TODO: 调用 API 创建/更新报表
  - `src/app/api/quotations/[id]/send/route.ts` — TODO: 实现邮件发送逻辑
  - `src/lib/email.ts` — TODO: 实现真实邮件发送
  - `src/components/batch-operations/*ImportDialog.tsx` — TODO: 检查重复
- **修复**: 评估优先级，完成或移除

### W4. 仅 Product 模型实现软删除
- **文件**: `prisma/schema.prisma`
- **问题**: 2185 行的 Schema 中只有 `Product` 模型有 `deletedAt` 字段。Order、Customer、Supplier、Quotation 等核心业务模型都没有软删除，删除操作是物理删除
- **修复**: 为需要审计追踪的模型添加 `deletedAt DateTime?` 字段

### W5. 订单号/单号生成存在并发风险
- **文件**: `src/app/api/orders/route.ts` 第 250-257 行
- **问题**: 订单号通过 `count + 1` 方式生成，并发请求可能产生重复订单号
- **修复**: 使用数据库序列或在事务中生成（`/api/v1/inbound-orders/route.ts` 已正确实现，可作为参考）

### W6. Zod 验证器仅部分 API 使用
- **文件**: `src/lib/validators/` 下的验证器
- **问题**: 只有 orders、products 等少数 API 路由使用了 Zod 输入验证。大多数 API 直接使用 `await request.json()` 不做验证
- **修复**: 为所有接收用户输入的 API 路由添加 Zod 验证

### W7. 测试文件有 TypeScript 编译错误
- **文件**: 
  - `__tests__/api/roles-permissions.test.ts` — 缺少 `node-mocks-http` 依赖 + mock 类型错误
  - `__tests__/permissions/permission-middleware.test.ts` — 使用了不存在的 `prisma.user.find` 方法
- **修复**: 安装缺失依赖，修正 mock 代码

### W8. 密码加密强度不足
- **文件**: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`
- **问题**: `bcrypt.hash(password, 10)` — salt rounds = 10 在现代硬件上偏快，建议使用 12+
- **修复**: 改为 `bcrypt.hash(password, 12)`

### W9. 内存缓存多实例不安全
- **文件**: `src/lib/rate-limit.ts`, `src/lib/permissions.ts`
- **问题**: 速率限制和权限缓存都使用 `Map` 存储在内存中。在多实例/Serverless 部署中无效（每个实例独立缓存），且进程重启后丢失
- **修复**: 使用 Redis 作为分布式缓存

### W10. 前端页面引用不存在的路由
- **文件**: `src/app/login/page.tsx` 第 201 行
- **问题**: 链接到 `/forgot-password`，但该页面不存在
- **修复**: 创建对应页面或移除链接

### W11. /api/v1/products 路由缺失 CRUD
- **文件**: `src/app/api/v1/products/route.ts`
- **问题**: 只有 GET 方法，缺少 POST 创建。而 `src/app/api/products/route.ts` 有完整的 CRUD。两套路径功能不对等
- **修复**: 补充 v1 路径的完整 CRUD 或统一路径

### W12. Email 服务未实现
- **文件**: `src/lib/email.ts`
- **问题**: 邮件发送功能仅开发模式打印日志，生产环境直接跳过。报价单发送等依赖邮件的功能无法正常工作
- **修复**: 集成 Nodemailer + SMTP 服务，或使用第三方邮件 API（SendGrid 等）

### W13. `checkPermission.ts` 已废弃但仍存在
- **文件**: `src/middleware/checkPermission.ts`
- **问题**: 文件注释明确标注 "Legacy - Pages Router"，且 session 检查被注释掉，`userId = 'legacy'` 硬编码。任何调用此中间件的代码都绕过了认证
- **修复**: 删除此文件，或添加运行时错误防止误用

### W14. 测试覆盖率目标与实际不符
- **文件**: `jest.config.js`
- **问题**: 覆盖率阈值设为 50%，但实际 API 路由中大量缺少测试。特别是 RBAC 权限、报表、审批流程等核心功能测试不足
- **修复**: 补充核心 API 测试后再提高覆盖率阈值

### W15. `bcrypt` 和 `bcryptjs` 同时安装
- **文件**: `package.json`
- **问题**: 同时依赖了 `bcrypt`（原生 C++）和 `bcryptjs`（纯 JS），增加 bundle 体积和潜在不一致
- **修复**: 统一使用 `bcryptjs`（无原生依赖，更兼容），或统一使用 `bcrypt`（性能更好）

---

## 💡 Suggestions（优化建议）

### S1. 统一错误响应格式
- 项目中已有 `@/lib/api-response.ts` 提供标准化响应，但部分 API 路由直接使用 `NextResponse.json()`。建议统一使用标准化响应函数

### S2. 添加 API 文档
- 90 个 API 路由缺少 OpenAPI/Swagger 文档。建议集成 `next-swagger-doc` 或类似工具

### S3. 分页参数默认值验证
- 部分列表 API 未验证 `page` 和 `limit` 的上限，可能导致性能问题。建议设置 `limit` 最大值（如 100）

### S4. 数据库索引优化
- `Order.orderNo` 已标记为 `@unique`，同时又加了 `@@index([orderNo])`，属于冗余索引
- 建议审查所有 `@@unique` + `@@index` 组合，移除冗余索引

### S5. 使用环境变量管理公共路径
- `middleware.ts` 中的 `publicPaths` 数组硬编码，建议提取为环境变量或配置对象

### S6. 添加请求 ID 追踪
- 建议为每个请求生成唯一 ID（如 `x-request-id`），便于日志关联和调试

### S7. 前端状态管理
- 项目使用 `@tanstack/react-query` 但没有看到统一的数据获取层。建议为每个资源创建对应的 React Query hooks

### S8. 添加健康检查端点
- `src/app/api/health/route.ts` 存在但功能简单。建议添加数据库连通性、缓存状态等深度检查

### S9. 生产环境构建检查
- 当前没有 CI/CD 配置（`.github` 目录只有空框架）。建议添加 GitHub Actions 工作流，包含 type-check、lint、test 步骤

### S10. 依赖安全更新
- `npm audit` 报告 13 个漏洞。建议定期运行 `npm audit fix` 并评估高危依赖

### S11. 日志持久化
- 当前日志输出到 `logs/` 目录但没有结构化。建议集成日志轮转和日志聚合

---

## ✅ Good（做得好的部分）

1. **Prisma Schema 验证通过** — `npx prisma validate` 无错误
2. **完善的 Zod 输入验证器** — `src/lib/validators/` 下有多领域验证器（order, product, supplier, quotation, purchase-order）
3. **标准化 API 响应** — `src/lib/api-response.ts` 提供了一致的成功/错误响应格式
4. **登录失败限制** — `src/app/api/auth/login/route.ts` 实现了内存级别的失败登录计数（5 次/15 分钟）
5. **RBAC 权限系统设计完善** — 虽然实现有 bug，但角色-权限设计（多角色、通配符、行级过滤）架构合理
6. **事务使用正确场景** — `v1/inbound-orders` 和 `v1/outbound-orders` 正确使用了 `prisma.$transaction()`
7. **密码哈希** — 使用 bcrypt 而非明文存储
8. **审批流** — 新用户注册需要管理员审批（`isApproved` 标志）
9. **测试框架搭建完整** — Jest + Playwright 双测试体系，包含单元测试、集成测试、E2E 测试
10. **代码组织清晰** — API 路由、组件、hooks、lib、types 分层合理

---

## 🔧 工具诊断结果

### Prisma Schema
```
✅ npx prisma validate — The schema at prisma/schema.prisma is valid
```

### TypeScript 检查
```
❌ npx tsc --noEmit — 8 个错误（全部在测试文件）
   - __tests__/api/roles-permissions.test.ts: 5 个错误
     - 缺少 node-mocks-http 类型声明
     - Mock 返回类型与 Promise 不匹配
   - __tests__/permissions/permission-middleware.test.ts: 3 个错误
     - 使用了不存在的 prisma.user.find 方法（应为 findUnique/findMany）
```

### 依赖安全
```
⚠️ npm audit — 13 vulnerabilities
   - 1 moderate
   - 11 high
   - 1 critical
```

---

## 📋 修复优先级建议

### P0（立即修复，1-2 天内）
1. **C1/C2/C12**: 删除或保护 debug 端点 — 安全紧急
2. **C4**: 为 47 个无认证的 API 路由添加认证检查
3. **C3**: 修复 cookie 名称不一致（`auth_token` → `auth-token`）

### P1（本周内）
4. **C5**: 统一认证系统，删除重复模块
5. **C6**: 启用 CSRF 防护
6. **C7**: 注册接口添加速率限制
7. **C10**: 批量操作添加事务保护
8. **C11**: 删除 .bak 文件

### P2（本月内）
9. **W1**: 统一 API 路径版本
10. **W2**: 清理生产环境 console.log
11. **W6**: 补充 Zod 验证
12. **W4**: 为核心模型添加软删除
13. **W8**: 提高 bcrypt rounds
14. **W15**: 统一 bcrypt 依赖

---

*报告结束*
