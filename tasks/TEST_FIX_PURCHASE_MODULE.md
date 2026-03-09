# Sprint 3 - 采购模块测试修复任务

**分配给**: 开发工程师  
**优先级**: 🔴 高  
**预计工时**: 1 小时  
**截止时间**: 今日 14:00

---

## 📋 任务描述

修复采购模块测试中的 2 个失败用例，确保测试通过率达到 100%。

---

## ❌ 失败测试

### 测试 1: DELETE /api/v1/suppliers/[id] - 应该删除供应商

**错误信息:**
```
TypeError: Cannot read properties of undefined (reading 'id')
at tests/purchase-orders.test.ts:363:38
```

**问题定位:**
```javascript
const testResponse = await POST_SUPPLIER(testRequest);
const testData = await testResponse.json();
const testId = testData.data.id; // ❌ testData.data 是 undefined
```

**根本原因:**
测试代码期望响应格式为 `{ success: true, data: { id: "..." } }`，但实际 API 返回可能是 `{ success: true, data: undefined }` 或响应格式不匹配。

---

### 测试 2: POST /api/v1/purchase-orders - 应该验证供应商状态

**错误信息:**
```
TypeError: Cannot read properties of undefined (reading 'id')
at tests/purchase-orders.test.ts:498:41
```

**问题定位:**
```javascript
const poData = {
  ...testPurchaseOrderData,
  supplierId: supplierData.data.id, // ❌ supplierData.data 是 undefined
};
```

**根本原因:**
同上，供应商创建失败导致后续测试无法获取 ID。

---

## 🔧 修复方案

### 方案 A: 修复测试代码（推荐）

**修改 `tests/purchase-orders.test.ts`:**

```javascript
// 第 363 行 - 添加错误检查
const testResponse = await POST_SUPPLIER(testRequest);
const testData = await testResponse.json();

// ✅ 添加响应验证
if (!testData.success || !testData.data) {
  throw new Error(`创建供应商失败：${testData.message}`);
}
const testId = testData.data.id;

// 第 498 行 - 同样添加验证
const supplierResponse = await POST_SUPPLIER(supplierRequest);
const supplierData = await supplierResponse.json();

if (!supplierData.success || !supplierData.data) {
  throw new Error(`创建供应商失败：${supplierData.message}`);
}
const poData = {
  ...testPurchaseOrderData,
  supplierId: supplierData.data.id,
};
```

### 方案 B: 修复 API 响应

检查 `src/app/api/v1/suppliers/route.ts` 的 POST 处理，确保返回正确的数据格式。

---

## ✅ 验收标准

1. **测试通过率**: 166/166 (100%)
2. **采购模块测试**: 22/22 通过
3. **无新的测试失败**

---

## 📝 执行步骤

```bash
# 1. 修复测试代码
cd /Users/apple/clawd/trade-erp
# 编辑 tests/purchase-orders.test.ts

# 2. 运行测试验证
npm test -- tests/purchase-orders.test.ts

# 3. 运行全部测试
npm test

# 4. 提交修复
git add tests/purchase-orders.test.ts
git commit -m "fix: 修复采购模块测试响应验证"
git push
```

---

## 🎯 业务影响

- ✅ 确保供应商删除功能正常工作
- ✅ 确保采购订单验证逻辑正确
- ✅ 提高代码质量和可维护性

---

**创建时间**: 2026-03-09 12:55  
**状态**: 🔄 进行中  
**负责人**: 应亮 (项目经理代理)
