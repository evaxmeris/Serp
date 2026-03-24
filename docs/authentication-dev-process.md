# 认证方案开发过程记录

**项目**: Trade ERP
**版本**: v0.6.0
**记录日期**: 2026-03-23
**记录人**: Trade ERP 信息员

---

## 目录

1. [问题背景](#问题背景)
2. [初始方案选择](#初始方案选择)
3. [遇到的问题](#遇到的问题)
4. [根因分析](#根因分析)
5. [方案选型对比](#方案选型对比)
6. [简化认证方案实现](#简化认证方案实现)
7. [测试验证](#测试验证)
8. [部署上线](#部署上线)
9. [技术债务与后续计划](#技术债务与后续计划)
10. [经验教训](#经验教训)

---

## 问题背景

Trade ERP 项目基于 Next.js 16.1.6 开发，需要用户认证功能来保护后台路由和 API。

### 需求
- 用户登录/登出
- 基于 JWT 的会话管理
- HttpOnly Cookie 存储（安全）
- 角色权限控制
- 兼容 Next.js 16 异步 API

---

## 初始方案选择

### 选型：NextAuth v4.x

**选择理由**:
1. Next.js 生态最流行的认证库
2. 社区活跃，文档完善
3. 支持多种第三方登录
4. 默认安全配置良好

**预期开发时间**: 1-2 天

---

## 遇到的问题

### 问题 1: `cookies(...).getAll is not a function`

**错误信息**:
```
TypeError: cookies(...).getAll is not a function
TypeError: Function.prototype.apply was called on #<Object>
```

**问题描述**: NextAuth v4 在 Next.js 16 环境下运行时，调用 `cookies().getAll()` 失败。

---

### 问题 2: `Route "/api/auth/[...nextauth]" used params.nextauth. params is a Promise`

**错误信息**:
```
Error: Route "/api/auth/[...nextauth]" used `params.nextauth`. `params` is a Promise
in your client-side or Route Handler code. In Next.js 15+, you need to await
params before accessing properties.
```

**问题描述**: Next.js 15/16 将 `params` 改为 Promise 类型，但 NextAuth v4 仍以同步方式访问。

---

### 问题 3: 生产环境 Cookie 不匹配

**错误现象**: 登录成功后，刷新页面仍然需要重新登录。

**根因**:
- `.env.production` 中 `NEXTAUTH_URL=http://localhost:3000`
- 实际部署域名：`https://serp.cpolar.cn`
- 导致 Cookie Domain 不匹配，浏览器不发送 Cookie

---

## 根因分析

| 问题 | 根本原因 | 影响 |
|------|----------|------|
| `getAll is not a function` | Next.js 16 Cookies API 变化，NextAuth v4 不兼容 | 登录流程完全中断 |
| `params is a Promise` | Next.js 16 路由参数异步化变革 | API 路由无法启动 |
| Cookie 不匹配 | 环境变量配置错误 | 会话无法保持 |

### 兼容性总结

| NextAuth 版本 | Next.js 15/16 兼容性 |
|---------------|----------------------|
| NextAuth v4 | ❌ 不兼容 |
| NextAuth v5 (beta) | ⚠️ 测试版，API 不稳定 |
| Auth.js v5 (beta) | ⚠️ 仍在开发中 |

---

## 方案选型对比

在遇到兼容性问题后，重新评估了可行方案：

### 方案 1: 升级到 NextAuth v5 (beta)

**优势**:
- 官方支持，生态完善
- 支持多种第三方登录

**劣势**:
- 仍是 Beta 版本，API 可能变化
- 学习成本高
- 仍可能有兼容性问题

**评估**: ⚠️ 不适合当前稳定迭代

---

### 方案 2: 引入 Auth0/Clerk SaaS 认证

**优势**:
- 无需自己维护
- 专业安全

**劣势**:
- 增加成本
- 依赖第三方服务
- 数据隐私顾虑
- 定制化困难

**评估**: ❌ 当前阶段不需要

---

### 方案 3: 自定义简化认证（JWT + Cookie）

**优势**:
- 完全兼容 Next.js 16
- 代码完全可控，易调试
- 1-2 小时完成上线
- 可逆，后续可升级
- 符合当前项目只需要账号密码的需求

**劣势**:
- 需手动实现第三方登录（当前不需要）
- 无社区生态

**评估**: ✅ 最适合当前阶段

---

## 简化认证方案实现

### 技术架构

```
┌─────────────────────────────────────────┐
│  浏览器 / 前端                            │
├─────────────────────────────────────────┤
│  - 登录表单                              │
│  - localStorage 缓存用户信息             │
│  - 携带 Cookie 自动认证                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  API 路由 (/api/auth/*)                  │
├─────────────────────────────────────────┤
│  - POST /api/auth/login  → 登录          │
│  - GET  /api/auth/me     → 获取用户信息  │
│  - POST /api/auth/logout → 登出          │
│  - POST /api/auth/register → 注册        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  业务层 (auth-simple.ts)                 │
├─────────────────────────────────────────┤
│  - login(email, password)                │
│  - getCurrentUser()                      │
│  - logout()                              │
│  - JWT 签名 + 验证 (jose 库)             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  数据层 (Prisma)                         │
├─────────────────────────────────────────┤
│  - User 表存储用户信息                   │
│  - passwordHash 存储 bcrypt 哈希         │
└─────────────────────────────────────────┘
```

### 文件结构

```
src/
├── lib/
│   ├── auth-simple.ts      # 简化认证核心实现
│   └── auth.ts             # 兼容层（供旧代码使用）
└── app/
    └── api/
        └── auth/
            ├── login/
            │   └── route.ts     # 登录 API
            ├── me/
            │   └── route.ts     # 获取用户信息 API
            ├── logout/
            │   └── route.ts     # 登出 API
            └── register/
                └── route.ts     # 注册 API
```

### 核心实现

#### 1. 环境变量配置

**必需配置**:
```bash
# JWT 签名密钥（必须 >= 32 字符）
NEXTAUTH_SECRET="your-secret-key-here-min-32-chars-long"
# 站点 URL（必须与实际访问地址一致）
NEXTAUTH_URL="https://your-domain.com"
```

> **安全强制检查**: 如果 `NEXTAUTH_SECRET` 未设置，服务启动时直接抛出错误，不使用默认值。

---

#### 2. JWT 登录流程

```typescript
// 1. 根据邮箱查找用户
const user = await prisma.user.findUnique({ where: { email } });

// 2. 验证密码（bcrypt .compare）
const isValid = await bcrypt.compare(password, user.passwordHash);

// 3. 验证用户状态
// 支持状态: PENDING_APPROVAL / SUSPENDED / DISABLED

// 4. 生成 JWT Token
const token = await new SignJWT({ 
  id: user.id, 
  email: user.email,
  name: user.name,
  role: user.role 
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET);

// 5. 设置 HttpOnly Cookie
cookieStore.set('auth-token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60, // 7 天
  path: '/',
});
```

---

#### 3. 获取当前用户

```typescript
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, SECRET);
  
  return {
    id: payload.id as string,
    email: payload.email as string,
    name: payload.name as string,
    role: payload.role as string,
  };
}
```

---

#### 4. 权限控制兼容层

`src/lib/auth.ts` 提供兼容层，保持与原 API 一致：

```typescript
// 原 API: getSession(request) -> 获取会话
export async function getSession(request: NextRequest) {
  // 内部调用简化认证的 getCurrentUser
  const { getCurrentUser } = await import('@/lib/auth-simple');
  const user = await getCurrentUser();
  // 转换为兼容格式返回
  return user ? { user } : null;
}

// 角色权限验证
export function requireRole(session: AuthSession, requiredRole: UserRole) {
  const roleHierarchy = {
    'VIEWER': 1, 'USER': 2, 'MANAGER': 3, 'ADMIN': 4
  };
  // ... 返回错误或 null
}
```

---

### Cookie 安全配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `httpOnly` | `true` | 防止 XSS 读取 |
| `secure` | 生产环境 `true` | 只在 HTTPS 发送 |
| `sameSite` | `lax` | CSRF 防护 |
| `maxAge` | 7 天 | 自动过期 |
| `path` | `/` | 全站可用 |

---

## 测试验证

### 单元测试（手动）

#### 测试 1: 正常登录

```bash
curl -c /tmp/cookies.txt -X POST https://serp.cpolar.cn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin@123456"}'
```

**预期响应**:
```json
{
  "success": true,
  "user": {
    "id": "xxx",
    "email": "admin@trade-erp.com",
    "name": "Admin",
    "role": "ADMIN"
  },
  "message": "登录成功"
}
```

**验证**: ✅ 通过

---

#### 测试 2: 获取用户信息

```bash
curl -b /tmp/cookies.txt https://serp.cpolar.cn/api/auth/me
```

**预期响应**:
```json
{
  "authenticated": true,
  "user": {
    "id": "xxx",
    "email": "admin@trade-erp.com",
    "name": "Admin",
    "role": "ADMIN"
  }
}
```

**验证**: ✅ 通过

---

#### 测试 3: 错误密码

```bash
curl -X POST https://serp.cpolar.cn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"wrong-password"}'
```

**预期响应**: 401 + `{"error": "账号或密码错误"}`

**验证**: ✅ 通过

---

#### 测试 4: 登出

```bash
curl -b /tmp/cookies.txt -X POST https://serp.cpolar.cn/api/auth/logout
```

**预期结果**: Cookie 被清除，`maxAge=0`，再次调用 `/api/auth/me` 返回 401。

**验证**: ✅ 通过

---

### 功能测试清单

| 测试项 | 结果 |
|--------|------|
| 正常登录成功 | ✅ |
| 错误密码提示正确 | ✅ |
| 不存在账号提示正确 | ✅ |
| 获取用户信息成功 | ✅ |
| 未登录返回 401 | ✅ |
| 登出成功清除 Cookie | ✅ |
| Cookie 在生产环境设置 secure | ✅ |
| JWT 到期自动失效 | ✅ |
| API 路由兼容旧权限验证 | ✅ |

---

## 部署上线

### 关键配置变更

**`.env.production`**:
```diff
# NextAuth 配置（生产环境）
- NEXTAUTH_URL="http://localhost:3000"
+ NEXTAUTH_URL="https://serp.cpolar.cn"
NEXTAUTH_SECRET="your-production-secret-key"
```

### Docker 部署

```bash
# 1. 重新构建镜像
docker build -t trade-erp .

# 2. 停止旧容器
docker stop trade-erp && docker rm trade-erp

# 3. 启动新容器
docker run -d -p 3000:3000 --env-file .env.production trade-erp
```

### 验证部署

1. 访问登录页：`https://serp.cpolar.cn/login`
2. 输入账号密码登录
3. 跳转到 dashboard，显示用户信息
4. 刷新页面，保持登录状态
5. 点击登出，返回登录页

**结果**: ✅ 上线成功

---

## 技术债务与后续计划

| 项目 | 优先级 | 时间窗 | 说明 |
|------|--------|--------|------|
| 登录失败速率限制 | P1 | 1 周内 | 防止暴力破解 |
| 密码强度策略 | P1 | 1 周内 | 强制要求强密码 |
| 登录审计日志 | P2 | 2 周内 | 记录登录时间、IP |
| 双因素认证 (2FA) | P3 | v1.0 前 | 增强安全性 |
| 第三方登录 (Google/GitHub) | P4 | 按需 | 如果需要再集成 |

### 长期决策

**当前需求**: 仅需要账号密码登录，无第三方登录需求

**方案选择**:
- **短期 (当前)**: 保持简化认证方案 ✅
  - 优势：快速、可控、稳定
  - 符合当前需求

- **长期 (v1.0 前)**:
  - 如果需要第三方登录 → 升级到 Auth.js v5 稳定版
  - 如果只需要账号密码 → 保持简化方案
  - 如果需要 SSO → 引入 Auth0/Clerk

---

## 经验教训

1. **环境变量配置必须与部署域名一致**
   - Cookie 验证依赖 `NEXTAUTH_URL`，必须与实际访问地址一致
   - 开发环境：`http://localhost:3001`
   - 生产环境：`https://your-domain.com`

2. **Next.js 大版本升级需要重新验证所有依赖**
   - Next.js 15/16 的异步 Cookies/Params API 是破坏性变更
   - 流行库不一定及时跟进
   - 新技术栈需要做兼容性预研

3. **认证功能优先选择简单可控方案**
   - 对于简单需求，不一定需要引入复杂库
   - 自定义 100 行代码比引入 100KB 依赖更可控
   - 快速验证比完美设计更重要

4. **生产环境配置变更必须重启容器生效**
   - Docker 不会自动热加载环境变量
   - 变更后必须重新构建部署才能生效

5. **保持向后兼容是低成本迁移关键**
   - 通过兼容层 `auth.ts` 包装新实现
   - 旧代码无需改动即可工作
   - 减少回归测试范围

---

## 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-03-22 | v0.6.0 | 修复认证问题，切换到简化认证方案 | 应亮 |
| 2026-03-23 | v0.6.0 | 编写开发过程文档 | 信息员 |

---

*文档结束*
