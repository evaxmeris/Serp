# RBAC 角色权限系统 - 访问流程设计

**文档版本:** v1.0  
**创建日期:** 2026-04-11  
**作者:** ERP 系统架构师  
**状态:** ✅ 设计完成

---

## 目录

1. [概述](#1-概述)
2. [用户访问流程](#2-用户访问流程)
3. [功能入口规划](#3-功能入口规划)
4. [菜单结构优化](#4-菜单结构优化)
5. [路由设计](#5-路由设计)
6. [权限控制策略](#6-权限控制策略)
7. [未授权访问处理](#7-未授权访问处理)
8. [实施清单](#8-实施清单)

---

## 1. 概述

### 1.1 设计目标

为 Trade ERP 系统的 RBAC 角色权限功能提供完整的用户访问流程和功能入口规划，确保：
- ✅ 管理员能够方便地管理角色和权限
- ✅ 普通用户能够查看自己的权限
- ✅ 未授权访问得到妥善处理
- ✅ 菜单结构清晰、易于导航

### 1.2 适用范围

- **系统版本:** Trade ERP v0.9.0+
- **涉及模块:** 角色管理、用户角色分配、权限查看
- **目标用户:** 系统管理员、普通用户

### 1.3 核心概念

| 概念 | 说明 |
|------|------|
| **角色 (Role)** | 权限的集合，如"业务员"、"采购员" |
| **权限 (Permission)** | 具体的操作授权，如 `order:create` |
| **用户角色分配** | 将角色分配给用户 |
| **系统管理员 (ADMIN)** | 拥有全部权限的超级用户 |

---

## 2. 用户访问流程

### 2.1 管理员访问流程

#### 2.1.1 角色管理访问流程

```mermaid
flowchart TD
    A[管理员登录] --> B{是否有<br/>ADMIN 角色？}
    B -->|否 | C[显示错误提示<br/>"无权限访问"]
    B -->|是 | D[点击侧边栏<br/>"系统管理" > "角色权限"]
    D --> E[进入角色管理页面<br/>/settings/roles]
    E --> F[查看角色列表]
    F --> G{操作类型}
    G -->|创建角色 | H[点击"新建角色"<br/>填写角色信息]
    G -->|编辑角色 | I[点击角色操作菜单<br/>选择"编辑"]
    G -->|分配权限 | J[点击"分配权限"<br/>勾选权限树]
    G -->|删除角色 | K[点击"删除"<br/>二次确认]
    H --> L[保存并提交]
    I --> L
    J --> L
    K --> L
    L --> M{操作成功？}
    M -->|是 | N[显示成功提示<br/>刷新列表]
    M -->|否 | O[显示错误信息<br/>保留表单]
    N --> F
    O --> F
```

#### 2.1.2 用户角色分配流程

```mermaid
flowchart TD
    A[管理员登录] --> B[点击侧边栏<br/>"系统管理" > "用户管理"]
    B --> C[进入用户管理页面<br/>/settings/users]
    C --> D[查看用户列表]
    D --> E[选择目标用户]
    E --> F[点击"分配角色"按钮]
    F --> G[弹出角色分配对话框]
    G --> H[勾选要分配的角色]
    H --> I[保存并提交]
    I --> J{操作成功？}
    J -->|是 | K[显示成功提示<br/>更新用户列表]
    J -->|否 | L[显示错误信息]
    K --> D
    L --> G
```

### 2.2 普通用户访问流程

#### 2.2.1 查看个人权限流程

```mermaid
flowchart TD
    A[用户登录] --> B[点击头像下拉菜单]
    B --> C[选择"个人资料"]
    C --> D[进入个人资料页面<br/>/profile]
    D --> E[查看"我的权限"标签页]
    E --> F[查看已分配角色列表]
    F --> G[查看角色对应的权限详情]
    G --> H[权限说明<br/>只读不可修改]
```

#### 2.2.2 通过菜单发现权限

```mermaid
flowchart TD
    A[用户登录] --> B[系统根据用户角色<br/>过滤侧边栏菜单]
    B --> C[只显示用户有权限的菜单项]
    C --> D[用户点击菜单项]
    D --> E{是否有访问权限？}
    E -->|是 | F[正常访问页面]
    E -->|否 | G[显示 403 页面<br/>"无权限访问"]
    F --> H[继续使用系统]
    G --> H
```

### 2.3 完整用户旅程图

```
用户登录
    │
    ├─ 1. 身份验证
    │   └─ 成功 → 获取用户信息（包含角色）
    │   └─ 失败 → 返回登录页
    │
    ├─ 2. 权限加载
    │   └─ 根据角色加载用户权限列表
    │   └─ 缓存到 localStorage（前端）
    │
    ├─ 3. 菜单渲染
    │   └─ 根据权限过滤菜单项
    │   └─ 只显示有权限的菜单
    │
    ├─ 4. 页面访问
    │   └─ 前端路由守卫检查权限
    │   └─ 后端 API 中间件验证权限
    │
    └─ 5. 操作执行
        └─ 按钮级权限控制
        └─ 无权限按钮隐藏或禁用
```

---

## 3. 功能入口规划

### 3.1 角色管理入口

| 功能 | 入口位置 | 访问权限 | 说明 |
|------|---------|---------|------|
| **角色管理** | 侧边栏 → 系统管理 → 角色权限 | ADMIN | 主入口，管理所有角色 |
| **创建角色** | 角色管理页面 → "新建角色"按钮 | ADMIN | 创建新角色 |
| **编辑角色** | 角色列表 → 操作菜单 → 编辑 | ADMIN | 修改角色信息 |
| **分配权限** | 角色列表 → 操作菜单 → 分配权限 | ADMIN | 为角色分配权限 |
| **删除角色** | 角色列表 → 操作菜单 → 删除 | ADMIN | 删除角色（系统角色不可删除） |

### 3.2 用户角色分配入口

| 功能 | 入口位置 | 访问权限 | 说明 |
|------|---------|---------|------|
| **用户管理** | 侧边栏 → 系统管理 → 用户管理 | ADMIN | 管理所有用户 |
| **分配角色** | 用户列表 → 操作菜单 → 分配角色 | ADMIN | 为用户分配角色 |
| **批量分配** | 用户列表 → 批量操作 → 分配角色 | ADMIN | 批量为多个用户分配角色 |

### 3.3 个人权限查看入口

| 功能 | 入口位置 | 访问权限 | 说明 |
|------|---------|---------|------|
| **个人资料** | 右上角头像 → 个人资料 | 所有用户 | 查看和编辑个人信息 |
| **我的权限** | 个人资料页面 → "我的权限"标签页 | 所有用户 | 查看自己的角色和权限（只读） |

### 3.4 入口布局图

```
┌─────────────────────────────────────────────────────────────┐
│  Trade ERP                                      [头像] ▼    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 侧边栏                                              │    │
│  │                                                     │    │
│  │ 📊 仪表盘                                           │    │
│  │                                                     │    │
│  │ 📦 基础资料                                         │    │
│  │   ├─ 客户管理                                       │    │
│  │   └─ 供应商管理                                     │    │
│  │                                                     │    │
│  │ 🛒 采购供应链                                       │    │
│  │                                                     │    │
│  │ 💰 销售订单                                         │    │
│  │                                                     │    │
│  │ 📦 仓储物流                                         │    │
│  │                                                     │    │
│  │ 📈 报表分析                                         │    │
│  │                                                     │    │
│  │ ⚙️ 系统管理  ←──────────┐                          │    │
│  │   ├─ 用户管理            │                          │    │
│  │   ├─ 角色权限  ←─────────┼────── 管理员可见         │    │
│  │   └─ 系统设置            │                          │    │
│  └─────────────────────────│───────────────────────────┘    │
│                            │                                  │
│                            ▼                                  │
│                    ┌─────────────┐                            │
│                    │ 角色管理页  │                            │
│                    │ /settings/  │                            │
│                    │ roles       │                            │
│                    └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘

用户点击头像下拉菜单：
┌─────────────────────┐
│ [头像] 张三         │
│ ─────────────────── │
│ 📋 个人资料         │ ← 所有用户可见
│ 🔑 我的权限         │ ← 所有用户可见
│ ─────────────────── │
│ 🚪 退出登录         │
└─────────────────────┘
```

---

## 4. 菜单结构优化

### 4.1 当前菜单结构（v0.9.0）

```
侧边栏
├── 📊 仪表盘
├── 📦 基础资料
│   ├── 客户管理
│   └─  供应商管理
├── 📦 产品管理
│   ├── 产品列表
│   ├── 品类管理
│   └── 属性模板
├── 🛒 采购供应链
│   ├── 采购入库
│   └── 采购管理
├── 💰 销售订单
│   ├── 订单管理
│   └── 报价管理
├── 📦 仓储物流
│   ├── 库存管理
│   └── 出库管理
├── 📈 报表分析
│   ├── 仪表盘
│   └── 报表中心
├── ⚙️ 系统管理  ← 已有分组
│   ├── 用户管理
│   └── 系统设置
└── 🔬 产品开发
    ├── 调研看板
    ├── 产品调研
    ├── 产品对比
    └── 数据导入
```

### 4.2 优化后菜单结构（v1.0）

```
侧边栏
├── 📊 仪表盘
├── 📦 基础资料
│   ├── 客户管理
│   └── 供应商管理
├── 📦 产品管理
│   ├── 产品列表
│   ├── 品类管理
│   └── 属性模板
├── 🛒 采购供应链
│   ├── 采购入库
│   └── 采购管理
├── 💰 销售订单
│   ├── 订单管理
│   └── 报价管理
├── 📦 仓储物流
│   ├── 库存管理
│   └── 出库管理
├── 📈 报表分析
│   ├── 仪表盘
│   └── 报表中心
├── ⚙️ 系统管理  ← 扩展
│   ├── 用户管理           ← 保持不变
│   ├── 角色权限  ←──────── 新增
│   └── 系统设置           ← 保持不变
└── 🔬 产品开发
    ├── 调研看板
    ├── 产品调研
    ├── 产品对比
    └── 数据导入
```

### 4.3 菜单配置代码（Sidebar.tsx）

```typescript
// 系统管理分组配置
{
  group: '系统管理',
  items: [
    {
      key: 'users',
      label: '用户管理',
      icon: User,
      href: '/settings/users',  // 修改：从 /users 改为 /settings/users
      roles: ['ADMIN'],
    },
    {
      key: 'roles',
      label: '角色权限',  // 新增
      icon: Shield,
      href: '/settings/roles',
      roles: ['ADMIN'],
    },
    {
      key: 'settings',
      label: '系统设置',
      icon: Settings,
      href: '/settings',
      roles: ['ADMIN'],
    },
  ],
}
```

### 4.4 菜单权限控制

| 菜单项 | 允许角色 | 说明 |
|--------|---------|------|
| 用户管理 | ADMIN | 仅管理员可见 |
| 角色权限 | ADMIN | 仅管理员可见 |
| 系统设置 | ADMIN | 仅管理员可见 |

---

## 5. 路由设计

### 5.1 路由结构

```
/app
└── /settings
    ├── /page.tsx              # 系统设置主页（业务设置 Tab）
    ├── /roles
    │   └── /page.tsx          # 角色管理页面 ⭐ 新增
    └── /users
        └── /page.tsx          # 用户角色分配页面 ⭐ 新增

/app
└── /profile
    └── /page.tsx              # 个人资料页面（包含"我的权限"Tab）
```

### 5.2 路由规划表

| 路由 | 页面名称 | 访问权限 | 功能描述 |
|------|---------|---------|---------|
| `/settings/roles` | 角色管理 | ADMIN | 角色 CRUD、权限分配 |
| `/settings/users` | 用户角色分配 | ADMIN | 用户列表、角色分配 |
| `/profile` | 个人资料 | 所有用户 | 个人信息、我的权限查看 |

### 5.3 路由守卫设计

#### 5.3.1 前端路由守卫（Middleware）

```typescript
// src/middleware/route-guard.ts
import { NextRequest, NextResponse } from 'next/server';

// 路由权限配置
const routePermissions: Record<string, string[]> = {
  '/settings/roles': ['role:view', 'role:manage'],
  '/settings/users': ['user:view', 'user:manage'],
  '/profile': ['profile:view'],
};

export function routeGuard(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // 获取用户权限（从 Cookie 或请求头）
  const userPermissions = getUserPermissionsFromRequest(request);
  
  // 检查路由是否需要权限
  const requiredPermissions = routePermissions[pathname];
  if (!requiredPermissions) {
    return NextResponse.next(); // 公开路由
  }
  
  // 检查用户是否有权限
  const hasPermission = requiredPermissions.some(perm => 
    userPermissions.includes(perm) || userPermissions.includes('*')
  );
  
  if (!hasPermission) {
    // 重定向到 403 页面
    return NextResponse.redirect(new URL('/403', request.url));
  }
  
  return NextResponse.next();
}
```

#### 5.3.2 后端 API 权限验证

```typescript
// src/middleware/permissions.ts
import { withPermission } from '@/middleware/permissions';

// 角色管理 API
export const GET = withPermission('role:view', async (request: NextRequest) => {
  // 获取角色列表
});

export const POST = withPermission('role:create', async (request: NextRequest) => {
  // 创建角色
});

// 用户角色分配 API
export const POST = withPermission('user:assign-role', async (request: NextRequest) => {
  // 分配用户角色
});
```

### 5.4 路由跳转逻辑

```typescript
// 用户登录后的路由跳转
function redirectAfterLogin(userRole: string) {
  if (userRole === 'ADMIN') {
    return '/dashboard'; // 管理员到仪表盘
  } else if (userRole === 'SALES') {
    return '/orders'; // 业务员到订单管理
  } else if (userRole === 'PURCHASING') {
    return '/purchases'; // 采购员到采购管理
  } else if (userRole === 'WAREHOUSE') {
    return '/inventory'; // 仓管员到库存管理
  } else {
    return '/dashboard'; // 默认到仪表盘
  }
}
```

---

## 6. 权限控制策略

### 6.1 三层权限控制架构

```
┌─────────────────────────────────────────────────────────┐
│ 第一层：菜单级权限控制                                   │
│ - 根据用户角色过滤侧边栏菜单                             │
│ - 无权限菜单项不显示                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 第二层：页面级权限控制                                   │
│ - 路由守卫检查用户权限                                   │
│ - 无权限访问重定向到 403 页面                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 第三层：操作级权限控制                                   │
│ - 按钮/表单级权限控制                                    │
│ - 无权限操作按钮隐藏或禁用                               │
│ - API 中间件验证权限                                     │
└─────────────────────────────────────────────────────────┘
```

### 6.2 权限代码规范

#### 6.2.1 权限代码格式

```
<模块>:<操作>

示例:
- role:view      # 查看角色
- role:create    # 创建角色
- role:edit      # 编辑角色
- role:delete    # 删除角色
- role:assign    # 分配权限

- user:view      # 查看用户
- user:edit      # 编辑用户
- user:assign-role  # 分配用户角色
```

#### 6.2.2 通配符支持

```typescript
// 权限匹配规则
'*'              // 全部权限（ADMIN 专用）
'role:*'         // 角色模块全部权限
'user:*'         // 用户模块全部权限
'order:*'        // 订单模块全部权限
```

### 6.3 前端权限工具函数

```typescript
// src/utils/permissions.ts

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(userPermissions: string[], permissionCode: string): boolean {
  return userPermissions.includes(permissionCode) || 
         userPermissions.includes('*') ||
         userPermissions.some(p => {
           // 支持通配符匹配
           if (p.endsWith(':*')) {
             const module = p.replace(':*', '');
             return permissionCode.startsWith(module + ':');
           }
           return false;
         });
}

/**
 * 检查用户是否有任何一个权限
 */
export function hasAnyPermission(userPermissions: string[], permissionCodes: string[]): boolean {
  return permissionCodes.some(code => hasPermission(userPermissions, code));
}

/**
 * 检查用户是否拥有所有权限
 */
export function hasAllPermissions(userPermissions: string[], permissionCodes: string[]): boolean {
  return permissionCodes.every(code => hasPermission(userPermissions, code));
}
```

### 6.4 前端组件权限控制

```typescript
// src/components/PermissionGuard.tsx
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/permissions';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { userPermissions } = useAuth();
  
  if (!hasPermission(userPermissions, permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// 使用示例
<PermissionGuard permission="role:create" fallback={<Button disabled>新建角色</Button>}>
  <Button>新建角色</Button>
</PermissionGuard>
```

### 6.5 默认角色权限分配

| 角色 | 权限代码列表 |
|------|-------------|
| **ADMIN** | `*` (全部权限) |
| **SALES** | `customer:*`, `order:*`, `quotation:*`, `inquiry:*`, `report:view` |
| **PURCHASING** | `supplier:*`, `product:*`, `purchase:*`, `inventory:view`, `report:view` |
| **WAREHOUSE** | `product:view`, `inventory:*`, `inbound:*`, `outbound:*`, `report:view` |
| **VIEWER** | `*:view`, `report:view` (所有只读权限) |

---

## 7. 未授权访问处理

### 7.1 未授权场景分类

| 场景 | 触发条件 | 处理方式 |
|------|---------|---------|
| **未登录访问** | 用户未登录直接访问受保护页面 | 重定向到登录页 |
| **权限不足** | 用户登录但无页面访问权限 | 显示 403 页面 |
| **API 无权限** | 前端调用无权限的 API | 返回 403 错误，前端提示 |
| **菜单隐藏** | 用户无某菜单项权限 | 菜单中不显示该项 |

### 7.2 403 页面设计

```typescript
// src/app/403/page.tsx
import { Shield, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function ForbiddenPage() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="text-center space-y-6">
        <Shield className="h-24 w-24 text-zinc-300 dark:text-zinc-700 mx-auto" />
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">
            403
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mt-2">
            无权限访问
          </p>
          <p className="text-zinc-500 dark:text-zinc-500 mt-4 max-w-md">
            您没有权限访问此页面。请联系系统管理员获取相应权限。
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => router.back()}>
            返回上一页
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            <Home className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 7.3 API 无权限响应

```typescript
// API 返回格式
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "您没有权限执行此操作",
    "details": {
      "requiredPermission": "role:create",
      "userRole": "SALES"
    }
  }
}

// 前端处理
async function handleApiError(error: ApiError) {
  if (error.code === 'PERMISSION_DENIED') {
    toast.error('您没有权限执行此操作，请联系管理员');
    // 可选：隐藏或禁用相关按钮
  }
}
```

### 7.4 权限申请流程（可选功能）

```mermaid
flowchart TD
    A[用户发现无权限] --> B[点击"申请权限"按钮]
    B --> C[填写权限申请表单]
    C --> D[选择需要的权限]
    D --> E[填写申请理由]
    E --> F[提交申请]
    F --> G[管理员收到通知]
    G --> H[管理员审核申请]
    H --> I{审核通过？}
    I -->|是 | J[为用户分配权限]
    I -->|否 | K[拒绝申请并填写理由]
    J --> L[通知用户申请结果]
    K --> L
    L --> M[流程结束]
```

---

## 8. 实施清单

### 8.1 后端实施

- [ ] 创建角色管理 API (`/api/roles`)
- [ ] 创建用户角色分配 API (`/api/user-roles`)
- [ ] 创建权限验证中间件 (`withPermission`)
- [ ] 实现权限缓存机制
- [ ] 初始化默认权限和角色
- [ ] 编写 API 测试用例

### 8.2 前端实施

- [ ] 创建角色管理页面 (`/settings/roles`)
- [ ] 创建用户角色分配页面 (`/settings/users`)
- [ ] 在个人资料页面添加"我的权限"Tab
- [ ] 更新侧边栏菜单配置（添加"角色权限"入口）
- [ ] 实现前端路由守卫
- [ ] 实现权限工具函数 (`hasPermission`)
- [ ] 创建权限守卫组件 (`PermissionGuard`)
- [ ] 创建 403 页面
- [ ] 编写前端 E2E 测试

### 8.3 数据迁移

- [ ] 执行数据库迁移（创建 RBAC 表）
- [ ] 运行权限初始化脚本
- [ ] 迁移现有用户角色数据
- [ ] 验证数据完整性

### 8.4 文档与培训

- [ ] 编写管理员使用手册
- [ ] 编写用户权限查看指南
- [ ] 录制操作演示视频
- [ ] 进行管理员培训

### 8.5 测试验证

- [ ] 单元测试（权限验证逻辑）
- [ ] 集成测试（API 权限控制）
- [ ] E2E 测试（完整用户流程）
- [ ] 性能测试（权限缓存效果）
- [ ] 安全测试（权限绕过测试）

---

## 附录

### A. 相关文件

| 文件 | 说明 |
|------|------|
| `workspace/documents/rbac/API_SPECIFICATION.md` | API 接口规范 |
| `workspace/documents/rbac/DATABASE_DESIGN.md` | 数据库设计 |
| `trade-erp/RBAC_ARCHITECTURE_REVIEW.md` | 架构验证报告 |
| `src/middleware/permissions.ts` | 权限中间件 |
| `src/components/Sidebar/Sidebar.tsx` | 侧边栏组件 |

### B. 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-11 | 初始版本，完成访问流程设计 | ERP 架构师 |

### C. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| RBAC | Role-Based Access Control | 基于角色的访问控制 |
| 权限 | Permission | 具体的操作授权 |
| 角色 | Role | 权限的集合 |
| 用户角色分配 | User Role Assignment | 将角色分配给用户 |

---

*文档结束*
