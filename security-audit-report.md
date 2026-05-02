# Trade ERP 安全审查报告

**审查日期**: 2026-05-02
**审查范围**: 认证、授权、输入验证、CSRF、敏感数据、速率限制、审计日志、常见漏洞
**总评分**: 52 / 100

---

## 评分明细

| 维度 | 评分 | 说明 |
|------|------|------|
| 认证体系 | 40/100 | 4+ 套系统并存，统一入口未生效 |
| 授权/权限控制 | 45/100 | RBAC 框架完整但落地不统一，v1 API 大量缺失 |
| 输入验证 | 70/100 | Zod 质量好但应用覆盖率不足 |
| CSRF 防护 | 30/100 | 仅生产环境 + 仅 Origin/Referer，开发环境裸奔 |
| 敏感数据保护 | 55/100 | bcrypt + jose 正确，但密钥强度弱 |
| 速率限制 | 35/100 | 仅登录端点，内存实现不可扩展 |
| 审计日志 | 10/100 | 表结构存在，但无任何写入代码 |
| 代码质量/漏洞 | 65/100 | 无明显 RCE/SQLi，但有配置泄露等风险 |

---

## 核心发现（5条）

### 1. P0 — 认证体系碎片化：4套认证模块同时活跃
- `src/lib/auth.ts` — 客户端/服务端混合，重新导出 middleware/auth
- `src/lib/auth-api.ts` — API 专用 `getUserFromRequest`
- `src/lib/auth-simple.ts` — **已标注废弃但仍可被引用**
- `src/lib/auth-unified.ts` — 试图统一但只是薄封装，未替换旧代码
- `src/middleware/auth.ts` — 完整 RBAC 实现
- `src/middleware.ts` — Edge 层基础认证拦截
- `src/components/AuthGuard.tsx` — 客户端角色守卫（依赖 localStorage）

**影响**: 新路由开发者不知道该用哪个，权限策略分散在 7 个文件中，维护成本极高。

### 2. P0 — 审计日志形同虚设：表存在但无写入代码
`prisma.auditLog.create` 在全项目中调用次数为 **0**。虽然：
- Prisma schema 中 `AuditLog` 模型存在（2573行）
- `GET /api/v1/audit-logs` 端点存在可读
- 但所有 CREATE/UPDATE/DELETE 操作均未记录

**影响**: 一旦发生安全事件，完全无法追溯谁在何时做了什么操作。

### 3. P0 — CSRF 防护仅在生产环境生效，且实现不完整
`src/middleware.ts:19` — CSRF 校验条件为 `process.env.NODE_ENV === 'production'`。开发环境所有 POST/PUT/DELETE 请求完全无 CSRF 防御。同时：
- 仅使用 Origin/Referer 校验（可被某些中间件/代理绕过）
- 无 CSRF token 挑战-响应机制
- `middleware/auth.ts:112-121` 中存在 `x-csrf-token` 验证函数但**从未被调用**

### 4. P1 — RBAC 权限检查在 v1 API 中大面积缺失
- `getUserFromRequest`（仅认证检查）调用 **134 次**
- `requirePermission`（RBAC 检查）仅调用 **38 次**
- 以下 v1 路由只做了简单认证但没有权限检查：products, suppliers, purchase-orders, shipments, outbound-orders, warehouses, settings, reimbursements, audit-logs, user-preferences

### 5. P1 — JWT 密钥强度弱，存在泄露风险
- `.env.production:6` — `JWT_SECRET=trade-...ment`（规律性字符串，非随机生成）
- `.env.production:7` — `NEXTAUTH_SECRET=trade-...ment`（同上）
- 代码 `src/lib/auth-api.ts:56` / `auth-simple.ts:60,108` 等处使用 `SECRET=***` 占位符（早期可能有硬编码密钥）
- `.env.local` 已提交到 git（虽然被 `.gitignore` 保护，但需确认）

---

## 问题清单

### P0（立即修复）

| # | 问题 | 文件 | 行号 | 描述 |
|---|------|------|------|------|
| 1 | 审计日志无写入 | 全局 | - | prisma.auditLog.create 零调用，操作不可追溯 |
| 2 | CSRF 生产环境限制 | src/middleware.ts | 19 | 条件 `process.env.NODE_ENV==='production'` 导致开发环境无 CSRF 保护 |
| 3 | CSRF Token 验证闲置 | src/middleware/auth.ts | 112-121 | verifyCSRFToken 函数定义但从未被任何路由调用 |

### P1（高优先级）

| # | 问题 | 文件 | 行号 | 描述 |
|---|------|------|------|------|
| 4 | v1/products 无 RBAC | src/app/api/v1/products/route.ts | 34-40 | 仅 getUserFromRequest，无 requirePermission |
| 5 | v1/suppliers 无 RBAC | src/app/api/v1/suppliers/route.ts | 14-20 | 同上 |
| 6 | v1/purchase-orders 无 RBAC | src/app/api/v1/purchase-orders/route.ts | 17-23 | 同上 |
| 7 | v1/shipments 无 RBAC | src/app/api/v1/shipments/route.ts | 16-19 | 同上，POST 也仅认证 |
| 8 | v1/outbound-orders 无 RBAC | src/app/api/v1/outbound-orders/route.ts | 48-57 | 同上 |
| 9 | v1/warehouses 无 RBAC | src/app/api/v1/warehouses/route.ts | 47-51 | 同上 |
| 10 | v1/settings 无 RBAC | src/app/api/v1/settings/route.ts | 1-40 | 仅 getUserFromRequest |
| 11 | v1/reimbursements 无 RBAC | src/app/api/v1/reimbursements/route.ts | 1-29 | 仅简单认证 |
| 12 | 4 套认证系统并存 | src/lib/auth*.ts + middleware/auth.ts | 全局 | auth-api, auth-simple, auth-unified, middleware/auth 全部活跃 |
| 13 | JWT 密钥非随机 | .env.production | 6-7 | `trade-...ment` 模式字符串 |
| 14 | auth-simple 废弃但仍存在 | src/lib/auth-simple.ts | 1-130 | 标注 @deprecated 但未删除，可能被引用 |
| 15 | 速率限制仅覆盖登录 | src/app/api/auth/login/route.ts | 27-28 | 注册/密码重置等端点无保护 |
| 16 | 速率限制内存 Map | src/lib/rate-limit.ts | 23 | 单机内存，多实例部署无效 |

### P2（中优先级）

| # | 问题 | 文件 | 行号 | 描述 |
|---|------|------|------|------|
| 17 | AuthGuard 依赖 localStorage | src/components/AuthGuard.tsx | 32-41 | localStorage.getItem('user') + JSON.parse — 可被篡改 |
| 18 | 密码最小长度不一致 | src/lib/api-schemas.ts | 34 | 服务端 min(6)，客户端 min(8) |
| 19 | 手动 SQL 清理代替 Zod | src/app/api/v1/products/route.ts | 22-31 | 使用 sanitizeSearchInput 手动清理而非 Zod + Prisma |
| 20 | 审计日志端点无权限限制 | src/app/api/v1/audit-logs/route.ts | 24-25 | 仅 getSession 检查，任何认证用户可读全量日志 |
| 21 | 注册端点可能缺失 | src/app/register/page.tsx | 102 | 前端 POST /api/auth/register 但文件未找到 |
| 22 | x-forwarded-for 可伪造 | src/lib/rate-limit.ts | 46-48 | 使用客户端可控的 header 做限速 key |
| 23 | 无账号锁定机制 | src/app/api/auth/login/route.ts | 122-152 | failedLoginMap 仅限速不锁定账号 |
| 24 | cookie sameSite 不统一 | src/lib/auth-simple.ts | 76 | sameSite: 'lax' vs login route 的 sameSite: 'strict' |

---

## 修复建议

### 立即修复（P0）

**1. 实现审计日志写入**
在 Prisma client 层或统一 API handler 层添加审计日志拦截：
```typescript
// 方案：统一在 api-response.ts 的 write 操作后调用
export async function createAuditLog(params: {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
  entityType: string;
  entityId: string;
  details?: any;
}) {
  await prisma.auditLog.create({ data: params });
}
```
建议在 `api-response.ts` 的 `createdResponse`/`successResponse` 或每个路由 handler 的关键操作后调用。

**2. CSRF 防护修复**
- 移除 `process.env.NODE_ENV === 'production'` 条件，在所有环境启用
- 实现双 token 机制（CSRF token in cookie + header 校验）
- 或利用 Next.js 的 Server Actions 内置 CSRF 保护
- 最低要求：Origin/Referer 校验在所有环境生效

### 高优先级修复（P1）

**3. 统一认证模块**
- 删除 `auth-simple.ts`（已废弃）
- 将 `auth-api.ts` 合并入 `middleware/auth.ts` 或 `auth-unified.ts`
- 将 `auth-unified.ts` 升级为**唯一入口**，所有新路由强制使用
- 添加 lint 规则禁止 import `@/lib/auth-api` 和 `@/lib/auth-simple`

**4. 补齐 v1 API RBAC 检查**
对以下路由添加 `requirePermission` 调用：
- `v1/products`: `product:list`, `product:create`, `product:edit`, `product:delete`
- `v1/suppliers`: `supplier:list`, `supplier:create`, `supplier:edit`, `supplier:delete`
- `v1/purchase-orders`: `purchase:list`, `purchase:create`, `purchase:edit`
- `v1/shipments`: `shipment:list`, `shipment:create`, `shipment:edit`, `shipment:delete`
- `v1/warehouses`: `warehouse:list`, `warehouse:edit`
- `v1/settings`: `settings:list`, `settings:edit`

**5. JWT 密钥管理**
- 生产环境使用 `openssl rand -hex 64` 生成强密钥（至少 32 字节）
- 确保 `.env.production` 中的密钥不提交到版本控制
- 考虑使用密钥轮换机制或 KMS 服务

**6. 速率限制扩展**
- 对注册、密码重置、API 批量操作端点添加速率限制
- 考虑使用 Redis 替代内存 Map 以支持水平扩展
- 添加 IP + User-Agent 组合识别防止 IP 伪造

### 中优先级修复（P2）

**7. AuthGuard 改进**
- 不要仅依赖 localStorage 做权限判断
- 添加 `/api/auth/me` 的定期验证或使用 httpOnly cookie 状态

**8. 密码策略统一**
- 统一服务端和客户端的最小密码长度（建议 8）
- 服务端 RegisterSchema 添加密码强度校验

**9. 搜索输入处理规范化**
- 统一使用 Prisma 的 `contains` + `mode: 'insensitive'`（已参数化查询），无需手动 sanitizeSearchInput
- 手动清理代码 `sanitizeSearchInput` 可以移除

**10. 账号锁定机制**
- 连续 5 次失败登录后锁定账号 15 分钟（在数据库记录 failedLoginAttempts）
- 避免仅依赖内存 Map（服务重启后重置）

---

## 已确认的安全措施（正面）

- ✅ bcryptjs 正确用于密码对比（非明文存储）
- ✅ jose 库用于 JWT 签名验证（标准实现）
- ✅ Zod schemas 定义完整（api-schemas.ts）
- ✅ 文件上传有 MIME + 魔数双重校验
- ✅ `withValidation` 声明式验证中间件存在
- ✅ 软删除（deletedAt）支持
- ✅ 行级数据过滤（row-level-filter.ts）
- ✅ CSRF 在生产环境有 Origin/Referer 校验
- ✅ middleware.ts 路由级认证拦截
- ✅ 密码强度客户端提示
