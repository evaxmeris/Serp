# 用户停用/启用功能 — 架构方案（Arch）

> 版本：V1.0 | 2026-09-09 | 状态：待确认
> 需求来源：员工离职只需暂停登录权限，不删除账号（保留历史业务数据关联）
> BA 定案：① 新增权限点 user:disable ② 停用"下次登录生效" ③ 记录时间/原因/操作人 ④ 防锁死规则 ⑤ 软删除不做（P2）

---

## 0. 前置步骤（开发前必须）

**提交广告域 M1 未提交工作**，把工作区清干净（因为本次要改 prisma/schema.prisma，不能与广告域 212 行 schema 改动混在一起）。

**提交清单（建议 3 个 commit）**：
1. `feat(ads): 广告域 M1 完整功能（页面/API/权限/schema/引擎骨架/文档）`
   - src/app/ads/、src/app/api/v1/ads/、src/components/ads/、src/hooks/use-ads.ts、src/lib/ads/、src/types/ads.ts
   - services/amazon-ads-engine/、scripts/seed-ads.*、tests/ads-permissions-seed.verify.test.ts
   - prisma/schema.prisma（广告域部分）、src/lib/permissions.ts、src/app/api/permissions/init/route.ts、src/components/Sidebar/Sidebar.tsx
   - docs/advertising-domain-m1-*.md（7 份）、docs/amazon-ads-design.md、docs/amazon-business-hub-plan.md
2. `fix(ui): Dialog 长表单拖动修复（仅标题区可拖 + pointermove 兜底）`
   - src/components/ui/dialog.tsx
3. `chore: 更新 codebase-memory 图谱`
   - .codebase-memory/

**保持未提交（不纳入）**：public/uploads/*（运行时产物）、.qa-mkt.json、prisma/schema.prisma.pre-ads.bak、
chrome-extension/content.js + parsers/alibaba-v2.js（历史遗留，另行处理）、物流 submit/orders page 改动（待确认归属）

---

## 1. 数据模型（prisma/schema.prisma → User）

```prisma
model User {
  // ...现有字段
  isActive       Boolean   @default(true)  // 停用开关（false=已停用，禁止登录）
  disabledAt     DateTime?                 // 停用时间
  disabledBy     String?                   // 操作人（userId）
  disabledReason String?                   // 停用原因（可选填，最多 200 字）
  @@index([isActive])
}
```

迁移：`npx prisma migrate dev --name add_user_disable_fields`（开发库）→ 生产走 `prisma migrate deploy`。

---

## 2. 后端设计

### 2.1 PUT /api/users/[id]（扩展，不新增端点）
- Zod schema 增加：`isActive: z.boolean().optional()`, `disabledReason: z.string().max(200).optional()`
- 权限分层：
  - `isActive` 变更 → 要求 `user:disable` 权限，否则 403
  - 其他字段（name/email/role/isApproved/password）→ 维持现状 `admin/super-admin` 判断 + `user:edit`
- 状态切换副作用：
  - true→false：`isActive=false, disabledAt=now, disabledBy=currentUser.id, disabledReason=传入值`
  - false→true：`isActive=true, disabledAt=null, disabledBy=null, disabledReason=null`
- **防锁死校验（在写库前）**：
  1. `id === currentUser.id` → 400「不能停用当前登录账号」
  2. 目标是 super-admin：`SELECT count(*) FROM users WHERE isActive=true AND 有 super-admin 角色` = 1 → 400「不能停用最后一个超级管理员」
- 审计日志：`writeAuditLog({ action: isActive ? 'USER_ENABLED' : 'USER_DISABLED', entityType: 'User', entityId: id, details: { reason, targetEmail } })`

### 2.2 登录校验（api/auth/login/route.ts）
在 `isApproved` 检查之后（第 102 行后）插入：
```ts
if (!user.isActive) {
  await writeAuditLog({ action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id,
    details: { email: user.email, reason: 'account_disabled' }, ipAddress, userAgent });
  return NextResponse.json({ error: '账号已停用，请联系管理员。' }, { status: 403 });
}
```
顺序说明：放在密码校验之后（避免向未验证者泄露账号状态）。

### 2.3 列表/详情数据（api/users/route.ts GET）
- select 增加 `isActive, disabledAt, disabledReason`（否则前端拿不到状态）

### 2.4 权限种子（api/permissions/init/route.ts）
- 新增一行：`{ name: 'user:disable', code: 'user:disable', displayName: '停用/启用用户', module: 'user' }`
- 现有 admin/super-admin 角色的授权：确认种子是否自动挂新权限；否则补脚本给 admin/super-admin 角色关联（★ 开发时验证）

---

## 3. 前端设计（src/app/settings/users/user-list.tsx）

1. **类型**：UserRow 增加 `isActive: boolean; disabledAt?: string | null; disabledReason?: string | null`
2. **状态列**：
   - `isActive === false` → 红色徽章「已停用」（优先展示，覆盖已批准/待批准）
   - 其余维持「已批准 / 待批准」
3. **操作列新增按钮**（放在编辑与删除之间，`hasPerm('user:disable')` 才显示）：
   - 正常用户 → ⏻（PowerOff 图标，title「停用」）
   - 已停用用户 → ⏻（Power 图标，title「启用」）
4. **停用弹窗**：显示「确认停用 {name}？停用后该账号将无法登录（历史数据保留）」+ 原因输入框（可选，placeholder「如：离职 / 长期休假」）+ 取消/确认停用（destructive）
5. **启用弹窗**：轻确认「确认恢复 {name} 的登录权限？」→ 确认启用
6. **查看详情弹窗**：状态行改为「账号状态：正常 / 已停用（2026-09-09 · 原因：离职）」
7. **列表筛选（可选）**：状态筛选项加「已停用」（默认不筛）
8. 交互反馈：成功后 Toast + 列表刷新（复用现有 loadUsers）

---

## 4. 影响面与回归风险

| 文件 | 改动 | 风险 |
|------|------|------|
| prisma/schema.prisma + 迁移 | +4 字段 | 低（纯新增，默认 true 不影响存量） |
| api/users/[id]/route.ts | PUT 扩展 + 校验 | 中：权限分层不能破坏现有编辑流程 |
| api/auth/login/route.ts | +1 检查 | 中（登录核心路径，改动必须最小且放对位置） |
| api/users/route.ts | select +3 字段 | 低 |
| api/permissions/init/route.ts | +1 权限点 | 中：需确认 admin 角色能拿到新权限 |
| settings/users/user-list.tsx | UI 扩展 | 低 |

**已知边界（写进文档提示）**：JWT 无状态——已登录用户的旧 token 在到期前仍有效，停用"下次登录生效"。如需即时踢出，需改全局鉴权（P2 评估）。

---

## 5. QA 测试要点（开发完成后必测）

1. □ 停用用户 → 该用户登录返回 403「账号已停用」
2. □ 停用后旧会话（已登录 tab）行为符合预期（仍可操作，下次登录失效）——确认提示文案已说明
3. □ 启用后立即恢复登录
4. □ 停用自己 → 400 拒绝；停用最后一个 super-admin → 400 拒绝
5. □ 无 user:disable 权限角色：按钮不可见 + 直接调 API 返回 403
6. □ 状态徽章正确（已停用=红色），列表/详情/编辑三处一致
7. □ 审计日志写入 USER_DISABLED / USER_ENABLED / LOGIN_FAILED(account_disabled)
8. □ 停用原因、时间、操作人正确落库
9. □ 回归：正常编辑用户（改名/改角色/改密码/批准）不受影响
10. □ 回归：新增用户、审批流、角色管理页正常

---

## 6. 交付物

- 代码：schema + 迁移 + 3 个 API 文件 + 1 个前端文件
- 文档：本 Arch（docs/user-disable-arch.md）
- 自验：dev 环境（:3001）按 QA 清单逐项实测 + 截图/curl 证据
