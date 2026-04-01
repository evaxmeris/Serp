# 安全漏洞修复记录 - P0 紧急修复

## 修复日期
2026-04-02

## 漏洞级别
P0 - 严重安全漏洞

## 漏洞描述
未登录用户可以直接访问：
- 所有管理页面（/dashboard、/users 等）
- 所有业务 API 接口，可以获取、修改、删除数据

**影响范围**：整个系统的所有业务数据都暴露给未认证访问。

## 根因分析
1. `src/middleware.ts` 原设计：API 路由完全放行，由各个路由自行处理认证
2. 实际开发中，大部分 API 路由（59/64）都没有添加认证检查
3. 导致严重的未授权访问漏洞

## 修复方案
修改 `src/middleware.ts`，增加全局 API 认证检查：

- `/api/auth/*` - 保持开放（登录、注册等）
- 所有其他 `/api/*` - 必须有 `auth-token` cookie，否则返回 401
- 页面路由保护原逻辑正确，保持不变

## 修复内容
```diff
  // API 路由的认证检查
  if (pathname.startsWith('/api/')) {
-   // API 认证由各个路由自行处理，中间件不拦截
-   return NextResponse.next();
+   // /api/auth/* 不需要认证（登录、注册等）
+   if (pathname.startsWith('/api/auth/')) {
+     return NextResponse.next();
+   }
+   // 所有其他 API 都需要认证
+   if (!authToken) {
+     return NextResponse.json(
+       { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
+       { status: 401 }
+     );
+   }
+   return NextResponse.next();
  }
```

## 验证
- ✅ TypeScript 编译通过
- ✅ Next.js 构建成功
- ✅ 未登录用户访问 `/dashboard` → 重定向 `/login`
- ✅ 未登录用户访问 `/users` → 重定向 `/login`
- ✅ 未登录用户调用 `/api/users` → 返回 401
- ✅ 未登录用户调用 `/api/customers` → 返回 401
- ✅ `/api/auth/login` 保持开放

## 安全改进
实现双重防护：
1. 中间件全局拦截 → 堵住大漏洞
2. 路由层面权限检查 → 精细权限控制（RBAC）

这样即使后续新增 API 忘记添加认证检查，中间件也会保护。
