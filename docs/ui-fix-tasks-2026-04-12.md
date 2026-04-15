# UI 设计一致性修复任务

**日期：** 2026-04-12  
**优先级：** P0  
**状态：** 进行中

---

## ✅ 已完成

### categories/page.tsx - 品类管理页面

**修复时间：** 2026-04-12 06:15  
**修复人：** AI 前端组

**修改内容：**
1. ✅ 替换所有原生 HTML 为 shadcn/ui 组件
2. ✅ 使用 `<Dialog>` 替换原生对话框
3. ✅ 使用 `<Card>` 包裹页面内容
4. ✅ 使用 `<Button>` `<Input>` `<Label>` `<Select>` `<Textarea>` `<Checkbox>` `<Badge>`
5. ✅ 响应式布局（移动端单列，桌面端两列/三列）
6. ✅ 统一间距和样式

**使用的新组件：**
```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```

**验证结果：**
- ✅ 移动端显示正常
- ✅ 桌面端显示正常
- ✅ 对话框样式统一
- ✅ 表单布局响应式
- ✅ 与其他页面视觉一致

---

## 📋 待检查页面

### 全系统页面审计（需要前端设计师逐个检查）

**检查范围：**
- [ ] `/app/products/` - 产品管理
- [ ] `/app/orders/` - 订单管理
- [ ] `/app/inventory/` - 库存管理
- [ ] `/app/suppliers/` - 供应商管理
- [ ] `/app/customers/` - 客户管理
- [ ] `/app/finance/` - 财务管理
- [ ] `/app/reports/` - 报表管理
- [ ] `/app/settings/` - 系统设置

**检查清单：**
1. 是否使用 shadcn/ui 组件？
2. 对话框是否使用 `<Dialog>` 组件？
3. 卡片是否使用 `<Card>` 组件？
4. 表格是否使用 `<Table>` 组件？
5. 按钮是否使用 `<Button>` 组件？
6. 表单控件是否使用统一组件？
7. 响应式布局是否正确？
8. 颜色和样式是否统一？

---

## 🎯 设计原则（必须遵守）

### 1. 组件使用规范

**强制使用 shadcn/ui：**
- 对话框 → `<Dialog>` 系列
- 卡片 → `<Card>` 系列
- 表格 → `<Table>` 系列
- 按钮 → `<Button>` 系列
- 表单 → `<Input>` `<Label>` `<Select>` 等
- 徽章 → `<Badge>`
- 复选框 → `<Checkbox>`

**禁止使用：**
- ❌ 原生 `div.fixed.inset-0` 对话框
- ❌ 原生 `button.px-4.py-2.bg-blue-500`
- ❌ 原生 `input.border.rounded.px-3.py-2`
- ❌ 原生 `select.border.rounded`

### 2. 页面结构规范

```tsx
<div className="container mx-auto p-6">
  <Card>
    <CardHeader>
      <CardTitle>页面标题</CardTitle>
      <CardDescription>页面描述</CardDescription>
    </CardHeader>
    <CardContent>
      {/* 内容 */}
    </CardContent>
  </Card>
</div>
```

### 3. 对话框规范

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      {/* 表单内容，使用响应式 grid */}
    </div>
    <DialogFooter>
      <Button variant="outline">取消</Button>
      <Button>保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 4. 响应式布局规范

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 移动端单列，平板两列，桌面三列 */}
</div>
```

---

## 📝 团队分工

| 模块 | 负责人 | 状态 | 截止时间 |
|------|--------|------|----------|
| 产品调研 | AI 前端组 | ✅ 已完成 | 2026-04-12 06:15 |
| 产品管理 | 待分配 | ⏳ 待检查 | 2026-04-12 12:00 |
| 订单管理 | 待分配 | ⏳ 待检查 | 2026-04-12 12:00 |
| 库存管理 | 待分配 | ⏳ 待检查 | 2026-04-12 12:00 |
| 财务管理 | 待分配 | ⏳ 待检查 | 2026-04-12 12:00 |
| 系统设置 | 待分配 | ⏳ 待检查 | 2026-04-12 12:00 |

---

## 🔍 验证流程

**每个页面修改后需要验证：**

1. **视觉检查**
   - [ ] 打开页面，查看整体布局
   - [ ] 对比其他已完成的页面
   - [ ] 检查对话框样式

2. **功能检查**
   - [ ] 所有按钮可点击
   - [ ] 表单可正常填写
   - [ ] 对话框可正常打开/关闭
   - [ ] 数据可正常保存

3. **响应式检查**
   - [ ] 移动端（<768px）显示正常
   - [ ] 平板端（≥768px）显示正常
   - [ ] 桌面端（≥1024px）显示正常

4. **代码检查**
   - [ ] 无原生 HTML 控件
   - [ ] 全部使用 shadcn/ui
   - [ ] 无内联样式（除特殊需求）
   - [ ] 代码格式统一

---

## 📊 进度追踪

**总体进度：** 1/6 模块完成（16.7%）

**时间线：**
- 06:00 - 发现问题（用户反馈）
- 06:10 - 创建审计报告
- 06:15 - 完成 categories 修复
- 12:00 - 完成所有模块检查（目标）
- 18:00 - 完成所有修复（目标）

---

*最后更新：2026-04-12 06:15*  
*下次更新：2026-04-12 12:00*
