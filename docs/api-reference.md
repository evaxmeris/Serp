# Trade ERP API 参考文档

**项目:** Trade ERP 外贸企业资源管理系统  
**版本:** v0.8.0  
**最后更新:** 2026-04-09  
**Base URL:** `https://your-domain.com/api`

---

## 目录

1. [简介](#简介)
2. [认证](#认证)
3. [通用响应格式](#通用响应格式)
4. [错误码说明](#错误码说明)
5. [认证 API](#认证-api)
6. [订单管理 API](#订单管理-api)
7. [产品管理 API](#产品管理-api)
8. [客户管理 API](#客户管理-api)
9. [采购管理 API](#采购管理-api)
10. [供应商管理 API](#供应商管理-api)
11. [批量操作 API](#批量操作-api)
12. [仪表板统计 API](#仪表板统计-api)
13. [报价管理 API](#报价管理-api)
14. [询盘管理 API](#询盘管理-api)
15. [库存管理 API](#库存管理-api)
16. [报表 API](#报表-api)
17. [速率限制](#速率限制)
18. [版本管理](#版本管理)

---

## 简介

Trade ERP 提供完整的 RESTful API 供客户端集成。本文档描述了所有公开 API 的使用方法。

### API 设计原则

- 遵循 RESTful 设计规范
- 使用 JSON 格式请求和响应
- 统一响应格式，便于客户端处理
- JWT + HttpOnly Cookie 认证
- 支持角色权限控制

---

## 认证

### 认证流程

Trade ERP 使用 **JWT + HttpOnly Cookie** 认证方案：

1. 客户端调用 `/api/auth/login` 登录
2. 服务端验证用户名密码成功后，设置 HttpOnly Cookie `auth-token`
3. 浏览器会自动在后续请求中携带 Cookie
4. 服务端验证 JWT 有效性，通过后处理请求

### 认证方式

**对于浏览器客户端（推荐）：**
- 依靠浏览器自动发送 Cookie，无需额外处理
- 登录成功后 Cookie 自动设置

**对于第三方调用（Postman/APP）：**
```http
Cookie: auth-token=<jwt_token>
```

### 获取当前用户信息

客户端每次页面加载后应该调用 `/api/auth/me` 检查认证状态。

### 权限

API 根据用户角色进行权限控制，不同角色有不同权限：

| 角色 | 权限等级 | 说明 |
|------|----------|------|
| `VIEWER` | 1 | 只读权限 |
| `USER` | 2 | 普通用户，可以操作自己负责的业务 |
| `MANAGER` | 3 | 经理，可以审批和管理部门业务 |
| `ADMIN` | 4 | 管理员，完整权限 |

高级角色自动包含低级角色所有权限。

---

## 通用响应格式

### 成功响应（单条数据）

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

### 列表响应（分页）

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  },
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

### 错误响应

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "errors": [
    {
      "field": "email",
      "message": "邮箱格式不正确"
    }
  ],
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | OK，请求成功 |
| 201 | Created，资源创建成功 |
| 204 | No Content，删除成功 |
| 400 | Bad Request，请求参数错误 |
| 401 | Unauthorized，未认证 |
| 403 | Forbidden，无权限 |
| 404 | Not Found，资源不存在 |
| 409 | Conflict，资源冲突 |
| 422 | Unprocessable Entity，验证失败 |
| 429 | Too Many Requests，请求超限 |
| 500 | Internal Server Error，服务器错误 |

---

## 错误码说明

### 通用错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `SUCCESS` | 200 | 成功 |
| `CREATED` | 201 | 创建成功 |
| `NO_CONTENT` | 204 | 删除成功 |
| `BAD_REQUEST` | 400 | 请求参数错误 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `VALIDATION_ERROR` | 422 | 验证失败 |
| `TOO_MANY_REQUESTS` | 429 | 请求超限 |
| `INTERNAL_ERROR` | 500 | 服务器错误 |

### 订单业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `ORDER_INVALID_STATUS` | 409 | 订单状态不允许此操作 |
| `ORDER_ALREADY_CONFIRMED` | 409 | 订单已确认 |
| `ORDER_ALREADY_CANCELLED` | 409 | 订单已取消 |
| `INSUFFICIENT_STOCK` | 409 | 库存不足 |

### 供应商业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `SUPPLIER_NOT_FOUND` | 404 | 供应商不存在 |
| `SUPPLIER_INACTIVE` | 409 | 供应商已停用 |

### 采购业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `PURCHASE_ORDER_NOT_FOUND` | 404 | 采购单不存在 |
| `RECEIPT_QTY_EXCEEDS` | 409 | 入库数量超过订单数量 |

### 产品业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `PRODUCT_NOT_FOUND` | 404 | 产品不存在 |
| `PRODUCT_SKU_EXISTS` | 409 | SKU 已存在 |
| `PRODUCT_HAS_RELATED_DATA` | 409 | 产品存在关联数据，无法删除 |

### 客户业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `CUSTOMER_NOT_FOUND` | 404 | 客户不存在 |
| `CUSTOMER_EMAIL_EXISTS` | 409 | 邮箱已存在 |

---

## 认证 API

### POST `/api/auth/login`

用户登录。登录成功后自动设置 HttpOnly Cookie。

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**成功响应 (200):**
```json
{
  "success": true,
  "user": {
    "id": "cly...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "message": "登录成功"
}
```

**失败响应 (401):**
```json
{
  "error": "账号或密码错误"
}
```

**失败响应 (400):**
```json
{
  "error": "邮箱和密码不能为空"
}
```

**失败响应 (429):**
```json
{
  "error": "请求过于频繁，请稍后再试"
}
```

---

### GET `/api/auth/me`

获取当前登录用户信息，检查认证状态。

**成功响应 (200 - 已认证):**
```json
{
  "authenticated": true,
  "user": {
    "id": "cly...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

**失败响应 (401 - 未认证):**
```json
{
  "authenticated": false
}
```

---

### POST `/api/auth/logout`

用户登出，清除 Cookie。

**成功响应:**
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

### POST `/api/auth/register`

用户注册（开放注册模式）。

**请求体:**
```json
{
  "email": "new@example.com",
  "name": "New User",
  "password": "password123",
  "role": "USER"
}
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址（唯一） |
| name | string | 是 | 用户姓名 |
| password | string | 是 | 密码 |
| role | string | 否 | 角色，默认 `USER` |

**成功响应 (201):**
```json
{
  "id": "cly...",
  "email": "new@example.com",
  "name": "New User",
  "role": "USER",
  "createdAt": "2026-03-22T00:00:00.000Z",
  "updatedAt": "2026-03-22T00:00:00.000Z"
}
```

**错误响应 (400):**
```json
{
  "error": "User already exists"
}
```

---

## 订单管理 API

### GET `/api/orders`

获取订单列表（分页）。

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
| search | string | 否 | 搜索关键词（订单号/客户名）|
| sortBy | string | 否 | 排序字段，默认 `createdAt` |
| sortOrder | string | 否 | 排序方向：`asc`/`desc`，默认 `desc` |

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
        "createdAt": "2026-03-01T08:00:00.000Z",
        "updatedAt": "2026-03-02T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  },
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

---

### GET `/api/orders/:id`

获取订单详情。

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
    "notes": "Rush order, please prioritize",
    "createdAt": "2026-03-01T08:00:00.000Z",
    "updatedAt": "2026-03-02T10:30:00.000Z"
  },
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

---

### POST `/api/orders`

创建订单。

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

**权限:** 需要 `USER` 或以上角色。

---

### PUT `/api/orders/:id`

更新订单（部分更新）。

**请求体:**
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

**权限:** 创建者或 `MANAGER` 或以上角色。

---

### POST `/api/orders/:id/confirm`

确认订单。

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

**权限:** 需要 `MANAGER` 或以上角色。

---

### POST `/api/orders/:id/cancel`

取消订单。

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

---

### GET `/api/orders/statistics`

获取订单统计数据。

**查询参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | 统计周期：`day`/`week`/`month`/`quarter`/`year` |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| groupBy | string | 分组维度：`status`/`salesRep`/`customer` |

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
      { "status": "CONFIRMED", "count": 25, "amount": 375000.00 }
    ],
    "bySalesRep": [
      { "salesRepId": "clzzz...", "salesRepName": "张三", "count": 45, "amount": 675000.00 }
    ],
    "trend": [
      { "date": "2026-03-01", "orders": 5, "amount": 75000.00 }
    ]
  },
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

---

## 产品管理 API

### GET `/api/products`

获取产品列表（分页）。

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码 |
| limit | number | 否 | 每页数量 |
| status | string | 否 | 状态筛选 |
| category | string | 否 | 分类筛选 |
| supplierId | string | 否 | 供应商筛选 |
| search | string | 否 | 搜索关键词（SKU/名称）|
| minPrice | number | 否 | 最低价格 |
| maxPrice | number | 否 | 最高价格 |

---

### GET `/api/products/:id`

获取产品详情。

**路径参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 产品 ID |

---

### POST `/api/products`

创建产品。

**请求体:**
```json
{
  "sku": "PROD-001",
  "name": "产品名称",
  "nameEn": "Product Name",
  "unit": "PCS",
  "costPrice": 10.00,
  "salePrice": 20.00,
  "currency": "USD",
  "status": "ACTIVE",
  "category": "electronics",
  "description": "产品描述",
  "images": ["https://.../image.jpg"]
}
```

**验证规则:**
- `sku`: 必填，唯一
- `name`: 必填
- `salePrice`: 非负数

---

### PUT `/api/products/:id`

更新产品。

**请求体:** 部分更新，同创建产品。

---

### DELETE `/api/products/:id`

删除产品。

**业务规则:**
- 没有关联数据（订单、库存、采购）才能删除
- 需要产品管理权限

---

## 客户管理 API

### GET `/api/customers`

获取客户列表（分页）。

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码 |
| limit | number | 否 | 每页数量 |
| status | string | 否 | 状态筛选 |
| level | string | 否 | 等级筛选 |
| country | string | 否 | 国家筛选 |
| salesRepId | string | 否 | 业务员筛选 |
| search | string | 否 | 搜索关键词 |

---

### GET `/api/customers/:id`

获取客户详情。

---

### POST `/api/customers`

创建客户。

**请求体:**
```json
{
  "companyName": "ABC Trading Co., Ltd.",
  "contactName": "John Smith",
  "email": "john@abc.com",
  "phone": "+1-234-567-8900",
  "country": "US",
  "status": "ACTIVE",
  "level": "VIP",
  "source": "Google",
  "website": "https://abc.com",
  "address": "123 Main Street, Los Angeles, CA",
  "notes": "VIP customer"
}
```

---

### PUT `/api/customers/:id`

更新客户。

---

### DELETE `/api/customers/:id`

删除客户。

---

## 采购管理 API

### GET `/api/v1/purchase-orders`

获取采购订单列表。

**查询参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| status | string | 状态筛选 |
| supplierId | string | 供应商筛选 |
| salesOrderId | string | 关联销售订单 |
| purchaserId | string | 采购员筛选 |

---

### GET `/api/v1/purchase-orders/:id`

获取采购订单详情。

---

### POST `/api/v1/purchase-orders`

创建采购订单。

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
    }
  ]
}
```

---

## 供应商管理 API

### GET `/api/v1/suppliers`

获取供应商列表。

**查询参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| status | string | 状态筛选 |
| type | string | 类型：`DOMESTIC`/`OVERSEAS` |
| level | string | 等级筛选 |
| search | string | 搜索关键词 |

---

### GET `/api/v1/suppliers/:id`

获取供应商详情。

---

### POST `/api/v1/suppliers`

创建供应商。

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

---

## 批量操作 API

### 通用批量响应格式

所有批量操作使用统一的响应格式：

```json
{
  "success": true,
  "message": "成功操作 X 项，失败 Y 项",
  "total": 10,
  "successCount": 8,
  "failedCount": 2,
  "errors": [
    {
      "id": "clxxx...",
      "message": "订单状态不是待确认，无法确认"
    }
  ]
}
```

**限制:** 单次批量操作最多 100 条记录（导入除外，最多 1000 条）。

---

### 订单批量操作

#### POST `/api/orders/batch-confirm`

批量确认订单。

**请求体:**
```json
{
  "ids": ["clid1...", "clid2...", "clid3..."]
}
```

**业务规则:**
- 只能确认 `PENDING` 状态的订单
- 如果有任何一个订单状态不正确，整批失败
- 需要销售管理权限

**响应示例:**
```json
{
  "success": true,
  "message": "成功确认 5 条订单",
  "confirmedCount": 5
}
```

---

#### POST `/api/orders/batch-ship`

批量发货。

**请求体:**
```json
{
  "ids": ["clid1...", "clid2..."],
  "trackingNumbers": {
    "clid1...": "1ZA23456789",
    "clid2...": "1ZA98765432"
  },
  "sendNotification": true
}
```

**业务规则:**
- 只能发货 `CONFIRMED` 状态的订单
- 为每个订单创建出库单
- 需要发货权限

**响应示例:**
```json
{
  "success": true,
  "message": "成功发货 2 条订单",
  "shippedCount": 2
}
```

---

### 产品批量操作

#### POST `/api/products/batch-import`

批量导入产品。

**请求体:**
```json
{
  "products": [
    {
      "sku": "SKU001",
      "name": "产品 1",
      "costPrice": 10.00,
      "salePrice": 20.00
    },
    {
      "sku": "SKU002",
      "name": "产品 2",
      "costPrice": 15.00,
      "salePrice": 30.00
    }
  ],
  "mode": "create"
}
```

**参数说明:**
| 参数 | 说明 |
|------|------|
| products | 产品数据数组 |
| mode | `create` - 新建（SKU 存在报错），`update` - 更新已存在 |

**限制:** 单次最多 1000 条。

**响应示例:**
```json
{
  "success": true,
  "message": "导入完成：成功 18 条，失败 2 条",
  "results": {
    "success": 18,
    "failed": 2,
    "errors": [
      {
        "index": 3,
        "error": "SKU SKU003 已存在"
      }
    ]
  }
}
```

**权限:** 需要产品管理权限。

---

#### GET `/api/products/batch-export`

批量导出产品。

**请求体:**
```json
{
  "ids": ["id1...", "id2..."],
  "filters": { "status": "ACTIVE", "category": "electronics" },
  "fields": ["sku", "name", "costPrice", "salePrice", "category"]
}
```

**响应:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 文件下载。

**权限:** 需要产品管理权限。

---

#### DELETE `/api/products/batch-delete`

批量删除产品。

**请求体:**
```json
{
  "ids": ["id1...", "id2..."]
}
```

**业务规则:**
- 产品有关联数据（库存、订单、采购）无法删除
- 需要产品管理权限

**响应示例:**
```json
{
  "success": true,
  "message": "成功删除 3 条产品",
  "deletedCount": 3
}
```

---

### 客户批量操作

#### POST `/api/customers/batch-import`

批量导入客户。

**请求体:**
```json
{
  "customers": [
    {
      "companyName": "ABC Company",
      "contactName": "John Doe",
      "email": "john@abc.com",
      "country": "US"
    }
  ],
  "mode": "create",
  "assignSalesRepId": "userid..."
}
```

**参数说明:**
| 参数 | 说明 |
|------|------|
| customers | 客户数据数组 |
| mode | `create` - 新建（邮箱存在报错），`update` - 更新 |
| assignSalesRepId | 可选，分配给指定业务员 |

**限制:** 单次最多 1000 条。

**权限:** 需要客户管理权限。

---

#### POST `/api/customers/batch-export`

批量导出客户到 Excel。

同产品批量导出。

---

#### POST `/api/customers/batch-tag`

批量添加/移除标签。

**请求体:**
```json
{
  "ids": ["id1...", "id2..."],
  "action": "add",
  "tags": ["VIP", "潜在客户"]
}
```

**参数说明:**
| 参数 | 说明 |
|------|------|
| action | `add` - 添加标签，`remove` - 移除标签 |
| tags | 标签数组 |

**权限:** 需要客户管理权限。

---

## 仪表板统计 API

### GET `/api/dashboard/overview`

获取概览统计数据。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 1250,
    "monthlyOrders": 45,
    "monthlyRevenue": 125000.00,
    "totalCustomers": 320,
    "newCustomersThisMonth": 12,
    "totalProducts": 850,
    "lowStockProducts": 8,
    "pendingOrders": 12,
    "confirmedOrders": 25
  }
}
```

---

### GET `/api/dashboard/orders`

获取订单统计数据。

---

### GET `/api/dashboard/products`

获取产品统计数据。

---

### GET `/api/dashboard/customers`

获取客户统计数据。

---

### GET `/api/dashboard/sales`

获取销售趋势数据。

---

## 报价管理 API

### GET `/api/quotations`

获取报价单列表。

---

### GET `/api/quotations/:id`

获取报价单详情。

---

### POST `/api/quotations`

创建报价单。

---

### PUT `/api/quotations/:id`

更新报价单。

---

### POST `/api/quotations/:id/convert`

将报价单转换为订单。

---

### POST `/api/quotations/:id/send`

发送报价单给客户。

---

## 询盘管理 API

### GET `/api/inquiries`

获取询盘列表。

---

### GET `/api/inquiries/:id`

获取询盘详情。

---

### POST `/api/inquiries`

创建询盘。

---

### PUT `/api/inquiries/:id`

更新询盘。

---

## 库存管理 API

### GET `/api/v1/inventory`

获取库存列表。

**查询参数:**
| 参数 | 说明 |
|------|------|
| warehouse | 仓库筛选 |
| productId | 产品筛选 |
| lowStock | 是否只显示低库存 |

---

### POST `/api/v1/inbound-orders`

创建入库单。

---

### POST `/api/v1/inbound-orders/:id/confirm`

确认入库。

---

### POST `/api/v1/inbound-orders/:id/cancel`

取消入库单。

---

### POST `/api/v1/outbound-orders`

创建出库单。

---

### POST `/api/v1/outbound-orders/:id/confirm`

确认出库/发货。

---

### POST `/api/v1/outbound-orders/:id/cancel`

取消出库单。

---

### POST `/api/v1/outbound-orders/batch`

批量创建出库单。

---

## 报表 API

### GET `/api/v1/reports/dashboard`

获取仪表板报表数据。

---

### GET `/api/v1/reports/sales`

获取销售报表。

**查询参数:**
| 参数 | 说明 |
|------|------|
| startDate | 开始日期 |
| endDate | 结束日期 |
| groupBy | 分组维度：`day`/`week`/`month`/`salesRep` |

---

### GET `/api/v1/reports/purchase`

获取采购报表。

---

### GET `/api/v1/reports/profit`

获取利润分析报表。

---

### GET `/api/v1/reports/inventory`

获取库存报表。

---

### GET `/api/v1/reports/cashflow`

获取现金流报表。

---

### POST `/api/v1/reports/export`

导出报表数据到 Excel。

---

### POST `/api/v1/reports/subscribe`

订阅报表（定时发送）。

---

## 速率限制

API 返回速率限制信息在响应头：

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709712000
```

**限制规则:**

| API 类型 | 限制 |
|----------|------|
| 普通接口 | 100 次/分钟 |
| 认证接口（登录/注册）| 10 次/分钟 |
| 导出接口 | 5 次/分钟 |

**超限响应:**
```json
{
  "error": "Too Many Requests",
  "code": "TOO_MANY_REQUESTS",
  "message": "请求过于频繁，请稍后再试"
}
```

---

## 版本管理

### 版本策略

- 路径版本化：`/api/v1/`, `/api/v2/`
- 向后兼容至少维护 2 个大版本
- 废弃接口提前 3 个月通知

### 当前版本

- **v1**: 当前稳定版本，所有新接口都在 v1 路径下
- 部分旧接口无版本前缀，仍兼容使用

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-09 | v0.8.0 | 初始完整 API 参考文档创建，包含所有已实现端点 |

---

*文档结束*
