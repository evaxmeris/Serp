# UI 设计一致性审计报告

**日期：** 2026-04-12  
**审计人：** 前端设计组  
**范围：** product-research 模块所有页面

---

## 🎯 设计原则（统一标准）

### 1. 组件库使用

**必须使用 shadcn/ui 组件：**

| 组件类型 | 使用组件 | 禁止使用 |
|---------|---------|---------|
| 对话框 | `<Dialog>` `<DialogContent>` | 原生 `div.fixed` |
| 卡片 | `<Card>` `<CardHeader>` `<CardContent>` | 原生 `div.bg-white` |
| 表格 | `<Table>` `<TableBody>` `<TableRow>` | 原生 `table` |
| 按钮 | `<Button>` | 原生 `button.px-4.py-2` |
| 输入框 | `<Input>` | 原生 `input.border.rounded` |
| 标签 | `<Label>` | 原生 `label.block` |
| 下拉框 | `<Select>` `<SelectTrigger>` | 原生 `select.border` |
| 徽章 | `<Badge>` | 原生 `span.text-xs` |
| 复选框 | `<Checkbox>` | 原生 `input[type=checkbox]` |
| 文本域 | `<Textarea>` | 原生 `textarea.border` |

### 2. 布局规范

**页面结构：**
```tsx
<div className="container mx-auto p-6">
  <Card>
    <CardHeader>
      <CardTitle>页面标题</CardTitle>
      <CardDescription>页面描述</CardDescription>
    </CardHeader>
    <CardContent>
      {/* 内容区域 */}
    </CardContent>
  </Card>
</div>
```

**对话框结构：**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      {/* 表单内容 */}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={cancel}>取消</Button>
      <Button onClick={save}>保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 3. 响应式设计

- 移动端：单列布局
- 平板端（≥768px）：两列布局
- 桌面端（≥1024px）：三列或四列布局

使用 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`

### 4. 颜色规范

| 用途 | 颜色类 | 说明 |
|------|--------|------|
| 主按钮 | `bg-blue-600 hover:bg-blue-700` | 保存、确认 |
| 次要按钮 | `variant="outline"` | 取消、返回 |
| 危险操作 | `bg-red-600 hover:bg-red-700` | 删除 |
| 成功状态 | `bg-green-100 text-green-800` | 徽章 |
| 警告状态 | `bg-yellow-100 text-yellow-800` | 徽章 |

---

## 📋 页面审计结果

### ✅ 符合标准

| 页面 | 状态 | 说明 |
|------|------|------|
| templates/page.tsx | ✅ 符合 | 使用 shadcn/ui 组件 |
| products/page.tsx | ✅ 符合 | 使用 shadcn/ui 组件 |
| comparisons/page.tsx | ✅ 符合 | 使用 shadcn/ui 组件 |
| dashboard/page.tsx | ✅ 符合 | 使用 shadcn/ui 组件 |
| import/page.tsx | ✅ 符合 | 使用 shadcn/ui 组件 |

### ❌ 不符合标准

| 页面 | 问题 | 优先级 |
|------|------|--------|
| categories/page.tsx | 使用原生 HTML+Tailwind，未使用 shadcn/ui | P0 |

---

## 🔧 修复计划

### categories/page.tsx 修复清单

**负责人：** 前端开发组  
**截止时间：** 2026-04-12 18:00

**需要修改的内容：**

1. **导入 shadcn/ui 组件**
   ```tsx
   import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
   import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
   import { Button } from '@/components/ui/button';
   import { Input } from '@/components/ui/input';
   import { Label } from '@/components/ui/label';
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
   import { Checkbox } from '@/components/ui/checkbox';
   import { Textarea } from '@/components/ui/textarea';
   import { Badge } from '@/components/ui/badge';
   ```

2. **替换对话框**
   - 从 `div.fixed.inset-0` → `<Dialog>` `<DialogContent>`
   - 添加 `<DialogHeader>` `<DialogTitle>`
   - 添加 `<DialogFooter>` 包含按钮

3. **替换表单控件**
   - `input.border.rounded` → `<Input>`
   - `select.border.rounded` → `<Select>`
   - `textarea.border.rounded` → `<Textarea>`
   - `label.block` → `<Label>`
   - `input[type=checkbox]` → `<Checkbox>`

4. **优化布局**
   - 使用 `<Card>` 包裹内容
   - 使用 `grid` 布局实现响应式
   - 统一间距 `gap-4`

5. **添加徽章**
   - 品类统计使用 `<Badge>` 组件
   - 状态显示使用 `<Badge variant=...>`

---

## 📝 修改后代码示例

**对话框部分：**
```tsx
<Dialog open={showModal} onOpenChange={setShowModal}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>
        {editingCategory ? '编辑品类' : '新建品类'}
      </DialogTitle>
    </DialogHeader>
    
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">品类名称 *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="如：电子产品"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nameEn">英文名称</Label>
          <Input
            id="nameEn"
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            placeholder="如：Electronic Products"
          />
        </div>
      </div>
      
      {/* 其他表单字段... */}
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowModal(false)}>
        取消
      </Button>
      <Button onClick={handleSave}>
        保存
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## ✅ 验证清单

修改完成后需要验证：

- [ ] 所有组件使用 shadcn/ui
- [ ] 对话框样式统一
- [ ] 表单布局响应式
- [ ] 按钮样式一致
- [ ] 移动端显示正常
- [ ] 桌面端显示正常
- [ ] 与其他页面视觉一致

---

## 📊 后续行动

1. **立即修复** categories/page.tsx（P0 优先级）
2. **代码审查** 所有新建页面必须使用 shadcn/ui
3. **文档更新** 将本规范添加到 `docs/frontend-design-guide.md`
4. **团队通知** 在 ERP 开发群同步设计规范

---

*创建时间：2026-04-12 06:10*  
*状态：进行中*
