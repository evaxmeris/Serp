# WooCommerce 发布服务设计

## 概述

发布服务的核心职责：将 CollectedProduct 的完整数据映射为 WooCommerce 产品，通过 REST API 创建或更新。

## WooCommerce REST API 对应关系

### 产品创建/更新

```
POST /wp-json/wc/v3/products     → 创建
PUT  /wp-json/wc/v3/products/:id  → 更新
```

### 字段映射

| CollectedProduct | WooCommerce API 字段 | 说明 |
|-----------------|---------------------|------|
| title / titleEn | name | 优先用英文标题 |
| descriptionEn / description | description | 优先用英文描述 |
| shortDescription | short_description | |
| sku | sku | |
| price | regular_price | |
| compareAtPrice | sale_price | WooCommerce 的 sale_price 配合 regular_price 显示折扣 |
| weight | weight | |
| length | dimensions.length | |
| width | dimensions.width | |
| height | dimensions.height | |
| tags | tags[] | 传入时自动创建不存在的标签 |
| metaTitle | meta_data[{key:"_yoast_wpseo_title"}] | SEO 插件 |
| metaDescription | meta_data[{key:"_yoast_wpseo_metadesc"}] | SEO 插件 |
| woocommerceCategoryId | categories[{id}] | |
| 采集来源信息 | meta_data[{key:"_collected_from"}] | 标记来源平台 |
| ERP 产品 ID | meta_data[{key:"_erp_product_id"}] | 反向关联 |

### 图片上传

```
图片数据（bytea）→ 临时文件 → POST /wp-json/wp/v2/media
                         → 返回 attachment ID
                         → WooCommerce 产品引用 images[{id}]
```

流程：

```
CollectedProductImage.data (bytea)
    ↓ 从 DB 读取二进制
    ↓ 写入临时文件
    ↓ POST /wp-json/wp/v2/media
    ↓    Headers: Content-Disposition, Content-Type
    ↓    Auth: Consumer Key / Secret (Basic Auth)
    ↓ 返回 media_id
    ↓
主图 → images[{ id: media_id, position: 0 }]
图库 → images[{ id: media_id, position: 1 }]
      images[{ id: media_id, position: 2 }]
      ...
```

### 变体（Variable Product）

如果产品有变体（variants 表有数据），流程变为两步：

```
Step 1: 创建父产品 (type: variable)
  POST /wp-json/wc/v3/products
  {
    name: "...",
    type: "variable",
    attributes: [
      { name: "颜色", variation: true },
      { name: "尺寸", variation: true }
    ]
  }
  ← 返回父产品 ID: 123

Step 2: 创建每个变体子产品
  POST /wp-json/wc/v3/products/123/variations
  {
    sku: "SERUM-R-S",
    regular_price: "14.99",
    attributes: [
      { name: "颜色", option: "红色" },
      { name: "尺寸", option: "S" }
    ],
    image: { id: media_id }  // 变体独立图片
  }
```

---

## 发布流程

### 首次发布

```
用户点击"发布"
    ↓
1. 检查 productId 是否已关联
   ├── 有 → 使用已关联的 Product 表数据
   └── 无 → 自动执行 convert（采集品 → Product）
           → 生成 SKU（如未填则自动生成）
    ↓
2. 准备 WooCommerce 产品数据
   ├── 基本字段映射
   ├── 优先用英文字段
   ├── HTML 清洗（二次清洗，确保无平台痕迹）
   └── 图片上传（获取 media_id）
    ↓
3. 调 WooCommerce API
   ├── POST /products
   ├── 记录 PublishLog（请求/响应/耗时）
   ├── 成功 → 更新 woocommerceId、woocommerceUrl
   │          pipelineStatus → published
   └── 失败 → pipelineStatus → error
              publishError → 错误信息
```

### 更新（已发布产品）

```
用户在编辑页修改后点"保存并同步到 WooCommerce"
    ↓
1. 收集变更的字段
2. 调 WooCommerce API
   ├── PUT /products/:woocommerceId
   ├── 图片处理（新增/删除/替换）
   └── 变体处理（新增/更新/删除变体）
```

---

## WooCommerce API 客户端模块

```typescript
// src/lib/woocommerce-publisher.ts

export class WooCommercePublisher {
  constructor(config: WooCommerceConfig)

  // 创建产品
  async create(product: CollectedProduct): Promise<PublishResult>

  // 更新产品
  async update(product: CollectedProduct): Promise<PublishResult>

  // 上传单张图片 bytea → WooCommerce media_id
  private async uploadImage(data: Buffer, fileName: string, mimeType: string): Promise<number>

  // 映射字段
  private buildProductData(product: CollectedProduct): object

  // 处理变体
  private async createVariations(productId: number, variants: Variant[]): Promise<void>
}

interface PublishResult {
  success: boolean
  woocommerceId?: number
  woocommerceUrl?: string
  error?: string
  durationMs: number
}
```

---

## HTML 清洗规则

```
应用时机：
  1. Chrome 插件采集时（基础清洗）
  2. 发布到 WooCommerce 前（二次深度清洗）

清洗规则：
  ── 移除 ──
  · <script> 标签及内容
  · <iframe> 标签
  · 所有行内事件（onclick, onload 等）
  · 站外链接（指向 alibaba.com, 1688.com, taobao.com 的 <a>）
  · 阿里/1688 的推荐模块（根据 class/id 特征）
  · 二维码图片（根据 class/alt 特征）
  · 统计像素/追踪图片

  ── 保留 ──
  · 产品描述文字
  · 产品说明图片（无平台水印）
  · 表格/规格参数
  · 基本的 HTML 格式（p, div, ul, ol, li, table, img）

  ── 替换 ──
  · 所有图片 src 改为 CDN 可访问的链接（发布时已上传到 WooCommerce）
  · 绝对路径改为相对路径
```
