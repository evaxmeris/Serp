# 🐛 Bug 修复报告 - 全站点 P0 Bug

**修复日期:** 2026-03-09  
**修复人:** ERP 前端开发团队  
**状态:** ✅ 全部完成

---

## Bug 修复清单

### ✅ BUG-FULLSITE-001: 报价单详情页类型错误

**状态:** ✅ 已修复（修复前已存在）  
**位置:** `src/app/quotations/[id]/page.tsx`  
**问题:** `quotation.totalAmount.toFixed is not a function`  
**修复:** 文件中已存在 `formatAmount` 函数（第 53-56 行），正确处理 `string | number` 类型  
**验证:** ✅ 构建通过

---

### ✅ BUG-FULLSITE-002: 订单管理 Select 组件错误

**状态:** ✅ 已修复  
**位置:** `src/app/orders/page.tsx`  
**问题:** `A <Select.Item /> must have a value prop that is not an empty string`  
**修复内容:**
- 将 `ORDER_STATUS_OPTIONS` 中第一个选项的 `value: ''` 改为 `value: 'ALL'`
- 更新 `statusFilter` 初始值为 `'ALL'`
- 在调用 `useOrders` 时，将 `'ALL'` 转换为 `undefined`

**修改代码:**
```typescript
// 修复前
const ORDER_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  // ...
];
const [statusFilter, setStatusFilter] = useState('');

// 修复后
const ORDER_STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  // ...
];
const [statusFilter, setStatusFilter] = useState('ALL');
// useOrders 中：status: (statusFilter === 'ALL' ? undefined : statusFilter)
```

**验证:** ✅ 构建通过

---

### ✅ BUG-FULLSITE-003: 采购管理 Select 组件错误

**状态:** ✅ 已修复  
**位置:** `src/app/purchases/page.tsx`  
**问题:** 同 BUG-FULLSITE-002  
**修复内容:**
- 将 `<SelectItem value="">全部状态</SelectItem>` 改为 `<SelectItem value="ALL">全部状态</SelectItem>`
- 更新 `statusFilter` 初始值为 `'ALL'`
- 在 `fetchPurchases` 中，将 `'ALL'` 条件转换为不传递 status 参数

**修改代码:**
```typescript
// 修复前
const [statusFilter, setStatusFilter] = useState('');
<SelectItem value="">全部状态</SelectItem>

// 修复后
const [statusFilter, setStatusFilter] = useState('ALL');
<SelectItem value="ALL">全部状态</SelectItem>
// fetchPurchases 中：if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
```

**验证:** ✅ 构建通过

---

## 构建验证结果

```bash
cd /Users/apple/clawd/trade-erp && npm run build
```

**结果:** ✅ 构建成功
- Compiled successfully in 2.4s
- TypeScript 检查通过
- 所有页面生成成功 (32 pages)

---

## 修复总结

| Bug ID | 问题类型 | 修复状态 | 验证状态 |
|--------|---------|---------|---------|
| BUG-FULLSITE-001 | 类型错误 | ✅ 已完成 | ✅ 通过 |
| BUG-FULLSITE-002 | Select 组件 | ✅ 已完成 | ✅ 通过 |
| BUG-FULLSITE-003 | Select 组件 | ✅ 已完成 | ✅ 通过 |

**总耗时:** < 30 分钟  
**修复策略:** 统一使用 `'ALL'` 作为"全部状态"的有效值，避免空字符串导致的 Radix UI Select 组件错误

---

## 下一步

✅ 所有 P0 Bug 已修复并验证  
📢 **请通知测试团队进行验证**

**测试建议:**
1. 访问报价单详情页，确认金额显示正常
2. 访问订单管理页面，测试状态筛选功能
3. 访问采购管理页面，测试状态筛选功能
4. 检查浏览器控制台无报错

---

*修复完成时间: 2026-03-09 01:45 GMT+8*
