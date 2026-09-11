# Trade ERP 亚马逊广告优化管理（M1）后端详细设计

> 文档编号：TRADE-ERP-ADS-M1-BE-v1.0
> 状态：**详细设计（待 Phase 3 审核）** | 日期：2026-08-29
> 作者：Hermes Agent（后端工程师 BE，独立产出）
> 上游基准（两级，冲突时以需求为准）：
> - 需求规格：`docs/advertising-domain-m1-requirements.md`（501 行，**唯一需求基准**：§3 REQ-ADS-001~011、§4 v20 规则、§5 权限、§6 异常 E1~E9、§7 验收 AC-1~10、§8 隐性 R1~R8、§9 非功能）
> - 架构 v2：`docs/advertising-domain-m1-architecture.md`（1045 行，**技术基准**：五表数据模型、API 17 行端点、Python 引擎契约、批量表、权限、安全）
> 代码探索依据（已实地核对，非假定）：`src/lib/api-response.ts`、`src/lib/api-validation.ts`、`src/lib/api-schemas.ts`、`src/lib/crypto-utils.ts`、`src/lib/permissions.ts`、`src/lib/auth-unified.ts`、`src/app/api/permissions/init/route.ts`、`src/app/api/v1/competitors/route.ts`、`src/app/api/upload/route.ts`、`src/app/api/orders/route.ts`、`src/lib/sync/order-sync.ts`、`src/middleware.ts`、`prisma/schema.prisma`（AuditLog/PlatformSyncConfig/Permission/Role/RolePermission/UserRole）、`package.json`（zod ^4.3.6，无 exceljs）、`services/`（alibaba-collector 先例）、`data/`（competitor-monitoring 私有目录先例）、`~/.hermes/skills/ecommerce/amazon-ads-optimization/SKILL.md`（v18.1 已验证 33 列批量表列头）、`~/clawd/amazon-ads-optimizer/modules/report_analyzer.py`（v20 引擎，557 行纯标准库）

---

## 目录

1. [设计范围与端点覆盖说明](#一设计范围与端点覆盖说明)
2. [现有代码约定探索结论（已核实）](#二现有代码约定探索结论已核实)
3. [通用 API 约定](#三通用-api-约定)
4. [API 端点详细设计（架构 §4.1 全表 17 端点）](#四api-端点详细设计架构-41-全表-17-端点)
5. [Prisma 查询与写入设计](#五prisma-查询与写入设计)
6. [Python 引擎集成](#六python-引擎集成)
7. [批量表生成（bulk-table.ts）](#七批量表生成bulk-tablets)
8. [权限实现](#八权限实现)
9. [凭据安全](#九凭据安全)
10. [审计日志点](#十审计日志点)
11. [事务边界](#十一事务边界)
12. [文件存储](#十二文件存储)
13. [数据获取层（ReportFetcher/ManualFetcher）](#十三数据获取层reportfetchermanualfetcher)
14. [目录/文件清单（开发顺序，BE 范围）](#十四目录文件清单开发顺序be-范围)
15. [验收映射（AC-1~10 → 后端验证）](#十五验收映射ac-110--后端验证)
16. [BE 侧风险与注意事项（架构 §11 之外）](#十六be-侧风险与注意事项架构-11-之外)
17. [Phase 3 审核自查清单](#十七phase-3-审核自查清单)

---

## 一、设计范围与端点覆盖说明

### 1.1 范围

本设计覆盖 M1 后端全部交付物：

| 层 | 交付物 |
|----|--------|
| API 层 | `src/app/api/v1/ads/**` 全部 Route Handler（17 端点，见 §1.2） |
| 服务层 | `src/lib/ads/engine-client.ts`（子进程封装）、`engine-schema.ts`（引擎 JSON Zod 校验）、`bulk-table.ts`（批量表）、`mask.ts`（凭据脱敏）、`fetchers/report-fetcher.ts`（数据获取层抽象） |
| 引擎目录 | `services/amazon-ads-engine/`（analyze_cli.py 适配层 + v20 模块复制 + VERSION） |
| 数据层 | `prisma/schema.prisma` 追加 5+1 模型（表结构以架构 §2 为准，本设计只补充查询/事务/索引用法）、站点种子脚本 |
| 权限 | 3 权限点注册两处种子 + `seedAdsRolePermissions()` 幂等接线 |
| 文件 | 上传私有目录 `data/ads-reports/`、引擎临时目录 `data/ads-engine/` |

不覆盖：前端页面/组件/hooks（另出 FE 设计）、引擎内部判定逻辑（零重写原则，BE 只写适配层）、M2 API 拉取/执行。

### 1.2 端点覆盖说明（架构 §4.1 表 17 行全量覆盖）

架构 v2 §4.1 端点表实际为 **17 行**（任务书言 14，按资源归并为 14 组设计节，本节逐一编号，全部覆盖、无遗漏）：

| 组 | 端点 | 权限 | 对应设计节 |
|----|------|------|-----------|
| 1 | GET `/api/v1/ads/accounts` | ads:view | §4.1 |
| 2 | POST `/api/v1/ads/accounts` | ads:admin | §4.2 |
| 3 | PUT `/api/v1/ads/accounts/:id` | ads:admin | §4.3 |
| 4 | DELETE `/api/v1/ads/accounts/:id` | ads:admin | §4.4 |
| 5 | GET `/api/v1/ads/marketplaces` | ads:view | §4.5 |
| 6 | POST `/api/v1/ads/marketplaces` + PUT/DELETE `/marketplaces/:id`（3 子端点一组） | ads:admin | §4.6 |
| 7 | POST `/api/v1/ads/reports/upload`（multipart） | ads:edit | §4.7 |
| 8 | GET `/api/v1/ads/reports` | ads:view | §4.8 |
| 9 | POST `/api/v1/ads/reports/:id/analyze` | ads:edit | §4.9 |
| 10 | GET `/api/v1/ads/reports/:id/result` | ads:view | §4.10 |
| 11 | GET `/api/v1/ads/reports/:id/file` | ads:view | §4.11 |
| 12 | DELETE `/api/v1/ads/reports/:id` | ads:admin | §4.12 |
| 13 | GET `/api/v1/ads/keywords` | ads:view | §4.13 |
| 14 | PUT `/api/v1/ads/keywords/:id` | ads:edit | §4.14 |
| 15 | POST `/api/v1/ads/bulk-table` | ads:edit | §4.15 |
| 16 | GET `/api/v1/ads/bulk-table/:recommendationId/download` | ads:edit | §4.16 |
| 17 | GET `/api/v1/ads/recommendations` + `compare`（P1） | ads:view | §4.17 |

---

## 二、现有代码约定探索结论（已核实）

> 本设计全部对齐以下**已存在**的约定；探索过程中发现的陷阱以 ⚠️ 标注，已在设计中规避。

| 文件/位置 | 已核实的约定 | 对 ads 域的设计影响 |
|-----------|-------------|---------------------|
| `src/lib/api-response.ts` | `successResponse(data, message?, code='SUCCESS')`、`listResponse(items, pagination)`、`createdResponse`（201）、`errorResponse(message, code, status, errors?)`、`validationErrorResponse`（422）、`notFoundResponse`（404）、`conflictResponse`（409）、`forbiddenResponse`（403）；响应统一 `{success, code, data, message, timestamp}`；Zod v4 用 `issues` | ads 端点一律复用，不新造包装 |
| `src/lib/api-validation.ts` | `validateOrReturn(schema, data, target?)` 返回 `{success, data} | {success:false, response}`；`withValidation({body, query, params}, handler)` 支持 **Next.js 16 params 为 Promise** 的自动 resolve | 新端点优先 `withValidation`；multipart 端点（upload）除外，按 `/api/upload` 手写 |
| `src/lib/api-schemas.ts` | `PaginationSchema = {page: z.coerce.number().int().min(1).default(1), limit: ...default(20), sortBy: default('createdAt'), sortOrder: enum default('desc')}`；字段风格 `.optional().nullable()`、`.or(z.literal(''))`、中文错误消息 | ads 列表查询直接复用/扩展 PaginationSchema；⚠️ 其默认 sortBy='createdAt' 对决策行列表不适用（见 §4.13） |
| `src/lib/crypto-utils.ts` | AES-256-GCM：`encrypt(text)` → hex(iv+ct+authTag)；`decrypt()`；未配 `ENCRYPTION_KEY` 降级 `base64:` 前缀；`encryptCredentials/decryptCredentials` 为 Json 字段封装的现成先例（PlatformSyncConfig.credentials 在用） | AdAccount 三凭据字段为 **String 列**（非 Json），直接 `encrypt()` 单值；⚠️ 降级路径真实存在，部署检查项（§9.4） |
| `src/lib/permissions.ts` | `hasPermission(userId, code)` 带 5 分钟内存缓存；`*` 快速路径（legacy `user.role` in admin/super-admin）；`module:*` 通配匹配；`initDefaultPermissions()` 内 `defaultPermissions` 数组（43 条）逐条 findUnique+create，角色 5 个（admin/sales/purchasing/warehouse/viewer）**但从不接线 RolePermission** | 3 个 ads 权限点追加到该数组；新增 `seedAdsRolePermissions()` 在此文件导出（§8.3）；⚠️ hasPermission 缓存 5 分钟——接线后已登录用户可能缓存未命中新权限，开发验证时需重新登录或调 `invalidateUserPermissionsCache` |
| `src/app/api/permissions/init/route.ts` | **独立的** `defaultPermissions` 数组（模块命名风格不同：user/customer/order…）+ `defaultRoles`（super_admin/admin/sales_manager/sales/…）；`createMany + skipDuplicates`；**仅给 super_admin 接线全部权限**（admin 角色在该体系下无 RolePermission 行） | ads 3 权限点**必须同步追加到此处**（架构 §3.1 必改项 5）；⚠️ 该 init 的 admin 角色无线接——`seedAdsRolePermissions()` 必须同时覆盖「按角色名找 Role 并接 RolePermission」两套命名（admin/sales 两体系同名，可统一处理） |
| Route 范式（`src/app/api/v1/competitors/route.ts`） | try/catch 包裹 → `getUserFromRequest(request)` 401 → `validateOrReturn` 422 → 业务 → `listResponse/createdResponse` → catch 统一 `errorResponse(..., 'INTERNAL_ERROR', 500)` | ads 路由照此范式；权限校验插在认证之后 |
| `src/lib/auth-unified.ts` | `getUserFromRequest(request): Promise<UserSession | null>`，session 含 `{id, email, name, role}`；`withAuth` 高阶 | 统一用 `getUserFromRequest`；`session.id` 即 userId |
| `src/app/api/upload/route.ts` | multipart 范式：`request.formData()` → `file.type` MIME 白名单 → 大小上限 → **魔数校验**（`validateMagicBytes`，xlsx 无签名条目需补 `PK\x03\x04`）→ `mkdir` + 唯一文件名 + `writeFile` | ads upload 复用此模式但**改私有目录** `data/ads-reports/`（§12），大小上限 50MB（E9），xlsx 魔数 `PK\x03\x04`、csv 校验 UTF-8 可解码 |
| `src/middleware.ts` | `/api/**` 非 GET 请求统一 Origin/Referer 同源校验（排除 /api/auth//external//debug/）+ `auth-token` cookie 认证拦截 | ads 路由（/api/v1/ads/**）**自动覆盖** CSRF 与登录拦截，无需新增（架构 §3.4） |
| 审计日志 | `prisma.auditLog.create({action, entityType, entityId, userId, details, ipAddress, userAgent})`（`src/app/api/orders/route.ts` 的 `writeAuditLog` 封装范式；`src/lib/sync/order-sync.ts` 同款）；AuditLog 表字段已核实（schema 2508 行，user 软关联 SetNull） | 抽公用 `src/lib/ads/audit.ts` 封装 `writeAdsAuditLog`（§10），details 只记业务变更不记凭据明文 |
| `child_process` 先例 | `src/app/api/external/alibaba-collect/route.ts` 有 `import { spawn }` 但调用已注释（"API 路由中直接 spawn 可能阻塞"）——**无可用先例**；`services/alibaba-collector/` 目录存在（Python 服务目录先例） | `engine-client.ts` 全新编写，按架构 §5.3 规格（execFile 数组参数、超时/重试/白名单/并发闸门）；⚠️ 子进程在 Node 运行时下可用，注意 maxBuffer 配置（stderr 全量记录需求） |
| `package.json` | `zod ^4.3.6`（**Zod v4**，`.catch()`/`.issues` 可用）；`@tanstack/react-query ^5`；`xlsx`/`papaparse` 在；**`exceljs` 不在**（架构 §6.1/§11 R1 确认） | 开发第 1 步 `npm i exceljs`（步骤 0，§7.1）；引擎输出校验用 Zod v4 `.catch()` 容错 |
| `prisma/schema.prisma` | 风格：cuid 主键、snake_case `@@map`、显式外键关系、`onDelete: Cascade`、索引覆盖查询；PlatformSyncConfig.credentials 为加密 Json 先例 | 5+1 表按架构 §2 原样追加；本设计只补充查询索引用法（§5） |
| `data/` 私有目录 | 已存在 `data/competitor-monitoring/`、`data/debug-previews/` 先例（非 public 的数据目录） | ads 上传目录 `data/ads-reports/{accountId}/`、引擎临时 `data/ads-engine/`，符合私有化要求（§12） |
| 种子 | **无 `prisma/seed.ts`**（prisma/ 下为 migrations + 拆分 schema 文件） | AdMarketplace 9 站点种子写成独立脚本 `prisma/seed-ads.ts`（幂等 upsert，§14 步骤 2） |

---

## 三、通用 API 约定

### 3.1 请求/响应包装（对齐现有代码，前端读取约定）

- 前缀：`/api/v1/ads/`；所有响应经 `successResponse/listResponse/createdResponse/errorResponse/...` 包装。
- **前端读取约定（已探索确认，`src/hooks/use-orders.ts`）**：fetcher 返回 `res.json()` 后解包 `.data`（即 `data.data`）；列表读 `data.items` + `data.pagination`。本设计所有端点响应形状遵循该约定。
- 分页对象：`{ page, limit, total, totalPages }`（与 `listResponse` 签名一致）。

### 3.2 Zod 使用规范（Zod v4，对齐 api-schemas 风格）

| 用途 | 写法 | 说明 |
|------|------|------|
| 查询数字 | `z.coerce.number().int().min(1).default(1)` | 复用 PaginationSchema |
| 查询布尔 | ⚠️ **禁止 `z.coerce.boolean()`**（`Boolean('false') === true` 陷阱）→ 用 `z.enum(['true','false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined)` | §4.8/§4.13 用到 |
| 引擎 JSON 容错 | `z.coerce.number().nullable().catch(null)`、`z.coerce.number().catch(0)` | 引擎可能输出 null/缺字段，`.catch()` 兜底不拒批（§6.4） |
| 可选字段 | `.optional().nullable()` | 与现有 schema 风格一致 |
| 空串兜底 | `.or(z.literal(''))` | 现有一致 |
| 路径参数 | `withValidation({params: IdSchema})`；Next.js 16 params 为 Promise，withValidation 已自动 resolve | 新路由统一用 |
| 请求体 | `withValidation({body: XxxSchema})` 或手写 `validateOrReturn` | multipart 除外 |

### 3.3 错误码总表（HTTP 状态 + code + E1~E9 映射）

> 业务码风格对齐 `/api/upload` 的 `INVALID_TYPE`/`FILE_TOO_LARGE` 大写蛇形。

| HTTP | code | 对应异常 | 场景 |
|------|------|----------|------|
| 401 | `UNAUTHORIZED` | — | 未登录（middleware 或路由双重） |
| 403 | `FORBIDDEN` / `CSRF_INVALID` | — | 无权限点 / CSRF 拦截（middleware 已覆盖） |
| 404 | `NOT_FOUND` | — | 账户/报告/决策/站点不存在（含软删） |
| 409 | `CONFLICT` | — | platformCode+marketplaceId 唯一冲突、marketplace code/marketplaceId 冲突、分析进行中（ANALYZING 并发） |
| 422 | `VALIDATION_ERROR` | — | Zod 校验失败（含缺失必填字段） |
| 422 | `NO_FILE` | — | upload 至少一份文件（REQ-001-1） |
| 400 | `FILE_TOO_LARGE` | **E9** | 单文件 > 50MB |
| 400 | `INVALID_TYPE` / `INVALID_MAGIC_BYTES` | **E1** | 扩展名/MIME/魔数不符 |
| 422 | `PARSE_FAILED` | **E1** | 引擎 parse 失败（errors 数组指明缺哪列/哪个文件，附列名风险提示文案；不落库） |
| 422 | `CONSISTENCY_MISMATCH` | **E4** | 双报告口径偏差 > 15%（analyze 时阻断，返回两报告花费/订单差异明细；无 force 参数） |
| 422 | `NO_ACTIONS` | **E6** | 勾选清单为空且未确认（confirmEmpty=false） |
| 422 | `BULK_SELF_CHECK_FAILED` | **E5** | 4 项自检任一非 0（errors 列缺 ID 行） |
| 422 | `ACCOUNT_INACTIVE` | — | 上传/分析指向 isActive=false 账户 |
| 500/502 | `ENGINE_FAILED` | **E2/E7** | 引擎 exit 非 0 / 超时 / {ok:false} / 契约校验失败（重试 1 次后），analyzeError 落库、状态 ANALYZE_FAILED |
| 422 | `INVALID_DATE_RANGE` | — | startDate > endDate 或日期格式非法 |
| 409 | `ANALYSIS_IN_PROGRESS` | — | 报告已在 ANALYZING（并发守卫，§5.4） |

异常 E3（无 Targeting 报告）与 E8（重复分析）**不是错误**：E3 → degraded 模式正常 200（`degraded:true`）；E8 → 允许重跑生成新版本 200。

### 3.4 认证与权限校验流程（每端点统一前置）

```
1. const session = await getUserFromRequest(request);  if (!session) → 401 UNAUTHORIZED
2. const ok = await hasPermission(session.id, '<perm>'); if (!ok) → 403 FORBIDDEN
3. 业务逻辑（Zod 已先行）
```
- 读接口 `ads:view`；写接口 `ads:edit`；账户/凭据/删除 `ads:admin`（§8.5 校验点表）。
- CSRF 与登录 cookie 拦截由 `src/middleware.ts` 自动覆盖，路由内不做重复。

### 3.5 审计日志统一封装

`src/lib/ads/audit.ts` 导出 `writeAdsAuditLog({action, entityType, entityId, userId, details, request})`：
- request 透传取 `x-forwarded-for || x-real-ip || 'unknown'` 与 `user-agent`（对齐 orders 路由的 `getClientInfo`）；
- details 为业务变更对象（凭据只记「已更新」不记明文，§10）。

---

## 四、API 端点详细设计（架构 §4.1 全表 17 端点）

### 4.1 GET `/api/v1/ads/accounts` — 账户列表（ads:view）

**查询参数**（`withValidation({query})`）：

```typescript
const AdsAccountsQuerySchema = PaginationSchema.extend({
  search: z.string().max(100).optional(),                       // 匹配 name / externalId
  active: z.enum(['true', 'false']).optional()
    .transform(v => v === undefined ? undefined : v === 'true'), // ⚠️ 禁用 z.coerce.boolean()
});
```

**逻辑**：`prisma.adAccount.findMany({ where: { deletedAt: null, ...(active !== undefined && { isActive: active }), ...(search && { OR: [{ name: { contains: search } }, { externalId: { contains: search } }] }) }, include: { marketplace: true }, orderBy: { createdAt: 'desc' }, skip, take })` + `count` 同 where。**select 时不查 clientSecret/refreshToken 列**（凭据列只在需要脱敏回显时取，双保险 §9.3）。

**响应** `listResponse(items, pagination)`，items 项（凭据一律 `maskCredential()`，§9.2）：

```json
{ "id": "cuid", "platformCode": "amazon", "marketplaceId": "ATVPDKIKX0DER",
  "marketplace": { "code": "US", "name": "美国站", "currency": "USD", "adEndpoint": "advertising-api.amazon.com" },
  "name": "美国站主账户", "externalId": "profile-123",
  "clientId": "****ABCD", "clientSecret": "", "refreshToken": "****WXYZ",
  "platformAccountId": null, "isActive": true,
  "settings": { "breakEvenAcos": 40, "negateClicks": null, "stopSpend": null },
  "createdAt": "2026-08-29T10:00:00.000Z" }
```

**错误**：仅认证/权限/分页校验。

### 4.2 POST `/api/v1/ads/accounts` — 创建账户（ads:admin）

**Body**（`withValidation({body})`）：

```typescript
const CreateAdAccountSchema = z.object({
  marketplaceId: z.string().min(1, 'marketplaceId 不能为空'),
  name: z.string().min(1).max(100, '账户名最长 100 字'),
  externalId: z.string().max(100).optional().nullable(),
  clientId: z.string().max(500).optional().nullable(),      // 非空即加密
  clientSecret: z.string().max(2000).optional().nullable(), // 非空即加密
  refreshToken: z.string().max(2000).optional().nullable(), // 非空即加密
  platformAccountId: z.string().max(100).optional().nullable(), // 订单域弱引用，不建 FK
  isActive: z.boolean().default(true),
  settings: z.object({
    breakEvenAcos: z.coerce.number().min(0).max(100).catch(40),            // D6 默认 40%
    negateClicks: z.coerce.number().int().min(0).nullable().catch(null),   // null=动态计算（AC-4）
    stopSpend: z.coerce.number().min(0).nullable().catch(null),            // null=动态计算（AC-4）
  }).default({}),
});
```

**逻辑**：
1. `prisma.adMarketplace.findUnique({ where: { marketplaceId: body.marketplaceId } })` → 无 → 404 `NOT_FOUND`（"站点不存在"）。
2. 凭据字段非空 → `encrypt()`（§9.1）；空串/undefined → null。
3. `prisma.adAccount.create` → 审计 `CREATE/AdAccount` → `createdResponse(账户脱敏对象)`。
4. 唯一冲突（platformCode='amazon' + marketplaceId）被 Prisma P2002 捕获 → 409 `CONFLICT`（"该站点已绑定广告账户"）。

**错误**：422/404/409 如上；`settings` 字段缺省时 `.default({})` + 内层 `.catch()` 保证容错。

### 4.3 PUT `/api/v1/ads/accounts/:id` — 更新账户（ads:admin）

**Body**：`UpdateAdAccountSchema = CreateAdAccountSchema.partial()`；params `{ id: z.string().min(1) }`。

**凭据更新语义**（架构 §4.3）：**缺省 = 保持不变；提供（非空） = 重新加密；不允许传空串覆盖**。实现：
```
const prev = await prisma.adAccount.findUnique({ where: { id }, });  // deletedAt=null 校验
if (!prev) → 404
data = 仅组装 body 出现的字段；
  凭据字段：body.clientId === undefined → 不动；=== null → 置 null；非空串 → encrypt()
```

**逻辑**：update → 审计 `UPDATE/AdAccount`（details 记变更前后字段，凭据只记 `{clientId: 'updated'}` 不记明文）→ `successResponse(脱敏对象)`。

### 4.4 DELETE `/api/v1/ads/accounts/:id` — 软删除账户（ads:admin）

**逻辑**：存在校验（deletedAt=null）→ **软删**：`update({ where: { id }, data: { deletedAt: new Date() } })`（保留报告/决策历史，R7；不触发 Cascade）→ 审计 `DELETE/AdAccount` → `successResponse({ id })`。
**错误**：404；已软删 → 404（幂等语义：重复删返回 404 或成功均可，设计取 404 明确提示）。

### 4.5 GET `/api/v1/ads/marketplaces` — 站点列表（ads:view）

**查询**：`PaginationSchema.extend({ active: z.enum(['true','false']).optional().transform(...) })`（同 §4.1）。
**逻辑**：`adMarketplace.findMany` + count；`orderBy: { code: 'asc' }`。
**响应** `listResponse`，项：`{ id, code, name, marketplaceId, currency, adEndpoint, isActive, createdAt }`。

### 4.6 POST `/api/v1/ads/marketplaces` + PUT/DELETE `/marketplaces/:id` — 站点 CRUD（ads:admin，3 子端点一组）

**Body**：

```typescript
const CreateMarketplaceSchema = z.object({
  code: z.string().regex(/^[A-Z]{2,3}$/, '站点代码如 US/CA/UK'),
  name: z.string().min(1).max(50),
  marketplaceId: z.string().min(1).max(50),
  currency: z.string().length(3).default('USD'),
  adEndpoint: z.string().min(1).max(200),
  isActive: z.boolean().default(true),
});
const UpdateMarketplaceSchema = CreateMarketplaceSchema.partial();
```

**逻辑**：
- POST：create → 审计 `CREATE/AdMarketplace` → `createdResponse`；`code` 或 `marketplaceId` 唯一冲突 → 409。
- PUT：存在校验 → update → 审计（变更字段）→ `successResponse`。
- DELETE：存在校验 → **硬删或软删？** 设计：`AdMarketplace` 无 deletedAt 列（架构 §2 未定义）→ 采用「isActive=false + 强约束」策略：**不允许物理删除被 AdAccount 引用的站点**（`adAccount.count({ where: { marketplaceId } }) > 0` → 409 `CONFLICT` "站点已被账户引用，请先停用账户"）；未被引用可物理删除 → 审计 → `successResponse`。业务上站点停用用 `isActive=false`（PUT），删除仅清理误建数据。

### 4.7 POST `/api/v1/ads/reports/upload` — 双报告上传（ads:edit，multipart，E1/E4/E9）

⚠️ **不用 withValidation**（FormData 非 JSON），按 `/api/upload` 手写范式 + 手动字段校验。

**请求**：`FormData`
```
accountId:      string 必填（须 isActive 账户）
startDate:      string 必填  YYYY-MM-DD
endDate:        string 必填  YYYY-MM-DD
uploadBatchId:  string 可选  前端生成 UUID（分次提交沿用同一 batchId 配对；缺省服务端 cuid 兼容）
searchFile:     File 可选  xlsx/csv ≤50MB
targetingFile:  File 可选  xlsx/csv ≤50MB   （至少一份，否则 422 NO_FILE）
```

**字段校验**（手写 Zod safeParse，失败 422）：
```typescript
const UploadMetaSchema = z.object({
  accountId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  uploadBatchId: z.string().uuid('uploadBatchId 须为 UUID').optional(),
}).refine(v => v.startDate <= v.endDate, { message: 'startDate 不能晚于 endDate' });
```

**文件校验**（对齐 /api/upload 魔数思路 + 需求 REQ-001-5/E9）：
- 大小 `> 50 * 1024 * 1024` → 400 `FILE_TOO_LARGE`（E9）；
- 扩展名 ∉ {xlsx, csv} → 400 `INVALID_TYPE`；
- MIME 白名单：xlsx = `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`、csv = `text/csv` 等；
- 魔数：xlsx 头部 `PK\x03\x04`（zip 头）；csv 按 UTF-8 可解码（剥 BOM 由引擎做，Node 只做可读性校验）→ 不符 400 `INVALID_MAGIC_BYTES`（E1）。

**处理流程（伪代码级）**：
```
1. 校验账户：adAccount.findUnique({ id, deletedAt: null })；isActive=false → 422 ACCOUNT_INACTIVE
2. batchId = 请求 uploadBatchId ?? cuid()
3. 文件写入私有目录 data/ads-reports/{accountId}/{uuid}.{ext}（mkdir recursive）
4. engine-client.runParse({ searchPath?, targetingPath?, startDate, endDate })   // §6.3
   → { ok, reports: { search: {columns,rowCount,summary,rawRows}, targeting: {...} },
       consistency: { spendDiffPct, ordersDiffPct, dateMismatch, warning } }
5. parse 失败（{ok:false, error:{errors[]}}）→ 删除已写文件 → 422 PARSE_FAILED
   （errors 指明哪个文件缺哪列/行数=0；附列名风险提示文案：不同站点模板列名可能不同，E1/R5）
6. 落库（单事务，§11.1）：
   - 对每份成功解析的报告 create AdReport {
       adAccountId, uploadBatchId: batchId, reportType: SEARCH_TERM|TARGETING,
       source: 'MANUAL_UPLOAD', startDate: new Date(startDate+'T00:00:00Z'), endDate: ...,
       originalName, fileName: <uuid.ext>, filePath, fileSize,
       summary, rawRows, rowCount, consistencyCheck: 一致性对象（两份都在时计算）,
       analyzeStatus: 'UPLOADED' }
   - dateMismatch=true → consistencyCheck.dateMismatch=true（warning 不阻断，REQ-001-2）
   - consistency.spendDiffPct>15 → consistencyCheck.warning=true（上传成功；analyze 时阻断 E4，REQ-001-6）
7. 审计 UPLOAD/AdReport（details: { batchId, files[], rowCounts, consistency 摘要 }）
8. createdResponse({ uploadBatchId, reports: [{ id, reportType, rowCount }, ...] })  // 201
```

**响应**（201）：
```json
{ "uploadBatchId": "<前端UUID或服务端cuid>",
  "reports": [ { "id": "cuid", "reportType": "TARGETING", "rowCount": 823 } ],
  "warnings": { "dateMismatch": false, "consistency": { "spendDiffPct": 8.2, "ordersDiffPct": 3.1, "warning": false } } }
```
（warnings 供前端 Toast/警示条，REQ-001-2/001-6。）

### 4.8 GET `/api/v1/ads/reports` — 报告历史（ads:view，REQ-008-1）

**查询**：
```typescript
const AdsReportsQuerySchema = PaginationSchema.extend({
  accountId: z.string().min(1).optional(),
  reportType: z.enum(['SEARCH_TERM', 'TARGETING']).optional(),
  source: z.enum(['MANUAL_UPLOAD', 'API']).optional(),
});
```

**逻辑**：where 组合 + **latestRecommendation 子查询**（每份报告关联的最新决策版本）：
```typescript
const reports = await prisma.adReport.findMany({
  where: { ...(accountId && { adAccountId: accountId }), ...(reportType && { reportType }),
           ...(source && { source }) },
  include: {
    adAccount: { select: { id: true, name: true } },
    recommendations: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, version: true, createdAt: true } },
  },
  orderBy: { createdAt: 'desc' }, skip, take,
});
```

**响应** `listResponse`，项（**不含 rawRows/summary 大字段**，R6 防超限）：
```json
{ "id": "cuid", "accountId": "...", "accountName": "美国站主账户",
  "reportType": "TARGETING", "source": "MANUAL_UPLOAD",
  "startDate": "2026-08-01T00:00:00.000Z", "endDate": "2026-08-30T00:00:00.000Z",
  "originalName": "targeting-report.csv", "rowCount": 823,
  "analyzeStatus": "ANALYZED", "analyzedAt": "...",
  "latestRecommendation": { "id": "cuid", "version": "v20", "createdAt": "..." },
  "createdAt": "..." }
```

### 4.9 POST `/api/v1/ads/reports/:id/analyze` — 触发 v20 引擎跑批（ads:edit，E2/E3/E4/E7/E8）

**Body**：`z.object({}).strict()`（**已裁剪 force 参数**，架构 O-1：E4 阻断后按需求字面重传）；params `{ id }`。

**逻辑（伪代码级，事务细节见 §11.2）**：
```
1. report = adReport.findUnique({ id, include: { adAccount: true } });  !report → 404
2. 配对（架构 P0-2/G-2）：
   a. 批内：adReport.findFirst({ where: { uploadBatchId: report.uploadBatchId,
        adAccountId: report.adAccountId, reportType: 互补类型, id: { not: report.id } } })
   b. 批内无 → 跨批回退：同账户 + 互补类型 + 日期窗口重叠 ≥ 50% + 唯一命中
      （窗口重叠天数 / min(两报告窗口天数) ≥ 0.5；多命中则不回退）
   c. pairing = { mode: 'batch'|'fallback', reportId } | { mode: 'none' }；仅前端提示用
3. E3：无 targeting 报告（回退后仍无）→ 允许分析，degraded=true（引擎缺省 --targeting 参数，§6.2）
4. E4：本报告或配对报告 consistencyCheck.warning → 422 CONSISTENCY_MISMATCH
   （details 返回两报告 spend/orders 差异：{ targetingSpend, searchSpend, spendDiffPct, ordersDiffPct }）
5. 并发守卫：report.analyzeStatus === 'ANALYZING' → 409 ANALYSIS_IN_PROGRESS
6. 状态 UPLOADED/ANALYZE_FAILED/ANALYZED → ANALYZING（update，非事务）
7. 参数：AdAccount.settings（breakEvenAcos/negateClicks/stopSpend）+ startDate/endDate → EngineOptions
   （null 值不传参 → 引擎动态计算，AC-4 禁硬编码）
8. engine-client.runAdsEngine({ searchPath: 主报告路径, targetingPath?: 配对报告路径, opts })（§6.3）
   超时 120s / 重试 1 次；失败 → report.update({ analyzeStatus: 'ANALYZE_FAILED',
   analyzeError: { exitCode, stderr, attempts, durationMs } }) + 审计（含失败详情）→ 502 ENGINE_FAILED
9. EngineResultSchema 校验（§6.4）：{ok:false} 或字段级失败 → 同 8 处理（E7：details 含 version 与失败字段）
10. 事务落库（§11.2）：
   - AdCampaign upsert（键 (adAccountId, externalId)，来自决策行 campaignId 列）
   - AdRecommendation.create({ adReportId: targetingId ?? report.id, adAccountId, version: result.version,
       result: 全量契约（含 degraded）, params })
   - AdKeyword 决策行写入（冲突消解 + 匹配键 §5.3）
11. report.update({ analyzeStatus: 'ANALYZED', analyzedAt: new Date() })
12. 审计 ANALYZE/AdReport（参数/degraded/pairing/attempts/耗时）→ successResponse({
      recommendationId, degraded, pairing })   // 200
```

**响应**：
```json
{ "recommendationId": "cuid", "degraded": false,
  "pairing": { "mode": "batch", "reportId": "cuid" } }
```

### 4.10 GET `/api/v1/ads/reports/:id/result` — 最新决策结果（ads:view，REQ-003）

**查询**：`{ page, limit }`（closeMatrix/negateList 服务端内存分页，R6 防 MB 级响应；limit 默认 50，max 200）。

**逻辑**：
```
1. recommendation = adRecommendation.findFirst({ where: { adReportId: id, 关联报告 analyzeStatus: 'ANALYZED' },
     orderBy: { createdAt: 'desc' } })   // 批内最新
   !recommendation → 404 NOT_FOUND（"该报告尚未分析或分析失败"）
2. r = recommendation.result  // Json 原样读，数字零换算（R4/AC-1）
3. 分页：closeMatrix/negateList items = 内存切片 skip/take；pagination 计算 total/totalPages
```

**响应** `successResponse`：
```json
{ "recommendation": { "id": "cuid", "version": "v20", "createdAt": "...", "params": { "breakEvenAcos": 40 } },
  "account": { "spend": 0, "sales": 0, "orders": 0, "clicks": 0, "acos": 0, "cvr": 0, "aov": 0 },
  "families": [ { "family": "臀·紧致", "spend": 0, "orders": 0, "acos": 0, "verdict": "收缩", "members": [] } ],
  "expandTable": [ { "family": "...", "verdict": "★开 BROAD", "incremental": [] } ],
  "layerCheck": { "ladderWarnings": [], "coefficientAudit": [], "bidUnavailable": false },
  "summary": { "closeCount": 0, "closeSpendPct": 0, "projectedAcos": 0, "needsBidAdjust": false, "needsListingFix": false },
  "closeMatrix": { "items": [ { "keywordText": "...", "rowIndex": 12, ... } ], "pagination": { "page": 1, "limit": 50, "total": 823, "totalPages": 17 } },
  "negateList": { "items": [ { "term": "...", "reason": "...", "rowIndex": 3 } ], "pagination": { ... } },
  "degraded": false, "pairing": { "mode": "batch" } }
```

**数据源边界（架构 P0-7/AD-8）**：本接口只做**数字透传**（账户/族/摘要/层级 + closeMatrix/negateList 快照）；**执行清单各表的展示与勾选一律以 GET /keywords 为唯一数据源**。closeMatrix 行带 `rowIndex`（→ AdReport.rawRows 下标，AC-10 下钻）。

### 4.11 GET `/api/v1/ads/reports/:id/file` — 原始报告归档下载（ads:view，REQ-008-1）

**逻辑**：
```
1. report = findUnique(id) → 404；filePath 为空 → 404（"文件已不存在"）
2. fs.access(filePath) → 404（归档文件丢失，提示联系管理员）
3. 返回 new NextResponse(stream)：
   Content-Type: xlsx → application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
                 csv  → text/csv; charset=utf-8
   Content-Disposition: attachment; filename*=UTF-8''<encodeURIComponent(originalName)>
   （防路径穿越：只读 DB 中 filePath，不接受用户输入路径）
```
无鉴权静态 URL（§12.2）。

### 4.12 DELETE `/api/v1/ads/reports/:id` — 删除报告及其决策（ads:admin，R7/§9.2）

**逻辑**：
```
1. report = findUnique(id, { include: { recommendations: { select: { id: true } } } }) → 404
2. 事务：adReport.delete({ id })  // Cascade 自动删除 AdRecommendation → AdKeyword（架构 §2.1）
3. 事务后（best-effort）：fs.unlink(filePath)（文件删失败仅记 warn，不影响响应）
4. 审计 DELETE/AdReport（details: { reportType, rowCount, recommendationIds, fileName }）
5. successResponse({ id })
```
⚠️ 注意：删除报告后，若其 AdKeyword 行曾被其他 recommendation 引用——不会发生，AdKeyword.recommendationId 归属本报告链，Cascade 语义安全。

### 4.13 GET `/api/v1/ads/keywords` — 决策行列表（ads:view，REQ-003/004，**执行清单唯一数据源**）

**查询**：
```typescript
const AdsKeywordsQuerySchema = z.object({
  recommendationId: z.string().min(1, 'recommendationId 必填'),   // 必填，缺失 422
  accountId: z.string().min(1).optional(),
  familyL1: z.string().max(100).optional(),
  action: z.enum(['PAUSE', 'RAISE_BID', 'LOWER_BID', 'NEGATE', 'KEEP', 'EXPAND', 'HARVEST']).optional(),
  matchType: z.string().max(50).optional(),
  source: z.enum(['CLOSE_MATRIX', 'LAYER_CHECK', 'EXPAND', 'NEGATE']).optional(),
  isSelected: z.enum(['true', 'false']).optional()
    .transform(v => v === undefined ? undefined : v === 'true'),   // ⚠️ 同 §4.1 陷阱规避
  search: z.string().max(100).optional(),                          // keywordText contains（不区分大小写）
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
```
⚠️ **不复用 PaginationSchema 的 sortBy/sortOrder 默认值**（决策行按 `[{ source: 'asc' }, { rawRowIndex: 'asc', nulls: 'last' }]` 排序，保持引擎行序、NEGATE 等 null 行沉底）。

**逻辑**：where 组合 + `OR: [{ keywordText: { contains: search, mode: 'insensitive' } }]`；count 同 where。

**响应** `listResponse`，行 = AdKeyword 全字段 + 派生标记：
```json
{ "id": "cuid", "adAccountId": "...", "campaignId": "cuid(内部FK)", "amazonCampaignId": "123456789",
  "adGroupId": "987654", "externalId": "kw-abc",
  "keywordText": "breast enhancement cream", "matchType": "EXACT", "state": "ENABLED", "bid": 1.2,
  "familyL1": "胸·合规丰盈", "duplicateOf": null,
  "action": "PAUSE", "actionBid": null, "actionReason": "双标准达标：0单，点击34≥否定阈值34，花费$23.76≥$23.76",
  "rawRowIndex": 12, "source": "CLOSE_MATRIX",
  "acos": null, "orders": 0, "spend": 23.76, "clicks": 34, "impressions": 120, "ctr": 0.28,
  "reportId": "cuid",
  "isSelected": false, "overrideAction": null, "overrideBid": null, "overriddenBy": null, "overriddenAt": null,
  "recommendationId": "cuid",
  "isManualOverride": false,      // 派生：overriddenAt != null（前端标「手工修改」）
  "reasonPending": false,          // 派生：actionReason === "待补充"（前端标黄，架构 P0-3）
  "createdAt": "...", "updatedAt": "..." }
```

### 4.14 PUT `/api/v1/ads/keywords/:id` — 勾选 / 手工覆写（ads:edit，REQ-004，**非 admin**）

**Body**：
```typescript
const UpdateKeywordSchema = z.object({
  isSelected: z.boolean().optional(),
  action: z.enum(['PAUSE', 'RAISE_BID', 'LOWER_BID', 'NEGATE', 'KEEP', 'EXPAND', 'HARVEST']).optional(),
  actionBid: z.coerce.number().min(0.2).max(999).optional().nullable(),   // 下限 $0.20（§4.7 铁律五）
  actionReason: z.string().min(1, '依据文字不能为空').max(1000).optional(),
}).refine(v => v.isSelected !== undefined || v.action !== undefined
           || v.actionBid !== undefined || v.actionReason !== undefined,
           { message: '至少提交一个可更新字段' });
```

**更新语义（关键区分，架构 §4.8）**：
| 提交内容 | 落库 | 覆写标记 |
|----------|------|----------|
| 仅 `isSelected` | 只更新 isSelected | **不置**（勾选不是覆写） |
| `action` 或 `actionBid` | 更新对应字段 | 置 `overrideAction/overrideBid`（若传 null 则清空对应覆写）+ `overriddenBy/overriddenAt` |
| `actionReason`（补填"待补充"依据） | 更新 actionReason | 置 `overriddenAt/overriddenBy`（人工修订依据也算手工修改，R7 留痕） |

**逻辑**：行存在校验（404）→ 组 data → update → 审计 `UPDATE/AdKeyword`（details 记前后 `{isSelected, action, actionBid}` 对比，R7）→ `successResponse(更新后行)`。

### 4.15 POST `/api/v1/ads/bulk-table` — 校验并生成批量表（ads:edit，E5/E6）

**Body**：
```typescript
const GenerateBulkTableSchema = z.object({
  recommendationId: z.string().min(1),
  confirmEmpty: z.boolean().default(false),   // E6：执行清单为空时的确认标志
});
```

**逻辑**：
```
1. recommendation = findUnique({ id }) → 404；其 AdKeyword isSelected=true 行（**唯一数据源**，架构 P0-7）：
   prisma.adKeyword.findMany({ where: { recommendationId, isSelected: true },
     orderBy: [{ source: 'asc' }, { rawRowIndex: 'asc' }] })
2. E6：行数=0 且 !confirmEmpty → 422 NO_ACTIONS（"执行清单为空，确认生成空表？"）
3. 组装 3 类操作行（§7.3；Campaign ID 列取 amazonCampaignId——架构 P0-5 严禁内部 cuid）
4. runBulkSelfCheck(rows)（§7.4）：任一非 0 → 422 BULK_SELF_CHECK_FAILED（errors 列缺 ID 行明细，E5）
5. 审计 EXPORT/AdRecommendation（stats + 自检结果 + 行数）
6. successResponse({ xlsxUrl: "/api/v1/ads/bulk-table/{recommendationId}/download?type=xlsx",
     readmeUrl: "/api/v1/ads/bulk-table/{recommendationId}/download?type=readme",
     stats: { close: n, bidChange: n, negate: n, create: n } })
```
**不落盘**（确定性生成，GET download 每次重新生成，无状态；架构 §4.9）。

### 4.16 GET `/api/v1/ads/bulk-table/:recommendationId/download` — 下载 xlsx / 使用说明（ads:edit）

**查询**：`{ type: z.enum(['xlsx', 'readme']).default('xlsx') }`；params `{ recommendationId }`。

**逻辑**：
```
1. 重取 recommendation + isSelected 行 → 重新组装 + 重新自检（确定性：同输入同输出）
   ⚠️ 自检失败同样 422 BULK_SELF_CHECK_FAILED（不静默输出坏表）
2. type=xlsx → buildBulkWorkbook(rows) 内存生成 → buffer → 流式返回：
   Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   Content-Disposition: attachment; filename="sp-ads-bulk-<recommendationId>.xlsx"
3. type=readme → buildReadmeText(...) → text/plain; charset=utf-8 → 返回使用说明（§7.5）
4. 每次下载记审计 EXPORT（含 stats）
```

### 4.17 GET `/api/v1/ads/recommendations` + `/compare` — 决策历史/对比（ads:view，P1，可后置）

**查询**：`{ accountId?: string, page, limit }`（PaginationSchema）。
**compare**：`{ a: z.string().min(1), b: z.string().min(1) }` 两次决策对比：
```
服务端对比（防前端二次聚合，R4）：
- 账户指标差异：account.spend/sales/acos 差值
- 处置差异：同一 (keywordText, matchType) 在 a/b 的 action 变化；
- 族差异：families 出现/消失集合 diff
```
响应 `successResponse({ accountDiff, actionChanges: [...], familyAdded: [...], familyRemoved: [...] })`。

---

## 五、Prisma 查询与写入设计

### 5.1 五表 CRUD 汇总（表结构以架构 §2 为准，此处只补查询/写入语义）

| 表 | 主要读取路径 | 写入路径 | 删除路径 |
|----|-------------|----------|----------|
| AdMarketplace | 列表（code asc）、by marketplaceId | CRUD（§4.6） | 被引用禁止物理删（409） |
| AdAccount | 列表（deletedAt=null + active/search）、by id（含 marketplace） | create/update（凭据加密 §9） | **软删** deletedAt（R7） |
| AdCampaign | by (adAccountId, externalId) upsert 探测 | analyze 事务内 upsert（§5.3） | Cascade（删账户时）；AdKeyword.campaignId SetNull |
| AdKeyword | **主查询**：列表筛选（§4.13）+ isSelected=true 批量表取数（索引 `[recommendationId, isSelected]`）+ by id | analyze 决策行批量写入（§5.3）+ PUT 勾选/覆写（§4.14） | Cascade（删 recommendation/account 时） |
| AdReport | 历史列表（§4.8）+ by id + 配对查询（uploadBatchId/窗口重叠） | upload 创建（§4.7）+ analyze 状态机更新 | **硬删**（admin，Cascade 决策，§4.12） |
| AdRecommendation | by adReportId 最新（createdAt desc take 1）+ 历史列表 | analyze 事务内 create | Cascade（删报告时） |

### 5.2 列表筛选语义（账户/族/动作/分页）

- **账户**：`accountId` 精确匹配（外键）；账户列表另有 `search`（name/externalId contains）+ `active`。
- **族**：`familyL1` 精确匹配（引擎产出的 L1 族名可能含中文/特殊字符，contains 有歧义，取精确）。
- **动作**：`action` enum 精确；`source` 分区精确（CLOSE_MATRIX/LAYER_CHECK/EXPAND/NEGATE）；`isSelected` 布尔。
- **分页**：`page/limit` + `total/totalPages`；决策行排序 `[{source asc}, {rawRowIndex asc nulls last}]` 保持引擎行序；历史列表按 `createdAt desc`。
- **性能**：所有筛选项均有索引支撑（架构 §2 已含 `[adAccountId, familyL1]`、`[recommendationId, isSelected]`、`[adAccountId, reportType]` 等）；`search` contains 仅在 keywordText 上，行数受 recommendationId 约束（万行级），可接受。

### 5.3 决策行落库：冲突消解 + upsert（匹配键 `recommendationId + externalId + rawRowIndex`）

**背景**：一次 analyze 产出 4 类决策行（closeMatrix 全量 / layerCheck 警告 / expandTable 增量 / negateList），同一投放词可能多来源出现（I-7：如「已关仍建议改价」矛盾）。DB 唯一约束为 `(recommendationId, externalId)`（架构 §2），`rawRowIndex` 参与**内存合并键**而非 DB 唯一键——`(recommendationId, externalId, rawRowIndex)` 三键合并语义实现如下：

```
输入：引擎决策行集合 D（每行带 source/rawRowIndex/externalId/keywordText/campaignId/adGroupId/...）

步骤 1 归一化：
  - 每行补充 recommendationId（新建）、reportId（主报告）、adAccountId
  - amazonCampaignId = 行内 campaignId 列原文（不查 AdCampaign 表，P0-5）
  - actionReason 为空/缺失 → 写兜底值 "待补充"（P0-3，落库强校验非空；计 warning）

步骤 2 内存合并（匹配键 = recommendationId + externalId + rawRowIndex）：
  - 组键：externalId 非空 → (recommendationId, externalId, rawRowIndex ?? -1)
          externalId 为空（NEGATE/EXPAND 行）→ (recommendationId, campaignId ?? '', keywordText, matchType, source)
            // NEGATE/EXPAND 无 keywordId，业务键 = 活动 + 词 + 匹配 + 来源；Postgres 唯一索引多 NULL 不冲突，可多条共存
  - 同组冲突消解按来源优先级：CLOSE_MATRIX > LAYER_CHECK > EXPAND > NEGATE
    高优先级行覆盖低优先级行的 action/actionBid/actionReason（关闭优先于改价，杜绝矛盾行，I-7）
    （注：来源优先级是"同键冲突时保留谁"，NEGATE 因业务键不同天然独立成行，不参与覆盖）

步骤 3 写入（事务内，§11.2）：
  - 现有行探测：findMany({ where: { recommendationId } , select: { id, externalId, rawRowIndex, keywordText, matchType, source } })
  - 新增：createMany（无冲突行批量插入，千行级性能）
  - 已存在（重跑同 recommendation 的幂等场景）：按 id updateMany 覆盖（等价于逐行 upsert）
  - 该探测+合并逻辑保证：同 recommendationId 重跑 analyze（异常恢复重试）不会产生重复行
```

**AdCampaign upsert**（同一事务）：`prisma.adCampaign.upsert({ where: { adAccountId_externalId: { adAccountId, externalId } }, create: {...}, update: {} })`，externalId = 决策行 campaignId 列；name 缺失时用 `"campaign-<externalId>"` 占位。

**NEGATE 行细节**：state='ENABLED'、action='NEGATE'、bid=null、externalId=null、rawRowIndex=搜索词行下标；**否定对象是搜索词**，匹配键不含 keywordText 之外的投放词字段。
**EXPAND 行细节**：新建精准候选，externalId=null，活动/广告组上下文取所属族主词（引擎契约提供，适配层搬运）。

### 5.4 报告状态机

```
                 ┌──────────────┐
   create ──────▶│  UPLOADED    │──────────┐
                 └──────┬───────┘          │ analyze（E8 重跑，任何终态均可）
                        │ analyze          ▼
                 ┌──────▼───────┐      ┌─────────┐
   analyze 失败 ─┤  ANALYZING   │─────▶│ ANALYZED│（analyzedAt=now）
                 └──────┬───────┘      └─────────┘
                        │ 失败/超时/契约失败
                 ┌──────▼───────────┐
                 │  ANALYZE_FAILED   │（analyzeError 记录 exitCode/stderr/attempts/durationMs；可重试）
                 └──────────────────┘
```

| 转移 | 触发 | 守卫 |
|------|------|------|
| UPLOADED → ANALYZING | POST analyze | 无（首次） |
| ANALYZE_FAILED → ANALYZING | POST analyze 重试 | E2 后允许 |
| ANALYZED → ANALYZING | POST analyze 重跑（E8） | 允许，生成新 AdRecommendation 版本，旧版保留 |
| → ANALYZED | 引擎成功 + 契约校验通过 + 事务落库完成 | 状态更新在事务后单独执行 |
| → ANALYZE_FAILED | 引擎/契约失败 | analyzeError 全量落库 |

**并发守卫**：analyze 入口检查 `analyzeStatus === 'ANALYZING'` → 409 `ANALYSIS_IN_PROGRESS`（避免同报告双跑）。全局引擎并发由 engine-client 信号量（并发 2 + 排队）控制（§9.1 非功能）。

### 5.5 勾选/覆写更新语义

- `isSelected` 独立更新：**不触碰覆写字段**（架构 P0-7：勾选状态与引擎建议分离）。
- 批量表取值：`overrideBid ?? actionBid`、`overrideAction ?? action`（REQ-004-2：覆写优先）。
- `overriddenAt != null` ⇒ 前端标注「手工修改」；`actionReason === "待补充"` ⇒ 前端标黄（P0-3）。

---

## 六、Python 引擎集成

### 6.1 目录结构（services/amazon-ads-engine/，架构 §5.1）

```
services/amazon-ads-engine/
├─ analyze_cli.py        # 新增：适配层（parse/analyze 两模式 + 契约映射 + degraded + JSON 输出）★唯一新增代码
├─ report_analyzer.py    # 复制自 ~/clawd/amazon-ads-optimizer/modules/report_analyzer.py（557 行，原样零改动；
│                        #   同步 main.py 的 sys.path 处理 Path(__file__).parent）
├─ modules/decisions.py  # analyze 路径依赖时复制（保持 v20 内部 import 结构）
├─ VERSION               # 内容 "v20"（→ AdRecommendation.version，E7）
└─ README.md             # 复制来源 commit + 升级步骤（R8）
```

引擎只依赖 Python 标准库（zipfile/xml.etree/re/collections/dataclasses），**无 pip 依赖**。复制后立即 `python3 analyze_cli.py analyze --help` 冒烟。

### 6.2 analyze_cli.py 接口契约（BE 侧视角）

```
用法：
  analyze_cli.py parse    --search <f> [--targeting <f>] --out <json>
                          [--start-date <YYYY-MM-DD>] [--end-date <YYYY-MM-DD>]      # dateMismatch 比对（P0-4）
  analyze_cli.py analyze  --search <f> [--targeting <f>] --out <json>               # --targeting 可选 = degraded（P0-1/E3）
                          [--break-even-acos 40] [--negate-clicks 34] [--stop-spend 23.76]   # 白名单数值（D6 透传）
                          [--start-date <YYYY-MM-DD>] [--end-date <YYYY-MM-DD>]
退出码：0=成功（--out 已写）；1=业务失败（--out 写 {ok:false, error}）；2=参数错误；124=超时（Node 侧 kill）
```

**search-only degraded 模式**（`--targeting` 缺省）：输出契约顶层 `"degraded": true`；`closeMatrix: []`、`layerCheck.bidUnavailable = true`、`summary.needsBidAdjust = false`、summary 附 `bidPendingList`（无 bid/状态待核对清单）；仅产出 negateList/expandTable/account/summary（口径铁律 2/3：禁止用 CPC 冒充 bid）。

**analyze 输出契约（固定 UTF-8）**：
```json
{
  "ok": true, "degraded": false,
  "account": { "spend": 0, "sales": 0, "orders": 0, "clicks": 0, "acos": 0, "cvr": 0, "aov": 0 },
  "families": [ { "family": "", "spend": 0, "orders": 0, "acos": 0, "verdict": "", "members": [] } ],
  "closeMatrix": [ { "keywordText": "", "matchType": "", "clicks": 0, "spend": 0, "ctr": 0, "cpa": 0,
                     "bid": 0, "state": "", "basis": "", "action": "", "rowIndex": 0 } ],
  "negateList": [ { "term": "", "reason": "", "rowIndex": 0 } ],
  "expandTable": [ { "family": "", "verdict": "", "incremental": [] } ],
  "layerCheck": { "ladderWarnings": [], "coefficientAudit": [ { "family": "", "match": "", "bid": 0, "exactBid": 0, "ratio": 0 } ],
                  "bidUnavailable": false },
  "summary": { "closeCount": 0, "closeSpendPct": 0, "projectedAcos": 0, "needsBidAdjust": false, "needsListingFix": false },
  "version": "v20"
}
```

**契约映射规则（适配层职责，纯改名/字段搬运，零判定逻辑）**：`account←R['account']`；`families←R['families']`（verdict 按固定映射表从既有字段组装，缺中间字段输出 `''`，不自行推导，I-8）；`closeMatrix←R['combos']`（补 ctr/cpa/bid/state/basis/action + `rowIndex`=parse 后 Targeting rawRows 下标，行序稳定，P0-6）；`negateList←R['neg_list']`（rowIndex=搜索词 rawRows 下标）；`expandTable←R['expansion_space']`；`layerCheck←{ladderWarnings: R['bid_ladder_warnings'], coefficientAudit: 组装}`；`summary←R['stop_spend'/'negate_clicks'/'break_even_acos'] + 预演字段`；`version←VERSION 文件`；`degraded←(targeting 缺失)`；`actionReason` 缺依据 → `"待补充"`。

**parse 输出契约**：`{ ok, reports: { search: {columns, rowCount, summary, rawRows}, targeting: {...} }, consistency: {spendDiffPct, ordersDiffPct, dateMismatch, warning} }`；rawRows 行 = 归一化列名（投放=targeting、匹配类型=matchType、客户搜索词=customerSearchTerm、花费=spend、7天总销售额=attributedSales7d、7天总订单数=attributedUnitsOrdered7d、目标竞价=bid、投放状态=state、Campaign ID=campaignId、Ad Group ID=adGroupId、关键词/商品定向 ID=externalId，REQ-001-3）；**保持文件原始行序**（rowIndex 精确下钻，P0-6）；dateMismatch = 用户传日期窗口 vs 报告内数据窗口（min/max 日期列）比对，未传日期跳过。

### 6.3 Node 侧封装 `src/lib/ads/engine-client.ts`

```typescript
export interface EngineOptions {
  breakEvenAcos?: number;   // 白名单数值参数，仅此 3 个可透传（I-9）
  negateClicks?: number;
  stopSpend?: number;
  startDate?: string;       // 白名单日期参数 YYYY-MM-DD（dateMismatch / 配对回退）
  endDate?: string;
}
export interface EngineErrorPayload { exitCode: number | null; stderr: string; attempts: number; timedOut: boolean; durationMs: number; }
export class EngineError extends Error { exitCode; stderr; attempts; timedOut; }

export async function runParse(input: { searchPath?: string; targetingPath?: string; startDate?: string; endDate?: string }): Promise<ParseResult>;
export async function runAdsEngine(input: { searchPath: string; targetingPath?: string; opts: EngineOptions }): Promise<EngineResult>; // targetingPath 可选 = degraded
export async function runEngineCli(args: string[], opts: EngineOptions): Promise<{ exitCode: number; stdout: string; stderr: string; outJson?: unknown }>;
```

**实现要点**：
1. **execFile 数组参数，无 shell**：`execFile('python3', [ENGINE_DIR + '/analyze_cli.py', mode, '--search', searchPath, ...(targetingPath ? ['--targeting', targetingPath] : []), '--out', tmpJson, ...白名单参数], { timeout: 120_000, cwd: ENGINE_DIR, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 10 * 1024 * 1024 })`——天然防注入（§9.3）。
2. **白名单双保险**（发起进程前校验，不合法直接 422 不执行）：
   - `--break-even-acos/--negate-clicks/--stop-spend`：`/^\d+(\.\d+)?$/` + 范围（acos 0–100、clicks 0–100000、stopSpend 0–100000）；
   - `--start-date/--end-date`：`/^\d{4}-\d{2}-\d{2}$/` + 真实日历日（Date 构造回读校验）；
   - **文件路径全部系统生成**（data/ads-reports/ 下 uuid），绝不接受用户输入路径拼接。
3. **超时 120s + 重试 1 次**：超时 → `child.kill('SIGKILL')` → 记 ETIMEDOUT → 清理 tmp → **同一命令重试 1 次** → 仍失败抛 `EngineError{exitCode, stderr, attempts: 2, timedOut}`（E2）。
4. **tmp 文件**：`data/ads-engine/tmp-<uuid>.json`，读后删除（finally 中 best-effort unlink）；重试前清理前一次 tmp。
5. **并发闸门**：进程内信号量（并发 2 + Promise 队列，§9.1）。
6. **日志**：每次调用记 `{ mode, args(白名单可见), durationMs, exitCode, stderrTail(≤4KB) }` 到 console + analyze 时随审计落库（E2 可观测）。
7. **退出码语义**：0 → 读 tmp 校验；1 → 读 tmp 的 `{ok:false, error}` → EngineError（details 含 error）；2 → 参数错误（视为引擎侧 bug，EngineError）；124 → 超时。

### 6.4 引擎输出 JSON 校验 `src/lib/ads/engine-schema.ts`（E7 契约防漂移）

```typescript
import { z } from 'zod';

const AccountSchema = z.object({
  spend: z.coerce.number().catch(0), sales: z.coerce.number().catch(0), orders: z.coerce.number().catch(0),
  clicks: z.coerce.number().catch(0), acos: z.coerce.number().nullable().catch(null),
  cvr: z.coerce.number().nullable().catch(null), aov: z.coerce.number().nullable().catch(null),
});

const CloseMatrixRowSchema = z.object({
  keywordText: z.string().catch(''), matchType: z.string().catch(''),
  clicks: z.coerce.number().catch(0), spend: z.coerce.number().catch(0),
  ctr: z.coerce.number().nullable().catch(null), cpa: z.coerce.number().nullable().catch(null),
  bid: z.coerce.number().nullable().catch(null), state: z.string().catch(''),
  basis: z.string().catch(''), action: z.string().catch(''),
  rowIndex: z.coerce.number().nullable().catch(null),   // P0-6：degraded 模式为 null 合法
});

const NegateRowSchema = z.object({ term: z.string().catch(''), reason: z.string().catch(''),
  rowIndex: z.coerce.number().nullable().catch(null) });

const LayerCheckSchema = z.object({
  ladderWarnings: z.array(z.unknown()).catch([]),
  coefficientAudit: z.array(z.object({ family: z.string().catch(''), match: z.string().catch(''),
    bid: z.coerce.number().nullable().catch(null), exactBid: z.coerce.number().nullable().catch(null),
    ratio: z.coerce.number().nullable().catch(null) })).catch([]),
  bidUnavailable: z.boolean().catch(false),
});

const SummarySchema = z.object({
  closeCount: z.coerce.number().catch(0), closeSpendPct: z.coerce.number().catch(0),
  projectedAcos: z.coerce.number().nullable().catch(null),
  needsBidAdjust: z.boolean().catch(false), needsListingFix: z.boolean().catch(false),
  bidPendingList: z.array(z.unknown()).catch([]),   // degraded 特有，catch 容错
});

export const EngineResultSchema = z.object({
  ok: z.literal(true),
  degraded: z.boolean().catch(false),               // P0-1：search-only 标记
  account: AccountSchema.catch({ spend: 0, sales: 0, orders: 0, clicks: 0, acos: null, cvr: null, aov: null }),
  families: z.array(z.object({ family: z.string().catch(''), spend: z.coerce.number().catch(0),
    orders: z.coerce.number().catch(0), acos: z.coerce.number().nullable().catch(null),
    verdict: z.string().catch(''), members: z.array(z.unknown()).catch([]) })).catch([]),
  closeMatrix: z.array(CloseMatrixRowSchema).catch([]),
  negateList: z.array(NegateRowSchema).catch([]),
  expandTable: z.array(z.object({ family: z.string().catch(''), verdict: z.string().catch(''),
    incremental: z.array(z.unknown()).catch([]) })).catch([]),
  layerCheck: LayerCheckSchema.catch({ ladderWarnings: [], coefficientAudit: [], bidUnavailable: false }),
  summary: SummarySchema.catch({}),
  version: z.string().catch('unknown'),
});
```

**degraded 形态合法性判定**：`degraded=true` 时 `closeMatrix=[]` 且 `layerCheck.bidUnavailable=true` 为**合法输出**（不按缺行判失败）；`ok:false`（顶层 literal 校验即失败）或字段级 parse 抛错 → 按 E2/E7 处理（ANALYZE_FAILED + analyzeError 含 version 与失败字段，提示"引擎版本与契约不符"）。

---

## 七、批量表生成（bulk-table.ts）

### 7.1 步骤 0（前置依赖）

**`exceljs` 未安装**（package.json 已核实仅有 xlsx/papaparse）→ 开发第 1 步：

```bash
npm i exceljs        # 使用项目现有 .npmrc 镜像配置
```

### 7.2 33 列基线列头（v18.1 已验证，来自 amazon-ads-optimization 技能固化）

**完整 33 列清单（Sheet 名固定 `Sponsored Products Campaigns`，Product 列固定 `Sponsored Products`）**：

| # | 列名 | # | 列名 |
|---|------|---|------|
| 1 | Product | 18 | Daily Budget |
| 2 | Entity | 19 | SKU |
| 3 | Operation | 20 | ASIN |
| 4 | Campaign ID | 21 | Eligibility Status (Informational only) |
| 5 | Ad Group ID | 22 | Reason for Ineligibility (Informational only) |
| 6 | Portfolio ID | 23 | Ad Group Default Bid |
| 7 | Ad ID | 24 | Bid |
| 8 | Keyword ID | 25 | Keyword Text |
| 9 | Product Targeting ID | 26 | Native Language Keyword |
| 10 | Campaign Name | 27 | Native Language Locale |
| 11 | Ad Group Name | 28 | Match Type |
| 12 | Start Date | 29 | Bidding Strategy |
| 13 | End Date | 30 | Placement |
| 14 | Targeting Type | 31 | Percentage |
| 15 | State | 32 | Product Targeting Expression |
| 16 | Campaign State (Informational only) | 33 | Resolved Product Targeting Expression (Informational only) |
| 17 | Ad Group State (Informational only) | | |

**11 个业务关键列**（bulk-table.ts 组装与自检只涉及）：Product / Entity / Operation / Campaign ID / Ad Group ID / Keyword ID / Product Targeting ID / Keyword Text / Match Type / State / Bid。

**R3 用户模板核对**：`buildBulkWorkbook` 内置上述基线列头数组；生成时**与用户上传的模板列头 diff**（用户模板由 UI 提供上传位，M1 可选），不一致 → 返回 `headerMismatch: string[]`（不阻断生成，但写入使用说明并 UI 提示：中文列名/列序不同按用户模板重排后再交付，REQ-005-5/R3）。

### 7.3 三类操作行生成规则（REQ-ADS-005-2/3，v18.1 已验证）

**三件套取值（架构 P0-5）**：Campaign ID 列 = `AdKeyword.amazonCampaignId`（**严禁内部 cuid campaignId**）；Ad Group ID 列 = `adGroupId`；Keyword/Product Targeting ID 列 = `externalId`。全部来自 AdKeyword 行本身，无需 join。

| 操作 | Product | Entity | Operation | 关键列 | 来源 |
|------|---------|--------|-----------|--------|------|
| 关闭 | Sponsored Products | 按 005-3：matchType ∈ {EXACT/PHRASE/BROAD} → Keyword；∈ {TARGETING_EXPRESSION, TARGETING_EXPRESSION_PREDEFINED} → Product Targeting | Update | 三件套 + State=paused（**禁止同时填 Bid**） | action=PAUSE |
| 改价 | Sponsored Products | 同上 | Update | 三件套 + State=enabled + Bid=层级约束后的最终值（两位小数，`overrideBid ?? actionBid`） | action ∈ {RAISE_BID, LOWER_BID} |
| 否定 | Sponsored Products | Campaign Negative Keyword | Create | Campaign ID + Keyword Text + Match Type=negativeExact + State=enabled | action=NEGATE（externalId=null） |

补充规则：
- **Match Type 列**：Keyword 行小写 `exact/phrase/broad`；Product Targeting 行填原值（TARGETING_EXPRESSION 等）。
- **合规风险词（§4.5）输出两行**：关闭（paused）+ 活动级否定（negativeExact）。
- **动作/数值覆写优先**：`overrideAction ?? action`、`overrideBid ?? actionBid`（REQ-004-2）。
- 行类型 stats：close / bidChange / negate / create（风险词双行计 negate+close 各 1）。

### 7.4 生成前自检（4 项必须全为 0，REQ-005-4，E5）

```typescript
interface BulkSelfCheckResult { ok: boolean; errors: { check: number; description: string; rowIndexes: number[] }[]; }

function runBulkSelfCheck(rows: BulkRow[]): BulkSelfCheckResult {
  // 1. Update 行缺 Campaign ID（amazonCampaignId 为空）或 Ad Group ID 的行数 = 0
  // 2. Entity=Keyword 缺 Keyword ID（externalId）的行数 = 0
  // 3. State 值非 paused/enabled 的行数 = 0
  // 4. State=paused 与 Bid 并存的行数 = 0
  // 任一非 0 → ok=false + errors 列具体行（rowIndexes），422 BULK_SELF_CHECK_FAILED
}
```

### 7.5 输出与使用说明

- `buildBulkWorkbook(rows): Promise<ExcelJS.Workbook>`——exceljs **内存生成不落盘**；`worksheet.name = 'Sponsored Products Campaigns'`；行 1 = 33 列头；三类行按类型分组连续排列；改价行 Bid 数字格式 2 位小数。生成 ≤10s（200 行内）。
- `buildReadmeText(recommendation, stats): string` 生成 `批量表使用说明.txt`，内容五段（REQ-005-5/6 + R3）：
  1. **备份**：先下载后台现有「批量操作」表格作回滚备份；
  2. **核对列名**：中文列名或列序与模板不同 → 按用户模板重排后再交付（基线 33 列 vs 用户模板 diff 结果附上）；
  3. **上传步骤与预期效果**：后台「批量操作」上传，等待处理完成；
  4. **回滚方法**：备份表原样上传覆盖；
  5. **风险提示**：中文投放词加否定可能被拒（美国站单行失败不影响整表，上传后下载「处理结果」核对成功行数）。
- 下载端点见 §4.16（确定性重新生成 + 每次重新自检 + 审计）。

---

## 八、权限实现

### 8.1 权限点定义（REQ-ADS §5.1）

| 权限点 | displayName | description | 授予角色 |
|--------|-------------|-------------|----------|
| `ads:view` | 查看广告数据 | 查看广告数据与决策结果 | admin ✅ sales ✅ viewer ❌（D1） |
| `ads:edit` | 操作广告优化 | 上传报告/触发分析/勾选覆写/下载批量表（含 view） | admin ✅ sales ✅ |
| `ads:admin` | 管理广告账户 | 站点/账户/凭据 CRUD、删除报告决策（含 edit） | admin ✅ |

### 8.2 两处种子注册（架构 §3.1，**必须同步**，漏加生产初始化缺权限点）

**位置 1** `src/lib/permissions.ts` → `initDefaultPermissions()` 的 `defaultPermissions` 数组末尾追加：
```typescript
// 广告优化（M1）
{ name: 'ads:view',  code: 'ads:view',  displayName: '查看广告数据', module: 'ads', description: '查看广告数据与决策结果' },
{ name: 'ads:edit',  code: 'ads:edit',  displayName: '操作广告优化', module: 'ads', description: '上传报告/触发分析/勾选覆写/下载批量表（含 view）' },
{ name: 'ads:admin', code: 'ads:admin', displayName: '管理广告账户', module: 'ads', description: '站点/账户/凭据 CRUD、删除报告决策（含 edit）' },
```

**位置 2** `src/app/api/permissions/init/route.ts` → `defaultPermissions` 数组末尾同步追加同 3 条（该文件模块命名风格不同但 code 相同，追加 `module: 'ads'` 条目即可；该处走 `createMany + skipDuplicates` 幂等）。

### 8.3 角色授权落库 `seedAdsRolePermissions()`（幂等接线）

导出自 `src/lib/permissions.ts`，**在 `initDefaultPermissions()` 末尾调用**，**并在 `/api/permissions/init` POST 处理成功末尾调用**（两套初始化入口都覆盖）：

```typescript
export async function seedAdsRolePermissions(): Promise<{ wired: { role: string; permissions: string[] }[] }> {
  // 1. 解析权限 code → id：permission.findMany({ where: { code: { in: ['ads:view','ads:edit','ads:admin'] } } })
  // 2. 角色矩阵：
  //    admin ← ads:view + ads:edit + ads:admin
  //    sales ← ads:view + ads:edit
  //    （viewer/purchasing/warehouse 不接线，默认无）
  // 3. 幂等：rolePermission.createMany({ data: 按 role 展开的 (roleId, permissionId), skipDuplicates: true })
  //    ⚠️ 先 findUnique role by name（两套角色的 admin/sales 同名，天然统一）；角色不存在 → 跳过该角色并 console.warn
}
```

**说明（探索发现的两套体系）**：
- `hasPermission` 对 legacy `user.role='admin'/'super-admin'` 有 `'*'` 快速路径（无需 DB 行）；但 UserRole 体系下的 admin 用户依赖 RolePermission 行，而 `/api/permissions/init` 目前**只给 super_admin 接线**——因此 admin 也必须显式接线（架构 §3.3 已声明）。
- 接线后 **5 分钟权限缓存**：开发验收时角色切换后需重新登录，或调用 `invalidateUserPermissionsCache(userId)`（已导出于 permissions.ts）。

### 8.4 角色权限矩阵（落地后）

| 权限点 | admin | sales | viewer | purchasing / warehouse |
|--------|:-----:|:-----:|:------:|:----------------------:|
| ads:view | ✅ | ✅ | ❌ | ❌ |
| ads:edit | ✅ | ✅ | ❌ | ❌ |
| ads:admin | ✅ | ❌ | ❌ | ❌ |

### 8.5 每接口校验点表（REQ-§5.3「前端隐藏不等于安全」，AC-7 逐接口 curl）

| 端点 | 权限点 | 备注 |
|------|--------|------|
| GET /accounts | ads:view | 凭据脱敏回显 |
| POST /accounts | ads:admin | 凭据加密写入 |
| PUT /accounts/:id | ads:admin | 凭据重加密 |
| DELETE /accounts/:id | ads:admin | 软删 |
| GET /marketplaces | ads:view | |
| POST/PUT/DELETE /marketplaces(/:id) | ads:admin | |
| POST /reports/upload | ads:edit | multipart |
| GET /reports | ads:view | |
| POST /reports/:id/analyze | ads:edit | |
| GET /reports/:id/result | ads:view | |
| GET /reports/:id/file | ads:view | 归档下载 |
| DELETE /reports/:id | ads:admin | 删除报告+决策 |
| GET /keywords | ads:view | |
| PUT /keywords/:id | ads:edit | 勾选/覆写（sales 可做，非 admin） |
| POST /bulk-table | ads:edit | |
| GET /bulk-table/:recommendationId/download | ads:edit | 鉴权下载 |
| GET /recommendations (+compare) | ads:view | P1 |

---

## 九、凭据安全

### 9.1 加密写入（REQ-006-2/3、§9.2）

- 复用 `src/lib/crypto-utils.ts` 的 `encrypt(text)`（AES-256-GCM，hex(iv+ciphertext+authTag)）。
- 写入时机：POST/PUT /accounts，`clientId/clientSecret/refreshToken` 非空 → `encrypt()`；**禁止明文落库**（AC-7 检查项）。
- `settings` Json 不涉及凭据，明文存储（D6 引擎参数）。

### 9.2 返回脱敏 `src/lib/ads/mask.ts`

```typescript
export function maskCredential(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.length > 4 ? value.slice(-4) : value;   // 后 4 位
  return `****${v}`;
}
```
- 所有账户响应（GET /accounts、POST/PUT 响应）凭据字段一律过 `maskCredential()`；空值返回 `''`。
- **写入后不可回读明文**：M1 无任何解密路径（解密仅 M2 ApiFetcher 内部使用）；接口层永不调用 `decrypt()`。

### 9.3 双保险

- 查询时 select **不取凭据列**（列表只回显脱敏值，直接查列再 mask 亦可，但设计取"不查 + mask"双保险——避免未来某处误用原始值）。
- 审计日志与日志输出**禁止记录凭据明文**（details 只记 `{clientId: 'updated'}`，§10）。

### 9.4 部署检查项（架构 §11 R11）

crypto-utils 存在「未设 ENCRYPTION_KEY 降级 base64」路径（**已核实代码**）——生产必须配置 `ENCRYPTION_KEY`（64 hex 字符）；DEPLOYMENT.md 新增检查项 + 站点管理页保存凭据时提示（若检测到降级警告）。

---

## 十、审计日志点

统一 `writeAdsAuditLog`（§3.5）→ `prisma.auditLog.create({ action, entityType, entityId, userId, details, ipAddress, userAgent })`（AuditLog 表已核实，user 软关联 SetNull）。

| 时机 | action | entityType | entityId | details 要点 |
|------|--------|------------|----------|--------------|
| 创建/更新/删除账户（含凭据变更） | CREATE/UPDATE/DELETE | AdAccount | account.id | 变更前后字段；凭据只记 `{clientId: 'updated'}` **不记明文** |
| 站点 CRUD | CREATE/UPDATE/DELETE | AdMarketplace | marketplace.id | 变更字段 |
| 报告上传 | UPLOAD | AdReport | report.id（每份） | batchId、文件清单、rowCount、consistency/dateMismatch 摘要 |
| 触发分析（含引擎失败） | ANALYZE | AdReport | report.id | 参数（breakEvenAcos 等）、degraded、pairing 模式、attempts、exitCode、stderrTail、耗时 |
| 决策行勾选/覆写 | UPDATE | AdKeyword | keyword.id | 前后 isSelected/action/actionBid 对比 |
| 批量表生成/下载 | EXPORT | AdRecommendation | recommendation.id | stats（close/bidChange/negate/create）、自检结果、行数 |
| 删除报告/决策 | DELETE | AdReport | report.id | reportType、rowCount、关联 recommendationIds、fileName |

---

## 十一、事务边界

### 11.1 上传落库（§4.7 步骤 6）

- 文件写入（fs）→ 引擎 parse → **单事务**：1~2 条 AdReport create（同 batchId 共享）。
- **回滚策略**：parse 失败（E1）→ 删除已写文件（fs.unlink best-effort）→ 422，**不落库**（AC-9：失败不产生脏数据）。
- 事务粒度：两份报告在同事务写入（保持 batchId 配对原子性）；单份时事务内仅 1 条 create。

### 11.2 analyze 结果落库（§4.9 步骤 10）

```
$transaction(async (tx) => {
  // 1. AdCampaign upsert（键 (adAccountId, externalId)，按需逐条，通常 ≤ 决策行 campaign 数）
  // 2. AdRecommendation.create（result 全量契约 + params + version + degraded）
  // 3. AdKeyword 批量写入（§5.3 内存去重后：createMany 新增 + updateMany 覆盖已存在）
})
```
- **原子性**：任一失败整体回滚（无半截 recommendation / 孤儿 AdKeyword）；引擎已成功但事务失败 → 报告置 ANALYZE_FAILED（analyzeError 记录，可重试；重试时 recommendationId 全新，旧失败回滚无残留）。
- **状态更新不在事务内**：ANALYZED（成功）与 ANALYZE_FAILED（失败）是事务**之后**的独立 update——保证状态反映最终结果，且失败路径也能落 analyzeError。
- 注意：Prisma `$transaction` 内不宜跑引擎（120s 子进程），引擎调用**在事务外**先完成，事务只做落库。

### 11.3 覆写更新（§4.14）

单条 `update`（单语句原子）；乐观更新由前端 React Query 处理（onMutate 回滚），后端无跨表一致性要求。

### 11.4 删除报告（§4.12）

- `$transaction([prisma.adReport.delete({ id })])` —— Cascade 自动删除 AdRecommendation → AdKeyword（架构 §2.1）。
- 文件删除（fs.unlink）在事务提交后 best-effort（失败仅 warn，DB 已一致）。

### 11.5 批量表（§4.15/4.16）

纯读操作（findMany isSelected=true + 内存组装），无事务需求；确定性生成无状态写入。

---

## 十二、文件存储

### 12.1 目录规划（私有，非 public）

```
data/
├─ ads-reports/{accountId}/{uuid}.{ext}   # 报告归档（ext ∈ xlsx|csv，uuid 文件名）
├─ ads-engine/tmp-<uuid>.json             # 引擎 --out 临时契约文件（读后即删）
└─ (existing) competitor-monitoring/ …    # 既有私有数据目录先例
```
- `data/` 不在 `public/` 下、next.config **不暴露**（架构 §9.2；已核实项目 next.config.ts 无 data/ 静态映射）。
- 上传目录权限：仅服务进程可读写；文件名系统生成（`crypto.randomUUID()`），不沿用用户文件名。

### 12.2 下载鉴权

- 归档下载**仅**走 `GET /reports/:id/file`（ads:view，§4.11）；批量表**仅**走 `GET /bulk-table/:recommendationId/download`（ads:edit，§4.16）——不生成静态 URL，全链路经 middleware 认证 + 路由权限点校验（§8.5）。
- 文件读取只接受 DB 内 filePath（不接受用户传入路径，防穿越）。

### 12.3 文件生命周期

| 阶段 | 动作 |
|------|------|
| 上传 | 魔数/大小/扩展名校验 → 写入归档目录（E9 超限不落盘） |
| 分析 | 读归档路径传引擎；引擎 tmp 输出读后删除 |
| 删除报告 | 事务删 DB → best-effort unlink 归档文件 |
| 保留策略 | 原始文件**只增不删**（除非 admin 显式删除报告，§9.2 数据保留） |

---

## 十三、数据获取层（ReportFetcher/ManualFetcher）

按架构 §1.3 实现（类型契约先行，M2 零改动）：

- `src/lib/ads/fetchers/report-fetcher.ts`：`FetchedReport` 接口 + `ReportFetcher` 接口（`fetchReport` / `fetchSettings` / M2 预留 `applyChanges?`，dry-run 默认 + 二次确认 + 单批上限 50 的签名已定）。
- M1 实现 `ManualFetcher`：`fetchReport({ accountId, reportType, dateRange, files })` → 引擎 parse → 返回 `FetchedReport[]`（**上传路由的业务逻辑不直接碰文件系统/引擎**，经 ManualFetcher 封装）。
- 业务层（analyze/result/bulk 服务）只依赖接口与 AdReport 模型；`source` 字段贯穿展示与筛选（REQ-007-4）。

---

## 十四、目录/文件清单（开发顺序，BE 范围）

> 顺序即依赖顺序（对齐架构 §10，BE 裁剪版；前端项标注 FE 不在此列）。

| # | 文件/操作 | 内容 | BE 验收 |
|---|-----------|------|---------|
| 0 | `npm i exceljs` | 批量表依赖（当前未安装） | package.json 出现 exceljs |
| 1 | `prisma/schema.prisma` | 追加 5+1 模型（架构 §2 原样） | `prisma validate` 通过；`prisma db push`/migrate 后先 kill dev 再 generate 再重启 |
| 2 | `prisma/seed-ads.ts` | AdMarketplace 9 站点幂等 upsert（架构 §2.2 表） | 运行后 9 行，可重复执行 |
| 3 | `services/amazon-ads-engine/report_analyzer.py`（+ modules/decisions.py） | 复制 v20 模块原样 | `python3 -m ast` 解析通过 |
| 4 | `services/amazon-ads-engine/analyze_cli.py` | 适配层（parse/analyze、degraded、日期透传、rowIndex、契约映射） | 真实报告冒烟 {ok:true} 与 v20 数值一致；单报告 degraded 冒烟 |
| 5 | `services/amazon-ads-engine/VERSION` + README | "v20" + 复制来源/升级说明 | — |
| 6 | `src/lib/ads/engine-schema.ts` | 引擎输出 Zod 校验（§6.4） | 单测坏 JSON 拒绝 |
| 7 | `src/lib/ads/engine-client.ts` | execFile 封装（超时/重试/白名单/并发闸门） | 冒烟：真实报告 ≤30s；E2 路径演练 |
| 8 | `src/lib/ads/mask.ts` | maskCredential() | 单测（空值/短值/正常） |
| 9 | `src/lib/ads/audit.ts` | writeAdsAuditLog 封装 | 类型编译通过 |
| 10 | `src/lib/ads/bulk-table.ts` | exceljs 批量表 + 自检 + 使用说明（§7） | 读回校验列头/行内容（AC-5） |
| 11 | `src/lib/ads/fetchers/report-fetcher.ts` | ReportFetcher + ManualFetcher（§13） | 类型编译通过 |
| 12 | `src/lib/permissions.ts` | 3 权限点 + seedAdsRolePermissions（§8） | init 后权限表/接线存在 |
| 13 | `src/app/api/permissions/init/route.ts` | defaultPermissions 同步追加 3 条 + 调 seedAdsRolePermissions | 生产初始化含 ads:* 且接线 |
| 14 | `src/types/ads.ts` | 共享类型（AdAccountDTO/EngineResult/KeywordRow/…） | — |
| 15 | `src/app/api/v1/ads/marketplaces/route.ts` + `[id]/route.ts` | 站点 CRUD（§4.5/4.6） | curl AC-7 |
| 16 | `src/app/api/v1/ads/accounts/route.ts` + `[id]/route.ts` | 账户 CRUD（§4.1~4.4） | curl：凭据脱敏（AC-7） |
| 17 | `src/app/api/v1/ads/reports/upload/route.ts` | 上传落库 + batchId 配对 + 日期透传（§4.7） | E1/E9、分次提交配对演练（AC-9） |
| 18 | `src/app/api/v1/ads/reports/route.ts` | 报告历史（§4.8） | AC-8 按账户隔离 |
| 19 | `src/app/api/v1/ads/reports/[id]/analyze/route.ts` | 引擎跑批 + degraded + 跨批回退（§4.9） | E2/E3/E4/E7/E8 演练；AC-1 diff |
| 20 | `src/app/api/v1/ads/reports/[id]/result/route.ts` | 结果读取（§4.10） | AC-6 5 区渲染数据 |
| 21 | `src/app/api/v1/ads/reports/[id]/file/route.ts` | 归档下载（§4.11） | 鉴权校验 |
| 22 | `src/app/api/v1/ads/keywords/route.ts` + `[id]/route.ts` | 列表/勾选/覆写（§4.13/4.14） | AC-10 下钻（rawRowIndex）、R7 审计 |
| 23 | `src/app/api/v1/ads/bulk-table/route.ts` + `[recommendationId]/download/route.ts` | 批量表（§4.15/4.16） | E5/E6 演练（AC-9） |
| 24 | `src/app/api/v1/ads/recommendations/route.ts` + `compare/route.ts` | 决策历史/对比（§4.17，P1） | AC 009 可后置 |
| 25 | `Dockerfile` | **必改**：`apk add --no-cache python3` + standalone 复制 services/ + 运行期 mkdir data/ads-reports（架构 §11 R2） | 镜像内引擎冒烟 |
| 26 | 部署文档（DEPLOYMENT.md 追加） | ENCRYPTION_KEY 必配、data/ 卷挂载、引擎目录说明（§9.4） | — |
| 27 | AC-1 回归脚本 `tests/ads-ac1-diff.*` | analyze_cli.py 直跑 vs 系统存储 result 逐字段 diff（对比基准 CLI = analyze_cli.py） | AC-1 通过 |

---

## 十五、验收映射（AC-1~10 → 后端验证）

| 验收 | 后端验证方式 |
|------|-------------|
| AC-1 引擎一致性 | tests/ads-ac1-diff：真实 v20 报告 → `python3 services/amazon-ads-engine/analyze_cli.py analyze ...` 直跑 vs POST /analyze 落库 result Json，脚本化逐字段 diff（数字误差 0、JSON 结构一致） |
| AC-2 双维度正确性 | 3 处历史误判案例报告回归：analyze 后断言 closeMatrix 中 enhance breast cream / bigger breast / breast firming 的 action 与 v20 修正后一致（投放词维度判断，无搜索词聚合误判加价） |
| AC-3 层级复核 | analyze 后断言 result.layerCheck.ladderWarnings 数 = 调价后倒挂数 = 0；coefficientAudit 逐族可读 |
| AC-4 双标准动态计算 | 代码审查：engine-client 不传 negateClicks/stopSpend 时引擎动态计算；settings 传 null 不落参（§4.9 步骤 7）；仓库 grep 无硬编码阈值（审查项） |
| AC-5 批量表自检 | 真实报告勾选生成 → exceljs/openpyxl 读回校验：4 项自检全 0、ID 三件套齐全率 100%、改价行 Bid = 层级约束值（非纯 ACoS 值） |
| AC-6 全流程走通 | 上传 → analyze → result 5 区 → 勾选 → bulk-table → 下载文件可打开校验列头/行内容（浏览器实测 dev 3001，FE 配合） |
| AC-7 权限边界 | 三种角色（admin/sales/viewer）逐接口 curl：viewer 全部 403、sales 站点管理写接口 403、凭据字段任何角色均为 `****后4位` |
| AC-8 站点管理 | 创建 US 账户 → 上传/分析 → 列表按账户隔离（report/keywords 过滤断言无串数据） |
| AC-9 异常路径 | E1（坏文件/缺列/0 行）→ 422 不落库；E2（坏脚本/超时）→ ANALYZE_FAILED + analyzeError；E3（单报告）→ degraded 200；E4（>15%）→ 422 CONSISTENCY_MISMATCH；E5/E6 → 422；E7 → ANALYZE_FAILED；E8 → 多版本共存；E9 → 400 |
| AC-10 可追溯性 | 任取 AdKeyword 行断言：actionReason 非空（含依据类型+关键数字）、rawRowIndex 指向对应 AdReport.rawRows 行、familyL1 有值 |

---

## 十六、BE 侧风险与注意事项（架构 §11 之外）

| # | 风险/陷阱 | 缓解 |
|---|-----------|------|
| B1 | **`z.coerce.boolean()` 陷阱**：`Boolean('false') === true`，查询参数 isSelected 会被错误转 true | 全设计用 `z.enum(['true','false']).optional().transform(...)`（§4.1/4.8/4.13），代码审查关键词 `coerce.boolean` |
| B2 | **权限缓存 5 分钟**：seedAdsRolePermissions 接线后，已登录用户 hasPermission 可能命中旧缓存返回 false | 开发/验收脚本调 `invalidateUserPermissionsCache(userId)`；文档注明角色变更需重新登录 |
| B3 | **hasPermission 的 `*` 快速路径与 UserRole 体系不一致**：legacy role=admin 免查库，UserRole admin 依赖接线；`/api/permissions/init` 只接 super_admin | seedAdsRolePermissions 显式接 admin+sales（§8.3），两体系都覆盖；AC-7 用 UserRole 用户验证 |
| B4 | **Next.js 16 params 为 Promise**（新路由上下文） | withValidation 已处理；手写路由用 `const { id } = await context.params` |
| B5 | **FormData 端点无 Zod body 中间件** | upload 路由手写 UploadMetaSchema safeParse + 文件校验（§4.7），不复用 withValidation |
| B6 | **引擎子进程 maxBuffer**：stderr 全量记录需求 + 大输出 | maxBuffer 10MB；stderrTail 截断 4KB 入 analyzeError/审计 |
| B7 | **重试幂等**：analyze 重试可能残留 ANALYZING 状态 | 失败路径（ANALYZE_FAILED）是终态可重试；成功路径事务原子（§11.2）；重试前不依赖旧 recommendation |
| B8 | **result/rawRows Json 过大**（R6） | result 接口 closeMatrix/negateList 服务端内存分页；列表接口不返回大字段；rawRows 仅 AC-10 下钻按需 |
| B9 | **决策行排序不稳定**：同 source 内 rawRowIndex 相同（多来源合并后） | 排序加次级键 `createdAt asc` 保证稳定；前端分页不抖动 |
| B10 | **exceljs 流式响应内存**：200 行内生成 buffer 无压力，超限行数前端已限制勾选量 | bulk 生成 ≤10s 目标；如未来超 1 万行改 stream 写入（M1 不做） |
| B11 | **日期存储时区**：用户传 YYYY-MM-DD | 统一 `new Date(dateStr + 'T00:00:00Z')`（UTC 零点），引擎收到同一 YYYY-MM-DD 字符串（透传不回格式），全链路无本地时区偏移 |
| B12 | **soft-delete 查询遗漏**：AdAccount 列表/上传/分析须过滤 deletedAt=null | 所有账户读取路径统一 where 含 `deletedAt: null`（§4.1/4.7/4.9） |

---

## 十七、Phase 3 审核自查清单

> Phase 3（跨阶段审核）重点核对：**Zod 字段名与前端设计对齐**。以下为 BE 侧承诺的字段契约（前端按此对齐，若有出入以此表为仲裁点）：

1. **关键词决策行字段**（GET /keywords 行对象）：`id, adAccountId, campaignId, amazonCampaignId, adGroupId, externalId, keywordText, matchType, state, bid, familyL1, duplicateOf, action, actionBid, actionReason, rawRowIndex, source, acos, orders, spend, clicks, impressions, ctr, reportId, isSelected, overrideAction, overrideBid, overriddenBy, overriddenAt, recommendationId, isManualOverride, reasonPending, createdAt, updatedAt` —— 前端「关闭矩阵/否定清单/拓词/层级核对」四表统一消费该行结构。
2. **动作枚举**（PUT /keywords 与查询共用）：`PAUSE | RAISE_BID | LOWER_BID | NEGATE | KEEP | EXPAND | HARVEST`；前端下拉选项与后端 enum 一致。
3. **决策来源分区枚举**：`CLOSE_MATRIX | LAYER_CHECK | EXPAND | NEGATE`（source 字段，前端 Tab 分区依据）。
4. **result 接口顶层键**：`recommendation, account, families, expandTable, layerCheck, summary, closeMatrix, negateList, degraded, pairing`（与引擎契约键一一对应，**前端禁止重命名/二次聚合**，R4/AC-1）。
5. **批量表统计键**：`stats: { close, bidChange, negate, create }`（与执行摘要条/已勾选分类计数一致，REQ-004-4 行数一致性）。
6. **上传响应键**：`uploadBatchId, reports: [{id, reportType, rowCount}], warnings`。
7. **分析响应键**：`recommendationId, degraded, pairing: { mode: 'batch'|'fallback'|'none', reportId? }`。
8. **报告列表项键**：`id, accountId, accountName, reportType, source, startDate, endDate, originalName, rowCount, analyzeStatus, analyzedAt, latestRecommendation: {id, version, createdAt} | null, createdAt`。
9. **账户项键**：`id, platformCode, marketplaceId, marketplace: {code, name, currency, adEndpoint}, name, externalId, clientId, clientSecret, refreshToken, platformAccountId, isActive, settings, createdAt`（凭据一律 `****后4位` 或 `''`）。
10. **日期格式**：请求 `YYYY-MM-DD` 字符串；响应 `ISO 8601`（Prisma DateTime 序列化）。

---

*文档结束。本设计为 M1 后端实现的唯一 BE 基准；与架构 v2 冲突时以架构 v2 为准，与需求规格冲突时以需求规格为准。Zod 字段契约（§17）为 Phase 3 审核仲裁点。*
