# UI 设计一致性全面审计报告

**审计日期：** 2026-04-12  
**审计工具：** scripts/ui-audit.js  
**审计范围：** trade-erp/src/app 全部 60 个页面

---

## 📊 审计结果统计

| 指标 | 数量 | 百分比 |
|------|------|--------|
| 总页面数 | 60 | 100% |
| ✅ 符合标准 | 36 | 60.0% |
| ❌ 不符合标准 | 24 | 40.0% |

---

## 🎯 问题分类统计

| 问题类型 | 出现次数 | 涉及页面数 |
|---------|---------|-----------|
| 未使用 `<Label>` | 11 | 11 |
| 未使用 `<Card>` | 8 | 8 |
| 未使用 `<Button>` | 6 | 6 |
| 未使用 `<Table>` | 5 | 5 |
| 未使用 `<Select>` | 4 | 4 |
| 未使用 `<Checkbox>` | 2 | 2 |
| 未使用 `<Badge>` | 2 | 2 |
| 未使用 `<Textarea>` | 1 | 1 |

---

## 📋 问题页面清单（按模块）

### 🔴 报表模块（reports/）- 重灾区

**问题最严重的模块，需要优先修复**

| 页面 | 问题数 | 问题详情 | 优先级 |
|------|--------|---------|--------|
| reports/inventory/page.tsx | 6 | Button, Card, Table, Checkbox, Label ×2 | P0 |
| reports/sales/page.tsx | 5 | Button, Card, Table, Label ×2 | P0 |
| reports/custom/page.tsx | 4 | Button, Card, Table, Label | P0 |
| reports/profit/page.tsx | 3 | Button, Card, Label ×2 | P0 |
| reports/purchase/page.tsx | 2 | Button, Label ×2 | P1 |
| reports/cashflow/page.tsx | 2 | Button, Label ×2 | P1 |
| reports/dashboard/page.tsx | 1 | Card | P2 |
| reports/page.tsx | 1 | Card | P2 |
| reports/subscriptions/page.tsx | 3 | Card, Table, Badge | P1 |

**小计：** 9 个页面，27 个问题

---

### 🟡 采购模块（purchases/）

| 页面 | 问题数 | 问题详情 | 优先级 |
|------|--------|---------|--------|
| purchases/page.tsx | 1 | Label | P2 |
| purchases/[id]/edit/page.tsx | 1 | Label | P2 |

**小计：** 2 个页面，2 个问题

---

### 🟡 报价模块（quotations/）

| 页面 | 问题数 | 问题详情 | 优先级 |
|------|--------|---------|--------|
| quotations/page.tsx | 1 | Select | P2 |
| quotations/new/page.tsx | 1 | Select | P2 |
| quotations/edit/[id]/page.tsx | 1 | Select | P2 |

**小计：** 3 个页面，3 个问题

---

### 🟡 供应商模块（suppliers/）

| 页面 | 问题数 | 问题详情 | 优先级 |
|------|--------|---------|--------|
| suppliers/page.tsx | 1 | Label | P2 |
| suppliers/[id]/edit/page.tsx | 1 | Textarea | P2 |

**小计：** 2 个页面，2 个问题

---

### 🟢 其他模块（零星问题）

| 页面 | 问题数 | 问题详情 | 优先级 |
|------|--------|---------|--------|
| inquiries/page.tsx | 1 | Select | P2 |
| inventory/page.tsx | 1 | Select | P2 |
| orders/[id]/edit/page.tsx | 1 | Badge | P2 |
| outbound-orders/page.tsx | 1 | Checkbox | P2 |
| product-research/products/page.tsx | 1 | Label | P2 |
| profile/page.tsx | 1 | Label | P2 |
| purchase-orders/[id]/page.tsx | 1 | Table | P2 |
| settings/page.tsx | 1 | Label | P2 |

**小计：** 8 个页面，8 个问题

---

## 🔧 修复计划

### 第一阶段：报表模块（P0 优先级）

**时间：** 2026-04-12 上午  
**负责人：** 前端开发组  
**目标：** 修复所有 reports/ 模块的严重问题

**修复清单：**
1. reports/inventory/page.tsx - 库存报表
2. reports/sales/page.tsx - 销售报表
3. reports/custom/page.tsx - 自定义报表
4. reports/profit/page.tsx - 利润报表
5. reports/purchase/page.tsx - 采购报表
6. reports/cashflow/page.tsx - 现金流报表

**预计工作量：** 6 页面 × 30 分钟 = 3 小时

---

### 第二阶段：其他模块（P1-P2 优先级）

**时间：** 2026-04-12 下午  
**负责人：** 前端开发组  
**目标：** 修复剩余所有问题

**修复清单：**
- quotations/ 模块（3 个页面）
- suppliers/ 模块（2 个页面）
- purchases/ 模块（2 个页面）
- 其他零星问题（8 个页面）

**预计工作量：** 15 页面 × 20 分钟 = 5 小时

---

## 📝 修复指南

### 1. 替换 `<Label>`

**修改前：**
```tsx
<label className="block text-sm font-medium mb-1">标签文本</label>
```

**修改后：**
```tsx
import { Label } from '@/components/ui/label';
<Label htmlFor="fieldId">标签文本</Label>
```

---

### 2. 替换 `<Card>`

**修改前：**
```tsx
<div className="bg-white rounded-lg border shadow-sm">
  <div className="p-6">内容</div>
</div>
```

**修改后：**
```tsx
import { Card, CardContent } from '@/components/ui/card';
<Card>
  <CardContent className="p-6">内容</CardContent>
</Card>
```

---

### 3. 替换 `<Button>`

**修改前：**
```tsx
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  按钮文本
</button>
```

**修改后：**
```tsx
import { Button } from '@/components/ui/button';
<Button>按钮文本</Button>
```

---

### 4. 替换 `<Table>`

**修改前：**
```tsx
<table className="min-w-full">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

**修改后：**
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
<Table>
  <TableHeader>...</TableHeader>
  <TableBody>...</TableBody>
</Table>
```

---

### 5. 替换 `<Select>`

**修改前：**
```tsx
<select className="border rounded px-3 py-2">
  <option>选项 1</option>
</select>
```

**修改后：**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
<Select>
  <SelectTrigger>
    <SelectValue placeholder="选择选项" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">选项 1</SelectItem>
  </SelectContent>
</Select>
```

---

### 6. 替换 `<Checkbox>`

**修改前：**
```tsx
<input type="checkbox" className="w-4 h-4" />
```

**修改后：**
```tsx
import { Checkbox } from '@/components/ui/checkbox';
<Checkbox />
```

---

### 7. 替换 `<Badge>`

**修改前：**
```tsx
<span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">徽章</span>
```

**修改后：**
```tsx
import { Badge } from '@/components/ui/badge';
<Badge variant="secondary">徽章</Badge>
```

---

### 8. 替换 `<Textarea>`

**修改前：**
```tsx
<textarea className="border rounded px-3 py-2" rows={3} />
```

**修改后：**
```tsx
import { Textarea } from '@/components/ui/textarea';
<Textarea rows={3} />
```

---

## ✅ 验证清单

每个页面修复后需要验证：

- [ ] 导入所有需要的 shadcn/ui 组件
- [ ] 移除所有原生 HTML 控件
- [ ] 页面功能正常（打开、交互、保存）
- [ ] 移动端显示正常
- [ ] 桌面端显示正常
- [ ] 与其他页面视觉一致

---

## 📊 进度追踪

**总体进度：** 36/60 页面已符合标准（60%）

**修复进度：**
- [ ] 报表模块（9 个页面）- P0
- [ ] 报价模块（3 个页面）- P2
- [ ] 供应商模块（2 个页面）- P2
- [ ] 采购模块（2 个页面）- P2
- [ ] 其他模块（8 个页面）- P2

**目标完成时间：** 2026-04-12 18:00

---

*生成时间：2026-04-12 06:20*  
*审计工具：scripts/ui-audit.js*  
*下次更新：2026-04-12 12:00*
