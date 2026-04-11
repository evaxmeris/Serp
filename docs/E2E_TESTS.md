# 角色权限管理系统 E2E 测试

本文档包含 Playwright E2E 测试脚本和执行说明。

## 目录

- [1. 环境准备](#1-环境准备)
- [2. 测试数据准备脚本](#2-测试数据准备脚本)
- [3. Playwright 测试脚本](#3-playwright-测试脚本)
- [4. 测试执行命令](#4-测试执行命令)
- [5. CI/CD 集成](#5-cicd-集成)

---

## 1. 环境准备

### 1.1 安装依赖

```bash
cd trade-erp
npm install --save-dev @playwright/test playwright
```

### 1.2 安装浏览器

```bash
npx playwright install chromium
```

### 1.3 环境变量

创建 `.env.test` 文件：

```env
DATABASE_URL="postgresql://username:password@localhost:5432/trade_erp_test"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-test-secret-key"
NODE_ENV=test
PORT=3001
```

---

## 2. 测试数据准备脚本

### 2.1 脚本位置

`tests/e2e/setup/prepare-test-data.js`

### 2.2 脚本内容

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始准备测试数据...');

  // 1. 清理旧数据（按外键依赖顺序清理）
  await prisma.userRole.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.role.deleteMany({ where: { isSystem: false } });
  await prisma.permission.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.com' } } });

  console.log('旧数据清理完成');

  // 2. 创建基础权限点
  const permissions = [
    { name: 'system:roles:read', displayName: '查看角色列表', module: 'system' },
    { name: 'system:roles:create', displayName: '创建角色', module: 'system' },
    { name: 'system:roles:update', displayName: '更新角色', module: 'system' },
    { name: 'system:roles:delete', displayName: '删除角色', module: 'system' },
    { name: 'system:users:assign-role', displayName: '分配用户角色', module: 'system' },
    { name: 'products:read', displayName: '查看产品', module: 'products' },
    { name: 'products:create', displayName: '创建产品', module: 'products' },
    { name: 'products:update', displayName: '更新产品', module: 'products' },
    { name: 'products:delete', displayName: '删除产品', module: 'products' },
    { name: 'orders:read', displayName: '查看订单', module: 'orders' },
    { name: 'orders:create', displayName: '创建订单', module: 'orders' },
    { name: 'orders:approve', displayName: '审批订单', module: 'orders' },
  ];

  for (const p of permissions) {
    await prisma.permission.create({ data: p });
  }

  console.log(`创建了 ${permissions.length} 个权限点`);

  // 3. 创建测试角色
  const roles = [
    { name: 'sales_manager', displayName: '销售主管', description: '销售团队主管' },
    { name: 'sales_rep', displayName: '普通销售', description: '销售业务员' },
    { name: 'purchasing_manager', displayName: '采购主管', description: '采购团队主管' },
    { name: 'test_empty', displayName: '空权限角色', description: '用于测试' },
  ];

  for (const r of roles) {
    await prisma.role.create({ data: r });
  }

  console.log(`创建了 ${roles.length} 个测试角色`);

  // 4. 创建测试用户
  const users = [
    { email: 'admin@test.com', name: '系统管理员', passwordHash: '$2b$10$...' }, // 预设哈希
    { email: 'sales_manager@test.com', name: '张主管', passwordHash: '$2b$10$...' },
    { email: 'sales@test.com', name: '李四', passwordHash: '$2b$10$...' },
    { email: 'viewer@test.com', name: '王五', passwordHash: '$2b$10$...' },
  ];

  for (const u of users) {
    await prisma.user.create({ data: { ...u, isApproved: true } });
  }

  console.log(`创建了 ${users.length} 个测试用户`);

  // 5. 分配权限给销售主管（全部销售相关权限）
  const salesManager = await prisma.role.findUnique({ where: { name: 'sales_manager' } });
  const productPerms = await prisma.permission.findMany({ where: { module: 'products' } });
  const orderPerms = await prisma.permission.findMany({ where: { module: 'orders' } });

  for (const p of [...productPerms, ...orderPerms]) {
    await prisma.rolePermission.create({
      data: { roleId: salesManager.id, permissionId: p.id }
    });
  }

  // 6. 分配权限给普通销售（只读）
  const salesRep = await prisma.role.findUnique({ where: { name: 'sales_rep' } });
  const readPerm = await prisma.permission.findMany({ where: { name: { endsWith: ':read' } } });
  for (const p of readPerm) {
    await prisma.rolePermission.create({
      data: { roleId: salesRep.id, permissionId: p.id }
    });
  }

  // 7. 分配角色给用户
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
  const salesManagerUser = await prisma.user.findUnique({ where: { email: 'sales_manager@test.com' } });
  const salesUser = await prisma.user.findUnique({ where: { email: 'sales@test.com' } });

  const adminRole = await prisma.role.findFirst({ where: { name: 'admin', isSystem: true } });
  if (adminRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id }
    });
  }

  const salesManagerRole = await prisma.role.findUnique({ where: { name: 'sales_manager' } });
  await prisma.userRole.create({
    data: { userId: salesManagerUser.id, roleId: salesManagerRole.id }
  });

  const salesRepRole = await prisma.role.findUnique({ where: { name: 'sales_rep' } });
  await prisma.userRole.create({
    data: { userId: salesUser.id, roleId: salesRepRole.id }
  });

  console.log('角色分配完成');
  console.log('测试数据准备完成 ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 2.3 执行数据准备

```bash
# 设置环境变量
export $(cat .env.test | xargs)

# 运行准备脚本
node tests/e2e/setup/prepare-test-data.js
```

---

## 3. Playwright 测试脚本

### 3.1 测试配置

`playwright.config.ts`：

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3.2 认证帮助函数

`tests/e2e/helpers/auth.ts`：

```typescript
import { test as base } from '@playwright/test';

export async function login(page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('/dashboard');
}

export async function logout(page) {
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.waitForURL('/login');
}
```

### 3.3 角色管理测试

`tests/e2e/roles/role-management.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const TEST_USER = {
  email: 'admin@test.com',
  password: 'password123', // 测试密码
};

test.describe('角色管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/settings/roles');
  });

  test('应该成功创建新角色', async ({ page }) => {
    await page.getByRole('button', { name: '新建角色' }).click();
    await page.getByLabel('角色名称').fill('测试角色');
    await page.getByLabel('描述').fill('这是一个测试角色');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('创建成功')).toBeVisible();
    await expect(page.getByText('测试角色')).toBeVisible();
  });

  test('应该查看角色详情', async ({ page }) => {
    await page.getByText('销售主管').closest('tr').getByRole('button', { name: '查看' }).click();
    await expect(page.getByText('销售团队主管')).toBeVisible();
  });

  test('应该更新角色信息', async ({ page }) => {
    await page.getByText('销售主管').closest('tr').getByRole('button', { name: '编辑' }).click();
    await page.getByLabel('描述').fill('更新后的描述');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('更新成功')).toBeVisible();
    await expect(page.getByText('更新后的描述')).toBeVisible();
  });

  test('应该拒绝删除有用户关联的角色', async ({ page }) => {
    // 销售主管已关联用户
    await page.getByText('销售主管').closest('tr').getByRole('button', { name: '删除' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();

    await expect(page.getByText('该角色有用户关联，无法删除')).toBeVisible();
  });

  test('应该成功删除未关联用户的角色', async ({ page }) => {
    // 先创建一个新角色
    await page.getByRole('button', { name: '新建角色' }).click();
    await page.getByLabel('角色名称').fill('待删除角色');
    await page.getByRole('button', { name: '保存' }).click();

    // 然后删除
    await page.getByText('待删除角色').closest('tr').getByRole('button', { name: '删除' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();

    await expect(page.getByText('删除成功')).toBeVisible();
    await expect(page.getByText('待删除角色')).not.toBeVisible();
  });

  test('应该搜索角色', async ({ page }) => {
    await page.getByPlaceholder('搜索角色名称').fill('销售');
    await page.getByRole('button', { name: '搜索' }).click();

    await expect(page.getByText('销售主管')).toBeVisible();
    await expect(page.getByText('普通销售')).toBeVisible();
  });

  test('应该拒绝创建重复角色名称', async ({ page }) => {
    await page.getByRole('button', { name: '新建角色' }).click();
    await page.getByLabel('角色名称').fill('销售主管'); // 已存在
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('角色名称已存在')).toBeVisible();
  });
});
```

### 3.4 权限配置测试

`tests/e2e/roles/permission-config.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const TEST_USER = {
  email: 'admin@test.com',
  password: 'password123',
};

test.describe('权限配置功能', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/settings/roles');
  });

  test('应该为角色分配单个权限', async ({ page }) => {
    await page.getByText('空权限角色').closest('tr').getByRole('button', { name: '权限配置' }).click();
    await page.getByText('产品').uncheck();
    await page.getByText('查看产品').check();
    await page.getByRole('button', { name: '保存权限' }).click();

    await expect(page.getByText('权限保存成功')).toBeVisible();
  });

  test('勾选父节点应该选中所有子权限', async ({ page }) => {
    await page.getByText('空权限角色').closest('tr').getByRole('button', { name: '权限配置' }).click();

    await page.getByText('产品').check();

    // 验证所有子权限都被勾选
    await expect(page.getByText('查看产品')).toBeChecked();
    await expect(page.getByText('创建产品')).toBeChecked();
    await expect(page.getByText('更新产品')).toBeChecked();
    await expect(page.getByText('删除产品')).toBeChecked();
  });

  test('取消父节点应该取消所有子权限', async ({ page }) => {
    await page.getByText('销售主管').closest('tr').getByRole('button', { name: '权限配置' }).click();

    await page.getByText('产品').uncheck();

    // 验证所有子权限都被取消勾选
    await expect(page.getByText('查看产品')).not.toBeChecked();
    await expect(page.getByText('创建产品')).not.toBeChecked();
  });

  test('应该清空所有权限', async ({ page }) => {
    await page.getByText('销售主管').closest('tr').getByRole('button', { name: '权限配置' }).click();
    await page.getByRole('button', { name: '清空全部' }).click();
    await page.getByRole('button', { name: '确认清空' }).click();

    const allCheckboxes = page.getByRole('checkbox');
    const count = await allCheckboxes.count();
    for (let i = 0; i < count; i++) {
      await expect(allCheckboxes.nth(i)).not.toBeChecked();
    }
  });
});
```

### 3.5 用户角色分配测试

`tests/e2e/roles/user-role-assign.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const TEST_USER = {
  email: 'admin@test.com',
  password: 'password123',
};

test.describe('用户角色分配功能', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/settings/users');
  });

  test('应该为用户分配角色', async ({ page }) => {
    await page.getByText('sales@test.com').closest('tr').getByRole('button', { name: '分配角色' }).click();
    await page.getByText('销售主管').check();
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('保存成功')).toBeVisible();
  });

  test('应该移除用户的角色', async ({ page }) => {
    await page.getByText('sales@test.com').closest('tr').getByRole('button', { name: '分配角色' }).click();
    await page.getByText('普通销售').uncheck();
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('保存成功')).toBeVisible();
  });

  test('应该批量分配角色', async ({ page }) => {
    await page.getByRole('checkbox', { name: '选择所有' }).check();
    await page.getByRole('button', { name: '批量分配角色' }).click();
    await page.getByText('普通销售').check();
    await page.getByRole('button', { name: '确认分配' }).click();

    await expect(page.getByText('分配成功')).toBeVisible();
  });
});
```

### 3.6 权限验证测试

`tests/e2e/roles/permission-validation.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const SALES_USER = {
  email: 'sales@test.com',
  password: 'password123',
};

test.describe('权限验证', () => {
  test('有权限应该可以访问', async ({ page }) => {
    await login(page, SALES_USER.email, SALES_USER.password);

    // 普通销售有 products:read 权限
    await page.goto('/products');
    await expect(page).toHaveURL('/products');
    await expect(page.getByText('产品列表')).toBeVisible();
  });

  test('无权限应该不能访问', async ({ page }) => {
    await login(page, SALES_USER.email, SALES_USER.password);

    // 普通销售没有角色管理权限
    await page.goto('/settings/roles');

    await expect(page.getByText('权限不足')).toBeVisible();
  });

  test('无权限应该不显示菜单', async ({ page }) => {
    await login(page, SALES_USER.email, SALES_USER.password);

    // 侧边栏不应该显示系统设置
    await expect(page.getByRole('link', { name: '角色管理' })).not.toBeVisible();
  });

  test('无权限应该不显示操作按钮', async ({ page }) => {
    await login(page, SALES_USER.email, SALES_USER.password);
    await page.goto('/products');

    // 只有查看权限，不显示删除按钮
    await expect(page.getByRole('button', { name: '删除' }).first()).not.toBeVisible();
  });
});
```

### 3.7 安全测试

`tests/e2e/roles/security.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';

test.describe('安全测试', () => {
  test('未登录应该重定向到登录页', async ({ page }) => {
    await page.goto('/settings/roles');
    await expect(page).toHaveURL(/login/);
  });
});
```

---

## 4. 测试执行命令

### 4.1 本地执行

```bash
# 1. 准备测试数据库
createdb trade_erp_test

# 2. 运行迁移
export $(cat .env.test | xargs)
npx prisma migrate deploy

# 3. 准备测试数据
node tests/e2e/setup/prepare-test-data.js

# 4. 启动开发服务器
npm run dev -- -p 3001 &

# 5. 运行所有 E2E 测试
npx playwright test

# 6. 查看测试报告
npx playwright show-report
```

### 4.2 运行单个测试文件

```bash
npx playwright test tests/e2e/roles/role-management.spec.ts
```

### 4.3 调试模式（打开浏览器）

```bash
npx playwright test --headed --debug
```

### 4.5 生成测试覆盖率

```bash
# 如果需要覆盖率
npx playwright test --coverage
```

---

## 5. CI/CD 集成

### 5.1 GitHub Actions 配置

`.github/workflows/e2e-role-permission.yml`：

```yaml
name: E2E Tests - Role Permission

on:
  push:
    branches: [ main ]
    paths:
      - '**/role**'
      - '**/permission**'
  pull_request:
    branches: [ main ]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Start PostgreSQL
        uses: postgres-actions/postgres@v1
        with:
          postgres-user: postgres
          postgres-password: postgres
          postgres-database: trade_erp_test

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Run migration
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/trade_erp_test

      - name: Prepare test data
        run: node tests/e2e/setup/prepare-test-data.js
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/trade_erp_test

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/trade_erp_test

      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: http://localhost:3000
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/trade_erp_test

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## 6. 故障排查

### 常见问题

**问题 1**: 数据库连接失败
```
解决方案：检查 DATABASE_URL 环境变量，确保数据库已创建并且可访问
```

**问题 2**: 测试数据准备脚本密码哈希错误
```
解决方案：使用 bcrypt 预生成密码哈希，替换到脚本中
```

**问题 3**: 元素找不到
```
解决方案：增加测试等待，使用 page.waitForSelector 确认元素加载完成
```

**问题 4**: CSRF token 验证失败
```
解决方案：Playwright 测试默认会携带 cookies，确保测试环境配置正确
```

---

## 测试清单

- [ ] 测试数据准备脚本执行成功
- [ ] 角色管理测试全部通过
- [ ] 权限配置测试全部通过
- [ ] 用户角色分配测试全部通过
- [ ] 权限验证测试全部通过
- [ ] 安全测试全部通过
- [ ] CI/CD 集成正常

---

*文档创建时间：2026-04-11*
