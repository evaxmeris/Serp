# Trade ERP 前端层 UI/UX 审计报告

> 审计日期：2026-04-26
> 审计范围：src/app/ 下所有 page.tsx (42 个页面) + src/components/ 下所有核心组件 (31 个组件)
> 审计人：AI 审计 Agent

---

## 目录

1. [用户界面流程](#一用户界面流程)
2. [组件复用和代码重复](#二组件复用和代码重复)
3. [前端表单验证](#三前端表单验证)
4. [错误处理和加载状态](#四错误处理和加载状态)
5. [用户体验问题](#五用户体验问题)
6. [响应式设计和移动端适配](#六响应式设计和移动端适配)
7. [安全问题](#七安全问题)
8. [总结与建议](#八总结与建议)

---

## 一、用户界面流程

### 1.1 导航结构混乱 - 【高】

**文件**: `src/components/Sidebar/Sidebar.tsx` (line 63-243)

**问题**: 菜单配置存在重复和不一致：
- "仪表盘" 同时出现在 `报表分析` 分组（href: `/dashboard`）和 `产品开发` 分组（href: `/product-research/dashboard`），key 都是 `'dashboard'`，导致 key 冲突。
- "产品列表" 同时出现在 `产品管理`（href: `/products`）和 `产品开发`（href: `/product-research/products`），key 都是 `'products'`。
- `/settings` 下同时有独立的 `roles` 和 `users` 子页面路由（`/settings/roles`, `/settings/users`），但菜单中 users 直接指向 `/users`，路径不一致。

**建议**: 
- 为所有菜单项设置唯一的 key。
- 统一 Settings 相关页面的路由结构，要么全部在 `/settings/*` 下，要么独立。
- 使用嵌套子菜单处理"产品调研"和"正式产品"的区分，避免同级并列造成的困惑。

### 1.2 根页面 (/) 是开发进度展示而非仪表盘 - 【中】

**文件**: `src/app/page.tsx`

**问题**: 根页面展示的是 Sprint 开发进度、快捷入口等"项目展示"内容，而不是 ERP 系统的业务仪表盘。`/dashboard` 才是真正的经营看板。用户首次登录看到的是开发进度而不是业务数据。

**建议**:
- 将 `/` 重定向到 `/dashboard`，或将当前 `/` 的内容迁移到一个独立的 `/about` 或 `/dev-progress` 页面。
- 根页面应作为登录后默认的业务首页。

### 1.3 表单提交流程缺少草稿保存 - 【中】

**文件**: `src/app/orders/new/page.tsx`, `src/app/purchase-orders/new/page.tsx`

**问题**: 订单、采购订单、报价等创建表单都是单步提交，没有草稿自动保存机制。用户填写大量信息后如果意外关闭页面，数据全部丢失。

**建议**:
- 实现 `localStorage` 自动草稿保存，页面恢复时提示"检测到未完成的草稿"。
- 对于复杂的订单表单（多商品明细），考虑分步表单（Stepper）。

### 1.4 客户/供应商详情页缺失 - 【低】

**文件**: `src/app/customers/page.tsx`, `src/app/suppliers/page.tsx`

**问题**: 客户列表页的"查看"按钮（line 444-447）没有 `href`，只是一个空壳按钮。供应商有 `/suppliers/[id]/page.tsx` 但客户没有对应的详情页路由。

**建议**:
- 为"查看"按钮添加正确的路由或实现内联展开。
- 补全客户详情页路由。

### 1.5 询盘/采购单/发货单新建功能内联在 Dialog 中 - 【中】

**文件**: 
- `src/app/purchases/page.tsx` (line 256-434, 新建对话框)
- `src/app/inquiries/page.tsx` (line 289-399, 新建对话框)
- `src/app/shipments/page.tsx` (line 312-423, 编辑对话框)

**问题**: 新建/编辑表单嵌套在 Dialog 中，当表单字段较多时，Dialog 内的滚动体验很差，而且 Dialog 尺寸受限。采购单新建包含供应商选择、币种、交货日期、多产品明细行等复杂表单，挤在一个 Dialog 内不适宜。

**建议**:
- 新建/编辑复杂实体应使用独立页面（如 `/purchases/new`），而非 Dialog。
- Dialog 仅适合简单操作（确认删除、快速编辑 1-2 个字段）。

---

## 二、组件复用和代码重复

### 2.1 状态/颜色映射大量重复 - 【高】

**发现于多个文件**:
- `src/app/orders/page.tsx` (line 51-61): ORDER_STATUS_OPTIONS
- `src/app/purchase-orders/page.tsx` (line 60-78): PO_STATUS + STATUS_COLORS
- `src/app/inbound-orders/page.tsx` (line 62-82): INBOUND_TYPE + INBOUND_STATUS + STATUS_COLORS
- `src/app/outbound-orders/page.tsx` (line 78-94): OUTBOUND_STATUS + STATUS_COLORS
- `src/app/purchases/page.tsx` (line 66-84): PURCHASE_STATUS + STATUS_COLORS
- `src/app/inquiries/page.tsx` (line 239-281): 4 个独立的 Record 映射
- `src/app/product-research/products/page.tsx` (line 107-120): STATUS_MAP + CONCLUSION_MAP

**问题**: 同一个实体（如订单状态）的 label/color 映射在多个页面中重复定义，颜色值也各不相同（同一状态在不同页面用不同颜色）。

**建议**:
- 提取到统一的 `src/lib/status-config.ts`，导出 `getStatusConfig(entityType, status)` 函数。
- 确保同一状态在所有页面使用一致的颜色语义。

### 2.2 分页组件重复 - 【高】

**发现于至少 12 个列表页面**:
- orders, purchase-orders, inbound-orders, outbound-orders, purchases, customers, suppliers, inquiries, shipments, inventory, products, product-research/products

**问题**: 每个页面都手写相同的分页 UI（上一页/下一页按钮 + 页码信息），代码几乎完全相同但分散在各处。

**建议**:
- 提取 `src/components/ui/pagination.tsx` 通用分页组件，接受 `page`, `totalPages`, `total`, `onPageChange` props。

### 2.3 加载/空状态重复 - 【中】

**问题**: 几乎每个页面都有相同的 `加载中...` 和 `暂无数据` 文本，但没有统一的 Skeleton 或 EmptyState 组件。

**建议**:
- 创建 `src/components/ui/skeleton-table.tsx` 和 `src/components/ui/empty-state.tsx` 组件。

### 2.4 全选/批量选择逻辑重复 - 【中】

**发现于**: orders, customers, products, outbound-orders, inquiries, product-research/products

**问题**: `toggleSelectAll`, `toggleSelect`, `selectedIds` (Set<string>) 的逻辑在 6+ 个页面中复制粘贴。

**建议**:
- 创建自定义 Hook `useBulkSelection(items: string[])` 返回 `{ selectedIds, toggleSelect, toggleSelectAll, clearSelection }`。

### 2.5 供应商数据获取逻辑重复 - 【中】

**发现于**:
- `src/app/purchase-orders/page.tsx` (line 107-118)
- `src/app/purchase-orders/new/page.tsx` (line 140-151)
- `src/app/orders/[id]/page.tsx` (line 82-98)
- `src/app/purchases/page.tsx` (line 146-157)
- `src/app/inbound-orders/page.tsx` (line 127-140)

**问题**: `fetch('/api/v1/suppliers')` 的处理逻辑（含 `result?.data` vs `result?.data?.items` 的双重适配）在 5+ 个页面中重复。

**建议**:
- 创建 `useSuppliers()` hook 或 `fetchSuppliers()` 工具函数。

### 2.6 搜索 + 筛选栏布局重复 - 【中】

**问题**: 几乎所有列表页都有类似的搜索框 + 状态筛选 + 供应商筛选 + 搜索按钮的布局，每个页面都手写一遍。

**建议**:
- 提取 `FilterBar` 组件，支持 search + select filters + search/reset buttons。

### 2.7 报表页面大量使用原始 HTML 元素 - 【中】

**文件**: 
- `src/app/reports/page.tsx` (line 193-210): 使用 `<button>` 而非 `<Button>`
- `src/app/reports/dashboard/page.tsx` (line 89-98, 111): 使用 `<select>` 而非 `<Select>`，使用 `<div>` 而非 `<Card>`
- `src/app/reports/sales/page.tsx` (line 100-151): 大量使用原生 `<select>`, `<input>`, `<table>`, `<button>` 而非 shadcn/ui 组件

**问题**: 报表系列页面未使用项目的 UI 组件库，视觉风格与主系统不一致。

**建议**:
- 将所有报表页面迁移到 shadcn/ui 组件（Button, Card, Select, Table）。

---

## 三、前端表单验证

### 3.1 部分页面完全没有前端验证 - 【高】

**文件**:
- `src/app/customers/page.tsx` (line 148-176): 客户创建无任何验证
- `src/app/inquiries/page.tsx` (line 208-237): 询盘创建无验证
- `src/app/purchases/page.tsx` (line 194-223): 采购单创建无验证
- `src/app/shipments/page.tsx` (line 165-195): 发货编辑无验证
- `src/app/inventory/page.tsx` (line 166-194): 库存调整无验证
- `src/app/users/page.tsx` (line 232-250): 用户创建无验证

**问题**: 这些页面的表单提交直接发送 API 请求，依赖后端验证，前端没有任何检查。用户输入无效数据后需要等待网络往返才知道错误。

**建议**:
- 统一使用 `react-hook-form` + `zod` 进行表单验证（如 orders/new 页面已正确使用）。
- 至少添加必填字段检查和基本格式验证。

### 3.2 登录/注册页面验证方式不统一 - 【低】

**文件**:
- `src/app/login/page.tsx` (line 13-25): 使用手动 validateForm 函数
- `src/app/register/page.tsx`: 使用内联检查（无统一验证函数）

**问题**: 登录页有验证函数，注册页直接内联检查，且两处的密码规则不一致（登录要求 6 位，注册要求 8 位+复杂度）。

**建议**:
- 提取共享的 auth 验证 schema。

### 3.3 Profile 页面的"保存"按钮无效 - 【高】

**文件**: `src/app/profile/page.tsx` (line 164-167, 207-223)

**问题**: `handleSave()` 函数只设置 `saved` 状态并显示"已保存"动画，但**没有实际调用任何 API 保存数据**。所有表单字段使用 `defaultValue` 而非受控模式，数据变更不会被收集。

**建议**:
- 实现真实的 API 调用。
- 将 `defaultValue` 改为受控的 `value` + `onChange`。

### 3.4 Settings 页面的"保存设置"按钮同样无效 - 【高】

**文件**: `src/app/settings/page.tsx` (line 175-178)

**问题**: `handleSave()` 和 Profile 页面一模一样——只显示动画，不调用 API。

**建议**:
- 实现各 Tab 下的真实数据持久化。

### 3.5 采购单 Dialog 表单没有加载态 - 【中】

**文件**: `src/app/purchases/page.tsx` (line 430-432)

**问题**: 创建按钮没有 `disabled={creating}` 状态，用户可能多次点击导致重复提交。

**建议**:
- 添加 `disabled={creating}` 和加载文案。

### 3.6 客户编辑没有前端验证 - 【中】

**文件**: `src/app/customers/page.tsx` (line 217-239)

**问题**: `handleUpdate()` 直接发送请求，没有任何表单验证。

---

## 四、错误处理和加载状态

### 4.1 大量使用原生 alert() - 【高】

**发现于 15+ 个页面**:
- orders (line 154, 157, 126-131)
- orders/[id] (line 123, 134, 153, 171, 214, 219)
- orders/[id]/edit (line 116-120)
- inbound-orders (line 163, 166, 170, 186, 189, 193)
- outbound-orders (line 171, 174, 178, 194, 197, 201, 231, 235, 251, 258, 262, 270, 274, 288, 297, 301, 309, 336, 341)
- purchases/[id] (大量 alert)
- inventory (line 177, 188, 192)
- shipments (line 185, 189, 193)
- product-research/products (line 276, 280, 294, 298, 302, 321, 354, 359, 372, 384, 387, 391, 398, 400, 416, 434, 438)
- orders/new (line 126-131)
- users (line 337, 340, 343, 361, 367, 370, 494, 498)
- approvals (line 99, 102, 105, 122, 135, 139, 142)
- settings (line 146, 150, 153)

**问题**: `alert()` 是阻塞式弹窗，破坏用户体验，且在移动端表现糟糕。项目中已经有 `useToast` hook（在 customers, suppliers, purchases, inquiries 中正确使用），但大多数页面仍在使用 `alert()`。

**建议**:
- 统一迁移到 `useToast` / `useToast` 组件。
- 成功操作用 `toast.success()`，错误用 `toast.error()`，警告用 `toast.warning()`。

### 4.2 大量使用原生 confirm() - 【中】

**发现于 8+ 个页面**:
- orders (line 149)
- orders/[id] (line 153)
- inbound-orders (line 152, 175)
- outbound-orders (line 160, 183, 235, 274)
- inquiries (line 131, 154)
- product-research/products (line 280, 372)
- users (line 285, 328)
- approvals (line 86)

**问题**: `confirm()` 同样是阻塞式原生弹窗，样式无法自定义，移动端体验差。

**建议**:
- 使用自定义确认对话框组件（如已有 `Dialog` 组件可用于此目的）。

### 4.3 加载状态不一致 - 【中】

**问题**: 
- 部分页面使用骨架屏/加载 spinner（如 reports 的 spinner）
- 部分页面只显示文字 "加载中..."（orders, customers, suppliers 等）
- 部分页面没有任何加载反馈（部分报表页面）
- Dashboard 页的 loading 覆盖整个 viewport（`h-[calc(100vh-100px)]`），但内容区域实际不需要占满全屏

**建议**:
- 统一使用 `Skeleton` 组件作为加载态。
- 列表页使用表格骨架屏，详情页使用卡片骨架屏。

### 4.4 错误状态处理不完整 - 【中】

**问题**:
- 许多页面的 `catch` 块只 `console.error`，不向用户展示任何错误信息（如 `fetchSuppliers` 在 purchase-orders/new 中）
- 部分页面设置 error state 但不渲染（如 suppliers 的 fetchSuppliers）
- 报表页面完全无错误处理（仅 console.error）

**建议**:
- 所有 API 调用应有 `try/catch` + 用户可见的错误提示。
- 统一使用 toast 或 inline error banner。

### 4.5 删除操作缺少 loading 状态 - 【中】

**文件**: 
- `src/app/orders/page.tsx` (line 148-159): 删除使用 `confirm()` + `alert()`，无 loading
- `src/app/inquiries/page.tsx` (line 153-170): 单条删除无 loading（批量有）

**问题**: 用户点击删除后没有视觉反馈，可能误以为没点上而重复点击。

---

## 五、用户体验问题

### 5.1 缺少操作成功/失败反馈 - 【高】

**文件**: 多处
- `src/app/orders/new/page.tsx` (line 126): 成功用 `alert('订单创建成功')`，但 `alert` 在移动端体验极差
- `src/app/users/page.tsx` (line 242-249): 创建用户成功后无任何用户反馈
- `src/app/inquiries/page.tsx` (line 220-223): 创建询盘成功后静默关闭 Dialog，无反馈

**问题**: 许多操作成功后用户得不到明确反馈。

**建议**: 统一使用 toast 通知。

### 5.2 客户列表"查看"按钮无功能 - 【高】

**文件**: `src/app/customers/page.tsx` (line 440-447)

**问题**: "查看"按钮没有 `onClick` 和 `href`，点击无任何反应。

**建议**: 添加客户详情路由或实现内联详情展开。

### 5.3 空状态缺少引导操作 - 【中】

**文件**: 
- `src/app/orders/page.tsx` (line 379-383): "暂无订单数据" — 无操作引导
- `src/app/customers/page.tsx` (line 475-479): "暂无客户数据" — 无操作引导
- `src/app/purchase-orders/page.tsx` (line 296-300): "暂无采购订单数据" — 无操作引导
- `src/app/inventory/page.tsx` (line 359-362): "暂无数据" — 无操作引导
- `src/app/inbound-orders/page.tsx` (line 287-291): "暂无数据" — 无操作引导

**问题**: 空状态仅显示文字，没有引导用户创建第一条记录的操作按钮。

**建议**: 空状态应包含描述性文字 + 操作按钮（如"暂无订单，[创建第一个订单]"）。

### 5.4 搜索体验不一致 - 【中】

**问题**:
- 部分页面搜索输入时自动触发（quotations 使用防抖 300ms）
- 部分页面需要按回车或点击"搜索"按钮（inbound-orders, shipments, inventory）
- 部分页面 onChange 就触发（customers, products）

**建议**: 统一搜索行为。建议：搜索框输入使用防抖自动搜索 + 提供"搜索"按钮用于立即触发。

### 5.5 表单提交成功后无路由跳转 - 【中】

**文件**: 
- `src/app/purchases/page.tsx` (line 194-223): 创建成功后只关闭 Dialog + 刷新列表，无路由变化
- `src/app/inquiries/page.tsx` (line 208-237): 同上
- `src/app/users/page.tsx` (line 232-250): 创建用户后无反馈

**问题**: 对于创建重要实体（订单、采购单），成功后的路由跳转给用户更明确的成功感。

### 5.6 缺少撤销操作机制 - 【低】

**问题**: 删除、取消等操作都是即时生效的，没有"撤销"窗口。

**建议**: 对非关键删除操作考虑添加 toast + 5秒内可撤销的机制。

### 5.7 Profile 页面偏好设置只读 - 【中】

**文件**: `src/app/profile/page.tsx` (line 382-422)

**问题**: "个人偏好" Tab 下所有设置（默认币种、通知偏好、时区、主题）都是静态展示，没有编辑功能。

**建议**: 实现实际的偏好设置编辑和保存。

### 5.8 Test 页面不应出现在生产环境 - 【低】

**文件**: `src/app/test/page.tsx`

**问题**: 一个简单的服务器测试页面不应存在于生产代码中。

**建议**: 删除或移至开发环境专属路径。

---

## 六、响应式设计和移动端适配

### 6.1 数据表格无移动端适配 - 【高】

**文件**: 几乎所有列表页面

**问题**: 所有列表页都使用 `<Table>` 组件展示数据，表格在移动端会水平溢出或被截断。虽然有部分页面加了 `overflow-x-auto`（如 reports/sales），但大部分列表页没有处理。

**具体问题**:
- `src/app/orders/page.tsx`: 12 列的表格在手机上完全无法使用
- `src/app/products/page.tsx`: 10+ 列表格
- `src/app/inquiries/page.tsx`: 11 列表格
- `src/app/suppliers/page.tsx`: 8+ 列表格

**建议**:
- 移动端使用卡片式布局替代表格。
- 或使用横向滚动 + 固定首列。
- 提取 `ResponsiveTable` 组件，在大屏显示表格，小屏显示卡片列表。

### 6.2 对话框在移动端溢出 - 【中】

**文件**: 
- `src/app/purchases/page.tsx` (line 260): `max-w-4xl max-h-[90vh]` 在手机上过宽
- `src/app/orders/[id]/page.tsx` (line 341): `max-w-4xl max-h-[80vh]`
- `src/app/products/page.tsx`: 编辑对话框内容过多

**问题**: Dialog 的 `max-w` 设置没有考虑移动端屏幕宽度。

**建议**: 使用 `sm:max-w-4xl w-[95vw]` 让 Dialog 在移动端自适应屏幕宽度。

### 6.3 筛选栏在移动端堆叠混乱 - 【中】

**文件**: 
- `src/app/purchase-orders/page.tsx` (line 176-224): 多个筛选条件在小屏下垂直堆叠，占用大量空间
- `src/app/suppliers/page.tsx` (line 448-501): 4 个筛选控件堆叠

**问题**: 筛选栏在移动端缺乏折叠机制，多个筛选项导致页面过长。

**建议**:
- 移动端将筛选栏折叠为"筛选"按钮，点击后弹出筛选面板。
- 使用 Drawer/Sheet 组件承载移动端筛选。

### 6.4 Reports 页面使用原生 HTML 元素 - 【中】

**文件**: `src/app/reports/` 下的所有页面

**问题**: 报表页面大量使用原生 `<select>`, `<input>`, `<table>`, `<button>`，这些元素在移动端的表现不一致，且不符合项目的设计系统。

### 6.5 固定底部批量操作栏未适配移动端 - 【低】

**文件**: `src/app/orders/page.tsx` (line 419-458)

**问题**: 底部固定栏在小屏上可能遮挡内容，且批量操作按钮太多导致溢出。

---

## 七、安全问题

### 7.1 敏感信息存储在 localStorage - 【高】

**文件**:
- `src/app/login/page.tsx` (line 92): `localStorage.setItem('user', JSON.stringify(data.user))`
- `src/components/Sidebar/Sidebar.tsx` (line 459): 从 localStorage 读取用户角色
- `src/components/Navbar.tsx` (line 18): 从 localStorage 读取用户信息

**问题**: 用户认证信息和角色存储在 `localStorage` 中，容易被 XSS 攻击读取。应使用 `httpOnly` Cookie 或 Session Storage。

**建议**:
- 使用 `httpOnly` Cookie 存储认证 token。
- 使用 `middleware.ts` 在服务端验证认证。

### 7.2 密码通过 localStorage 传递 - 【中】

**文件**: 同上

**问题**: 如果 `data.user` 对象包含密码哈希或其他敏感字段，存入 localStorage 是不安全的。

### 7.3 平台 API 密钥在前端明文显示 - 【中】

**文件**: `src/app/settings/page.tsx` (line 322-379)

**问题**: 同步配置对话框中直接显示 App Key、App Secret、Access Token。虽然提供了密码可见切换，但数据本身已通过 API 返回到前端。

**建议**: API 密钥应在前端显示为掩码（`****`），编辑时才允许输入新值。

### 7.4 无 CSRF 保护 - 【中】

**问题**: 所有 `fetch` 调用都没有 CSRF token，如果系统使用 Cookie 认证，容易受到 CSRF 攻击。

---

## 八、总结与建议

### 严重程度分布

| 严重程度 | 问题数量 | 占比 |
|---------|---------|------|
| 高 | 12 | 31% |
| 中 | 20 | 51% |
| 低 | 7 | 18% |

### 优先级排序的改进路线图

#### P0 - 立即修复（影响功能正确性）
1. **统一错误反馈机制**：将全局 `alert()` / `confirm()` 替换为 toast + 自定义对话框
2. **Profile/Settings 保存功能**：实现真实的 API 调用
3. **状态/颜色映射统一**：提取共享配置，消除不一致
4. **补全缺失验证**：为所有表单添加基础前端验证

#### P1 - 短期改进（显著影响用户体验）
5. **响应式表格**：移动端卡片视图或横向滚动
6. **空状态引导**：添加操作按钮和友好文案
7. **提取通用组件**：分页、筛选栏、批量选择 hook、骨架屏
8. **表单草稿保存**：复杂表单的 localStorage 自动保存

#### P2 - 中期优化（代码质量和可维护性）
9. **报表页面迁移**：统一使用 shadcn/ui 组件
10. **Dialog → 独立页面**：复杂新建/编辑操作迁移到独立路由
11. **安全加固**：认证信息迁移到 httpOnly Cookie
12. **删除 Test 页面**：清理开发调试代码

#### P3 - 长期规划
13. **骨架屏加载态**：替换文字 loading
14. **撤销机制**：非关键操作的撤销窗口
15. **分步表单**：复杂实体创建的多步引导

### 代码健康度评分

| 维度 | 评分 (1-10) | 说明 |
|------|------------|------|
| 代码复用 | 4/10 | 大量重复逻辑，缺少抽象 |
| 表单验证 | 5/10 | 部分页面使用 react-hook-form+zod，多数无验证 |
| 错误处理 | 3/10 | alert/confirm 泛滥，缺少统一策略 |
| 加载状态 | 5/10 | 有但不够一致和精细 |
| 响应式设计 | 4/10 | 表格在移动端不可用，Dialog 溢出 |
| 用户体验 | 5/10 | 空状态无引导，部分按钮无功能 |
| 安全性 | 4/10 | localStorage 存敏感信息 |

**综合评分：4.3 / 10**

核心功能已可用，但在代码复用、错误处理、响应式设计和安全性方面有大量改进空间。建议优先处理 P0 和 P1 级别的问题。
