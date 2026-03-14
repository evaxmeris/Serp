# Sprint 5 前端开发任务分配

**Sprint**: 5 - 出库管理模块  
**阶段**: 前端开发  
**日期**: 2026-03-14  
**版本**: v0.5.7

---

## 📋 任务概览

| 任务 ID | 任务名称 | 优先级 | 负责人 | 状态 | 预计工时 |
|---------|----------|--------|--------|------|----------|
| FE-5.1 | 出库单列表页面 | P0 | 开发工程师 | ⏳ 待开始 | 4h |
| FE-5.2 | 出库单详情页面 | P0 | 开发工程师 | ⏳ 待开始 | 3h |
| FE-5.3 | 创建出库单页面 | P0 | 开发工程师 | ⏳ 待开始 | 6h |
| FE-5.4 | 出库单确认/取消操作 | P0 | 开发工程师 | ⏳ 待开始 | 2h |
| FE-5.5 | 出库单编辑页面（DRAFT） | P1 | 开发工程师 | ⏳ 待开始 | 3h |
| FE-5.6 | 发货单录入页面 | P1 | 开发工程师 | ⏳ 待开始 | 4h |

**总工时**: 22 小时

---

## 🎯 任务详情

### FE-5.1: 出库单列表页面

**优先级**: P0  
**预计工时**: 4 小时

**功能需求**:
- [ ] 出库单列表展示（表格）
- [ ] 分页功能
- [ ] 状态筛选（DRAFT/PENDING/SHIPPED/CANCELLED）
- [ ] 按销售订单号搜索
- [ ] 按日期范围筛选
- [ ] 列排序功能
- [ ] 快捷操作（查看/确认/取消）

**技术实现**:
```typescript
// 页面路径：src/app/outbound-orders/page.tsx
// API: GET /api/v1/outbound-orders
// 组件：DataTable, StatusBadge, DateRangePicker
```

**验收标准**:
- [ ] 列表加载正常，支持分页
- [ ] 筛选功能正常
- [ ] 状态标签颜色正确
- [ ] 操作按钮权限正确

---

### FE-5.2: 出库单详情页面

**优先级**: P0  
**预计工时**: 3 小时

**功能需求**:
- [ ] 出库单基本信息展示
- [ ] 商品明细列表
- [ ] 状态流转历史
- [ ] 关联销售订单链接
- [ ] 操作按钮（确认/取消/编辑）
- [ ] 打印功能（可选）

**技术实现**:
```typescript
// 页面路径：src/app/outbound-orders/[id]/page.tsx
// API: GET /api/v1/outbound-orders/:id
// 组件：Card, Table, Badge, Button
```

**验收标准**:
- [ ] 信息展示完整准确
- [ ] 状态显示正确
- [ ] 操作按钮根据状态显示/隐藏
- [ ] 关联订单可跳转

---

### FE-5.3: 创建出库单页面

**优先级**: P0  
**预计工时**: 6 小时

**功能需求**:
- [ ] 选择销售订单（下拉搜索）
- [ ] 自动加载销售订单商品
- [ ] 选择仓库
- [ ] 输入出库数量（不能超过订单数量）
- [ ] 批次号/库位/备注（可选）
- [ ] 表单验证
- [ ] 提交创建

**技术实现**:
```typescript
// 页面路径：src/app/outbound-orders/new/page.tsx
// API: 
//   - GET /api/v1/orders?status=CONFIRMED
//   - POST /api/v1/outbound-orders
// 组件：Form, Select, Input, Button, Toast
```

**验收标准**:
- [ ] 销售订单选择正常
- [ ] 商品列表自动加载
- [ ] 数量验证正确
- [ ] 创建成功后跳转详情
- [ ] 错误提示友好

---

### FE-5.4: 出库单确认/取消操作

**优先级**: P0  
**预计工时**: 2 小时

**功能需求**:
- [ ] 确认按钮（PENDING → SHIPPED）
- [ ] 取消按钮（DRAFT/PENDING → CANCELLED）
- [ ] 取消原因输入（可选）
- [ ] 操作确认对话框
- [ ] 操作后刷新状态

**技术实现**:
```typescript
// 组件：AlertDialog, Toast
// API: 
//   - POST /api/v1/outbound-orders/:id/confirm
//   - POST /api/v1/outbound-orders/:id/cancel
```

**验收标准**:
- [ ] 按钮根据状态显示/隐藏
- [ ] 确认对话框提示正确
- [ ] 操作成功后状态更新
- [ ] 错误处理友好

---

### FE-5.5: 出库单编辑页面（DRAFT）

**优先级**: P1  
**预计工时**: 3 小时

**功能需求**:
- [ ] 仅 DRAFT 状态可编辑
- [ ] 修改商品数量
- [ ] 添加/删除商品行
- [ ] 修改备注信息
- [ ] 保存草稿

**技术实现**:
```typescript
// 页面路径：src/app/outbound-orders/[id]/edit
// API: PUT /api/v1/outbound-orders/:id
```

**验收标准**:
- [ ] 仅 DRAFT 状态可访问
- [ ] 修改保存成功
- [ ] 验证逻辑正确

---

### FE-5.6: 发货单录入页面

**优先级**: P1  
**预计工时**: 4 小时

**功能需求**:
- [ ] 物流公司选择
- [ ] 物流单号输入
- [ ] 发货时间选择
- [ ] 备注信息
- [ ] 提交发货

**技术实现**:
```typescript
// 页面路径：src/app/outbound-orders/[id]/ship
// API: POST /api/v1/shipments
```

**验收标准**:
- [ ] 发货信息录入完整
- [ ] 提交成功后状态更新
- [ ] 物流信息可追踪

---

## 📁 文件结构

```
src/app/outbound-orders/
├── page.tsx              # 列表页面 (FE-5.1)
├── new/
│   └── page.tsx          # 创建页面 (FE-5.3)
├── [id]/
│   ├── page.tsx          # 详情页面 (FE-5.2)
│   ├── edit/
│   │   └── page.tsx      # 编辑页面 (FE-5.5)
│   └── ship/
│       └── page.tsx      # 发货页面 (FE-5.6)
└── components/
    ├── outbound-list.tsx
    ├── outbound-form.tsx
    ├── outbound-detail.tsx
    └── outbound-actions.tsx
```

---

## 🎨 UI 组件参考

使用现有 shadcn/ui 组件：
- `DataTable` - 数据表格
- `Card` - 卡片容器
- `Form` - 表单
- `Select` - 下拉选择
- `Input` - 输入框
- `Button` - 按钮
- `Badge` - 状态标签
- `Dialog` - 对话框
- `Toast` - 提示消息

---

## 🧪 测试要求

**每个页面需要**:
- [ ] 页面加载测试
- [ ] 表单验证测试
- [ ] API 调用测试
- [ ] 错误处理测试

**测试文件位置**:
```
tests/e2e/outbound-orders/
├── list.spec.ts
├── create.spec.ts
├── detail.spec.ts
└── actions.spec.ts
```

---

## 📅 开发计划

### 第 1 天（今天）
- [ ] FE-5.1: 出库单列表页面
- [ ] FE-5.2: 出库单详情页面

### 第 2 天
- [ ] FE-5.3: 创建出库单页面
- [ ] FE-5.4: 确认/取消操作

### 第 3 天
- [ ] FE-5.5: 编辑页面
- [ ] FE-5.6: 发货单录入
- [ ] E2E 测试

---

## 🚀 开始开发

**开发工程师请执行**:
1. 阅读本任务文档
2. 确认技术实现方案
3. 按优先级开始开发
4. 每完成一个任务更新状态
5. 遇到问题及时沟通

**任务状态更新**:
```bash
# 完成任务后更新 TASK_ASSIGNMENTS.md
git add .
git commit -m "feat: 完成 FE-5.x [任务名称]"
```

---

**文档创建时间**: 2026-03-14 22:35  
**分配给**: @erp-developer  
**状态**: 🔄 准备开始
