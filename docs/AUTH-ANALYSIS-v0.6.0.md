# Trade ERP v0.6.0 认证技术分析

**分析日期**: 2026-03-22  
**版本**: v0.6.0 (Git 标签)

---

## 📊 **认证技术栈**

### 核心依赖

```json
{
  "next-auth": "^5.0.0-beta.30",
  "bcryptjs": "^3.0.3",
  "jose": "未安装"
}
```

### 认证方案

**v0.6.0 使用的是混合认证方案**：

1. **NextAuth v5 Beta** (主要认证框架)
2. **自定义简化认证** (辅助方案，用于部分 API)

---

## 🔍 **认证流程分析**

### 1. NextAuth v5 Beta 配置

**文件位置**: 未找到标准配置文件

**NextAuth v5 特点**:
- 使用 `NextAuth({ providers: [...] })` 配置
- 导出 `{ handlers, auth, signIn, signOut }`
- 支持 App Router 的新 API
- Beta 版本，API 可能变更

**标准配置示例**:
```typescript
// src/lib/auth.ts (应该是这样，但未找到)
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: "email" },
        password: { type: "password" }
      },
      authorize: async (credentials) => {
        // 验证用户
      }
    })
  ]
});
```

---

### 2. 自定义简化认证 (`src/lib/auth-simple.ts`)

**实现方式**: JWT + HttpOnly Cookie

**核心代码**:
```typescript
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

// 登录时生成 JWT
const token = await new SignJWT({ 
  id: user.id, 
  email: user.email,
  name: user.name,
  role: user.role 
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET);

// 设置 HttpOnly cookie
cookieStore.set('auth-token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60,
  path: '/',
});
```

**认证检查**:
```typescript
// 从 cookie 读取 token
const token = cookieStore.get('auth-token')?.value;

// 验证 JWT
const { payload } = await jwtVerify(token, SECRET);

// 提取用户信息
return {
  id: payload.id,
  email: payload.email,
  name: payload.name,
  role: payload.role,
};
```

---

### 3. 中间件认证 (`src/middleware/auth.ts`)

**功能**: 提供 API 请求的认证和授权

**核心函数**:
```typescript
// 获取当前用户会话
export async function getSession(request: NextRequest): Promise<AuthSession | null>

// 验证用户是否已认证
export async function requireAuth(request: NextRequest): Promise<NextResponse | null>

// 验证用户角色权限
export function requireRole(session: AuthSession, requiredRole: UserRole): NextResponse | null

// 可选认证（不强制要求登录）
export async function optionalAuth(request: NextRequest): Promise<AuthSession | null>
```

**角色等级**:
```typescript
type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';

const roleHierarchy = {
  'VIEWER': 1,
  'USER': 2,
  'MANAGER': 3,
  'ADMIN': 4
};
```

---

## 📁 **认证相关文件**

### API 路由

| 文件路径 | 功能 | 状态 |
|----------|------|------|
| `/api/auth/login` | 用户登录 | ✅ 已实现 |
| `/api/auth/register` | 用户注册 | ✅ 已实现 |
| `/api/auth/me` | 获取当前用户 | ✅ 已实现 |
| `/api/auth/logout` | 用户登出 | ✅ 已实现 |

### 认证库

| 文件路径 | 功能 | 说明 |
|----------|------|------|
| `src/lib/auth.ts` | 认证中间件 | 提供 `requireAuth()`, `requireRole()` 等 |
| `src/lib/auth-simple.ts` | 简化认证 | JWT + Cookie 实现 |
| `src/middleware/auth.ts` | 认证中间件 | API 层的认证检查 |

---

## 🔐 **认证流程**

### 登录流程

```
用户输入账号密码
    ↓
POST /api/auth/login
    ↓
验证用户 (Prisma + bcrypt)
    ↓
生成 JWT token (jose.SignJWT)
    ↓
设置 HttpOnly cookie (auth-token)
    ↓
返回用户信息
```

### API 认证流程

```
API 请求
    ↓
requireAuth(request)
    ↓
从 cookie 读取 auth-token
    ↓
jwtVerify(token, SECRET)
    ↓
提取用户信息 (id, email, role)
    ↓
返回用户会话或 401 错误
```

### 权限检查流程

```
requireRole(session, 'MANAGER')
    ↓
比较角色等级
    ↓
userRoleLevel >= requiredRoleLevel ?
    ↓
是：返回 null (通过)
否：返回 403 错误
```

---

## ⚠️ **存在的问题**

### 1. NextAuth v5 配置缺失

**问题**: 未找到标准的 NextAuth 配置文件

**影响**:
- NextAuth 可能未正确初始化
- 部分依赖 NextAuth 的功能可能失效
- 会话管理可能不一致

**建议**:
- 创建标准的 `src/lib/auth.ts` 配置文件
- 或完全迁移到简化认证方案

---

### 2. 认证方案不统一

**问题**: 同时使用 NextAuth 和简化认证

**影响**:
- 代码维护复杂
- 可能出现认证状态不一致
- Cookie 名称可能冲突

**建议**:
- 选择一种认证方案
- 统一所有 API 的认证逻辑

---

### 3. 缺少 CSRF 保护

**问题**: 未使用 CSRF token

**影响**:
- 可能存在跨站请求伪造风险

**建议**:
- 添加 CSRF token 验证
- 或使用 SameSite=strict cookie

---

### 4. 缺少速率限制

**问题**: 登录接口无速率限制

**影响**:
- 可能存在暴力破解风险

**建议**:
- 添加登录失败次数限制
- 实现账户锁定机制

---

## 📋 **推荐方案**

### 方案 A: 统一使用简化认证

**优点**:
- ✅ 代码简单，易于理解
- ✅ 完全可控
- ✅ 无外部依赖（除了 jose）
- ✅ 适合当前项目规模

**缺点**:
- ❌ 需要自行实现所有认证逻辑
- ❌ 无社区支持
- ❌ 第三方登录需要手动实现

**实施步骤**:
1. 移除 NextAuth 依赖
2. 统一使用 `auth-simple.ts`
3. 更新所有 API 的认证逻辑
4. 添加速率限制和安全加固

---

### 方案 B: 统一使用 NextAuth v5

**优点**:
- ✅ 功能完整
- ✅ 社区支持
- ✅ 第三方登录开箱即用
- ✅ 内置 CSRF 保护

**缺点**:
- ❌ Beta 版本，可能不稳定
- ❌ 配置复杂
- ❌ 学习曲线陡峭

**实施步骤**:
1. 创建标准的 NextAuth 配置
2. 迁移所有认证逻辑到 NextAuth
3. 更新中间件和 API 路由
4. 测试所有认证场景

---

### 方案 C: 降级到 NextAuth v4

**优点**:
- ✅ 稳定版本
- ✅ 文档完善
- ✅ 社区支持

**缺点**:
- ❌ 与 Next.js 16 可能有兼容性问题
- ❌ API 与 v5 不同

**实施步骤**:
1. `npm install next-auth@4.24.11`
2. 使用 v4 API 配置
3. 解决 Next.js 16 兼容性问题

---

## 🎯 **开发建议**

### 对于 v0.6.0 的后续开发

**推荐**: **方案 A - 统一使用简化认证**

**理由**:
1. v0.6.0 已经实现了简化认证
2. 代码量小，易于维护
3. 适合外贸 ERP 的业务场景
4. 可以逐步添加安全加固

**具体实施**:

1. **统一认证库**
   ```typescript
   // src/lib/auth.ts (统一认证库)
   export { login, logout, getCurrentUser } from './auth-simple';
   export { requireAuth, requireRole, getSession } from './middleware/auth';
   ```

2. **更新所有 API**
   ```typescript
   // 所有 API 统一使用
   import { requireAuth } from '@/lib/auth';
   
   export async function GET(request: Request) {
     const authError = await requireAuth(request);
     if (authError) return authError;
     
     // 业务逻辑
   }
   ```

3. **安全加固**
   - 添加登录失败速率限制
   - 实现账户锁定机制
   - 添加密码强度验证
   - 实现双因素认证（可选）

---

## 📚 **参考资料**

- [NextAuth v5 文档](https://next-auth.js.org/)
- [jose 库文档](https://github.com/panva/jose)
- [bcryptjs 文档](https://www.npmjs.com/package/bcryptjs)
- [OWASP 认证最佳实践](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

*本文档会根据开发进度持续更新*
