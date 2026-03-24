# 认证模块技术文档

**项目**: Trade ERP
**版本**: v0.6.0
**最后更新**: 2026-03-23

---

## 目录

1. [概述](#概述)
2. [技术架构](#技术架构)
3. [文件说明](#文件说明)
4. [API 参考](#api-参考)
5. [权限控制](#权限控制)
6. [前端集成](#前端集成)
7. [环境变量](#环境变量)
8. [部署注意事项](#部署注意事项)
9. [故障排查](#故障排查)

---

## 概述

Trade ERP 使用**简化 JWT + HttpOnly Cookie**认证方案。

### 设计目标

- ✅ 完全兼容 Next.js 16
- ✅ 代码简单易懂，易于维护
- ✅ 安全默认配置
- ✅ 支持角色权限控制
- ✅ 保持向后兼容

### 核心特性

| 特性 | 状态 |
|------|------|
| 邮箱密码登录 | ✅ |
| JWT 会话管理 | ✅ |
| HttpOnly Cookie | ✅ |
| 7 天自动过期 | ✅ |
| 角色权限控制 | ✅ |
| 用户状态管理 | ✅ |
| 速率限制 | ✅ |
| 密码哈希存储 (bcrypt) | ✅ |
| 第三方登录 | ❌ (当前未需求) |

---

## 技术架构

### 流程图

```
用户访问
   ↓
未认证？
   ↓ YES
跳转登录页
   ↓
用户提交表单
   ↓
POST /api/auth/login
   ↓
验证用户名密码 → 生成 JWT → 设置 HttpOnly Cookie
   ↓
返回用户信息 → 前端跳转 dashboard
   ↓
访问 API 时
   ↓
Cookie 自动携带 → 验证 JWT → 返回数据
   ↓
用户点击登出
   ↓
POST /api/auth/logout → 删除 Cookie → 跳转登录
```

### 数据流向

```
┌─────────────┐
│   浏览器    │
└──────┬──────┘
       │ Cookie: auth-token=xxx
       ▼
┌──────────────────────────┐
│ Next.js API Route        │
├──────────────────────────┤
│ 1. 从 Cookie 读取 token  │
│ 2. jwtVerify 验证签名    │
│ 3. 返回用户信息          │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐
│  业务逻辑处理            │
│  返回 JSON 响应         │
└──────────────────────────┘
```

---

## 文件说明

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/lib/auth-simple.ts` | 简化认证核心实现 |
| `src/lib/auth.ts` | 兼容层，保持与旧 API 兼容 |
| `src/app/api/auth/login/route.ts` | 登录 API |
| `src/app/api/auth/me/route.ts` | 获取当前用户信息 API |
| `src/app/api/auth/logout/route.ts` | 登出 API |
| `src/app/api/auth/register/route.ts` | 用户注册 API |
| `src/app/login/page.tsx` | 登录页面 |

### 数据模型

**User 表** (Prisma):

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String?
  passwordHash   String?   // bcrypt 哈希，不存储明文密码
  role           Role      @default(USER)  // ADMIN/MANAGER/USER/VIEWER
  avatar         String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  // ... 其他关联字段
}
```

**角色枚举**:

```typescript
export type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
```

**角色等级** (从低到高):
- `VIEWER` - 只读访客 (1)
- `USER` - 普通用户 (2)
- `MANAGER` - 经理 (3)
- `ADMIN` - 管理员 (4)

---

## API 参考

### POST `/api/auth/login`

用户登录

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**成功响应** (200):
```json
{
  "success": true,
  "user": {
    "id": "cly...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "message": "登录成功"
}
```
> **注意**: 响应成功后，Cookie 已在 Response Header 中设置，浏览器会自动保存。

**失败响应** (401):
```json
{
  "error": "账号或密码错误"
}
```

**失败响应** (400):
```json
{
  "error": "邮箱和密码不能为空"
}
```

**失败响应** (429):
```json
{
  "error": "请求过于频繁，请稍后再试"
}
```

---

### GET `/api/auth/me`

获取当前登录用户信息

**成功响应** (200 - 已认证):
```json
{
  "authenticated": true,
  "user": {
    "id": "cly...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

**失败响应** (401 - 未认证):
```json
{
  "authenticated": false
}
```

---

### POST `/api/auth/logout`

用户登出，清除 Cookie

**成功响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

### POST `/api/auth/register`

用户注册（开放注册模式）

**请求体**:
```json
{
  "email": "new@example.com",
  "name": "New User",
  "password": "password123",
  "role": "USER"  // 可选，默认 USER
}
```

**成功响应** (201):
```json
{
  "id": "cly...",
  "email": "new@example.com",
  "name": "New User",
  "role": "USER",
  "createdAt": "2026-03-22T00:00:00.000Z",
  "updatedAt": "2026-03-22T00:00:00.000Z"
}
```

**错误响应** (400):
```json
{
  "error": "User already exists"
}
```

---

## 权限控制

### 在 API 路由中使用

```typescript
import { NextRequest } from 'next/server';
import { getSession, requireAuth, requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // 1. 验证是否已登录
  const authError = await requireAuth(request);
  if (authError) return authError;

  // 2. 获取会话
  const session = await getSession(request);
  
  // 3. 验证角色权限（需要 MANAGER 或更高）
  const roleError = requireRole(session!, 'MANAGER');
  if (roleError) return roleError;

  // 4. 处理业务逻辑...
}
```

### 可用工具函数

| 函数 | 说明 | 返回值 |
|------|------|--------|
| `getSession(request)` | 获取当前用户会话 | `AuthSession | null` |
| `requireAuth(request)` | 要求必须登录 | `null` 表示通过，否则返回 401 响应 |
| `requireRole(session, requiredRole)` | 要求特定角色 | `null` 表示通过，否则返回 403 响应 |
| `isAdmin(session)` | 检查是否管理员 | `boolean` |
| `isManager(session)` | 检查是否经理或管理员 | `boolean` |

### 角色等级检查规则

`requireRole` 采用**最低等级**规则：
- 如果用户角色等级 ≥ 要求等级 → 通过
- 例如：要求 `MANAGER`，`ADMIN` 可以通过，`USER` 不能通过

---

## 前端集成

### 登录示例

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json();
    
    if (res.ok) {
      // 保存用户信息到 localStorage（可选）
      localStorage.setItem('user', JSON.stringify(data.user));
      // 跳转到 dashboard
      router.push('/dashboard');
      router.refresh();
    } else {
      alert(data.error);
    }
  };
  
  return <form onSubmit={handleSubmit}>/* ... */</form>;
}
```

### 检查认证状态

```typescript
async function checkAuth() {
  const res = await fetch('/api/auth/me');
  const data = await res.json();
  
  if (data.authenticated) {
    console.log('已登录', data.user);
  } else {
    console.log('未登录');
    router.push('/login');
  }
}
```

### 登出

```typescript
async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem('user');
  router.push('/login');
}
```

---

## 环境变量

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NEXTAUTH_SECRET` | JWT 签名密钥，必须 ≥ 32 字符 | `your-secret-key-here-min-32-chars-long` |
| `NEXTAUTH_URL` | 站点 URL，必须与实际访问地址一致 | `https://your-domain.com` |

### 开发环境示例 (`.env.local`):

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="TradeERP_Dev_Secret_Key_2026"
```

### 生产环境示例 (`.env.production`):

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://serp.cpolar.cn"
NEXTAUTH_SECRET="your-production-secret-key-keep-it-safe"
```

> **⚠️ 安全提醒**: `NEXTAUTH_SECRET` 必须保密，不要提交到 Git！

---

## 部署注意事项

### Docker 部署

1. 确保 `.env.production` 中 `NEXTAUTH_URL` 正确配置为实际访问域名
2. 构建镜像时不会包含 `.env.production`，通过 `--env-file` 传入
3. 环境变量变化后必须重新构建并重启容器

### Cookie 安全

- 生产环境必须使用 HTTPS
- `secure` 标志会自动根据 `NODE_ENV` 设置
- 开发环境 HTTP，`secure=false`
- 生产环境 HTTPS，`secure=true`

### 域名变更

如果域名变更，必须：
1. 更新 `NEXTAUTH_URL`
2. 重新构建部署
3. 用户需要重新登录

---

## 故障排查

### 问题 1: 登录成功，但刷新页面又需要重新登录

**可能原因**:
1. `NEXTAUTH_URL` 配置不正确
2. Cookie Domain 不匹配
3. HTTPS 网站使用了 `secure=false`

**排查步骤**:
1. 打开浏览器开发者工具 → Application → Cookies
2. 检查 `auth-token` 是否存在
3. 检查 `Domain` 是否与当前域名匹配
4. 检查 `Secure` 标志：生产环境 HTTPS 应该勾选
5. 确认 `.env.production` 中 `NEXTAUTH_URL` 正确

**修复**:
```bash
# 修改正确的 URL
NEXTAUTH_URL="https://your actual domain.com"
# 重新构建部署
```

---

### 问题 2: `NEXTAUTH_SECRET 环境变量必须设置`

**原因**: 安全检查强制要求必须配置，不允许使用默认值

**修复**: 在 `.env.local` 或 `.env.production` 中添加：
```bash
NEXTAUTH_SECRET="your-secret-key-here-min-32-chars-long"
```

---

### 问题 3: `cookies(...).getAll is not a function`

**原因**: NextAuth v4 与 Next.js 16 不兼容

**当前状态**: 已修复，使用简化认证方案，不会出现此问题

---

### 问题 4: 登录提示 `账户等待审批`

**原因**: 用户创建后，管理员还未批准账户

**解决**: 联系管理员审批账户状态

---

### 问题 5: 登录提示 `账户已暂停/禁用`

**原因**: 账户被管理员停用

**解决**: 联系管理员解除停用

---

## 相关文档

- [开发过程记录](./authentication-dev-process.md)
- [用户手册](./authentication-user-guide.md)

---

*文档结束*
