# 采购管理前端开发文档
# Purchase Management Frontend Development

**任务 ID:** DEV-008  
**完成时间:** 2026-03-07  
**状态:** ✅ 已完成

---

## 📋 完成页面清单

### 1. 供应商列表页 `/suppliers`
**文件:** `src/app/suppliers/page.tsx`

**功能特性:**
- ✅ 数据表格展示供应商信息
- ✅ 分页功能（每页 20 条）
- ✅ 多条件筛选（状态、类型、等级）
- ✅ 搜索功能（公司名称、联系人、邮箱、电话）
- ✅ 新增供应商对话框
- ✅ 操作按钮：查看详情、编辑
- ✅ 状态标签显示（正常/停用/黑名单/待审核）
- ✅ 供应商类型和等级标签

**技术实现:**
- shadcn/ui 组件：Table, Card, Dialog, Badge, Select, Input, Button
- React Hook Form 表单处理
- 响应式设计

---

### 2. 供应商详情页 `/suppliers/[id]`
**文件:** `src/app/suppliers/[id]/page.tsx`

**功能特性:**
- ✅ 供应商基本信息展示
- ✅ 联系人列表（预留）
- ✅ 采购订单历史（最近 10 条）
- ✅ 状态、类型、等级标签显示
- ✅ 操作按钮：编辑、返回
- ✅ 详细信息网格布局

**展示字段:**
- 公司名称、英文名称
- 联系人、职位、邮箱、电话、手机
- 地址、城市、国家
- 网站、供应产品
- 账期、结算货币
- 备注信息

---

### 3. 采购订单列表页 `/purchase-orders`
**文件:** `src/app/purchase-orders/page.tsx`

**功能特性:**
- ✅ 数据表格展示采购订单
- ✅ 分页功能（每页 20 条）
- ✅ 多条件筛选（状态、供应商）
- ✅ 搜索功能（订单号、供应商）
- ✅ 状态标签显示（7 种状态）
- ✅ 审批状态显示
- ✅ 金额显示（货币 + 金额）
- ✅ 操作按钮：查看详情
- ✅ 创建采购订单快捷入口

**状态类型:**
- 待确认 (PENDING)
- 已确认 (CONFIRMED)
- 生产中 (IN_PRODUCTION)
- 待发货 (READY)
- 已收货 (RECEIVED)
- 已完成 (COMPLETED)
- 已取消 (CANCELLED)

---

### 4. 创建采购订单页 `/purchase-orders/new`
**文件:** `src/app/purchase-orders/new/page.tsx`

**功能特性:**
- ✅ 供应商选择（下拉框）
- ✅ 商品明细动态添加/删除
- ✅ 产品选择（从产品库选择）
- ✅ 自动填充产品信息（SKU、规格、单位、成本价）
- ✅ 数量、单价输入
- ✅ 折扣率、税率设置
- ✅ 自动计算：
  - 单项金额 = 数量 × 单价 × (1 - 折扣率)
  - 税额 = 金额 × 税率
  - 小计、税额总计、总金额
- ✅ 货币选择（CNY/USD/EUR/GBP）
- ✅ 汇率设置
- ✅ 交货日期、最晚交货日期
- ✅ 交货地址
- ✅ 运输方式、付款条件
- ✅ 付款截止日期
- ✅ 备注（对客户可见）、内部备注
- ✅ 表单验证（Zod + React Hook Form）

**表单验证规则:**
- 供应商：必填
- 商品明细：至少一项
- 产品名称：必填
- 数量：正整数
- 单价：非负数
- 折扣率：0-100
- 税率：0-100

---

## 📁 类型定义

**文件:** `src/types/purchase.ts`

**导出类型:**
- `Supplier` - 供应商完整类型
- `SupplierStatus`, `SupplierType`, `SupplierLevel` - 供应商枚举
- `CreateSupplierInput`, `UpdateSupplierInput` - 供应商输入类型
- `PurchaseOrder` - 采购订单完整类型
- `PurchaseOrderStatus`, `ApprovalStatus` - 订单状态枚举
- `PurchaseOrderItem` - 订单项类型
- `CreatePurchaseOrderInput`, `UpdatePurchaseOrderInput` - 订单输入类型
- `ApiResponse`, `PaginatedResponse` - API 响应类型
- `SupplierFormData`, `PurchaseOrderFormData` - 表单数据类型
- `PurchaseOrderTotals` - 金额汇总类型

---

## 🔧 API 接口

### 供应商 API
- `GET /api/v1/suppliers` - 获取供应商列表（分页、筛选、搜索）
- `GET /api/v1/suppliers/[id]` - 获取供应商详情
- `POST /api/v1/suppliers` - 创建供应商
- `PUT /api/v1/suppliers/[id]` - 更新供应商
- `DELETE /api/v1/suppliers/[id]` - 删除供应商

### 采购订单 API
- `GET /api/v1/purchase-orders` - 获取采购订单列表（分页、筛选、搜索）
- `GET /api/v1/purchase-orders/[id]` - 获取采购订单详情
- `POST /api/v1/purchase-orders` - 创建采购订单
- `PUT /api/v1/purchase-orders/[id]` - 更新采购订单
- `DELETE /api/v1/purchase-orders/[id]` - 删除采购订单

---

## 🎨 使用的 shadcn/ui 组件

- `Button` - 按钮
- `Input` - 输入框
- `Textarea` - 多行文本框
- `Label` - 标签
- `Select` - 下拉选择框
- `Table` - 数据表格
- `Card` - 卡片
- `Dialog` - 对话框
- `Badge` - 徽章/标签
- `Separator` - 分隔线
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` - 表单组件

---

## 📦 依赖包

已安装：
- `@tanstack/react-query` - React Query 数据获取（5.74.3）
- `react-hook-form` - 表单处理 (7.71.2)
- `@hookform/resolvers` - React Hook Form 验证器 (5.2.2)
- `zod` - 模式验证 (4.3.6)
- `shadcn/ui` - UI 组件库
- `lucide-react` - 图标库

---

## 🚀 使用说明

### 启动开发服务器
```bash
cd /Users/apple/clawd/trade-erp
npm run dev
```

### 访问页面
- 供应商列表：http://localhost:3000/suppliers
- 供应商详情：http://localhost:3000/suppliers/[id]
- 采购订单列表：http://localhost:3000/purchase-orders
- 创建采购订单：http://localhost:3000/purchase-orders/new

---

## 📝 注意事项

1. **API 兼容性**: 前端页面使用 `/api/v1/` 路径访问后端 API，确保后端 API 已正确部署
2. **数据验证**: 所有表单都使用 Zod 进行客户端和服务端双重验证
3. **响应式设计**: 页面支持桌面和移动端自适应
4. **状态管理**: 使用 React 本地状态管理，复杂场景可考虑引入 Zustand 或 Redux
5. **错误处理**: API 错误会显示友好的错误提示

---

## 🔜 后续优化建议

1. **供应商编辑页**: 创建 `/suppliers/[id]/edit` 页面
2. **采购订单详情页**: 创建 `/purchase-orders/[id]` 页面
3. **采购订单编辑页**: 创建 `/purchase-orders/[id]/edit` 页面
4. **批量操作**: 支持批量删除、批量导出
5. **导出功能**: 支持 Excel/CSV 导出
6. **图表展示**: 采购统计图表
7. **权限控制**: 基于角色的访问控制
8. **React Query 集成**: 使用 React Query 替换现有的 fetch 调用，实现缓存和自动刷新

---

## ✅ 验收标准

- [x] 供应商列表页 - 展示、搜索、筛选、分页
- [x] 供应商详情页 - 详细信息、订单历史
- [x] 采购订单列表页 - 展示、搜索、筛选、分页
- [x] 创建采购订单页 - 表单、验证、自动计算
- [x] 类型定义 - TypeScript 类型完整
- [x] shadcn/ui 组件 - 使用一致
- [x] React Hook Form + Zod - 表单验证
- [x] 响应式设计 - 适配移动端

---

**开发者:** ERPDeveloper  
**审核人:** _待审核_  
**审核日期:** _待审核_
