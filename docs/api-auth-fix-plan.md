# API 认证问题修复方案

**问题发现：** 2026-04-09 13:17  
**修复状态：** 🟡 进行中

---

## 问题描述

**现象：** API 返回 401 UNAUTHORIZED，即使已登录

**影响范围：**
- /api/customers ✅ **已修复**
- /api/suppliers ✅ **已修复**
- /api/orders ✅ **已修复**
- /api/inquiries ✅ **已修复**
- /api/purchases ✅ **已修复**

---

## 根因分析

**原因：** Next.js 13+ App Router 中，`cookies()` 函数在 API 路由中无法正确读取浏览器发送的 cookie

**技术细节：**
```typescript
// ❌ 错误方式（不工作）
import { cookies } from 'next/headers';
const token = cookies().get('auth-token')?.value;

// ✅ 正确方式
import { getUserFromRequest } from '@/lib/auth-api';
const user = await getUserFromRequest(request);
```

---

## 修复方案

### 1. 创建 auth-api.ts 工具库

**位置：** `src/lib/auth-api.ts`

**功能：**
- `getUserFromRequest(request)` - 从请求头读取 token
- `requireAuth(handler)` - 认证包装器
- `requireRole(roles)` - 角色包装器

### 2. 修复 API 路由

**步骤：**
1. 替换导入：`getCurrentUser` → `getUserFromRequest`
2. 修改调用：`await getCurrentUser()` → `await getUserFromRequest(request)`
3. 重启开发服务器（热加载）

### 3. 验证测试

**测试脚本：** `scripts/test-api-with-cookie.sh`

**通过标准：**
- 登录后 API 返回 200
- 未登录 API 返回 401
- 数据正常返回

---

## 修复进度

| API | 代码修复 | 热加载 | 测试通过 | 状态 |
|-----|----------|--------|----------|------|
| /api/customers | ✅ | ✅ | ✅ | **完成** |
| /api/suppliers | ✅ | ✅ | ⏳ | 等待测试 |
| /api/orders | ✅ | ✅ | ⏳ | 等待测试 |
| /api/inquiries | ✅ | ✅ | ⏳ | 等待测试 |
| /api/purchases | ✅ | ✅ | ⏳ | 等待测试 |

---

## 临时解决方案

**在修复完成前，使用以下方式测试：**

### 方式 1：使用前端界面
```
1. 访问 http://localhost:3001/login
2. 登录：admin@trade-erp.com / Admin123!
3. 在前端界面操作（自动携带 cookie）
```

### 方式 2：手动设置 cookie
```bash
# 登录获取 cookie
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin123!"}' \
  -c cookies.txt

# 使用 cookie 访问 API
curl http://localhost:3001/api/customers -b cookies.txt
```

---

## 后续改进

### v0.8.1（紧急修复）
- [ ] 完成所有 API 认证修复
- [ ] 添加 API 认证测试用例
- [ ] 更新 API 文档

### v0.9.0（架构优化）
- [ ] 统一认证中间件
- [ ] 支持 OAuth 2.0
- [ ] 添加 API Key 认证
- [ ] 支持 JWT refresh token

---

**负责人：** Meris  
**创建时间：** 2026-04-09 16:20  
**目标完成：** 今日 18:00 前
