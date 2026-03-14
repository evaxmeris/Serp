# 产品调研模块 API 接口规范

**日期:** 2026-03-13  
**版本:** v1.0  
**作者:** Trade ERP 系统架构师  
**模块:** Product Research (产品调研)

---

## 1. API 设计原则

### 1.1 RESTful 规范

- 使用资源名词，路径小写，单词间用连字符
- 使用 HTTP 动词语义（GET/POST/PUT/DELETE）
- 版本号包含在路径中：`/api/v1/`
- 遵循现有 Trade ERP API 规范

### 1.2 统一响应格式

```typescript
// 成功响应
{
  "success": true,
  "code": "SUCCESS",
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2026-03-13T10:30:00Z"
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
  "timestamp": "2026-03-13T10:30:00Z"
}

// 错误响应
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "errors": [
    { "field": "title", "message": "产品标题不能为空" }
  ],
  "timestamp": "2026-03-13T10:30:00Z"
}
```

---

## 2. 品类管理 API

### 2.1 获取品类列表

```http
GET /api/v1/categories
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |
| parentId | string | 否 | 父品类 ID（获取子品类） |
| level | number | 否 | 层级筛选 |
| isActive | boolean | 否 | 状态筛选 |
| search | string | 否 | 搜索关键词 |
| sortBy | string | 否 | 排序字段：name/sort/productCount/createdAt |
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
        "categoryNo": "CAT-ELECTRONICS-001",
        "name": "消费电子",
        "nameEn": "Consumer Electronics",
        "parentId": null,
        "level": 1,
        "path": "/1/",
        "description": "消费类电子产品",
        "isActive": true,
        "sort": 1,
        "productCount": 156,
        "children": [
          {
            "id": "clyyy...",
            "name": "智能穿戴",
            "productCount": 45
          }
        ],
        "createdAt": "2026-01-15T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 2.2 获取品类详情

```http
GET /api/v1/categories/:id
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 品类 ID |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "id": "clxxx...",
    "categoryNo": "CAT-ELECTRONICS-001",
    "name": "消费电子",
    "nameEn": "Consumer Electronics",
    "parentId": null,
    "parent": null,
    "children": [
      {
        "id": "clyyy...",
        "name": "智能穿戴",
        "productCount": 45
      }
    ],
    "level": 1,
    "path": "/1/",
    "description": "消费类电子产品，包括手机、平板、智能穿戴等",
    "keywords": ["电子", "数码", "智能"],
    "isActive": true,
    "sort": 1,
    "productCount": 156,
    "attributes": [
      {
        "id": "clattr1...",
        "name": "颜色",
        "code": "color",
        "type": "SELECT",
        "isRequired": false,
        "isSearchable": true,
        "isComparable": true,
        "displayOrder": 1,
        "options": [
          {"value": "black", "label": "黑色"},
          {"value": "white", "label": "白色"}
        ]
      },
      {
        "id": "clattr2...",
        "name": "尺寸",
        "code": "size",
        "type": "TEXT",
        "isRequired": true,
        "displayOrder": 2
      }
    ],
    "createdAt": "2026-01-15T08:00:00Z",
    "updatedAt": "2026-03-10T14:20:00Z"
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 2.3 创建品类

```http
POST /api/v1/categories
```

**请求体:**

```json
{
  "name": "智能穿戴",
  "nameEn": "Smart Wearables",
  "parentId": "clxxx...",
  "description": "智能手表、手环等可穿戴设备",
  "keywords": ["手表", "手环", "穿戴"],
  "isActive": true,
  "sort": 1
}
```

**验证规则:**

- `name`: 必填，2-50 字符
- `parentId`: 可选，必须是存在的品类 ID
- `sort`: 可选，默认 0

**响应:**

```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "id": "clnew...",
    "categoryNo": "CAT-WEARABLES-001",
    "name": "智能穿戴",
    "parentId": "clxxx...",
    "level": 2,
    "path": "/1/5/",
    ...
  },
  "message": "品类创建成功",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 2.4 更新品类

```http
PUT /api/v1/categories/:id
```

**请求体:** (部分更新)

```json
{
  "name": "智能穿戴设备",
  "description": "更新后的描述",
  "isActive": false,
  "sort": 10
}
```

**业务规则:**

- 不能将品类移动到其子品类下（循环引用检查）
- 停用品类时，如有产品关联则不允许

### 2.5 删除品类

```http
DELETE /api/v1/categories/:id
```

**业务规则:**

- 有子品类时不允许删除
- 有关联产品时不允许删除
- 软删除：设置 `isActive = false`

---

## 3. 属性模板 API

### 3.1 获取品类属性列表

```http
GET /api/v1/categories/:id/attributes
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 品类 ID |

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| isComparable | boolean | 筛选可对比属性 |
| isRequired | boolean | 筛选必填属性 |
| type | string | 属性类型筛选 |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "clattr1...",
        "categoryId": "clxxx...",
        "name": "颜色",
        "nameEn": "Color",
        "code": "color",
        "type": "SELECT",
        "isRequired": false,
        "isSearchable": true,
        "isComparable": true,
        "displayOrder": 1,
        "options": [
          {"value": "black", "label": "黑色"},
          {"value": "white", "label": "白色"},
          {"value": "red", "label": "红色"}
        ],
        "unit": null,
        "description": "产品颜色",
        "createdAt": "2026-01-15T08:00:00Z"
      },
      {
        "id": "clattr2...",
        "name": "电池容量",
        "code": "battery_capacity",
        "type": "NUMBER",
        "isRequired": true,
        "isComparable": true,
        "displayOrder": 2,
        "minValue": 100,
        "maxValue": 10000,
        "unit": "mAh",
        "createdAt": "2026-01-15T08:00:00Z"
      }
    ],
    "total": 15
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 3.2 创建属性模板

```http
POST /api/v1/categories/:id/attributes
```

**请求体:**

```json
{
  "name": "颜色",
  "nameEn": "Color",
  "code": "color",
  "type": "SELECT",
  "isRequired": false,
  "isSearchable": true,
  "isComparable": true,
  "displayOrder": 1,
  "options": [
    {"value": "black", "label": "黑色"},
    {"value": "white", "label": "白色"}
  ],
  "description": "产品颜色选项"
}
```

**验证规则:**

- `name`: 必填，2-50 字符
- `code`: 必填，3-30 字符，小写字母和下划线，同一品类下唯一
- `type`: 必填，有效的属性类型
- `options`: SELECT/MULTI_SELECT 类型必填

### 3.3 更新属性模板

```http
PUT /api/v1/categories/:id/attributes/:attrId
```

**请求体:** (部分更新)

```json
{
  "name": "产品颜色",
  "isRequired": true,
  "displayOrder": 5,
  "options": [
    {"value": "black", "label": "黑色"},
    {"value": "white", "label": "白色"},
    {"value": "blue", "label": "蓝色"}
  ]
}
```

**业务规则:**

- 修改 `type` 时，如已有属性值数据则不允许
- 删除 `options` 中的选项时，检查是否有产品使用该值

### 3.4 删除属性模板

```http
DELETE /api/v1/categories/:id/attributes/:attrId
```

**业务规则:**

- 有产品使用该属性时，提示确认删除
- 删除属性时同步删除所有关联的属性值

---

## 4. 产品调研 API

### 4.1 获取产品调研列表

```http
GET /api/v1/product-research
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |
| categoryId | string | 否 | 品类 ID 筛选 |
| status | string | 否 | 状态筛选：DRAFT/IN_REVIEW/PUBLISHED/ARCHIVED |
| stage | string | 否 | 阶段筛选：INITIAL/DEEP_DIVE/DECISION/TRACKING |
| brand | string | 否 | 品牌筛选 |
| ownerId | string | 否 | 负责人 ID 筛选 |
| minScore | number | 否 | 最低评分筛选 |
| grade | string | 否 | 评分等级筛选：S/A/B/C/D |
| recommendation | string | 否 | 推荐意见筛选 |
| search | string | 否 | 搜索关键词（标题/品牌/SKU） |
| sortBy | string | 否 | 排序字段：totalScore/createdAt/updatedAt |
| sortOrder | string | 否 | 排序方向：asc/desc |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "clprd1...",
        "productNo": "PRD-20260313-001",
        "title": "无线蓝牙耳机 TWS-X1",
        "titleEn": "Wireless Bluetooth Earbuds TWS-X1",
        "sku": "TWS-X1-BLK",
        "brand": "SoundTech",
        "category": {
          "id": "clxxx...",
          "name": "智能穿戴"
        },
        "status": "PUBLISHED",
        "stage": "DECISION",
        "latestScore": {
          "totalScore": 85.5,
          "grade": "A",
          "recommendation": "BUY"
        },
        "owner": {
          "id": "cluser...",
          "name": "张三"
        },
        "attachmentCount": 5,
        "createdAt": "2026-03-10T09:00:00Z",
        "updatedAt": "2026-03-12T16:30:00Z"
      },
      {
        "id": "clprd2...",
        "productNo": "PRD-20260313-002",
        "title": "智能手表 Watch Pro 5",
        "brand": "FitTime",
        "category": {
          "id": "clxxx...",
          "name": "智能穿戴"
        },
        "status": "IN_REVIEW",
        "stage": "DEEP_DIVE",
        "latestScore": {
          "totalScore": 78.2,
          "grade": "B",
          "recommendation": "HOLD"
        },
        "createdAt": "2026-03-11T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 4.2 获取产品调研详情

```http
GET /api/v1/product-research/:id
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 产品调研 ID |

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| include | string | 包含关联数据：basicInfo,marketAnalysis,competitionAnalysis,attributes,scoreDetails,attachments（逗号分隔） |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "id": "clprd1...",
    "productNo": "PRD-20260313-001",
    "title": "无线蓝牙耳机 TWS-X1",
    "titleEn": "Wireless Bluetooth Earbuds TWS-X1",
    "sku": "TWS-X1-BLK",
    "mpn": "ST-TWS-X1-2026",
    "brand": "SoundTech",
    "brandEn": "SoundTech",
    "categoryId": "clxxx...",
    "category": {
      "id": "clxxx...",
      "name": "智能穿戴",
      "nameEn": "Smart Wearables"
    },
    "status": "PUBLISHED",
    "stage": "DECISION",
    
    "basicInfo": {
      "id": "clbasic...",
      "description": "高品质无线蓝牙耳机，支持主动降噪...",
      "descriptionEn": "High-quality wireless Bluetooth earbuds with ANC...",
      "specification": "蓝牙 5.3, 续航 30 小时，IPX5 防水",
      "material": "ABS + PC",
      "color": "黑色/白色/蓝色",
      "size": "充电盒：60×45×25mm",
      "weight": 45.5,
      "packageSize": "120×100×50mm",
      "packageWeight": 250,
      "certifications": ["CE", "FCC", "RoHS"],
      "originCountry": "CN",
      "originProvince": "广东",
      "originCity": "深圳",
      "mainImage": "https://cdn.example.com/products/tws-x1-main.jpg",
      "images": [
        "https://cdn.example.com/products/tws-x1-1.jpg",
        "https://cdn.example.com/products/tws-x1-2.jpg"
      ],
      "hsCode": "8518.30.0000"
    },
    
    "marketAnalysis": {
      "id": "clmarket...",
      "marketSize": 50000000,
      "marketGrowth": 15.5,
      "marketTrend": "GROWING",
      "targetMarkets": ["US", "EU", "JP"],
      "targetCustomers": "18-35 岁年轻消费者，注重音质和外观",
      "priceRangeMin": 29.99,
      "priceRangeMax": 79.99,
      "priceRangeAvg": 49.99,
      "suggestedPrice": 45.99,
      "demandLevel": "HIGH",
      "seasonality": "Q4 销售旺季（节假日）",
      "salesChannels": ["Amazon", "eBay", "Shopify"],
      "strengths": "音质好，续航长，性价比高",
      "weaknesses": "品牌知名度低",
      "opportunities": "TWS 市场持续增长",
      "threats": "竞争激烈，价格战",
      "dataSources": ["Amazon BSR", "Google Trends", "行业报告"],
      "researchDate": "2026-03-10"
    },
    
    "competitionAnalysis": {
      "id": "clcomp...",
      "competitors": [
        {
          "name": "Anker Soundcore Life P3",
          "brand": "Anker",
          "price": 79.99,
          "rating": 4.5,
          "features": ["ANC", "35h 续航", "无线充电"],
          "url": "https://amazon.com/..."
        },
        {
          "name": "JBL Tune 230NC",
          "brand": "JBL",
          "price": 99.99,
          "rating": 4.3,
          "features": ["ANC", "40h 续航", "品牌知名度高"]
        }
      ],
      "mainCompetitors": ["Anker", "JBL", "Soundcore"],
      "competitionLevel": "HIGH",
      "ourAdvantages": "价格优势，音质表现好",
      "ourDisadvantages": "品牌知名度低，营销预算有限",
      "pricePosition": "MID_RANGE",
      "priceStrategy": "渗透定价，快速占领市场",
      "differentiation": "主打性价比，强调音质表现",
      "barriers": "进入门槛低，竞争激烈",
      "researchDate": "2026-03-10"
    },
    
    "attributeValues": [
      {
        "id": "clattrval1...",
        "attributeId": "clattr1...",
        "attribute": {
          "name": "颜色",
          "code": "color",
          "type": "SELECT"
        },
        "valueText": "black",
        "valueUnified": "黑色"
      },
      {
        "id": "clattrval2...",
        "attributeId": "clattr2...",
        "attribute": {
          "name": "电池容量",
          "code": "battery_capacity",
          "type": "NUMBER",
          "unit": "mAh"
        },
        "valueNumber": 500,
        "valueUnified": "500"
      },
      {
        "id": "clattrval3...",
        "attributeId": "clattr3...",
        "attribute": {
          "name": "蓝牙版本",
          "code": "bluetooth_version",
          "type": "TEXT"
        },
        "valueText": "5.3",
        "valueUnified": "5.3"
      }
    ],
    
    "latestScoreDetail": {
      "id": "clscore...",
      "version": 1,
      "isLatest": true,
      "marketScore": 88.0,
      "competitionScore": 75.0,
      "profitScore": 90.0,
      "supplyScore": 85.0,
      "riskScore": 30.0,
      "totalScore": 85.5,
      "grade": "A",
      "recommendation": "BUY",
      "recommendationNotes": "市场增长快，利润空间好，建议进入",
      "scoredBy": "cluser...",
      "scoredByName": "张三",
      "createdAt": "2026-03-12T16:30:00Z"
    },
    
    "attachments": [
      {
        "id": "clattach1...",
        "name": "产品主图",
        "type": "IMAGE",
        "mimeType": "image/jpeg",
        "size": 524288,
        "url": "https://cdn.example.com/products/tws-x1-main.jpg",
        "category": "PRODUCT_IMAGE",
        "createdAt": "2026-03-10T09:30:00Z"
      },
      {
        "id": "clattach2...",
        "name": "CE 认证证书",
        "type": "PDF",
        "mimeType": "application/pdf",
        "size": 1048576,
        "url": "https://cdn.example.com/certs/tws-x1-ce.pdf",
        "category": "CERTIFICATE",
        "createdAt": "2026-03-10T10:00:00Z"
      }
    ],
    
    "stockPlans": [
      {
        "id": "clstock...",
        "planNo": "SP-20260313-001",
        "planName": "首批备货计划",
        "quantity": 1000,
        "unit": "PCS",
        "unitCost": 25.00,
        "totalCost": 25000.00,
        "expectedPrice": 45.99,
        "expectedRevenue": 45990.00,
        "expectedProfit": 20990.00,
        "profitMargin": 45.64,
        "status": "PENDING",
        "planDate": "2026-03-13"
      }
    ],
    
    "notes": "重点推荐产品，建议优先推进",
    "internalNotes": "供应商已确认，可快速打样",
    "owner": {
      "id": "cluser...",
      "name": "张三",
      "email": "zhangsan@company.com"
    },
    "createdAt": "2026-03-10T09:00:00Z",
    "updatedAt": "2026-03-12T16:30:00Z",
    "publishedAt": "2026-03-12T17:00:00Z"
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 4.3 创建产品调研

```http
POST /api/v1/product-research
```

**请求体:**

```json
{
  "categoryId": "clxxx...",
  "title": "无线蓝牙耳机 TWS-X1",
  "titleEn": "Wireless Bluetooth Earbuds TWS-X1",
  "sku": "TWS-X1-BLK",
  "brand": "SoundTech",
  "status": "DRAFT",
  "stage": "INITIAL",
  "notes": "初步调研产品",
  
  "basicInfo": {
    "description": "高品质无线蓝牙耳机...",
    "specification": "蓝牙 5.3, 续航 30 小时",
    "material": "ABS + PC",
    "color": "黑色/白色/蓝色",
    "weight": 45.5,
    "packageWeight": 250,
    "certifications": ["CE", "FCC"],
    "originCountry": "CN",
    "mainImage": "https://...",
    "images": ["https://...", "https://..."],
    "hsCode": "8518.30.0000"
  },
  
  "marketAnalysis": {
    "marketSize": 50000000,
    "marketGrowth": 15.5,
    "marketTrend": "GROWING",
    "targetMarkets": ["US", "EU"],
    "priceRangeMin": 29.99,
    "priceRangeMax": 79.99,
    "suggestedPrice": 45.99,
    "demandLevel": "HIGH",
    "salesChannels": ["Amazon", "eBay"],
    "strengths": "音质好，续航长",
    "weaknesses": "品牌知名度低",
    "opportunities": "市场增长快",
    "threats": "竞争激烈"
  },
  
  "competitionAnalysis": {
    "competitors": [
      {
        "name": "Anker Soundcore Life P3",
        "brand": "Anker",
        "price": 79.99,
        "rating": 4.5
      }
    ],
    "mainCompetitors": ["Anker", "JBL"],
    "competitionLevel": "HIGH",
    "ourAdvantages": "价格优势",
    "ourDisadvantages": "品牌知名度低",
    "pricePosition": "MID_RANGE"
  },
  
  "attributeValues": [
    {
      "attributeId": "clattr1...",
      "valueText": "black",
      "valueUnified": "黑色"
    },
    {
      "attributeId": "clattr2...",
      "valueNumber": 500,
      "valueUnified": "500"
    }
  ]
}
```

**验证规则:**

- `categoryId`: 必填，有效的品类 ID
- `title`: 必填，2-200 字符
- `status`: 可选，默认 DRAFT
- `basicInfo`: 可选，创建时可省略
- `attributeValues`: 可选，可后续补充

**响应:**

```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "id": "clprd1...",
    "productNo": "PRD-20260313-001",
    "title": "无线蓝牙耳机 TWS-X1",
    "status": "DRAFT",
    ...
  },
  "message": "产品调研创建成功",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 4.4 更新产品调研

```http
PUT /api/v1/product-research/:id
```

**请求体:** (部分更新)

```json
{
  "title": "无线蓝牙耳机 TWS-X1 升级版",
  "status": "IN_REVIEW",
  "stage": "DEEP_DIVE",
  "notes": "更新产品描述"
}
```

**业务规则:**

- `PUBLISHED` 状态的产品修改需要重新审核
- `ARCHIVED` 状态的产品不可修改

### 4.5 删除产品调研

```http
DELETE /api/v1/product-research/:id
```

**业务规则:**

- 软删除：设置 `status = ARCHIVED`
- 有备货计划关联时提示确认

### 4.6 发布产品调研

```http
POST /api/v1/product-research/:id/publish
```

**请求体:**

```json
{
  "notes": "审核通过，正式发布"
}
```

**业务规则:**

- 只能发布 `IN_REVIEW` 状态的产品
- 发布后状态变为 `PUBLISHED`
- 记录 `publishedAt` 时间

### 4.7 归档产品调研

```http
POST /api/v1/product-research/:id/archive
```

**请求体:**

```json
{
  "notes": "产品已停产，归档"
}
```

---

## 5. 产品对比 API

### 5.1 产品对比

```http
GET /api/v1/product-research/compare
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ids | string | 是 | 产品 ID 列表，逗号分隔：id1,id2,id3 |
| includeAttributes | string | 否 | 包含的属性代码列表，逗号分隔（默认全部可对比属性） |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "products": [
      {
        "id": "clprd1...",
        "productNo": "PRD-20260313-001",
        "title": "无线蓝牙耳机 TWS-X1",
        "brand": "SoundTech",
        "category": {
          "name": "智能穿戴"
        },
        "basicInfo": {
          "weight": 45.5,
          "color": "黑色/白色/蓝色",
          "specification": "蓝牙 5.3, 续航 30 小时"
        },
        "latestScore": {
          "totalScore": 85.5,
          "grade": "A",
          "recommendation": "BUY"
        },
        "marketAnalysis": {
          "suggestedPrice": 45.99,
          "demandLevel": "HIGH"
        }
      },
      {
        "id": "clprd2...",
        "productNo": "PRD-20260313-002",
        "title": "智能手表 Watch Pro 5",
        "brand": "FitTime",
        "category": {
          "name": "智能穿戴"
        },
        "basicInfo": {
          "weight": 55.0,
          "color": "黑色/银色",
          "specification": "蓝牙 5.2, 续航 7 天"
        },
        "latestScore": {
          "totalScore": 78.2,
          "grade": "B",
          "recommendation": "HOLD"
        },
        "marketAnalysis": {
          "suggestedPrice": 89.99,
          "demandLevel": "MEDIUM"
        }
      }
    ],
    "comparison": {
      "attributes": [
        {
          "code": "color",
          "name": "颜色",
          "type": "TEXT",
          "values": ["黑色/白色/蓝色", "黑色/银色"],
          "isDifferent": true
        },
        {
          "code": "weight",
          "name": "重量",
          "type": "NUMBER",
          "unit": "g",
          "values": [45.5, 55.0],
          "isDifferent": true,
          "min": 45.5,
          "max": 55.0,
          "diff": 9.5
        },
        {
          "code": "bluetooth_version",
          "name": "蓝牙版本",
          "type": "TEXT",
          "values": ["5.3", "5.2"],
          "isDifferent": true
        }
      ],
      "scores": {
        "marketScore": [88.0, 75.0],
        "competitionScore": [75.0, 78.0],
        "profitScore": [90.0, 80.0],
        "supplyScore": [85.0, 82.0],
        "riskScore": [30.0, 35.0],
        "totalScore": [85.5, 78.2]
      },
      "priceComparison": {
        "suggestedPrice": [45.99, 89.99],
        "min": 45.99,
        "max": 89.99,
        "diff": 44.00
      }
    },
    "summary": {
      "bestScore": {
        "productId": "clprd1...",
        "title": "无线蓝牙耳机 TWS-X1",
        "totalScore": 85.5
      },
      "lowestPrice": {
        "productId": "clprd1...",
        "title": "无线蓝牙耳机 TWS-X1",
        "price": 45.99
      },
      "commonAttributes": 12,
      "differentAttributes": 5
    }
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 5.2 导出对比报告

```http
POST /api/v1/product-research/compare/export
```

**请求体:**

```json
{
  "productIds": ["clprd1...", "clprd2...", "clprd3..."],
  "format": "PDF",
  "includeAttributes": ["color", "size", "weight", "material"],
  "includeScores": true,
  "includeMarketAnalysis": true,
  "includeImages": true
}
```

**响应:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "exportId": "clexport...",
    "fileName": "product-comparison-20260313.pdf",
    "downloadUrl": "https://cdn.example.com/exports/product-comparison-20260313.pdf",
    "expiresAt": "2026-03-14T10:30:00Z"
  },
  "message": "对比报告生成成功",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

---

## 6. 属性值 API

### 6.1 获取产品属性值

```http
GET /api/v1/product-research/:id/attributes
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 产品调研 ID |

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "productId": "clprd1...",
    "productTitle": "无线蓝牙耳机 TWS-X1",
    "categoryId": "clxxx...",
    "categoryName": "智能穿戴",
    "attributes": [
      {
        "id": "clattrval1...",
        "attributeId": "clattr1...",
        "attribute": {
          "name": "颜色",
          "code": "color",
          "type": "SELECT",
          "isRequired": false,
          "unit": null
        },
        "valueText": "black",
        "valueNumber": null,
        "valueDecimal": null,
        "valueBoolean": null,
        "valueUnified": "黑色",
        "note": null,
        "updatedAt": "2026-03-10T09:30:00Z"
      },
      {
        "id": "clattrval2...",
        "attributeId": "clattr2...",
        "attribute": {
          "name": "电池容量",
          "code": "battery_capacity",
          "type": "NUMBER",
          "isRequired": true,
          "unit": "mAh"
        },
        "valueText": null,
        "valueNumber": 500,
        "valueDecimal": null,
        "valueUnified": "500",
        "note": null,
        "updatedAt": "2026-03-10T09:30:00Z"
      }
    ],
    "missingRequired": []
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 6.2 批量设置属性值

```http
POST /api/v1/product-research/:id/attributes/batch
```

**请求体:**

```json
{
  "attributes": [
    {
      "attributeId": "clattr1...",
      "valueText": "black",
      "valueUnified": "黑色"
    },
    {
      "attributeId": "clattr2...",
      "valueNumber": 500,
      "valueUnified": "500"
    },
    {
      "attributeId": "clattr3...",
      "valueText": "5.3",
      "valueUnified": "5.3"
    }
  ]
}
```

**验证规则:**

- 必填属性不能缺失
- 值类型必须与属性定义匹配
- SELECT 类型的值必须在选项范围内

**响应:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "updated": 3,
    "created": 2,
    "skipped": 0
  },
  "message": "属性值更新成功",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

---

## 7. 评分 API

### 7.1 获取产品评分历史

```http
GET /api/v1/product-research/:id/scores
```

**响应示例:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "productId": "clprd1...",
    "productTitle": "无线蓝牙耳机 TWS-X1",
    "latestScore": {
      "version": 2,
      "totalScore": 85.5,
      "grade": "A",
      "recommendation": "BUY",
      "scoredAt": "2026-03-12T16:30:00Z"
    },
    "history": [
      {
        "id": "clscore2...",
        "version": 2,
        "isLatest": true,
        "totalScore": 85.5,
        "grade": "A",
        "recommendation": "BUY",
        "scoredBy": "cluser...",
        "scoredByName": "张三",
        "createdAt": "2026-03-12T16:30:00Z"
      },
      {
        "id": "clscore1...",
        "version": 1,
        "isLatest": false,
        "totalScore": 82.0,
        "grade": "B",
        "recommendation": "HOLD",
        "scoredBy": "cluser2...",
        "scoredByName": "李四",
        "createdAt": "2026-03-11T10:00:00Z"
      }
    ]
  },
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 7.2 创建/更新产品评分

```http
POST /api/v1/product-research/:id/scores
```

**请求体:**

```json
{
  "marketScore": 88.0,
  "competitionScore": 75.0,
  "profitScore": 90.0,
  "supplyScore": 85.0,
  "riskScore": 30.0,
  "recommendation": "BUY",
  "recommendationNotes": "市场增长快，利润空间好，建议进入",
  "notes": "第二次评分，调整了竞争评分"
}
```

**验证规则:**

- 所有评分维度：0-100 分
- 权重总和必须为 1.0（如使用自定义权重）

**响应:**

```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "id": "clscore2...",
    "version": 2,
    "totalScore": 85.5,
    "grade": "A",
    "recommendation": "BUY",
    "isLatest": true
  },
  "message": "评分创建成功",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

---

## 8. 附件 API

### 8.1 获取产品附件列表

```http
GET /api/v1/product-research/:id/attachments
```

### 8.2 上传附件

```http
POST /api/v1/product-research/:id/attachments
Content-Type: multipart/form-data
```

**请求体:**

| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | 附件文件 |
| name | string | 附件名称 |
| category | string | 附件分类：PRODUCT_IMAGE/CERTIFICATE/... |
| description | string | 附件描述 |
| tags | string | 标签，逗号分隔 |

**响应:**

```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "id": "clattach...",
    "name": "产品主图",
    "type": "IMAGE",
    "mimeType": "image/jpeg",
    "size": 524288,
    "url": "https://cdn.example.com/products/tws-x1-main.jpg",
    "category": "PRODUCT_IMAGE",
    "createdAt": "2026-03-13T10:30:00Z"
  },
  "message": "附件上传成功",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

### 8.3 删除附件

```http
DELETE /api/v1/product-research/:productId/attachments/:id
```

---

## 9. 备货计划 API

### 9.1 获取备货计划列表

```http
GET /api/v1/product-research/:id/stock-plans
```

### 9.2 创建备货计划

```http
POST /api/v1/product-research/:id/stock-plans
```

**请求体:**

```json
{
  "planName": "首批备货计划",
  "quantity": 1000,
  "unit": "PCS",
  "unitCost": 25.00,
  "shippingCost": 3000.00,
  "expectedPrice": 45.99,
  "expectedSales": 950,
  "purchaseDate": "2026-03-20",
  "arrivalDate": "2026-04-20",
  "notes": "首批试单，控制风险"
}
```

### 9.3 更新备货计划

```http
PUT /api/v1/product-research/:productId/stock-plans/:id
```

### 9.4 审批备货计划

```http
POST /api/v1/product-research/:productId/stock-plans/:id/approve
```

---

## 10. 错误码规范

### 10.1 业务错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| CATEGORY_NOT_FOUND | 404 | 品类不存在 |
| CATEGORY_HAS_CHILDREN | 409 | 品类有子品类，无法删除 |
| CATEGORY_HAS_PRODUCTS | 409 | 品类有关联产品，无法删除 |
| ATTRIBUTE_NOT_FOUND | 404 | 属性模板不存在 |
| ATTRIBUTE_CODE_EXISTS | 409 | 属性代码已存在 |
| PRODUCT_NOT_FOUND | 404 | 产品调研不存在 |
| PRODUCT_INVALID_STATUS | 409 | 产品状态不允许此操作 |
| PRODUCT_ALREADY_PUBLISHED | 409 | 产品已发布 |
| PRODUCT_ALREADY_ARCHIVED | 409 | 产品已归档 |
| ATTRIBUTE_VALUE_INVALID | 422 | 属性值格式不正确 |
| REQUIRED_ATTRIBUTE_MISSING | 422 | 必填属性缺失 |
| SCORE_INVALID_RANGE | 422 | 评分超出范围（0-100） |
| COMPARE_MIN_PRODUCTS | 400 | 至少需要 2 个产品进行对比 |
| COMPARE_MAX_PRODUCTS | 400 | 最多支持 10 个产品对比 |
| ATTACHMENT_TOO_LARGE | 413 | 附件文件过大 |
| ATTACHMENT_INVALID_TYPE | 415 | 附件类型不支持 |

---

## 11. 权限矩阵

| 资源 | Viewer | User | Manager | Admin |
|------|--------|------|---------|-------|
| 品类列表 | ✅ | ✅ | ✅ | ✅ |
| 创建品类 | ❌ | ❌ | ✅ | ✅ |
| 编辑品类 | ❌ | ❌ | ✅ | ✅ |
| 删除品类 | ❌ | ❌ | ✅ | ✅ |
| 产品列表 | ✅ | ✅ | ✅ | ✅ |
| 创建产品 | ❌ | ✅ | ✅ | ✅ |
| 编辑产品 | ❌ | 自己的 | ✅ | ✅ |
| 发布产品 | ❌ | ❌ | ✅ | ✅ |
| 删除产品 | ❌ | 自己的 | ✅ | ✅ |
| 产品对比 | ✅ | ✅ | ✅ | ✅ |
| 导出对比 | ❌ | ✅ | ✅ | ✅ |
| 创建评分 | ❌ | ✅ | ✅ | ✅ |
| 创建备货计划 | ❌ | ✅ | ✅ | ✅ |
| 审批备货计划 | ❌ | ❌ | ✅ | ✅ |

---

## 12. 速率限制

- 普通接口：100 次/分钟
- 对比接口：30 次/分钟（计算密集型）
- 导出接口：10 次/分钟（资源密集型）
- 上传附件：20 次/分钟

---

*文档结束*
