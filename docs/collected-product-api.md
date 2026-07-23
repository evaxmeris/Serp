# 采集产品模块 - API 路由设计

## 基础路径: `/api/collected-products`

---

## 一、采集接收

### POST /api/collected-products
由 Chrome 插件调用，接收采集数据。

```json
// Request (Chrome 插件 → ERP)
{
  "source": "alibaba",           // "alibaba" | "1688"
  "sourceUrl": "https://...",
  "sourceId": "123456789",

  "title": "Hydrating Facial Serum 30ml",
  "shortDescription": "Deep moisturizing...",
  "description": "<div>...</div>",

  "price": 15.99,
  "currency": "USD",

  "images": [
    {
      "type": "main",
      "data": "(base64 string)",
      "mimeType": "image/jpeg",
      "fileName": "main.jpg"
    },
    {
      "type": "gallery",
      "data": "(base64 string)",
      "mimeType": "image/jpeg",
      "fileName": "gallery_01.jpg"
    }
  ],

  "attributes": [
    { "name": "材质", "value": "玻璃" },
    { "name": "容量", "value": "30ml" }
  ],

  "variants": [
    {
      "sku": "S001-R",
      "price": 15.99,
      "options": [{ "name": "颜色", "value": "红色" }]
    }
  ],

  "rawData": { }
}
```

```json
// Response 201
{
  "success": true,
  "data": {
    "id": "cm8abc123...",
    "pipelineStatus": "collected"
  }
}
```

### 权限: `collected_product.create`
### 注意: 插件用 API Token 鉴权，非 session 登录态

---

## 二、列表查询

### GET /api/collected-products

```json
// Query Parameters
{
  "page": 1,
  "limit": 20,
  "status": "organizing",      // 按管线状态筛选
  "source": "1688",            // 按来源平台筛选
  "search": "精华",            // 标题模糊搜索
  "dateFrom": "2026-07-01",
  "dateTo": "2026-07-21"
}
```

```json
// Response 200
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cm8abc...",
        "title": "Hydrating Facial Serum 30ml",
        "source": "alibaba",
        "sourceUrl": "https://...",
        "pipelineStatus": "organizing",
        "price": 15.99,
        "currency": "USD",
        "mainImage": "(base64 or placeholder URL)",
        "hasVariants": false,
        "productId": null,
        "woocommerceId": null,
        "collectedAt": "2026-07-21T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 85,
      "totalPages": 5
    }
  }
}
```

### 说明
- 列表返回主图缩略图和基本状态，不含大二进制数据
- 图片数据只返回第一张主图的缩略参考

### 权限: `collected_product.view`

---

## 三、获取详情

### GET /api/collected-products/[id]

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "cm8abc...",
    "source": "1688",
    "sourceUrl": "https://...",
    "title": "保湿精华液30ml",
    "titleEn": "Hydrating Facial Serum 30ml",
    "shortDescription": "...",
    "description": "<div>...</div>",
    "descriptionEn": "...",
    "brand": "S2R",
    "sku": "SERUM-30ML",
    "price": 15.99,
    "compareAtPrice": 25.00,
    "currency": "USD",
    "stockQuantity": 500,
    "weight": 0.15,
    "length": 5,
    "width": 5,
    "height": 12,
    "hsCode": "3304.99",
    "metaTitle": "...",
    "metaDescription": "...",
    "urlSlug": "hydrating-facial-serum",
    "tags": ["精华", "保湿", "护肤品"],
    "pipelineStatus": "organizing",
    "woocommerceId": null,
    "productId": null,
    "publishError": null,
    "collectedAt": "2026-07-21T12:00:00Z",
    "organizedAt": null,
    "lastPublishedAt": null,

    "images": [
      {
        "id": "img01",
        "type": "main",
        "mimeType": "image/jpeg",
        "fileSize": 204800,
        "width": 800,
        "height": 800,
        "sortOrder": 0,
        "altText": "产品主图"
      },
      {
        "id": "img02",
        "type": "gallery",
        "mimeType": "image/jpeg",
        "fileSize": 153600,
        "sortOrder": 1
      }
    ],
    "variants": [],
    "attributes": [
      { "name": "材质", "nameEn": "Material", "value": "玻璃", "valueEn": "Glass" }
    ],
    "publishLogs": [],
    "rawData": {}
  }
}
```

### 说明
- 图片数据以 `data:image/jpeg;base64,...` 格式通过接口返回给前端展示
- 大图片可能有性能问题，后续可考虑缩略图缓存

### 权限: `collected_product.view`

---

## 四、编辑更新

### PUT /api/collected-products/[id]

```json
// Request — 仅传要修改的字段
{
  "title": "...",
  "titleEn": "...",
  "description": "...",
  "descriptionEn": "...",
  "price": 18.99,
  "pipelineStatus": "organizing"
  // ...
}
```

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "cm8abc...",
    "pipelineStatus": "organizing",
    "woocommerceNeedsSync": false
    // 提示：如果已发布状态，woocommerceNeedsSync = true
    // 前端应弹窗问"是否同步到 WooCommerce？"
  }
}
```

### 特殊逻辑
- 如果当前 `pipelineStatus == published` 且修改了标题/价格/描述等关键字段 → 返回 `woocommerceNeedsSync: true`，前端弹窗询问是否同步

### 权限: `collected_product.edit`

---

## 五、状态流转

### PUT /api/collected-products/[id]/status

```json
// Request
{
  "status": "ready"        // 标记梳理完成
}
```

```json
// Response 200
{
  "success": true,
  "data": { "pipelineStatus": "ready" }
}
```

### 权限: `collected_product.edit`

---

## 六、AI 翻译

### POST /api/collected-products/[id]/translate

```json
// Request
{
  "fields": ["title", "description"]  // 要翻译的字段
}
```

```json
// Response 200
{
  "success": true,
  "data": {
    "titleEn": "Hydrating Facial Serum 30ml",
    "descriptionEn": "<div>Intensive hydration...</div>"
  }
}
```

### 说明
- 后端调用配置的 LLM API（DeepSeek/OpenAI 等）
- 翻完后**不自动保存**，返回结果让用户确认后再调 PUT 保存

### 权限: `collected_product.edit`

---

## 七、转为正式产品

### POST /api/collected-products/[id]/convert

把采集产品的基础元数据写入 Product 表。

```json
// Response 200
{
  "success": true,
  "data": {
    "productId": "prod123...",
    "sku": "SERUM-30ML",
    "name": "保湿精华液30ml"
  }
}
```

### 说明
- 只同步元数据：name, nameEn, salePrice, weight, specification → Product 表
- 图片只同步主图到 Product.images[0]
- 不自动发布到 WooCommerce（需要用户再点"发布"）

### 权限: `collected_product.edit`

---

## 八、发布到 WooCommerce

### POST /api/collected-products/[id]/publish

```json
// Response 200
{
  "success": true,
  "data": {
    "woocommerceId": 1234,
    "woocommerceUrl": "https://yourstore.com/product/hydrating-serum",
    "pipelineStatus": "published"
  }
}
```

```json
// Response 200 (失败时)
{
  "success": true,
  "data": {
    "pipelineStatus": "error",
    "publishError": "WooCommerce API returned 400: Invalid SKU"
  }
}
```

### 说明
- 如果当前 `productId` 为空 → 自动先 convert 再 publish
- 如果 `productId` 已有 → 更新 Product 表 + 发布到 WooCommerce
- 成功后创建 PublishLog 记录

### 权限: `collected_product.publish`

---

## 九、批量发布

### POST /api/collected-products/batch-publish

```json
// Request
{
  "ids": ["cm8abc...", "cm8def...", "cm8ghi..."]
}
```

```json
// Response 200
{
  "success": true,
  "data": {
    "total": 3,
    "success": 2,
    "failed": [
      { "id": "cm8def...", "error": "...", "pipelineStatus": "error" }
    ]
  }
}
```

### 权限: `collected_product.publish`

---

## 十、删除

### DELETE /api/collected-products/[id]

```json
// Response 200
{
  "success": true
}
```

### 权限: `collected_product.delete`

---

## 十一、外部采集接口（Chrome 插件使用）

### POST /api/external/collect
Chrome 插件使用 API Token 鉴权，非 session 登录态。

与 `POST /api/collected-products` 相同，但使用独立的 API Token 验证方式。

### 说明
API Token 在系统设置中生成，粘贴到插件配置里。

---

## 十二、系统设置

### 12.1 WooCommerce 配置

```
GET  /api/settings/woocommerce    → 获取配置
PUT  /api/settings/woocommerce    → 更新配置
```

```json
// PUT Request
{
  "url": "https://yourstore.com",
  "consumerKey": "ck_...",
  "consumerSecret": "cs_..."
}
```

### 12.2 翻译配置

```
GET  /api/settings/translation    → 获取翻译配置
PUT  /api/settings/translation    → 更新翻译配置
```

```json
// PUT Request
{
  "provider": "deepseek",
  "apiKey": "sk-...",
  "model": "deepseek-chat"
}
```

### 12.3 采集 API Token

```
GET  /api/settings/collect-token    → 获取/生成 API Token
PUT  /api/settings/collect-token    → 重新生成 Token
```

### 权限: `admin`（仅管理员可配置系统设置）
