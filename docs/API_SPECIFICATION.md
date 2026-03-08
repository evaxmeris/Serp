# Trade ERP API 接口规范

**日期:** 2026-03-06  
**版本:** v1.0  
**作者:** 系统架构师

---

## 1. API 设计原则

### 1.1 RESTful 规范

- 使用资源名词，不使用动词
- 使用 HTTP 动词语义
- 路径使用小写，单词间用连字符
- 版本号包含在路径中：`/api/v1/`

### 1.2 统一响应格式

```typescript
// 成功响应
{
  "success": true,
  "code": "SUCCESS",
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2026-03-06T10:30:00Z"
}

// 列表响应
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "timestamp": "2026-03-06T10:30:00Z"
}

// 错误响应
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "errors": [
    { "field": "email", "message": "邮箱格式不正确" }
  ],
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 1.3 HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 成功获取或更新 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 删除成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 422 | Unprocessable Entity | 验证失败 |
| 429 | Too Many Requests | 请求超限 |
| 500 | Internal Server Error | 服务器错误 |

---

## 2. 订单管理 API

### 2.1 订单列表

```http
GET /api/v1/orders
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |
| status | string | 否 | 订单状态筛选 |
| customerId | string | 否 | 客户 ID 筛选 |
| salesRepId | string | 否 | 业务员 ID 筛选 |
| startDate | string | 否 | 开始日期 (ISO 8601) |
| endDate | string | 否 | 结束日期 (ISO 8601) |
| search | string | 否 | 搜索关键词（订单号/客户名） |
| sortBy | string | 否 | 排序字段，默认 createdAt |
| sortOrder | string | 否 | 排序方向：asc/desc |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "clxxx...",
        "orderNo": "SO-20260306-001",
        "customer": {
          "id": "clyyy...",
          "companyName": "ABC Trading Co., Ltd."
        },
        "status": "CONFIRMED",
        "currency": "USD",
        "totalAmount": 15000.00,
        "paidAmount": 4500.00,
        "balanceAmount": 10500.00,
        "deliveryDate": "2026-04-15",
        "salesRep": {
          "id": "clzzz...",
          "name": "张三"
        },
        "itemCount": 5,
        "createdAt": "2026-03-01T08:00:00Z",
        "updatedAt": "2026-03-02T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  },
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 2.2 获取订单详情

```http
GET /api/v1/orders/:id
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 订单 ID |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "id": "clxxx...",
    "orderNo": "SO-20260306-001",
    "customer": {
      "id": "clyyy...",
      "companyName": "ABC Trading Co., Ltd.",
      "contactName": "John Smith",
      "email": "john@abc.com",
      "phone": "+1-234-567-8900"
    },
    "sourceInquiry": {
      "id": "clinquiry...",
      "inquiryNo": "INQ-20260225-001"
    },
    "sourceQuotation": {
      "id": "clquot...",
      "quotationNo": "QT-20260228-001"
    },
    "status": "CONFIRMED",
    "approvalStatus": "APPROVED",
    "currency": "USD",
    "exchangeRate": 7.25,
    "totalAmount": 15000.00,
    "paidAmount": 4500.00,
    "balanceAmount": 10500.00,
    "paymentTerms": "T/T 30% deposit, 70% before shipment",
    "paymentDeadline": "2026-04-10",
    "deliveryTerms": "FOB Shanghai",
    "deliveryDate": "2026-04-15",
    "deliveryDeadline": "2026-04-20",
    "shippingAddress": "123 Main Street, Los Angeles, CA 90001, USA",
    "shippingContact": "John Smith",
    "shippingPhone": "+1-234-567-8900",
    "salesRep": {
      "id": "clzzz...",
      "name": "张三",
      "email": "zhangsan@company.com"
    },
    "items": [
      {
        "id": "clitem1...",
        "product": {
          "id": "clprod...",
          "sku": "PROD-001",
          "name": "Widget A"
        },
        "productName": "Widget A",
        "productSku": "PROD-001",
        "specification": "Size: 10x20cm, Color: Blue",
        "quantity": 1000,
        "unit": "PCS",
        "unitPrice": 10.00,
        "discountRate": 0,
        "amount": 10000.00,
        "productionStatus": "IN_PROGRESS",
        "shippedQty": 0,
        "deliveredQty": 0,
        "hsCode": "1234.56.7890",
        "notes": "Custom packaging required"
      },
      {
        "id": "clitem2...",
        "productName": "Widget B",
        "quantity": 500,
        "unitPrice": 10.00,
        "amount": 5000.00
      }
    ],
    "payments": [
      {
        "id": "clpay...",
        "paymentNo": "PAY-20260302-001",
        "amount": 4500.00,
        "currency": "USD",
        "paymentMethod": "T/T",
        "paymentDate": "2026-03-02",
        "status": "COMPLETED"
      }
    ],
    "shipments": [],
    "productionRecords": [
      {
        "id": "clprodrec...",
        "productionNo": "PR-20260303-001",
        "status": "IN_PROGRESS",
        "progress": 60,
        "plannedEndDate": "2026-04-10"
      }
    ],
    "notes": "Rush order, please prioritize",
    "internalNotes": "VIP customer, ensure quality",
    "attachments": ["https://.../contract.pdf"],
    "confirmedAt": "2026-03-02T10:00:00Z",
    "createdAt": "2026-03-01T08:00:00Z",
    "updatedAt": "2026-03-02T10:30:00Z"
  },
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 2.3 创建订单

```http
POST /api/v1/orders
```

**请求体:**

```json
{
  "customerId": "clyyy...",
  "sourceInquiryId": "clinquiry...",
  "sourceQuotationId": "clquot...",
  "currency": "USD",
  "exchangeRate": 7.25,
  "paymentTerms": "T/T 30% deposit, 70% before shipment",
  "paymentDeadline": "2026-04-10",
  "deliveryTerms": "FOB Shanghai",
  "deliveryDate": "2026-04-15",
  "shippingAddress": "123 Main Street, Los Angeles, CA 90001, USA",
  "shippingContact": "John Smith",
  "shippingPhone": "+1-234-567-8900",
  "salesRepId": "clzzz...",
  "notes": "Rush order, please prioritize",
  "items": [
    {
      "productId": "clprod...",
      "quantity": 1000,
      "unitPrice": 10.00,
      "discountRate": 0,
      "specification": "Size: 10x20cm, Color: Blue",
      "notes": "Custom packaging required"
    },
    {
      "productName": "Widget B",
      "quantity": 500,
      "unitPrice": 10.00
    }
  ]
}
```

**验证规则:**

- `customerId`: 必填，有效的客户 ID
- `items`: 必填，至少包含一项
- `items[].quantity`: 必填，正整数
- `items[].unitPrice`: 必填，非负数
- `deliveryDate`: 可选，但必须晚于当前日期

**响应:**

```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "id": "clxxx...",
    "orderNo": "SO-20260306-001",
    "status": "PENDING",
    ...
  },
  "message": "订单创建成功",
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 2.4 更新订单

```http
PUT /api/v1/orders/:id
```

**请求体:** (部分更新)

```json
{
  "status": "CONFIRMED",
  "deliveryDate": "2026-04-20",
  "notes": "Updated delivery date per customer request"
}
```

**业务规则:**

- 只有 `PENDING` 状态的订单可以修改商品
- `CANCELLED` 状态的订单不可修改
- 状态变更需要记录操作日志

### 2.5 确认订单

```http
POST /api/v1/orders/:id/confirm
```

**请求体:**

```json
{
  "notes": "订单已确认，开始安排生产"
}
```

**业务规则:**

- 只能确认 `PENDING` 状态的订单
- 确认后状态变为 `CONFIRMED`
- 自动创建生产记录

**响应:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "id": "clxxx...",
    "orderNo": "SO-20260306-001",
    "status": "CONFIRMED",
    "confirmedAt": "2026-03-06T10:30:00Z"
  },
  "message": "订单已确认",
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 2.6 取消订单

```http
POST /api/v1/orders/:id/cancel
```

**请求体:**

```json
{
  "cancelReason": "客户取消订单",
  "notes": "客户因市场变化取消订单"
}
```

**业务规则:**

- `SHIPPED` 及之后状态的订单不可取消
- 取消后状态变为 `CANCELLED`
- 需要记录取消原因

### 2.7 获取订单统计

```http
GET /api/v1/orders/statistics
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | 统计周期：day/week/month/quarter/year |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| groupBy | string | 分组维度：status/salesRep/customer |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "overview": {
      "totalOrders": 156,
      "totalAmount": 2350000.00,
      "completedOrders": 89,
      "completedAmount": 1420000.00,
      "pendingOrders": 12,
      "pendingAmount": 180000.00
    },
    "byStatus": [
      { "status": "PENDING", "count": 12, "amount": 180000.00 },
      { "status": "CONFIRMED", "count": 25, "amount": 375000.00 },
      { "status": "IN_PRODUCTION", "count": 30, "amount": 450000.00 }
    ],
    "bySalesRep": [
      { "salesRepId": "clzzz...", "salesRepName": "张三", "count": 45, "amount": 675000.00 },
      { "salesRepId": "clzzz2...", "salesRepName": "李四", "count": 38, "amount": 570000.00 }
    ],
    "trend": [
      { "date": "2026-03-01", "orders": 5, "amount": 75000.00 },
      { "date": "2026-03-02", "orders": 8, "amount": 120000.00 }
    ]
  },
  "timestamp": "2026-03-06T10:30:00Z"
}
```

---

## 3. 采购管理 API

### 3.1 供应商列表

```http
GET /api/v1/suppliers
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| status | string | 状态筛选 |
| type | string | 类型：DOMESTIC/OVERSEAS |
| level | string | 等级筛选 |
| search | string | 搜索关键词 |
| sortBy | string | 排序字段 |
| sortOrder | string | 排序方向 |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "clsup...",
        "supplierNo": "SUP-20260101-001",
        "companyName": "上海某某制造有限公司",
        "companyEn": "Shanghai ABC Manufacturing Co., Ltd.",
        "contactName": "李经理",
        "email": "li@abc-mfg.com",
        "phone": "+86-21-1234-5678",
        "country": "CN",
        "type": "DOMESTIC",
        "level": "PREFERRED",
        "score": 4.5,
        "status": "ACTIVE",
        "totalOrders": 25,
        "totalAmount": 350000.00,
        "lastOrderDate": "2026-02-28",
        "owner": {
          "id": "cluser...",
          "name": "采购员 A"
        },
        "createdAt": "2026-01-01T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 3.2 创建供应商

```http
POST /api/v1/suppliers
```

**请求体:**

```json
{
  "companyName": "上海某某制造有限公司",
  "companyEn": "Shanghai ABC Manufacturing Co., Ltd.",
  "contactName": "李经理",
  "contactTitle": "销售经理",
  "email": "li@abc-mfg.com",
  "phone": "+86-21-1234-5678",
  "mobile": "+86-138-0000-0000",
  "address": "上海市某某区某某路 100 号",
  "city": "上海",
  "province": "上海",
  "country": "CN",
  "taxId": "91310000XXXXXXXX1234",
  "bankName": "中国工商银行上海分行",
  "bankAccount": "1234567890123456789",
  "products": "电子产品、塑料制品",
  "categories": ["electronics", "plastics"],
  "type": "DOMESTIC",
  "creditTerms": "月结 30 天",
  "paymentMethods": ["T/T", "支付宝"],
  "currency": "CNY",
  "notes": "优质供应商，合作 3 年"
}
```

### 3.3 采购订单列表

```http
GET /api/v1/purchase-orders
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| status | string | 状态筛选 |
| supplierId | string | 供应商 ID |
| salesOrderId | string | 关联销售订单 ID |
| purchaserId | string | 采购员 ID |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| search | string | 搜索关键词 |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "clpo...",
        "poNo": "PO-20260306-001",
        "supplier": {
          "id": "clsup...",
          "companyName": "上海某某制造有限公司"
        },
        "salesOrder": {
          "id": "clxxx...",
          "orderNo": "SO-20260306-001"
        },
        "status": "CONFIRMED",
        "currency": "CNY",
        "totalAmount": 50000.00,
        "paidAmount": 15000.00,
        "deliveryDate": "2026-04-10",
        "purchaser": {
          "id": "cluser...",
          "name": "采购员 A"
        },
        "itemCount": 3,
        "createdAt": "2026-03-05T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 78,
      "totalPages": 4
    }
  },
  "timestamp": "2026-03-06T10:30:00Z"
}
```

### 3.4 创建采购订单

```http
POST /api/v1/purchase-orders
```

**请求体:**

```json
{
  "supplierId": "clsup...",
  "salesOrderId": "clxxx...",
  "currency": "CNY",
  "deliveryDate": "2026-04-10",
  "deliveryAddress": "上海市某某仓库",
  "paymentTerms": "货到付款",
  "purchaserId": "cluser...",
  "notes": "请加急生产",
  "items": [
    {
      "productId": "clprod...",
      "quantity": 1000,
      "unitPrice": 45.00,
      "taxRate": 13,
      "expectedDeliveryDate": "2026-04-10"
    },
    {
      "productName": "包装材料",
      "quantity": 500,
      "unitPrice": 10.00
    }
  ]
}
```

### 3.5 采购入库

```http
POST /api/v1/purchase-orders/:id/receipt
```

**请求体:**

```json
{
  "warehouse": "MAIN",
  "receiptDate": "2026-04-10",
  "receiptBy": "仓库管理员 A",
  "items": [
    {
      "purchaseOrderItemId": "clpoitem...",
      "quantity": 1000,
      "acceptedQty": 980,
      "rejectedQty": 20,
      "location": "A-01-02",
      "notes": "20 件外观不良"
    }
  ],
  "notes": "已完成入库",
  "qualityStatus": "PASSED"
}
```

**业务规则:**

- 入库数量不能超过订单未收数量
- 不合格品需要记录原因
- 入库后自动更新库存

### 3.6 供应商付款

```http
POST /api/v1/purchase-orders/:id/payment
```

**请求体:**

```json
{
  "amount": 35000.00,
  "currency": "CNY",
  "paymentMethod": "银行转账",
  "paymentDate": "2026-04-15",
  "bankName": "中国工商银行",
  "bankAccount": "1234567890123456789",
  "bankReference": "REF20260415001",
  "notes": "支付剩余货款",
  "attachments": ["https://.../payment_proof.pdf"]
}
```

### 3.7 供应商评估

```http
POST /api/v1/suppliers/:id/evaluation
```

**请求体:**

```json
{
  "period": "2026-Q1",
  "qualityScore": 4.5,
  "deliveryScore": 4.0,
  "priceScore": 4.2,
  "serviceScore": 4.8,
  "comments": "整体表现优秀，交期略有延迟",
  "improvementPlan": "建议加强生产计划管理"
}
```

---

## 4. 错误码规范

### 4.1 通用错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| SUCCESS | 200 | 成功 |
| CREATED | 201 | 创建成功 |
| NO_CONTENT | 204 | 删除成功 |
| BAD_REQUEST | 400 | 请求参数错误 |
| UNAUTHORIZED | 401 | 未认证 |
| FORBIDDEN | 403 | 无权限 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| VALIDATION_ERROR | 422 | 验证失败 |
| TOO_MANY_REQUESTS | 429 | 请求超限 |
| INTERNAL_ERROR | 500 | 服务器错误 |

### 4.2 业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| ORDER_NOT_FOUND | 404 | 订单不存在 |
| ORDER_INVALID_STATUS | 409 | 订单状态不允许此操作 |
| ORDER_ALREADY_CONFIRMED | 409 | 订单已确认 |
| ORDER_ALREADY_CANCELLED | 409 | 订单已取消 |
| INSUFFICIENT_STOCK | 409 | 库存不足 |
| SUPPLIER_NOT_FOUND | 404 | 供应商不存在 |
| SUPPLIER_INACTIVE | 409 | 供应商已停用 |
| PURCHASE_ORDER_NOT_FOUND | 404 | 采购单不存在 |
| RECEIPT_QTY_EXCEEDS | 409 | 入库数量超过订单数量 |

---

## 5. 认证与授权

### 5.1 认证方式

使用 JWT Token 进行认证：

```http
Authorization: Bearer <jwt_token>
```

### 5.2 权限矩阵

| 资源 | Viewer | User | Manager | Admin |
|------|--------|------|---------|-------|
| 订单列表 | ✅ | ✅ | ✅ | ✅ |
| 订单详情 | ✅ | ✅ | ✅ | ✅ |
| 创建订单 | ❌ | ✅ | ✅ | ✅ |
| 编辑订单 | ❌ | 自己的 | ✅ | ✅ |
| 删除订单 | ❌ | ❌ | ✅ | ✅ |
| 确认订单 | ❌ | ❌ | ✅ | ✅ |
| 取消订单 | ❌ | 自己的 | ✅ | ✅ |
| 供应商列表 | ✅ | ✅ | ✅ | ✅ |
| 创建供应商 | ❌ | ❌ | ✅ | ✅ |
| 采购订单 | ❌ | 采购员 | ✅ | ✅ |

---

## 6. 速率限制

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709712000
```

- 普通接口：100 次/分钟
- 敏感接口（认证、支付）：10 次/分钟
- 导出接口：5 次/分钟

---

## 7. API 版本管理

### 7.1 版本策略

- 路径版本化：`/api/v1/`, `/api/v2/`
- 向后兼容至少 2 个大版本
- 废弃接口提前 3 个月通知

### 7.2 废弃流程

1. 标记接口为 `@deprecated`
2. 在响应头添加 `Deprecation` 字段
3. 文档中标注废弃日期和替代方案
4. 到期后移除接口

---

## 8. 开发工具

### 8.1 OpenAPI 文档

访问 `http://localhost:3000/api/docs` 查看交互式 API 文档

### 8.2 Postman 集合

导入 `postman/trade-erp-api.json` 进行接口测试

### 8.3 生成 API Client

```bash
# 使用 openapi-typescript-codegen
npx openapi-typescript-codegen --input ./openapi.json --output ./src/client
```

---

*文档结束*
