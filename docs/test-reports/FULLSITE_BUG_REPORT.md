# 全站点 Bug 测试报告

**测试时间：** 2026-03-09 01:45  
**测试范围：** 主页面所有链接及子页面  
**测试工具：** Chrome 浏览器（真实渲染）  
**测试地址：** http://localhost:3001  
**测试人员：** ERP 测试团队

---

## 📊 测试结果总览

| 页面 | URL | 状态 | 问题数 | 优先级 |
|------|-----|------|--------|--------|
| 首页 | / | ✅ 正常 | 0 | - |
| 客户管理 | /customers | ✅ 正常 | 0 | - |
| 产品管理 | /products | ✅ 正常 | 0 | - |
| 询盘管理 | /inquiries | ✅ 正常 | 0 | - |
| 报价管理列表 | /quotations | ✅ 正常 | 0 | - |
| 报价单详情 | /quotations/[id] | ❌ 错误 | 1 | P0 |
| 新建报价单 | /quotations/new | ✅ 正常 | 0 | - |
| 订单管理 | /orders | ❌ 错误 | 1 | P0 |
| 采购管理 | /purchases | ❌ 错误 | 1 | P0 |
| 登录 | /login | ✅ 正常 | 0 | - |
| 注册 | /register | ✅ 正常 | 0 | - |

**总计：** 11 个页面，3 个错误，8 个正常

---

## 🐛 发现的 Bug（3 个 P0 级别）

### BUG-FULLSITE-001: 报价单详情页类型错误

**优先级：** P0  
**状态：** 🔴 待修复  
**页面：** /quotations/[id]

**错误信息：**
```
Runtime TypeError: quotation.totalAmount.toFixed is not a function
位置：src/app/quotations/[id]/page.tsx (300:61)
```

**现象：**
- 访问任意报价单详情页显示错误
- 页面无法渲染，只显示错误覆盖层

**根本原因：**
- API 返回的 `totalAmount` 是字符串类型（如 `"2050"`）
- 前端代码直接调用 `.toFixed(2)` 方法
- 字符串没有 `.toFixed()` 方法

**修复方案：**
```typescript
// 1. 修改接口定义
interface Quotation {
  totalAmount: string | number;
}

// 2. 添加格式化函数
const formatAmount = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
};

// 3. 使用
{quotation.currency} {formatAmount(quotation.totalAmount)}
```

**影响范围：** 所有报价单详情页

---

### BUG-FULLSITE-002: 订单管理页面 Select 组件错误

**优先级：** P0  
**状态：** 🔴 待修复  
**页面：** /orders

**错误信息：**
```
Runtime Error: A <Select.Item /> must have a value prop that is not an empty string.
位置：src/components/ui/select.tsx (109:5)
调用栈：src/app/orders/page.tsx (128:19)
```

**现象：**
- 访问订单管理页面显示错误
- 页面无法渲染

**根本原因：**
- `Select.Item` 组件的 `value` 属性使用了空字符串
- shadcn/ui 的 Select 组件不允许空字符串 value

**修复方案：**
```typescript
// 检查 orders/page.tsx 第 128 行附近的 Select 组件
// 确保所有 Select.Item 的 value 不为空字符串

// 错误示例：
<Select.Item value="">全部状态</Select.Item>

// 正确示例：
<Select.Item value="all">全部状态</Select.Item>
```

**影响范围：** 订单管理列表页

---

### BUG-FULLSITE-003: 采购管理页面 Select 组件错误

**优先级：** P0  
**状态：** 🔴 待修复  
**页面：** /purchases

**错误信息：**
```
Runtime Error: A <Select.Item /> must have a value prop that is not an empty string.
位置：src/components/ui/select.tsx (109:5)
调用栈：src/app/purchases/page.tsx (402:17)
```

**现象：**
- 访问采购管理页面显示错误
- 页面无法渲染

**根本原因：**
- 同 BUG-FULLSITE-002
- `Select.Item` 组件的 `value` 属性使用了空字符串

**修复方案：**
```typescript
// 检查 purchases/page.tsx 第 402 行附近的 Select 组件
// 确保所有 Select.Item 的 value 不为空字符串

// 错误示例：
<Select.Item value="">全部状态</Select.Item>

// 正确示例：
<Select.Item value="all">全部状态</Select.Item>
```

**影响范围：** 采购管理列表页

---

## ✅ 正常工作的页面（8 个）

### 首页 (/)
- ✅ 页面正常渲染
- ✅ 6 个模块卡片显示正常
- ✅ 所有链接可点击

### 客户管理 (/customers)
- ✅ 页面正常渲染
- ✅ 客户列表显示正常（20 条数据）
- ✅ 搜索框可用
- ✅ 表格数据显示完整
- ✅ 新增客户按钮可用

### 产品管理 (/products)
- ✅ 页面正常渲染
- ✅ 产品列表显示正常
- ✅ 搜索功能可用

### 询盘管理 (/inquiries)
- ✅ 页面正常渲染
- ✅ 询盘列表显示正常
- ✅ 状态筛选可用

### 报价管理列表 (/quotations)
- ✅ 页面正常渲染
- ✅ 4 条报价单数据显示正常
- ✅ 搜索框可用
- ✅ 状态筛选可用（6 个状态选项）

### 新建报价单 (/quotations/new)
- ✅ 页面正常渲染
- ✅ 客户选择下拉框正常（20 个选项）
- ✅ 币种选择正常（3 个选项）
- ✅ 产品明细添加功能正常
- ✅ 自动计算功能正常

### 登录 (/login)
- ✅ 页面正常渲染
- ✅ 登录表单可用

### 注册 (/register)
- ✅ 页面正常渲染
- ✅ 注册表单可用

---

## 📋 待测试功能

以下功能需要进一步测试：

### 报价管理模块
- [ ] 编辑报价单页 (/quotations/edit/[id])
- [ ] 发送报价单功能
- [ ] 报价单转订单功能
- [ ] 删除报价单功能

### 客户管理模块
- [ ] 客户详情页
- [ ] 新增客户功能
- [ ] 编辑客户功能
- [ ] 删除客户功能

### 产品管理模块
- [ ] 产品详情页
- [ ] 新增产品功能
- [ ] 编辑产品功能

### 询盘管理模块
- [ ] 询盘详情页
- [ ] 新增询盘功能
- [ ] 询盘转报价功能

---

## 🔧 修复优先级

### P0（立即修复）
1. BUG-FULLSITE-001 - 报价单详情页类型错误
2. BUG-FULLSITE-002 - 订单管理 Select 组件错误
3. BUG-FULLSITE-003 - 采购管理 Select 组件错误

**预计修复时间：** 每个 Bug 15-30 分钟

---

## 📞 联系信息

**测试团队：** ERP 测试工程师  
**开发团队：** 前端开发工程师  
**报告时间：** 2026-03-09 01:45

---

**请开发团队按优先级修复以上 Bug，修复后通知测试团队验证！** 🦾
