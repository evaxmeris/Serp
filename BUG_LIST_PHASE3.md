# Phase 3 Bug List - Trade ERP

## Bug Tracking

| Bug ID | Priority | Status | Component | Description | Fixed Date |
|--------|----------|--------|-----------|-------------|------------|
| BUG-QUOTATION-001 | P0 | ✅ Fixed | Frontend | 报价管理页面渲染失败 | 2026-03-09 |

---

## BUG-QUOTATION-001 - 报价管理页面错误

### 问题描述
- **发现时间:** 2026-03-09 01:33
- **优先级:** P0
- **状态:** ✅ 已修复

### 现象
- 访问 http://localhost:3001/quotations 显示错误
- 错误信息："Application error: a client-side exception has occurred"
- API 正常返回数据（4 条报价单）
- 控制台无明确错误信息

### 根本原因
**类型不匹配:** API 返回的 `totalAmount` 字段是**字符串类型**（如 `"2050"`），但在前端组件的 TypeScript 接口中被定义为 `number` 类型。

当页面尝试调用 `quotation.totalAmount.toFixed(2)` 时，由于字符串没有 `toFixed()` 方法，导致运行时错误。

**API 响应示例:**
```json
{
  "totalAmount": "2050"  // 字符串类型
}
```

**错误的接口定义:**
```typescript
interface Quotation {
  totalAmount: number;  // ❌ 应该是 string | number
}
```

### 修复方案
1. **修改接口定义** - 将 `totalAmount` 类型改为 `string | number`
2. **添加格式化函数** - 创建 `formatAmount()` 函数处理两种类型

**修复后的代码:**
```typescript
interface Quotation {
  // ...
  totalAmount: string | number;  // ✅ 支持两种类型
  // ...
}

const formatAmount = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
};

// 渲染时使用
{quotation.currency} {formatAmount(quotation.totalAmount)}
```

### 验证结果
- ✅ 构建成功：`npm run build` 通过
- ✅ 页面访问：http://localhost:3001/quotations 正常显示
- ✅ 数据加载：4 条报价单数据正常渲染
- ✅ 金额显示：格式化正确（如 "USD 2050.00"）

### 修复文件
- `src/app/quotations/page.tsx`

### 预防措施
1. 在 API 接口文档中明确字段类型
2. 前端接口定义应与实际 API 响应保持一致
3. 对于可能为字符串的数字字段，使用联合类型 `string | number`
4. 添加类型转换/格式化辅助函数处理边界情况

---

## 修复记录

### 2026-03-09
- **01:34** - 开始诊断
- **01:35** - 检查页面组件和 UI 组件，所有组件存在
- **01:36** - 检查 API 响应，发现 `totalAmount` 为字符串类型
- **01:37** - 修复接口定义和渲染逻辑
- **01:38** - 重新编译并测试，页面恢复正常
- **01:39** - 更新 BUG_LIST_PHASE3.md
