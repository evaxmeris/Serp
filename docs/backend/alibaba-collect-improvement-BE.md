# 阿里国际站商品采集改进 — 后端详细设计文档 (BE)

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2026-07-26 | Hermes BE | 后端详细设计（Sprint 1 + Sprint 2） |

---

## 目录

1. [Sprint 1 PR1: API 层补全设计](#1-sprint-1-pr1-api-层补全设计)
2. [Sprint 1 PR2: Chrome 插件提取引擎设计](#2-sprint-1-pr2-chrome-插件提取引擎设计)
3. [Sprint 1 PR3: Python 采集器增强设计](#3-sprint-1-pr3-python-采集器增强设计)
4. [Sprint 2: WooCommerce 发布器扩展设计](#4-sprint-2-woocommerce-发布器扩展设计)
5. [Sprint 2: 梳理后台 API 设计](#5-sprint-2-梳理后台-api-设计)
6. [附录: 接口类型定义](#6-附录-接口类型定义)

---

## 1. Sprint 1 PR1: API 层补全设计

### 1.1 POST /api/external/collect — 字段补全

**文件**: `src/app/api/external/collect/route.ts` (当前196行)

当前缺失字段: `length`, `width`, `height`, `shippingClass`, `hsCode`

#### 1.1.1 Create 逻辑改动点

在现有 `prisma.collectedProduct.create({ data: {...} })` 的 data 对象中，在 `weight` 行之后补入以下5行：

```typescript
// 在 weight 行之后（第133行）插入：
length: body.length ? parseFloat(body.length) : null,
width: body.width ? parseFloat(body.width) : null,
height: body.height ? parseFloat(body.height) : null,
shippingClass: body.shippingClass || null,
hsCode: body.hsCode || null,
```

**完整 create data 对象（改动后）**：

```typescript
data: {
  source: body.source,
  sourceUrl: body.sourceUrl,
  sourceId: body.sourceId || null,
  title: body.title || '(无标题)',
  titleEn: body.titleEn || null,
  shortDescription: body.shortDescription || null,
  description: body.description || null,
  descriptionEn: body.descriptionEn || null,
  brand: body.brand || null,
  sku: body.sku || null,
  price: body.price ? parseFloat(body.price) : null,
  compareAtPrice: body.compareAtPrice ? parseFloat(body.compareAtPrice) : null,
  currency: body.currency || 'USD',
  stockQuantity: body.stockQuantity ? parseInt(body.stockQuantity) : null,
  weight: body.weight ? parseFloat(body.weight) : null,
  // ★ 新增字段 (以下5行)
  length: body.length ? parseFloat(body.length) : null,
  width: body.width ? parseFloat(body.width) : null,
  height: body.height ? parseFloat(body.height) : null,
  shippingClass: body.shippingClass || null,
  hsCode: body.hsCode || null,
  pipelineStatus: 'collected',
  collectedAt: new Date(),
  rawData: body.rawData || null,
},
```

#### 1.1.2 Update 逻辑改动点

在现有 `prisma.collectedProduct.update({ where: { id: existing.id }, data: {...} })` 的 data 对象中，在 `weight` 行之后（第66行）补入：

```typescript
// 在 weight 行之后（第66行）插入：
length: body.length ? parseFloat(body.length) : existing.length,
width: body.width ? parseFloat(body.width) : existing.width,
height: body.height ? parseFloat(body.height) : existing.height,
shippingClass: body.shippingClass || existing.shippingClass,
hsCode: body.hsCode || existing.hsCode,
```

#### 1.1.3 Request Body 类型定义

```typescript
// Chrome 插件 / Python 采集器发送的 payload
interface CollectRequestBody {
  // 来源 (已有)
  source: string;             // "alibaba" | "1688"
  sourceUrl: string;
  sourceId?: string | null;

  // 基本信息 (已有)
  title?: string;
  titleEn?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  brand?: string | null;
  sku?: string | null;

  // 价格 (已有)
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  currency?: string;
  stockQuantity?: number | string | null;

  // 物流 (★ 新增)
  weight?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  shippingClass?: string | null;
  hsCode?: string | null;

  // 子表 (已有)
  images?: CollectImage[];
  variants?: CollectVariant[];
  attributes?: CollectAttribute[];

  // 原始数据 (已有, 但新增内部字段)
  rawData?: {
    tieredPricing?: TieredPrice[];     // ★ 新增
    supplier?: SupplierInfo;            // ★ 新增
    aggregateRating?: AggregateRating;  // ★ 新增
    moq?: number;                       // ★ 新增
    url?: string;
    capturedAt?: string;
  } | null;
}

interface TieredPrice {
  minQty: number;
  maxQty: number | null;  // null = "无限" (如 "100+")
  price: number;
  unit: string;           // "USD" | "EUR" | ...
}

interface SupplierInfo {
  name: string;
  url: string;
  verified: boolean;
  rating?: number;
  responseRate?: string;
}

interface AggregateRating {
  ratingValue: number;
  reviewCount: number;
}
```

### 1.2 新增 GET /api/external/collect/check — 去重查询端点

**文件**: `src/app/api/external/collect/check/route.ts` (新建)

#### 1.2.1 接口定义

| 项目 | 值 |
|------|-----|
| 方法 | GET |
| 路径 | `/api/external/collect/check` |
| 鉴权 | X-API-Token (与 POST 一致) |
| 查询参数 | `sourceUrl` (必填) — 阿里国际站产品页完整URL |
| 用途 | Chrome 插件在采集前调用，判断是否已采集过 |

#### 1.2.2 完整实现代码

```typescript
// src/app/api/external/collect/check/route.ts
import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/external/collect/check?sourceUrl=xxx
 * 去重查询：检查产品是否已经被采集过
 * 返回 existing 信息，让前端决定是否继续采集
 */
export async function GET(request: NextRequest) {
  try {
    // 验证 API Token
    const apiToken = request.headers.get('X-API-Token');
    if (!apiToken) {
      return errorResponse('缺少 API Token', 'UNAUTHORIZED', 401);
    }

    const tokenConfig = await prisma.systemConfig.findUnique({
      where: { key: 'collect_api_token' },
    });

    if (!tokenConfig || tokenConfig.value !== apiToken) {
      return errorResponse('API Token 无效', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const sourceUrl = searchParams.get('sourceUrl');

    if (!sourceUrl) {
      return errorResponse('缺少 sourceUrl 参数', 'VALIDATION_ERROR', 422);
    }

    // 按 sourceUrl 查找已有记录
    const existing = await prisma.collectedProduct.findFirst({
      where: { sourceUrl },
      orderBy: { collectedAt: 'desc' },
      select: {
        id: true,
        title: true,
        pipelineStatus: true,
        collectedAt: true,
      },
    });

    if (!existing) {
      return successResponse({
        exists: false,
        message: '该产品尚未采集',
      }, '未采集');
    }

    // 已存在 → 返回详情
    const minutesAgo = Math.floor(
      (Date.now() - existing.collectedAt.getTime()) / 60000
    );

    return successResponse({
      exists: true,
      id: existing.id,
      title: existing.title,
      pipelineStatus: existing.pipelineStatus,
      collectedAt: existing.collectedAt.toISOString(),
      minutesAgo,
      message: existing.pipelineStatus === 'published'
        ? `该产品已在 ${minutesAgo} 分钟前采集并发布，重新采集会创建新记录`
        : `该产品已在 ${minutesAgo} 分钟前采集（${existing.pipelineStatus}），重新采集会覆盖更新`,
    }, '已存在');
  } catch (error) {
    console.error('Check collect error:', error);
    return errorResponse('去重查询失败', 'INTERNAL_ERROR', 500);
  }
}
```

#### 1.2.3 返回值示例

```json
// 未采集过
{
  "success": true,
  "data": { "exists": false, "message": "该产品尚未采集" },
  "message": "未采集"
}

// 已采集但未发布
{
  "success": true,
  "data": {
    "exists": true,
    "id": "clxxxxx",
    "title": "Electric Toothbrush",
    "pipelineStatus": "collected",
    "collectedAt": "2026-07-26T10:30:00.000Z",
    "minutesAgo": 15,
    "message": "该产品已在 15 分钟前采集（collected），重新采集会覆盖更新"
  },
  "message": "已存在"
}

// 已采集且已发布
{
  "success": true,
  "data": {
    "exists": true,
    "id": "clxxxxx",
    "title": "Electric Toothbrush",
    "pipelineStatus": "published",
    "collectedAt": "2026-07-26T10:30:00.000Z",
    "minutesAgo": 60,
    "message": "该产品已在 60 分钟前采集并发布，重新采集会创建新记录"
  },
  "message": "已存在"
}
```

---

## 2. Sprint 1 PR2: Chrome 插件提取引擎设计

### 2.1 整体架构

```
chrome-extension/
├── ── content.js          ← 当前单文件 (556行)，将被拆分为模块化提取引擎
├── parsers/
│   ├── extraction-engine.js   ← 主控引擎
│   ├── selector-registry.js   ← 选择器注册表
│   ├── jsonld-parser.js       ← JSON-LD 解析器
│   ├── detail-data-parser.js  ← window.detailData 解析器
│   ├── tiered-price-parser.js ← 阶梯定价解析器
│   ├── variant-parser.js      ← 变体解析器
│   ├── spec-parser.js         ← 规格表解析器
│   ├── image-processor.js     ← 图片提取+高清化
│   └── payload-assembler.js   ← Payload 组装器
└── utils/
    └── dom-utils.js           ← DOM 通用工具
```

### 2.2 ExtractionEngine 主控引擎

**文件**: `chrome-extension/parsers/extraction-engine.js`

#### 2.2.1 接口定义

```javascript
/**
 * ExtractionEngine — 主控引擎，编排提取时序
 * 
 * 执行顺序:
 * Phase 1: DOM 字段提取 (3s timeout)
 *   1a. SelectorRegistry 多重选择器 → 标题/价格/描述/品牌/SKU
 *   1b. JsonLdParser.extract()  → JSON-LD 结构化数据
 *   1c. DetailDataParser.extract() → window.detailData
 *   1d. 三路径合并 (优先级: DOM > detailData > JSON-LD)
 * 
 * Phase 2: 结构化提取 (2s timeout)  
 *   2a. TieredPriceParser.extract() → tieredPricing[]
 *   2b. VariantParser.extract() → variants[]
 *   2c. SpecParser.extractFull() → attributes[] + unit 分离
 *   2d. extractSupplierInfo() → supplier
 *   2e. extractMOQ() → moq
 *   2f. extractShippingInfo() → weight/l/w/h/shippingClass/hsCode
 * 
 * Phase 3: 图片处理 (异步, 可超时)
 *   3a. ImageProcessor.extractImageUrls() → 主图/图库/详情图
 *   3b. ImageProcessor.highResAll() → 高清化 URLs
 *   3c. ImageProcessor.captureAll() → canvas/fetch → base64 (限8张)
 * 
 * Phase 4: 组装 (同步)
 *   4a. PayloadAssembler.assemble() → 完整 payload
 *   4b. postMessage → background → POST API
 */

class ExtractionEngine {
  constructor() {
    this.rawData = {
      tieredPricing: null,
      supplier: null,
      aggregateRating: null,
      moq: null,
      url: window.location.href,
      capturedAt: new Date().toISOString(),
    };
    this.progress = [];  // 进度事件队列
  }

  /**
   * 主入口
   * @param {Object} options
   * @param {number} options.phase1Timeout - Phase 1 超时 (ms), 默认 3000
   * @param {number} options.phase2Timeout - Phase 2 超时 (ms), 默认 2000
   * @param {number} options.maxImages - 最大图片数, 默认 8
   * @returns {Promise<Object>} - 完整 payload
   */
  async run(options = {}) {
    const { phase1Timeout = 3000, phase2Timeout = 2000, maxImages = 8 } = options;
    
    this._emitProgress('starting', '开始提取...');
    
    // Phase 1: 基础字段
    const fieldData = await this._phase1(phase1Timeout);
    
    // Phase 2: 结构化数据  
    const structuredData = await this._phase2(phase2Timeout);
    
    // Phase 3: 图片
    this._emitProgress('images', '正在处理图片...');
    const images = await this._phase3(maxImages);
    
    // Phase 4: 组装
    return this._phase4({ ...fieldData, ...structuredData, images });
  }

  /**
   * Phase 1: DOM 字段提取 + JSON-LD + detailData
   * 三路径合并策略:
   *   - 优先级: DOM 直接提取 > window.detailData > JSON-LD
   *   - 每个字段取最高优先级非空值
   */
  async _phase1(timeout) {
    this._emitProgress('phase1', '提取基础字段...');
    
    // 路径 A: DOM 多重选择器
    const domData = {
      title: SelectorRegistry.extractField('title'),
      brand: SelectorRegistry.extractField('brand'),
      sku: SelectorRegistry.extractField('sku'),
      priceText: SelectorRegistry.extractField('price'),
      currency: this._detectCurrency(),
      description: SelectorRegistry.extractField('description'),
      shortDescription: SelectorRegistry.extractField('shortDescription'),
    };

    // 路径 B: JSON-LD
    const jsonldData = JsonLdParser.extract();
    
    // 路径 C: window.detailData
    const detailData = DetailDataParser.extract();

    // 三路合并 (DOM 优先)
    const merged = this._mergeFields(domData, jsonldData, detailData);

    this._emitProgress('phase1', 
      `基础字段: 标题✓ 价格${merged.price ? '✓' : '✗'} 品牌${merged.brand ? '✓' : '✗'} SKU${merged.sku ? '✓' : '✗'}`
    );
    
    return merged;
  }

  /**
   * Phase 2: 结构化数据提取
   */
  async _phase2(timeout) {
    this._emitProgress('phase2', '提取结构化数据...');
    
    // 阶梯定价
    const tieredPricing = TieredPriceParser.extract();
    if (tieredPricing?.length > 0) {
      this.rawData.tieredPricing = tieredPricing;
      this._emitProgress('tiered-pricing', `阶梯定价: ${tieredPricing.length} 档`);
    }

    // 变体
    const variants = VariantParser.extract();
    
    // 规格表（含单位分离）
    const attributes = SpecParser.extractFull();
    this._emitProgress('attributes', `属性: ${attributes.length} 条`);

    // 供应商
    const supplier = this._extractSupplier();
    if (supplier) {
      this.rawData.supplier = supplier;
    }

    // MOQ
    const moq = this._extractMOQ();
    if (moq) this.rawData.moq = moq;

    // 评分
    const rating = this._extractRating();
    if (rating) this.rawData.aggregateRating = rating;

    // 物流信息
    const shipping = this._extractShipping();

    return { ...shipping, variants, attributes, moq };
  }

  /**
   * Phase 3: 图片处理
   */
  async _phase3(maxImages) {
    // Step 1: 提取所有图片 URL（不下载）
    const urls = ImageProcessor.extractImageUrls();
    
    // Step 2: 高清化所有 URL
    const highResUrls = urls.map(u => ImageProcessor.toHighRes(u));
    
    // Step 3: 区分类型
    const typedUrls = highResUrls.map((u, i) => ({
      ...u,
      type: i === 0 ? 'main' : 'gallery',
    }));
    
    // Step 4: canvas fetch 下载（限量）
    const captured = await ImageProcessor.captureAll(typedUrls, maxImages);
    
    this._emitProgress('images', `图片: ${captured.length}/${Math.min(urls.length, maxImages)} 张`);
    
    return captured;
  }

  /**
   * Phase 4: Payload 组装
   */
  _phase4(allData) {
    return PayloadAssembler.assemble({
      ...allData,
      rawData: this.rawData,
      source: detectPlatform(),
      sourceUrl: window.location.href,
      sourceId: this._extractSourceId(),
    });
  }

  // ====== 内部辅助方法 ======

  _mergeFields(domData, jsonldData, detailData) {
    // 三路合并: DOM > detailData > JSON-LD
    return {
      title: domData.title || detailData?.title || jsonldData?.name || '',
      price: domData.price || detailData?.price || jsonldData?.price || null,
      currency: domData.currency || detailData?.currency || jsonldData?.currency || 'USD',
      brand: domData.brand || detailData?.brand || jsonldData?.brand || null,
      sku: domData.sku || detailData?.sku || jsonldData?.sku || null,
      description: domData.description || detailData?.description || jsonldData?.description || null,
      shortDescription: domData.shortDescription || detailData?.shortDescription || jsonldData?.shortDescription || null,
    };
  }

  _detectCurrency() {
    const priceEl = document.querySelector(SelectorRegistry.getPrimarySelector('price'));
    if (!priceEl) return 'USD';
    const text = priceEl.textContent?.trim().toUpperCase() || '';
    if (text.includes('€')) return 'EUR';
    if (text.includes('¥') || text.includes('CNY') || text.includes('RMB')) return 'CNY';
    if (text.includes('£')) return 'GBP';
    return 'USD'; // 阿里国际站默认 USD
  }

  _extractSourceId() {
    const m = window.location.href.match(/_(\d{10,})\.html/);
    return m ? m[1] : null;
  }

  _extractSupplier() {
    const name = SelectorRegistry.extractField('supplierName');
    if (!name) return null;
    return {
      name,
      url: SelectorRegistry.extractFieldAttr('supplierUrl', 'href') || '',
      verified: document.querySelector(SelectorRegistry.getPrimarySelector('supplierVerified')) !== null,
      rating: parseFloat(SelectorRegistry.extractField('supplierRating')) || null,
      responseRate: SelectorRegistry.extractField('responseRate') || null,
    };
  }

  _extractMOQ() {
    const text = SelectorRegistry.extractField('moq');
    if (!text) return null;
    const m = text.match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
  }

  _extractRating() {
    const valueText = SelectorRegistry.extractField('ratingValue');
    const countText = SelectorRegistry.extractField('reviewCount');
    if (!valueText && !countText) return null;
    return {
      ratingValue: parseFloat(valueText) || null,
      reviewCount: parseInt(countText?.replace(/[()]/g, '')) || null,
    };
  }

  _extractShipping() {
    return {
      weight: parseFloat(SelectorRegistry.extractField('weight')) || null,
      length: parseFloat(SelectorRegistry.extractField('length')) || null,
      width: parseFloat(SelectorRegistry.extractField('width')) || null,
      height: parseFloat(SelectorRegistry.extractField('height')) || null,
      shippingClass: SelectorRegistry.extractField('shippingClass') || null,
      hsCode: SelectorRegistry.extractField('hsCode') || null,
    };
  }

  _emitProgress(phase, message) {
    this.progress.push({ phase, message, time: Date.now() });
    // 向 background.js 发送进度消息
    chrome.runtime.sendMessage({
      type: 'EXTRACTION_PROGRESS',
      payload: { phase, message, progress: this.progress },
    }).catch(() => {});  // 忽略 background 未就绪时的错误
  }
}
```

### 2.3 SelectorRegistry 选择器注册表

**文件**: `chrome-extension/parsers/selector-registry.js`

#### 2.3.1 接口定义

```javascript
/**
 * SelectorRegistry — 每个字段维护多重选择器链
 * 
 * 规则:
 * 1. 每个字段有 5-8 个备选 CSS 选择器，按可靠性降序排列
 * 2. extractField() 按顺序尝试，返回第一个非空值
 * 3. extractFieldAttr() 按顺序尝试，返回第一个非空属性值
 * 4. extractAllFields() 批量提取，带进度回调
 * 5. 所有选择器附注释标明来源和验证日期
 */
class SelectorRegistry {
  /**
   * 字段选择器链定义
   * 每个字段: [选择器1, 选择器2, ..., 选择器N] — 按优先级降序
   * 最后一个是兜底选择器
   */
  static SELECTORS = {
    // ===== 基本信息 =====
    title: [
      '.title-main',                          // 阿里国际站标准标题区
      '[data-testid="product-title"]',        // React data-testid
      'h1',                                   // H1 标签
      '.product-title',                       // 通用产品标题
      '.detail-title',                        // 详情标题
      '[class*="title"] h1',                  // 含 title class 的 h1
      'h1[class*="title"]',                   // h1 + title class
      '[data-pl*="product-title"]',           // 平台数据属性
      'meta[property="og:title"]',            // OG 标签兜底
    ],
    brand: [
      '#key-attributes div:has-text("Brand") + div',          // 属性表 Brand 行
      '[data-testid="product-brand"]',
      '.brand-name',
      '[class*="brand"]',
      '#key-attributes .id-grid div:has-text("brand")',
      'meta[property="product:brand"]',
    ],
    sku: [
      '[data-testid="sku"]',
      '.sku',
      '#key-attributes div:has-text("Model Number") + div',
      '#key-attributes div:has-text("Model") + div',
      '[class*="sku"]',
      'meta[property="product:retailer_item_id"]',
    ],
    
    // ===== 价格 =====
    price: [
      '.price-range',                         // 阿里标准价格区间
      '[data-testid="price"]',
      '.product-price',
      '.price',
      '[class*="price"]',
      '[data-pl*="price"]',
      '.offer-price',
      '.final-price',
    ],
    shortDescription: [
      '[data-testid="short-description"]',
      '.short-description',
      '.subtitle',
      '.summary',
      '[class*="subtitle"]',
      'meta[name="description"]',             // meta 兜底
    ],
    
    // ===== 描述 =====
    description: [
      '.detail-description',
      '[data-testid="description"]',
      '.product-description',
      '#description',
      '.description-content',
      '[class*="description"]',
      '.detail-content',
      '[data-pl*="description"]',
      '#desc-layer',                          // 1688
      'meta[property="og:description"]',      // OG 兜底
    ],
    
    // ===== 物流信息 =====
    weight: [
      '#key-attributes div:has-text("Weight") + div',
      '#key-attributes div:has-text("Gross Weight") + div',
      '#key-attributes div:has-text("Net Weight") + div',
      '[data-testid="weight"]',
      '.shipping-info .weight',
      '.product-weight',
      '[class*="weight"]',
    ],
    length: [
      '#key-attributes div:has-text("Length") + div',
      '#key-attributes div:has-text("Package Size") + div',
      '.package-dimensions .length',
      '[data-testid="dimension"]',
      '[class*="length"]',
    ],
    width: [
      '#key-attributes div:has-text("Width") + div',
      '.package-dimensions .width',
      '[class*="width"]',
    ],
    height: [
      '#key-attributes div:has-text("Height") + div',
      '.package-dimensions .height',
      '[class*="height"]',
    ],
    shippingClass: [
      '#key-attributes div:has-text("Shipping") + div',
      '.shipping-class',
      '[class*="shipping"]',
    ],
    hsCode: [
      '#key-attributes div:has-text("HS Code") + div',
      '#key-attributes div:has-text("Customs") + div',
      '.hs-code',
      '[data-testid="hs-code"]',
    ],
    
    // ===== 供应商 =====
    supplierName: [
      '.company-name',
      '.supplier-name',
      '[data-companyname]',
      '.store-name',
      '.seller-name',
      '[class*="supplier"]',
      '[class*="company"]',
    ],
    supplierUrl: [
      '.company-name a',
      '.supplier-name a',
      '[data-companyname] a',
      '[class*="supplier"] a',
    ],
    supplierVerified: [
      '.gold-supplier',
      '.verified-supplier',
      '[class*="verified"]',
      '[class*="gold"]',
    ],
    supplierRating: [
      '.supplier-rating',
      '.store-rating',
      '[class*="rating"]',
      '.feedback-score',
    ],
    responseRate: [
      '.response-rate',
      '[class*="response"]',
      '.reply-rate',
    ],
    
    // ===== MOQ =====
    moq: [
      '.min-order',
      '.moq',
      '[data-testid="moq"]',
      '[class*="moq"]',
      '[class*="min-order"]',
      '.min-quantity',
    ],
    
    // ===== 评分 =====
    ratingValue: [
      '.rating-value',
      '.review-score',
      '[class*="rating"] .score',
      '.star-rating .score',
    ],
    reviewCount: [
      '.review-count',
      '.feedback-count',
      '[class*="review"]',
    ],
  };

  /**
   * 提取单字段文本内容
   * @param {string} fieldName - 字段名 (在 SELECTORS 中的 key)
   * @returns {string} - 提取的文本，空字符串表示未找到
   */
  static extractField(fieldName) {
    const selectors = this.SELECTORS[fieldName];
    if (!selectors) return '';
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent?.trim()) {
          return el.textContent.trim();
        }
      } catch (e) {
        // querySelector 对某些复杂选择器可能抛异常（如 :has-text）
        continue;
      }
    }
    return '';
  }

  /**
   * 提取单字段 HTML 内容
   * @param {string} fieldName
   * @returns {string}
   */
  static extractFieldHtml(fieldName) {
    const selectors = this.SELECTORS[fieldName];
    if (!selectors) return '';
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.innerHTML?.trim()) {
          return el.innerHTML.trim();
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }

  /**
   * 提取单字段的 DOM 属性值
   * @param {string} fieldName
   * @param {string} attr - 属性名 (如 'href', 'src', 'content')
   * @returns {string}
   */
  static extractFieldAttr(fieldName, attr) {
    const selectors = this.SELECTORS[fieldName];
    if (!selectors) return '';
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const val = el.getAttribute(attr);
          if (val) return val;
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }

  /**
   * 获取某字段的首选选择器（供其他模块快速获取 DOM 元素）
   * @param {string} fieldName
   * @returns {string}
   */
  static getPrimarySelector(fieldName) {
    const selectors = this.SELECTORS[fieldName];
    return selectors?.[0] || '';
  }
}
```

### 2.4 JsonLdParser — JSON-LD 解析器

**文件**: `chrome-extension/parsers/jsonld-parser.js`

#### 2.4.1 接口定义

```javascript
/**
 * JsonLdParser — 从 <script type="application/ld+json"> 提取结构化数据
 * 
 * 阿里国际站 JSON-LD 结构示例:
 * {
 *   "@type": "Product",
 *   "name": "Product Name",
 *   "sku": "ABC123",
 *   "brand": { "@type": "Brand", "name": "BrandName" },
 *   "image": ["https://...1.jpg", "https://...2.jpg"],
 *   "description": "...",
 *   "offers": {
 *     "@type": "AggregateOffer",
 *     "priceCurrency": "USD",
 *     "lowPrice": 10.00,
 *     "highPrice": 15.00,
 *     "offerCount": 3,
 *     "availability": "https://schema.org/InStock"
 *   },
 *   "aggregateRating": {
 *     "@type": "AggregateRating",
 *     "ratingValue": 4.5,
 *     "reviewCount": 100
 *   },
 *   "category": "Health & Beauty"
 * }
 */
class JsonLdParser {
  /**
   * 提取所有 JSON-LD 中的产品数据
   * @returns {Object|null} { name, sku, brand, image, description, price, currency, category, aggregateRating }
   */
  static extract() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const parsed = JSON.parse(s.textContent);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item['@type'] === 'Product') {
              return this._parseProduct(item);
            }
          }
        } catch (e) { /* skip invalid JSON */ }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * 解析单个 Product JSON-LD 节点
   * @param {Object} item - JSON-LD Product 节点
   * @returns {Object} 解析后的扁平产品数据
   */
  static _parseProduct(item) {
    const result = {};

    result.name = item.name || '';
    result.sku = item.sku || '';

    // Brand
    const brand = item.brand || {};
    if (typeof brand === 'string') result.brand = brand;
    else if (brand.name) result.brand = brand.name;
    else result.brand = '';

    // Description
    result.description = item.description || '';

    // Category
    result.category = item.category || '';

    // Offers
    const offers = item.offers || {};
    if (offers) {
      result.currency = offers.priceCurrency || 'USD';
      result.price = parseFloat(offers.lowPrice || offers.price || 0) || null;
      result.compareAtPrice = parseFloat(offers.highPrice) || null;
    }

    // AggregateRating
    const ar = item.aggregateRating || {};
    if (ar && ar.ratingValue) {
      result.aggregateRating = {
        ratingValue: parseFloat(ar.ratingValue),
        reviewCount: parseInt(ar.reviewCount) || null,
      };
    }

    // Images
    const images = item.image || [];
    const imgList = Array.isArray(images) ? images : [images];
    result.images = imgList.filter(Boolean);

    return result;
  }
}
```

### 2.5 DetailDataParser — window.detailData 解析器

**文件**: `chrome-extension/parsers/detail-data-parser.js`

#### 2.5.1 接口定义

```javascript
/**
 * DetailDataParser — 从 window.detailData 全局变量提取结构化数据
 * 
 * 阿里国际站详情页在 Vue/React 渲染时, 经常将完整的产品数据
 * 挂在 window.detailData (或 window.__NUXT__, window.__INITIAL_STATE__) 上。
 * 这些数据比 JSON-LD 更完整，包含变体、阶梯定价等。
 * 
 * 已知的全局变量名:
 * - window.detailData          ← 阿里国际站最常见
 * - window.__NUXT__            ← Nuxt.js 渲染的页面
 * - window.__INITIAL_STATE__   ← Next.js 渲染的页面
 * - window.pageData            ← 旧版阿里详情页
 * - window.productData         ← 旧版
 */
class DetailDataParser {
  /**
   * 尝试所有已知的全局变量路径
   * @returns {Object|null} 解析后的扁平产品数据
   */
  static extract() {
    const candidates = [
      // window.detailData
      () => this._parseDetailData(window.detailData),
      // window.__NUXT__
      () => this._parseNuxtData(window.__NUXT__),
      // window.__INITIAL_STATE__
      () => this._parseInitialState(window.__INITIAL_STATE__),
      // window.pageData
      () => this._parsePageData(window.pageData),
      // window.productData
      () => this._parseProductData(window.productData),
    ];

    for (const fn of candidates) {
      try {
        const result = fn();
        if (result && result.title) return result;
      } catch (e) { /* continue */ }
    }
    return null;
  }

  /**
   * 解析 window.detailData (阿里国际站标准格式)
   * {
   *   priceRange: { minPrice: 10, maxPrice: 15, currency: "USD" },
   *   productName: "...",
   *   productImages: [{ src: "..." }, ...],
   *   skuList: [
   *     { specAttr: "Color:Red|Size:M", price: 10, stock: 100, sku: "R-M" },
   *     ...
   *   ],
   *   tieredPriceList: [
   *     { startQuantity: 1, endQuantity: 99, price: 15, currency: "USD" },
   *     { startQuantity: 100, endQuantity: null, price: 12, currency: "USD" }
   *   ],
   *   productSpecs: [
   *     { attrName: "Brand", attrValue: "XYZ" },
   *     ...
   *   ],
   *   sellerInfo: { companyName: "...", companyUrl: "...", ... },
   *   moq: 10,
   *   weight: "1.5 kg",
   *   packageSize: { length: 20, width: 15, height: 10 }
   * }
   */
  static _parseDetailData(data) {
    if (!data || typeof data !== 'object') return null;
    
    const result = {};

    // 标题 (不同版本 key 不同)
    result.title = data.productName || data.name || data.title || '';

    // 价格
    if (data.priceRange) {
      result.price = parseFloat(data.priceRange.minPrice || data.priceRange.lowPrice);
      result.compareAtPrice = parseFloat(data.priceRange.maxPrice || data.priceRange.highPrice);
      result.currency = data.priceRange.currency || 'USD';
    } else if (data.price) {
      result.price = parseFloat(data.price);
    }

    // 品牌
    result.brand = data.brand || '';

    // SKU
    result.sku = data.productId || data.sku || '';

    // 描述
    result.description = data.description || data.detailDesc || '';

    // 图片
    if (data.productImages?.length > 0) {
      result.imageUrls = data.productImages
        .map(img => img.src || img.url || img.original || '')
        .filter(Boolean);
    }

    // 变体
    if (data.skuList?.length > 0) {
      result.variants = data.skuList.map(sku => ({
        sku: sku.sku || sku.id || '',
        price: parseFloat(sku.price || sku.skuPrice) || null,
        stock: parseInt(sku.stock || sku.availableStock) || null,
        options: this._parseSkuOptions(sku.specAttr || sku.spec || ''),
        imageUrl: sku.image?.src || sku.imageUrl || '',
      }));
    }

    // 阶梯定价
    if (data.tieredPriceList?.length > 0) {
      result.tieredPricing = data.tieredPriceList.map(t => ({
        minQty: t.startQuantity || t.minQuantity || 1,
        maxQty: t.endQuantity || t.maxQuantity || null,
        price: parseFloat(t.price || t.unitPrice),
        unit: t.currency || result.currency || 'USD',
      }));
    }

    // 属性
    if (data.productSpecs?.length > 0) {
      result.attributes = data.productSpecs.map(spec => ({
        name: spec.attrName || spec.name || '',
        value: spec.attrValue || spec.value || '',
        unit: this._extractUnit(spec.attrValue || spec.value || ''),
      }));
    }

    // 供应商
    if (data.sellerInfo) {
      result.supplier = {
        name: data.sellerInfo.companyName || data.sellerInfo.name || '',
        url: data.sellerInfo.companyUrl || data.sellerInfo.url || '',
        verified: !!(data.sellerInfo.isVerified || data.sellerInfo.goldSupplier),
      };
    }

    // MOQ
    if (data.moq) result.moq = parseInt(data.moq);

    // 物流
    if (data.weight) result.weight = parseFloat(data.weight);
    if (data.packageSize) {
      result.length = parseFloat(data.packageSize.length);
      result.width = parseFloat(data.packageSize.width);
      result.height = parseFloat(data.packageSize.height);
    }

    return result;
  }

  /**
   * 解析 SKU 规格字符串 → options 数组
   * 输入: "Color:Red|Size:M" 或 "颜色:红色,尺寸:M"
   * 输出: [{name:"颜色",value:"红色"}, {name:"尺寸",value:"M"}]
   */
  static _parseSkuOptions(specStr) {
    if (!specStr) return [];
    if (Array.isArray(specStr)) {
      // 已经是数组格式
      return specStr.map(s => {
        if (typeof s === 'string') {
          const [name, value] = s.split(/[:：]/);
          return { name: (name || '').trim(), value: (value || '').trim() };
        }
        return { name: s.name || '', value: s.value || '' };
      });
    }
    // 字符串格式: "Color:Red|Size:M"
    return specStr.split(/[,|;]/).map(part => {
      const [name, value] = part.split(/[:：]/);
      return { name: (name || '').trim(), value: (value || '').trim() };
    }).filter(o => o.name && o.value);
  }

  /** 从属性值中分离单位，如 "100ml" → unit="ml" */
  static _extractUnit(value) {
    const m = value.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    return m ? m[2] : null;
  }

  /** 解析 __NUXT__ 的兜底 */
  static _parseNuxtData(data) {
    if (!data) return null;
    // __NUXT__ 结构多变，尝试常见嵌套路径
    const state = data.state || data;
    const product = state.product || state.detail || state.data;
    if (product) return this._parseDetailData(product);
    return null;
  }

  static _parseInitialState(data) {
    if (!data) return null;
    const product = data.props?.pageProps?.product || data.product;
    if (product) return this._parseDetailData(product);
    return null;
  }

  static _parsePageData(data) {
    if (!data) return null;
    return this._parseDetailData(data.product || data);
  }

  static _parseProductData(data) {
    if (!data) return null;
    return this._parseDetailData(data);
  }
}
```

### 2.6 TieredPriceParser — 阶梯定价解析器

**文件**: `chrome-extension/parsers/tiered-price-parser.js`

#### 2.6.1 接口定义

```javascript
/**
 * TieredPriceParser — 从 DOM 提取阿里国际站阶梯定价表
 * 
 * 阿里国际站阶梯定价区域 DOM 结构 (典型):
 * 
 * 1. .price-range-table 表格
 *    <table class="price-range-table">
 *      <tr><td>1-99 Units</td><td>US $15.00</td></tr>
 *      <tr><td>100-499 Units</td><td>US $12.00</td></tr>
 *      <tr><td>500+ Units</td><td>US $10.00</td></tr>
 *    </table>
 * 
 * 2. .tiered-price-list 列表
 *    <ul class="tiered-price-list">
 *      <li><span>1-99</span><span>US $15.00</span></li>
 *    </ul>
 * 
 * 3. .price-break 区块
 *    <div class="price-break">
 *      <div class="price-break-item">
 *        <span class="qty">1 - 99</span>
 *        <span class="price">US $15.00</span>
 *      </div>
 *    </div>
 */
class TieredPriceParser {
  /**
   * 选区的选择器链 (按可靠性降序)
   */
  static SELECTORS = [
    '.price-range-table',           // 标准定价表
    '.tiered-price-list',           // 阶梯定价列表
    '.price-break',                 // 价格分段容器
    '.bulk-price',                  // 批量定价
    '.volume-pricing',              // 批量价格区域
    '[data-testid="tiered-pricing"]',
    '[class*="tiered"]',
    '[class*="volume"]',
    '[class*="bulk"]',
  ];

  /**
   * 提取阶梯定价
   * @returns {Array<{minQty: number, maxQty: number|null, price: number, unit: string}> | null}
   */
  static extract() {
    // 尝试 DOM 提取
    for (const sel of this.SELECTORS) {
      try {
        const container = document.querySelector(sel);
        if (!container) continue;

        const rows = container.querySelectorAll('tr, li, .price-break-item, [class*="item"]');
        if (rows.length === 0) continue;

        const tiers = [];
        for (const row of rows) {
          const cells = row.querySelectorAll('td, span, div');
          const texts = Array.from(cells)
            .map(c => c.textContent?.trim())
            .filter(Boolean);
          
          if (texts.length < 2) continue;

          // 第一个文本是数量区间，第二个是价格
          const qtyText = texts[0];
          const priceText = texts[1];
          const parsed = this._parseTierRow(qtyText, priceText);
          if (parsed) tiers.push(parsed);
        }

        if (tiers.length > 0) return tiers;
      } catch (e) { continue; }
    }

    return null;
  }

  /**
   * 解析单行阶梯定价
   * @param {string} qtyText  - 如 "1-99 Units", "100+", "500+"
   * @param {string} priceText - 如 "US $15.00", "$12.00"
   * @returns {{minQty, maxQty, price, unit} | null}
   */
  static _parseTierRow(qtyText, priceText) {
    // 解析数量区间
    const rangeMatch = qtyText.match(/(\d+)\s*[-–]\s*(\d+)/);
    const plusMatch = qtyText.match(/(\d+)\s*\+/);
    
    let minQty, maxQty;
    if (rangeMatch) {
      minQty = parseInt(rangeMatch[1]);
      maxQty = parseInt(rangeMatch[2]);
    } else if (plusMatch) {
      minQty = parseInt(plusMatch[1]);
      maxQty = null;  // null = unlimited
    } else {
      // 尝试取第一个数字
      const numMatch = qtyText.match(/(\d+)/);
      if (!numMatch) return null;
      minQty = parseInt(numMatch[1]);
      maxQty = null;
    }

    // 解析价格
    const priceMatch = priceText.match(/([\d,]+\.?\d*)/);
    if (!priceMatch) return null;
    const price = parseFloat(priceMatch[1].replace(/,/g, ''));

    // 解析币种
    const unit = priceText.toUpperCase().includes('EUR') ? 'EUR'
      : priceText.includes('¥') || priceText.toUpperCase().includes('CNY') ? 'CNY'
      : priceText.includes('£') ? 'GBP'
      : 'USD';

    return { minQty, maxQty, price, unit };
  }
}
```

### 2.7 VariantParser — 变体解析器

**文件**: `chrome-extension/parsers/variant-parser.js`

#### 2.7.1 接口定义

```javascript
/**
 * VariantParser — 从 DOM 提取 SKU 变体
 * 
 * 阿里国际站变体区域 DOM 结构:
 * 
 * 1. .sku-list 变体选择区
 *    <div class="sku-list">
 *      <div class="sku-prop">           ← 一个变体维度（如 颜色/尺寸）
 *        <span class="prop-name">颜色</span>
 *        <ul class="prop-value-list">
 *          <li class="sku-item" data-sku-id="...">
 *            <img src="..." /> 红色      ← 有图的变体
 *          </li>
 *          <li class="sku-item" ...>蓝色</li>
 *        </ul>
 *      </div>
 *    </div>
 * 
 * 2. .sku-table 变体表格
 *    <table class="sku-table">
 *      <tr><th>颜色</th><th>尺寸</th><th>价格</th><th>库存</th></tr>
 *      <tr><td>红色</td><td>S</td><td>$15.00</td><td>100</td></tr>
 *    </table>
 * 
 * 3. window.detailData.skuList (优先于 DOM，由 ExtractionEngine 在 Phase 1 提取)
 */
class VariantParser {
  /**
   * 从 DOM 提取变体列表
   * @returns {Array<{sku: string, price: number, stock: number, options: Array<{name:string, value:string}>, imageUrl: string}>}
   */
  static extract() {
    // 先尝试 DOM 提取
    const domVariants = this._extractFromDOM();
    if (domVariants?.length > 0) return domVariants;

    // 兜底: 从 sku-prop 区域提取变体维度组合
    return this._extractFromSkuProps();
  }

  /**
   * 从 sku-table 表格提取变体 (最可靠)
   */
  static _extractFromDOM() {
    // 尝试选择器: .sku-table, table.sku-table, [data-testid="sku-table"]
    const tables = document.querySelectorAll('.sku-table, table.sku-table, [data-testid="sku-table"]');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      if (rows.length < 2) continue;

      // 表头: 确定各列含义
      const headers = rows[0].querySelectorAll('th, td');
      const headerTexts = Array.from(headers).map(h => h.textContent?.trim() || '');

      const variants = [];
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length < headers.length) continue;

        const variant = { sku: null, price: null, stock: null, options: [], imageUrl: '' };
        const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '');

        headerTexts.forEach((header, idx) => {
          const value = cellTexts[idx] || '';
          if (header.includes('SKU')) variant.sku = value;
          else if (header.includes('Price') || header.includes('价格')) variant.price = parseFloat(value) || null;
          else if (header.includes('Stock') || header.includes('库存')) variant.stock = parseInt(value) || null;
          else if (header.includes('Image') || header.includes('图片')) {
            const img = cells[idx].querySelector('img');
            variant.imageUrl = img?.getAttribute('src') || '';
          } else if (value) {
            // 其他列为 options
            variant.options.push({ name: header, value });
          }
        });

        if (variant.options.length > 0 || variant.sku) {
          variants.push(variant);
        }
      }

      if (variants.length > 0) return variants;
    }

    return [];
  }

  /**
   * 从 sku-prop 选择器区域提取变体组合
   * 阿里国际站典型: 颜色+尺寸 各自有可选值列表
   * 需要笛卡尔积组合 + 从 DOM 属性读取价格库存
   */
  static _extractFromSkuProps() {
    const propGroups = [];
    const propSelectors = document.querySelectorAll('.sku-prop, [class*="sku-prop"], [data-testid="sku-prop"]');
    
    if (propSelectors.length === 0) return [];

    for (const group of propSelectors) {
      const nameEl = group.querySelector('.prop-name, [class*="prop-name"], label');
      const name = nameEl?.textContent?.trim() || '';

      const items = group.querySelectorAll('.sku-item, .prop-value, [class*="sku-value"]');
      const values = Array.from(items).map(item => ({
        value: item.textContent?.trim() || '',
        imageUrl: item.querySelector('img')?.getAttribute('src') || '',
        skuId: item.getAttribute('data-sku-id') || '',
      }));

      if (name && values.length > 0) {
        propGroups.push({ name, values });
      }
    }

    if (propGroups.length === 0) return [];

    // 笛卡尔积生成所有变体组合
    const combinations = this._cartesianProduct(propGroups.map(g => g.values));
    
    return combinations.map((combo, idx) => ({
      sku: combo.map(c => c.skuId).filter(Boolean).join('-') || `variant-${idx}`,
      price: null,  // 阿里国际站的价格通常在 sku 选中后才显示在 DOM 中
      stock: null,
      options: combo.map((c, i) => ({ name: propGroups[i].name, value: c.value })),
      imageUrl: combo.find(c => c.imageUrl)?.imageUrl || '',
    }));
  }

  /** 笛卡尔积 */
  static _cartesianProduct(arrays) {
    return arrays.reduce((acc, arr) =>
      acc.flatMap(d => arr.map(e => [...d, e])), [[]]
    );
  }
}
```

### 2.8 SpecParser — 规格表解析器

**文件**: `chrome-extension/parsers/spec-parser.js`

#### 2.8.1 接口定义

```javascript
/**
 * SpecParser — 从规格表 (Key Attributes) 提取全量属性 + 单位分离
 * 
 * DOM 结构 (阿里国际站):
 * <div id="key-attributes">
 *   <div class="id-grid-cols-[2fr_3fr]">
 *     <div>Brand</div>       ← 属性名
 *     <div>XYZ Corp</div>    ← 属性值
 *   </div>
 *   <div class="id-grid-cols-[2fr_3fr]">
 *     <div>Weight</div>
 *     <div>1.5 kg</div>      ← 值含单位
 *   </div>
 * </div>
 */
class SpecParser {
  /**
   * 全量规格提取，含单位分离
   * @returns {Array<{name: string, value: string, unit: string|null}>}
   */
  static extractFull() {
    const specs = [];
    const seen = new Set();  // 去重

    // 选择器链尝试
    const selectors = [
      // 阿里国际站标准属性区
      '#key-attributes .id-grid-cols-\\[2fr_3fr\\]',
      '#key-attributes .id-grid-cols-\\[2fr_3fr\\] > div',
      // 属性表格
      '[data-testid="specifications"] tr',
      '.attributes-table tr',
      '.product-attributes tr',
      // 属性列表
      '[data-testid="product-attributes"] tr',
      '.specification li',
      '.attribute-list li',
      // 通用表格
      'table[class*="attr"] tr',
      'table[class*="spec"] tr',
      // 参数表
      '.params-table tr',
      '.props-table tr',
      // 详情页的属性区域
      '.module_product_attrs tr',
      '.tab-content tr',
    ];

    for (const sel of selectors) {
      const rows = document.querySelectorAll(sel);
      if (rows.length === 0) continue;

      for (const row of rows) {
        const cells = row.querySelectorAll('div, td, th, span');
        if (cells.length < 2) continue;

        let name = cells[0].textContent?.trim()?.replace(/[：:]/g, '') || '';
        let value = cells[1].textContent?.trim() || '';

        if (!name || !value || name === value) continue;
        if (name.length > 100 || value.length > 1000) continue;

        // 去重: 同名属性只取第一个
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // 单位分离
        const { cleanValue, unit } = this._separateUnit(value);

        specs.push({
          name,
          value: cleanValue,
          unit: unit,
        });
      }

      if (specs.length > 0) break;  // 第一个命中的选择器
    }

    // 按 DOM 出现顺序排序（已在选择器循环中保持）
    return specs;
  }

  /**
   * 从属性值中分离单位
   * 
   * 规则:
   * 1. 尾部数字+字母模式 → 如 "100 ml" → {value:"100", unit:"ml"}
   * 2. 已知单位关键词 → kg, g, cm, mm, ml, L, pcs, pieces, years, months
   * 3. 数字+符号模式   → 如 "15x10x5 cm" → 不分（保持原值，unit 存 "cm"）
   * 
   * @param {string} value - 原始属性值
   * @returns {{cleanValue: string, unit: string|null}}
   */
  static _separateUnit(value) {
    if (!value) return { cleanValue: '', unit: null };

    // 1. 尾部 "数字 单位" 模式: "100 ml", "1.5 kg", "3 Years"
    const unitPatterns = [
      /^([\d.,]+)\s*(kg|kilograms?)$/i,
      /^([\d.,]+)\s*(g|grams?)$/i,
      /^([\d.,]+)\s*(ml|milliliters?)$/i,
      /^([\d.,]+)\s*(l|liters?)$/i,
      /^([\d.,]+)\s*(cm|centimeters?)$/i,
      /^([\d.,]+)\s*(mm|millimeters?)$/i,
      /^([\d.,]+)\s*(pcs|pieces?)$/i,
      /^([\d.,]+)\s*(years?|months?|days?)$/i,
      /^([\d.,]+)\s*(oz|fl\.?\s*oz)$/i,
    ];
    for (const pattern of unitPatterns) {
      const m = value.match(pattern);
      if (m) {
        return { cleanValue: m[1].trim(), unit: m[2].toLowerCase() };
      }
    }

    // 2. 尾部单位缩写: "100ml", "1.5kg"
    const abbrevPattern = /^([\d.,]+)\s*([a-zA-Z]{1,4})$/;
    const m = value.match(abbrevPattern);
    if (m) {
      return { cleanValue: m[1].trim(), unit: m[2].toLowerCase() };
    }

    // 3. 尺寸模式: "15x10x5cm" 或 "15 × 10 × 5 cm"
    const dimMatch = value.match(/^([\d\s.×xX*]+)\s*(cm|mm|inch|inches)$/);
    if (dimMatch) {
      return { cleanValue: value.replace(/\s*(cm|mm|inch|inches)$/i, '').trim(), unit: dimMatch[2].toLowerCase() };
    }

    // 4. 属性值中有已知单位关键词在中间
    for (const kw of ['ml', 'kg', 'g', 'cm', 'mm', 'l', 'oz']) {
      const idx = value.toLowerCase().indexOf(kw);
      if (idx > 0 && idx < value.length - 3) {
        const before = value.substring(0, idx + kw.length);
        const after = value.substring(idx + kw.length);
        // 如果 after 只是标点或空，说明单位在尾部
        if (!after.trim() || /^[,;)\]]/.test(after.trim())) {
          return { cleanValue: before.replace(new RegExp(kw + '$', 'i'), '').trim(), unit: kw };
        }
      }
    }

    return { cleanValue: value, unit: null };
  }
}
```

### 2.9 ImageProcessor — 图片处理器

**文件**: `chrome-extension/parsers/image-processor.js`

#### 2.9.1 接口定义

```javascript
/**
 * ImageProcessor — 图片提取、高清化、下载
 * 
 * 阿里 CDN URL 高清化规则:
 * 原始: https://sc04.alicdn.com/kf/xxx_350x350.jpg
 * 高清: https://sc04.alicdn.com/kf/xxx_640x640.jpg  (或去掉尺寸后缀)
 * 
 * 策略:
 * 1. 去掉尺寸后缀 (_350x350 → _640x640)
 * 2. 去掉 Q 后缀 (_q90 → 空)
 * 3. 去掉水印后缀
 * 4. 优先用 data-zoom / data-large / data-big 属性 (原图链接)
 */
class ImageProcessor {
  /**
   * 提取页面上所有产品图 URL，区分类型
   * @returns {Array<{type: string, originalUrl: string, selector: string}>}
   */
  static extractImageUrls() {
    const seen = new Set();
    const results = [];

    // Step 1: 从已知选择器提取
    const selectors = [
      // 主图区域
      '#ProductImageMain img',
      '.current-main-image img',
      '.main-index img',
      // 图库
      '.product-gallery img',
      '[data-testid="gallery"] img',
      '.image-thumbnail img',
      '.gallery img',
      '.main-img img',
      '[data-role="gallery"] img',
      '.pic-box img',
      '.detail-hd img',
      '.img-list img',
      '.img-preview img',
      // 通用
      'img[class*="main"]',
      'img[class*="gallery"]',
      'img[class*="product"]',
    ];

    let hasMain = false;

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(img => {
        const url = this._getBestQualityUrl(img);
        if (!url || seen.has(url)) return;
        if (this._isPlaceholder(url)) return;
        seen.add(url);

        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: url.startsWith('//') ? 'https:' + url : url,
          mimeType: url.endsWith('.png') ? 'image/png' : 'image/jpeg',
          fileName: `product_${results.length + 1}.jpg`,
          width: img.naturalWidth || img.width || null,
          height: img.naturalHeight || img.height || null,
          altText: img.getAttribute('alt') || '',
        });
      });

      if (results.length > 0) break;
    }

    // Step 2: 兜底 — 取页面上 >=100px 的非 logo 图片
    if (results.length === 0) {
      document.querySelectorAll('img').forEach(img => {
        if (results.length >= 20) return;
        const url = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!url || seen.has(url) || img.width < 100) return;
        if (this._isPlaceholder(url)) return;
        seen.add(url);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: url.startsWith('//') ? 'https:' + url : url,
          mimeType: url.endsWith('.png') ? 'image/png' : 'image/jpeg',
          fileName: `product_${results.length + 1}.jpg`,
          width: img.width,
          height: img.height,
          altText: img.getAttribute('alt') || '',
        });
      });
    }

    return results;
  }

  /**
   * 获取图片元素的最佳质量 URL
   * 优先级: data-zoom > data-large > data-big > data-src > src (高清化)
   */
  static _getBestQualityUrl(img) {
    const attrOrder = ['data-zoom', 'data-large', 'data-big', 'data-src', 'data-lazyload', 'data-original', 'src'];
    for (const attr of attrOrder) {
      const val = img.getAttribute(attr);
      if (val && val.length > 10) {
        return this.toHighRes(val);
      }
    }
    return '';
  }

  /**
   * 将 CDN URL 转为高清版本
   * @param {string} url - 原始 CDN URL
   * @returns {string} - 高清版 URL
   */
  static toHighRes(url) {
    if (!url) return '';
    let u = url.startsWith('//') ? 'https:' + url : url;

    // 1. 去掉 _350x350 等尺寸后缀 → _640x640
    u = u.replace(/_\d+x\d+(?=\.(jpg|jpeg|png|webp))/g, '_640x640');

    // 2. 去掉 _q90 等质量后缀
    u = u.replace(/_[qQ]\d+(?=\.(jpg|jpeg|png|webp))/g, '');

    // 3. 去掉 URL 参数
    u = u.split('?')[0];

    return u;
  }

  /**
   * 判断是否为占位图/logo
   */
  static _isPlaceholder(url) {
    const lower = url.toLowerCase();
    return lower.includes('placeholder')
      || lower.includes('logo')
      || lower.includes('icon')
      || lower.includes('blank')
      || lower.includes('gray')
      || lower.includes('default')
      || (lower.startsWith('data:') && lower.length < 500);
  }

  /**
   * 批量下载图片 (canvas fetch)
   * @param {Array} imageInfos - extractImageUrls() 的输出
   * @param {number} maxImages - 最多下载几张
   * @returns {Promise<Array>} 含 base64 data 的完整图片信息
   */
  static async captureAll(imageInfos, maxImages = 8) {
    const results = [];
    const toCapture = imageInfos.slice(0, maxImages);

    // 并行下载 (限并发 3)
    const concurrency = 3;
    const chunks = [];
    for (let i = 0; i < toCapture.length; i += concurrency) {
      chunks.push(toCapture.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const captured = await Promise.allSettled(
        chunk.map(info => this._captureSingle(info))
      );
      for (const cap of captured) {
        if (cap.status === 'fulfilled' && cap.value) {
          results.push(cap.value);
        }
      }
    }

    return results;
  }

  /**
   * 下载单张图片 (canvas 绘制绕过防盗链)
   */
  static async _captureSingle(info) {
    try {
      const resp = await fetch(info.originalUrl, {
        signal: AbortSignal.timeout(8000),
        // 不设 mode: 'no-cors'，让浏览器自然处理 CORS
      });
      if (!resp.ok) return null;

      const blob = await resp.blob();
      if (blob.size < 2000) return null;  // 太小可能是占位图

      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      return {
        ...info,
        data: base64,
        mimeType: blob.type || info.mimeType,
        fileSize: blob.size,
      };
    } catch (e) {
      console.warn('[ImageProcessor] 图片下载失败:', info.originalUrl?.substring(0, 80), e.message);
      return null;
    }
  }
}
```

### 2.10 PayloadAssembler — Payload 组装器

**文件**: `chrome-extension/parsers/payload-assembler.js`

#### 2.10.1 接口定义

```javascript
/**
 * PayloadAssembler — 将各模块提取的数据组装为 POST API 的完整 payload
 * 
 * 映射逻辑:
 * - ExtractionEngine 输出的扁平数据 → CollectRequestBody 格式
 * - 子表数据 (images/variants/attributes) 组织为数组
 * - rawData 存储非直字段
 * - price/compareAtPrice 的阶梯定价映射
 */
class PayloadAssembler {
  /**
   * 组装完整 payload
   * @param {Object} data - ExtractionEngine.run() 各阶段的合并输出
   * @returns {Object} - 符合 CollectRequestBody 接口的 payload
   */
  static assemble(data) {
    const payload = {
      // ── 来源 ──
      source: data.source,
      sourceUrl: data.sourceUrl,
      sourceId: data.sourceId || null,

      // ── 基本信息 ──
      title: data.title || '',
      titleEn: null,                // 阿里国际站已是英文
      shortDescription: data.shortDescription || null,
      description: data.description || null,
      descriptionEn: null,
      brand: data.brand || null,
      sku: data.sku || null,

      // ── 价格 ──
      price: null,
      compareAtPrice: null,
      currency: data.currency || 'USD',
      stockQuantity: data.stockQuantity || null,

      // ── 物流 ──
      weight: data.weight || null,
      length: data.length || null,
      width: data.width || null,
      height: data.height || null,
      shippingClass: data.shippingClass || null,
      hsCode: data.hsCode || null,

      // ── 子表 ──
      images: data.images || [],
      attributes: data.attributes || [],
      variants: data.variants || [],

      // ── 原始数据 ──
      rawData: data.rawData,
    };

    // 阶梯定价 → price/compareAtPrice 映射
    this._applyTieredPricingToPrice(payload, data);

    return payload;
  }

  /**
   * 阶梯定价映射策略:
   * | 场景 | price | compareAtPrice |
   * |------|-------|----------------|
   * | 无阶梯 | data.price | data.compareAtPrice |
   * | 有阶梯，≥2档 | 最低价 (最后档) | 最高价 (第一档) |
   * | 有阶梯，仅1档 | 该档价格 | null |
   */
  static _applyTieredPricingToPrice(payload, data) {
    const tiers = data.rawData?.tieredPricing;
    if (tiers && tiers.length > 0) {
      const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
      // price: 最低价 (批量价)
      payload.price = sorted[sorted.length - 1].price;
      // compareAtPrice: 最高价 (零售价)
      if (sorted.length >= 2) {
        payload.compareAtPrice = sorted[0].price;
      }
    } else {
      // 无阶梯 → 直接传原始数据
      payload.price = data.price || null;
      payload.compareAtPrice = data.compareAtPrice || null;
    }
  }
}
```

---

## 3. Sprint 1 PR3: Python 采集器增强设计

### 3.1 _extract_variants() — 变体提取

在 `extractor.py` 中新增方法，从 DOM 的 sku-list 区域或 `window.detailData` 提取变体。

```python
async def _extract_variants(page: Page) -> list[dict]:
    """
    提取产品变体（SKU 选择器区域）
    
    优先从 window.detailData.skuList 提取（结构最完整），
    兜底从 DOM .sku-list / .sku-table 提取。
    
    Returns:
        list[dict]: [
            {
                "sku": str,          # 变体 SKU
                "price": float,      # 变体价格
                "stock": int,        # 变体库存
                "options": [         # 规格选项
                    {"name": str, "value": str},
                    ...
                ],
                "imageUrl": str      # 变体关联图片 URL
            },
            ...
        ]
    """
    # 1. 优先从 window.detailData 提取
    detail_variants = await _extract_variants_from_detail_data(page)
    if detail_variants:
        return detail_variants

    # 2. DOM: sku-table 表格
    variants = await _extract_variants_from_dom(page)
    if variants:
        return variants

    # 3. DOM: sku-prop 选择器区域 → 笛卡尔积
    return await _extract_variants_from_sku_props(page)


async def _extract_variants_from_detail_data(page: Page) -> list[dict]:
    """从 window.detailData.skuList 提取变体"""
    js = """
    () => {
        try {
            const dd = window.detailData;
            if (!dd || !dd.skuList || !Array.isArray(dd.skuList)) return null;
            return dd.skuList.map(sku => ({
                sku: sku.sku || sku.id || '',
                price: parseFloat(sku.price || sku.skuPrice) || null,
                stock: parseInt(sku.stock || sku.availableStock) || null,
                options: _parseSkuOptions(sku.specAttr || sku.spec || ''),
                imageUrl: (sku.image && (sku.image.src || sku.image.url)) || '',
            }));
            function _parseSkuOptions(specStr) {
                if (!specStr) return [];
                return specStr.split(/[,|;]/).map(part => {
                    const [name, value] = part.split(/[:：]/);
                    return { name: (name || '').trim(), value: (value || '').trim() };
                }).filter(o => o.name && o.value);
            }
        } catch(e) { return null; }
    }
    """
    try:
        result = await page.evaluate(js)
        if result and len(result) > 0:
            logger.info(f"从 detailData 提取到 {len(result)} 个变体")
            return result
    except Exception as e:
        logger.warning(f"detailData 变体提取失败: {e}")
    return []


async def _extract_variants_from_dom(page: Page) -> list[dict]:
    """从 DOM sku-table 表格提取变体"""
    try:
        table = page.locator('.sku-table, table.sku-table, [data-testid="sku-table"]').first
        if await table.count() == 0:
            return []
        
        rows = table.locator('tr')
        row_count = await rows.count()
        if row_count < 2:
            return []

        # 表头
        headers = await rows.nth(0).locator('th, td').all_inner_texts()
        headers = [h.strip() for h in headers]

        variants = []
        for i in range(1, row_count):
            cells = await rows.nth(i).locator('td').all()
            if len(cells) < len(headers):
                continue

            cell_texts = []
            for cell in cells:
                cell_texts.append((await cell.inner_text()).strip())

            variant = {"sku": None, "price": None, "stock": None, "options": [], "imageUrl": ""}
            for idx, header in enumerate(headers):
                value = cell_texts[idx] if idx < len(cell_texts) else ""
                if "sku" in header.lower():
                    variant["sku"] = value
                elif "price" in header.lower() or "价格" in header:
                    variant["price"] = parse_price(value)
                elif "stock" in header.lower() or "库存" in header:
                    variant["stock"] = int(value) if value.isdigit() else None
                elif "image" in header.lower() or "图片" in header:
                    img = await cells[idx].locator("img").get_attribute("src")
                    if img:
                        variant["imageUrl"] = make_absolute_url(img)
                elif value:
                    variant["options"].append({"name": header, "value": value})

            if variant["options"] or variant["sku"]:
                variants.append(variant)

        if variants:
            logger.info(f"从 DOM 表格提取到 {len(variants)} 个变体")
        return variants

    except Exception as e:
        logger.warning(f"DOM 变体提取失败: {e}")
    return []


async def _extract_variants_from_sku_props(page: Page) -> list[dict]:
    """从 sku-prop 选择器区域提取变体（笛卡尔积组合）"""
    try:
        # 提取 sku 维度
        js = """
        () => {
            const groups = [];
            const propEls = document.querySelectorAll('.sku-prop, [class*="sku-prop"], [data-testid="sku-prop"]');
            for (const g of propEls) {
                const name = (g.querySelector('.prop-name, [class*="prop-name"], label')?.textContent || '').trim();
                const items = g.querySelectorAll('.sku-item, .prop-value, [class*="sku-value"]');
                const values = Array.from(items).map(item => ({
                    value: (item.textContent || '').trim(),
                    imageUrl: item.querySelector('img')?.getAttribute('src') || '',
                }));
                if (name && values.length > 0) groups.push({ name, values });
            }
            return groups;
        }
        """
        groups = await page.evaluate(js)
        if not groups or len(groups) == 0:
            return []

        # Python 端执行笛卡尔积
        import itertools
        value_lists = [g["values"] for g in groups]
        combinations = list(itertools.product(*value_lists))

        variants = [
            {
                "sku": f"variant-{idx}",
                "price": None,
                "stock": None,
                "imageUrl": next((c["imageUrl"] for c in combo if c["imageUrl"]), ""),
                "options": [
                    {"name": groups[i]["name"], "value": combo[i]["value"]}
                    for i in range(len(groups))
                ],
            }
            for idx, combo in enumerate(combinations)
        ]

        logger.info(f"从 sku-prop 区域组合出 {len(variants)} 个变体")
        return variants

    except Exception as e:
        logger.warning(f"sku-prop 变体提取失败: {e}")
    return []
```

### 3.2 _extract_tiered_pricing() — 阶梯定价提取

```python
async def _extract_tiered_pricing(page: Page) -> Optional[list[dict]]:
    """
    提取阿里国际站阶梯定价表（tiered pricing）
    
    DOM 典型结构:
    <table class="price-range-table">
      <tr><td>1-99 Units</td><td>US $15.00</td></tr>
      <tr><td>100-499 Units</td><td>US $12.00</td></tr>
      <tr><td>500+ Units</td><td>US $10.00</td></tr>
    </table>
    
    Returns:
        list[dict] | None: [
            {"minQty": int, "maxQty": int | None, "price": float, "unit": str},
            ...
        ]
    """
    # 1. 优先从 window.detailData 提取
    tiers = await _extract_tiered_from_detail_data(page)
    if tiers:
        return tiers

    # 2. DOM 提取
    try:
        selectors = [
            ".price-range-table",
            ".tiered-price-list",
            ".price-break",
            ".bulk-price",
            ".volume-pricing",
            "[data-testid='tiered-pricing']",
        ]

        for sel in selectors:
            container = page.locator(sel).first
            if await container.count() == 0:
                continue

            rows = container.locator("tr, li, .price-break-item, [class*='item']")
            row_count = await rows.count()
            if row_count == 0:
                continue

            tiers = []
            for i in range(row_count):
                row = rows.nth(i)
                cells = row.locator("td, span, div")
                cell_count = await cells.count()
                texts = []
                for j in range(cell_count):
                    t = (await cells.nth(j).inner_text()).strip()
                    if t:
                        texts.append(t)
                if len(texts) < 2:
                    continue

                parsed = _parse_tier_row(texts[0], texts[1])
                if parsed:
                    tiers.append(parsed)

            if tiers:
                logger.info(f"提取到 {len(tiers)} 档阶梯定价")
                return tiers

    except Exception as e:
        logger.warning(f"阶梯定价 DOM 提取失败: {e}")

    return None


async def _extract_tiered_from_detail_data(page: Page) -> Optional[list[dict]]:
    """从 window.detailData.tieredPriceList 提取"""
    js = """
    () => {
        try {
            const dd = window.detailData;
            if (!dd || !dd.tieredPriceList) return null;
            return dd.tieredPriceList.map(t => ({
                minQty: t.startQuantity || t.minQuantity || 1,
                maxQty: t.endQuantity || t.maxQuantity || null,
                price: parseFloat(t.price || t.unitPrice),
                unit: t.currency || 'USD',
            }));
        } catch(e) { return null; }
    }
    """
    try:
        result = await page.evaluate(js)
        if result and len(result) > 0:
            logger.info(f"从 detailData 提取到 {len(result)} 档阶梯定价")
            return result
    except Exception:
        pass
    return None


def _parse_tier_row(qty_text: str, price_text: str) -> Optional[dict]:
    """解析单行阶梯定价"""
    if not qty_text or not price_text:
        return None

    # 数量区间: "1-99 Units" → minQty=1, maxQty=99
    range_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', qty_text)
    plus_match = re.search(r'(\d+)\s*\+', qty_text)

    if range_match:
        min_qty = int(range_match.group(1))
        max_qty = int(range_match.group(2))
    elif plus_match:
        min_qty = int(plus_match.group(1))
        max_qty = None  # 无限
    else:
        num_match = re.search(r'(\d+)', qty_text)
        if not num_match:
            return None
        min_qty = int(num_match.group(1))
        max_qty = None

    # 价格: "US $15.00" → 15.00
    price = parse_price(price_text)
    if price is None:
        return None

    # 币种
    unit = detect_currency(price_text)

    return {"minQty": min_qty, "maxQty": max_qty, "price": price, "unit": unit}
```

### 3.3 _extract_specs_full() — 全量规格提取含单位分离

替换现有 `_extract_specs(page)` 为更完善的版本：

```python
async def _extract_specs_full(page: Page) -> list[dict]:
    """
    全量规格提取，含单位分离
    
    改进点 (vs 现有 _extract_specs):
    1. 更多的选择器回退
    2. 从 window.detailData 前置提取
    3. 属性值中分离单位 (如 "100ml" → value="100", unit="ml")
    4. 去重（同名属性只取第一个）
    
    Returns:
        list[dict]: [
            {"name": str, "value": str, "unit": str | None},
            ...
        ]
    """
    # 1. 优先从 window.detailData 提取
    specs = await _extract_specs_from_detail_data(page)
    if specs:
        return specs

    # 2. DOM 多重选择器提取
    specs = []
    seen = set()

    dom_selectors = [
        "#key-attributes .id-grid-cols-\\[2fr_3fr\\]",
        "[data-testid='specifications'] tr",
        ".attributes-table tr",
        ".product-attributes tr",
        "[data-testid='product-attributes'] tr",
        ".specification li",
        ".attribute-list li",
        "table[class*='attr'] tr",
        "table[class*='spec'] tr",
        ".params-table tr",
        ".props-table tr",
        ".module_product_attrs tr",
        ".tab-content tr",
    ]

    for sel in dom_selectors:
        try:
            rows = page.locator(sel)
            count = await rows.count()
            if count == 0:
                continue

            for i in range(count):
                cells = rows.nth(i).locator("div, td, th, span")
                cell_count = await cells.count()
                if cell_count < 2:
                    continue

                name = (await cells.nth(0).inner_text()).strip().rstrip("：:").strip()
                value = (await cells.nth(1).inner_text()).strip()

                if not name or not value or name == value:
                    continue
                if len(name) > 100 or len(value) > 1000:
                    continue

                # 去重
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)

                # 单位分离
                clean_value, unit = _separate_unit(value)

                specs.append({"name": name, "value": clean_value, "unit": unit})

            if specs:
                logger.info(f"从选择器 '{sel}' 提取到 {len(specs)} 条规格")
                break  # 第一个成功的选择器

        except Exception as e:
            logger.debug(f"选择器 '{sel}' 提取失败: {e}")
            continue

    return specs


async def _extract_specs_from_detail_data(page: Page) -> list[dict]:
    """从 window.detailData.productSpecs 提取规格"""
    js = """
    () => {
        try {
            const dd = window.detailData;
            if (!dd || !dd.productSpecs) return null;
            return dd.productSpecs.map(spec => ({
                name: spec.attrName || spec.name || '',
                value: spec.attrValue || spec.value || '',
            }));
        } catch(e) { return null; }
    }
    """
    try:
        result = await page.evaluate(js)
        if result and len(result) > 0:
            logger.info(f"从 detailData 提取到 {len(result)} 条规格")
            # 单位分离
            for spec in result:
                clean_value, unit = _separate_unit(spec["value"])
                spec["value"] = clean_value
                spec["unit"] = unit
            return result
    except Exception:
        pass
    return []


def _separate_unit(value: str) -> tuple[str, Optional[str]]:
    """
    从属性值中分离单位
    
    Examples:
        "100 ml" → ("100", "ml")
        "1.5kg" → ("1.5", "kg")
        "3 Years" → ("3", "years")
        "15x10x5 cm" → ("15x10x5", "cm")
        "红色" → ("红色", None)
    """
    if not value:
        return (value, None)

    # 1. "数字 单位" 模式
    unit_patterns = [
        (r'^([\d.,]+)\s*(kg|kilograms?)$', re.I),
        (r'^([\d.,]+)\s*(g|grams?)$', re.I),
        (r'^([\d.,]+)\s*(ml|milliliters?)$', re.I),
        (r'^([\d.,]+)\s*(l|liters?)$', re.I),
        (r'^([\d.,]+)\s*(cm|centimeters?)$', re.I),
        (r'^([\d.,]+)\s*(mm|millimeters?)$', re.I),
        (r'^([\d.,]+)\s*(pcs|pieces?)$', re.I),
        (r'^([\d.,]+)\s*(years?|months?|days?)$', re.I),
        (r'^([\d.,]+)\s*(oz|fl\.?\s*oz)$', re.I),
    ]
    for pattern, flags in unit_patterns:
        m = re.match(pattern, value.strip(), flags)
        if m:
            return (m.group(1).strip(), m.group(2).lower())

    # 2. "数字单位" 缩写
    m = re.match(r'^([\d.,]+)\s*([a-zA-Z]{1,4})$', value.strip())
    if m:
        return (m.group(1).strip(), m.group(2).lower())

    # 3. 尺寸模式 "15x10x5 cm"
    m = re.match(r'^([\d\s.×xX*]+)\s*(cm|mm|inch|inches)$', value.strip())
    if m:
        return (value.strip()[:-len(m.group(2))].strip(), m.group(2).lower())

    return (value, None)
```

### 3.4 ProductListCrawler — 店铺列表爬取模块

**文件**: `services/alibaba-collector/lib/product_list.py` (新建)

```python
"""
ProductListCrawler — 店铺商品列表爬取模块
功能:
1. 访问店铺 productlist 页面
2. 滚动加载惰性加载商品
3. 翻页检测和自动翻页
4. 提取每个商品的链接、名称、图片、价格
5. 去重
"""

import re
import logging
import asyncio
from typing import Optional
from playwright.async_api import Page

logger = logging.getLogger(__name__)


class ProductListCrawler:
    """
    店铺商品列表爬取器
    
    典型店铺 URL: https://intellirise.en.alibaba.com/productlist
    
    使用:
        crawler = ProductListCrawler(page)
        products = await crawler.get_product_links("https://.../productlist", max_pages=5)
    """

    # 产品卡片选择器链
    CARD_SELECTORS = [
        ".fy26-product-card-wrapper",           # 标准产品卡片
        "[class*='product-card'][class*='wrapper']",
        ".product-list-item",
        ".product-item",
        ".product-card",
        "a[href*='/product-detail/']",          # 兜底: 包含产品详情链接的元素
    ]

    # 产品链接选择器
    LINK_SELECTORS = [
        "a.searchx-product-e-slider__link",
        "h2 a",
        "h3 a",
        "a[href*='/product-detail/']",
        ".product-card a[href*='/product/']",
        "[class*='product'] a[href*='.html']",
    ]

    # 翻页按钮选择器
    PAGINATION_SELECTORS = [
        "a.next, .pagination .next",
        "[class*='pagination'] [class*='next']",
        "a[rel='next']",
        ".page-next",
        "button:has-text('Next')",
    ]

    # 滚动加载检测
    LAZY_LOAD_SELECTORS = [
        ".lazy-load-more",
        ".load-more",
        "[class*='load-more']",
        ".infinite-scroll",
    ]

    def __init__(self, page: Page):
        self.page = page
        self.seen_urls: set[str] = set()  # 去重
        self.all_products: list[dict] = []

    async def get_product_links(
        self,
        url: str,
        max_pages: int = 10,
        scroll_wait: float = 2.0,
        page_wait: float = 3.0,
    ) -> list[dict]:
        """
        爬取店铺商品链接列表
        
        Args:
            url: 店铺 productlist 完整 URL
            max_pages: 最大翻页数
            scroll_wait: 每次滚动后等待秒数
            page_wait: 翻页后等待秒数
            
        Returns:
            list[dict]: [
                {"name": str, "url": str, "productId": str, "price": float, 
                 "currency": str, "imageUrl": str, "seller": dict},
                ...
            ]
        """
        logger.info(f"开始爬取商品列表: {url}")
        await self.page.goto(url, wait_until="networkidle", timeout=30000)

        page_num = 0
        while page_num < max_pages:
            page_num += 1
            logger.info(f"正在处理第 {page_num} 页...")

            # 1. 等待产品卡片出现
            await self._wait_for_cards()

            # 2. 滚动加载惰性商品
            await self._scroll_for_lazy_load(scroll_wait)

            # 3. 提取当前页所有商品
            products = await self._extract_page_products()
            logger.info(f"第 {page_num} 页提取到 {len(products)} 个商品 (去重前)")

            for p in products:
                if p.get("url") and p["url"] not in self.seen_urls:
                    self.seen_urls.add(p["url"])
                    self.all_products.append(p)

            # 4. 翻页
            has_next = await self._go_to_next_page(page_wait)
            if not has_next:
                logger.info("没有更多页，爬取结束")
                break

        logger.info(f"商品列表爬取结束，共 {len(self.all_products)} 个商品")
        return self.all_products

    async def _wait_for_cards(self):
        """等待产品卡片选择器之一出现"""
        for sel in self.CARD_SELECTORS:
            try:
                await self.page.wait_for_selector(sel, timeout=10000)
                logger.debug(f"产品卡片选择器 '{sel}' 已出现")
                return
            except Exception:
                continue
        logger.warning("所有产品卡片选择器均未出现")

    async def _scroll_for_lazy_load(self, wait_sec: float):
        """模拟用户滚动来触发懒加载"""
        # 先检测是否有懒加载触发器
        has_lazy = False
        for sel in self.LAZY_LOAD_SELECTORS:
            if await self.page.locator(sel).first.count() > 0:
                has_lazy = True
                break

        if not has_lazy:
            logger.debug("无懒加载触发器，跳过滚动加载")
            return

        # 滚动到底部
        prev_count = 0
        for _ in range(5):
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(wait_sec)

            cards = self.page.locator(self.CARD_SELECTORS[0])
            count = await cards.count()
            if count == prev_count:
                logger.debug(f"滚动后卡片数未增长 ({count})，停止")
                break
            prev_count = count
            logger.debug(f"滚动后卡片数: {count}")

    async def _extract_page_products(self) -> list[dict]:
        """提取当前页所有产品卡片"""
        js = """
        () => {
            const products = [];
            // 尝试每个卡片选择器
            const cardSelectors = arguments[0] || [];
            const linkSelectors = arguments[1] || [];
            
            let cards = [];
            for (const sel of cardSelectors) {
                const found = document.querySelectorAll(sel);
                if (found.length > 0) {
                    cards = Array.from(found);
                    break;
                }
            }
            
            // 兜底: 直接用链接选择器匹配元素
            if (cards.length === 0) {
                for (const sel of linkSelectors) {
                    const links = document.querySelectorAll(sel);
                    if (links.length > 0) {
                        cards = Array.from(links).map(a => a.closest('div, li') || a);
                        break;
                    }
                }
            }
            
            for (const card of cards) {
                const p = {};
                
                // Name
                const nameEl = card.querySelector('h2 span, [data-role="title-area"], [class*="title"]');
                if (nameEl) p.name = nameEl.textContent.trim();
                if (!p.name) continue;
                
                // URL + Product ID
                for (const sel of linkSelectors) {
                    const link = card.querySelector(sel);
                    if (link && link.href) {
                        p.url = link.href;
                        const m = link.href.match(/_(\\d{10,})\\.html/);
                        if (m) p.productId = m[1];
                        break;
                    }
                }
                
                // Price
                const priceEl = card.querySelector('[class*="price"]');
                if (priceEl) {
                    const text = priceEl.textContent.trim();
                    p.currency = text.includes('€') ? 'EUR' 
                        : (text.includes('¥') ? 'CNY' : 'USD');
                    const pm = text.match(/[\\d,]+\\.?\\d*/);
                    if (pm) p.price = parseFloat(pm[0].replace(/,/g, ''));
                }
                
                // Image
                const img = card.querySelector('img[class*="img"], img[src*="kf/"]');
                if (img) p.imageUrl = img.src || '';
                
                // Seller
                const sellerEl = card.querySelector('[class*="company"], [class*="supplier"]');
                if (sellerEl) {
                    p.seller = {
                        name: sellerEl.textContent.trim(),
                        url: sellerEl.querySelector('a')?.href || '',
                    };
                }
                
                products.push(p);
            }
            
            return products;
        }
        """
        try:
            result = await self.page.evaluate(
                js,
                self.CARD_SELECTORS,
                self.LINK_SELECTORS,
            )
            return result or []
        except Exception as e:
            logger.warning(f"提取页面产品失败: {e}")
            return []

    async def _go_to_next_page(self, wait_sec: float) -> bool:
        """翻到下一页，返回 False 表示无下一页"""
        for sel in self.PAGINATION_SELECTORS:
            try:
                next_btn = self.page.locator(sel).first
                if await next_btn.count() > 0:
                    # 检查是否 disabled
                    is_disabled = await next_btn.get_attribute("disabled")
                    if is_disabled:
                        continue

                    await next_btn.click()
                    await asyncio.sleep(wait_sec)
                    try:
                        await self.page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass

                    logger.debug(f"通过选择器 '{sel}' 翻页成功")
                    return True
            except Exception:
                continue

        # 兜底: 尝试 URL 参数翻页 (page=2)
        current_url = self.page.url
        m = re.search(r'page=(\d+)', current_url)
        if m:
            next_page = int(m.group(1)) + 1
            next_url = re.sub(r'page=\d+', f'page={next_page}', current_url)
            try:
                await self.page.goto(next_url, wait_until="networkidle", timeout=30000)
                logger.debug(f"通过 URL 参数翻到第 {next_page} 页")
                return True
            except Exception as e:
                logger.warning(f"URL 翻页失败: {e}")
                return False

        return False
```

### 3.5 DedupChecker — 去重模块

**文件**: `services/alibaba-collector/lib/dedup.py` (新建)

```python
"""
DedupChecker — 去重检查模块

在采集前调用 GET /api/external/collect/check 接口，
或在本地检查已采集的 sourceId 集合。
"""

import json
import logging
from typing import Optional
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class DedupChecker:
    """
    去重检查器
    
    两种模式:
    1. API 模式: 调用 GET /api/external/collect/check 检查
    2. 本地模式: 通过配置文件或 Redis 维护已采集 sourceId 集合
    
    用法:
        checker = DedupChecker(api_base_url="http://localhost:3000", api_token="xxx")
        result = await checker.check(source_url="https://...")
        if result["exists"]:
            logger.info(f"已采集过: {result['title']}")
    """

    def __init__(
        self,
        api_base_url: Optional[str] = None,
        api_token: Optional[str] = None,
        local_db: Optional[set[str]] = None,
    ):
        self.api_base_url = api_base_url
        self.api_token = api_token
        self.local_db = local_db or set()  # sourceId 集合

    async def check(
        self,
        source_url: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> dict:
        """
        检查产品是否已采集
        
        Args:
            source_url: 产品页面 URL (用于 API 模式)
            source_id: 产品 ID (用于本地模式)
            
        Returns:
            dict: {
                "exists": bool,
                "id": str | None,
                "title": str | None,
                "pipelineStatus": str | None,
                "message": str,
            }
        """
        # API 模式
        if self.api_base_url and source_url:
            return await self._check_via_api(source_url)

        # 本地模式
        if source_id and source_id in self.local_db:
            return {
                "exists": True,
                "id": None,
                "title": None,
                "pipelineStatus": None,
                "message": f"本地去重: sourceId={source_id} 已采集过",
            }

        return {"exists": False, "message": "未采集"}

    async def _check_via_api(self, source_url: str) -> dict:
        """通过 API 检查"""
        import httpx

        params = urlencode({"sourceUrl": source_url})
        url = f"{self.api_base_url}/api/external/collect/check?{params}"

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers={"X-API-Token": self.api_token or ""},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("data", {"exists": False})
                else:
                    logger.warning(f"去重 API 请求失败: {resp.status_code}")
                    return {"exists": False, "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            logger.warning(f"去重 API 请求异常: {e}")
            return {"exists": False, "error": str(e)}

    def add_to_local(self, source_id: str):
        """将 sourceId 加入本地去重集合"""
        self.local_db.add(source_id)

    def load_from_file(self, filepath: str):
        """从文件加载已采集 ID 列表"""
        try:
            with open(filepath, "r") as f:
                ids = json.load(f)
                if isinstance(ids, list):
                    self.local_db.update(ids)
                logger.info(f"从 {filepath} 加载了 {len(ids)} 个去重 ID")
        except Exception as e:
            logger.warning(f"加载去重文件失败: {e}")

    def save_to_file(self, filepath: str):
        """将去重集合保存到文件（断点续采支持）"""
        try:
            with open(filepath, "w") as f:
                json.dump(list(self.local_db), f)
            logger.info(f"已保存 {len(self.local_db)} 个去重 ID 到 {filepath}")
        except Exception as e:
            logger.warning(f"保存去重文件失败: {e}")
```

### 3.6 build_erp_payload_v2() — 全字段映射

在现有 `extractor.py` (或 `export.py`) 中新增：

```python
def build_erp_payload_v2(
    product: dict,
    source: str = "alibaba",
    source_url: str = "",
    source_id: Optional[str] = None,
) -> dict:
    """
    构建 POST /api/external/collect 的全字段 payload (v2)
    
    Args:
        product: extract_product_detail() 提取的完整产品数据
        source: 来源平台
        source_url: 页面 URL
        source_id: 产品 ID
        
    Returns:
        dict: 符合 CollectRequestBody 的 payload
    """
    # 计算阶梯定价映射
    tiered_pricing = product.get("tieredPricing") or product.get("tiers")
    price, compare_at_price = _map_tiered_to_price(tiered_pricing, product.get("price"))

    # 高阶化图片 URL
    images = product.get("images", [])
    highres_images = []
    for img in images:
        cleaned = clean_image_url(img.get("url", ""))
        if cleaned:
            highres_images.append({
                "type": "main" if img.get("isMain") or len(highres_images) == 0 else "gallery",
                "originalUrl": cleaned,
                "mimeType": "image/jpeg",
                "fileName": f"product_{len(highres_images)+1}.jpg",
                "sortOrder": len(highres_images),
                "altText": img.get("altText", ""),
                "width": img.get("width"),
                "height": img.get("height"),
            })

    # 规格属性（含单位分离）
    attributes = []
    for spec in product.get("specifications", []):
        clean_val, unit = _separate_unit(spec.get("value", ""))
        attributes.append({
            "name": spec.get("key", spec.get("name", "")),
            "value": clean_val,
            "unit": unit,
        })

    # 变体
    variants = []
    for v in product.get("variants", []):
        variants.append({
            "sku": v.get("sku", ""),
            "price": v.get("price"),
            "stock": v.get("stock"),
            "options": v.get("options", []),
        })

    # 提取物流信息
    weight = product.get("weight") or _extract_numeric_from_specs(
        product.get("specifications", []), ["weight", "gross weight", "net weight"]
    )
    length = product.get("length") or _extract_numeric_from_specs(
        product.get("specifications", []), ["length", "package size"]
    )
    width = product.get("width") or None
    height = product.get("height") or None
    hs_code = product.get("hsCode") or _extract_text_from_specs(
        product.get("specifications", []), ["hs code", "customs", "海关编码"]
    )
    shipping_class = product.get("shippingClass") or None

    return {
        # 来源
        "source": source,
        "sourceUrl": source_url,
        "sourceId": source_id or product.get("productId"),

        # 基本信息
        "title": product.get("name", "") or product.get("title", ""),
        "titleEn": None,
        "shortDescription": product.get("shortDescription") or None,
        "description": product.get("description"),
        "descriptionEn": None,
        "brand": product.get("brand"),
        "sku": product.get("sku") or product.get("productId"),

        # 价格
        "price": price,
        "compareAtPrice": compare_at_price,
        "currency": product.get("currency", "USD"),
        "stockQuantity": product.get("stockQuantity"),

        # 物流
        "weight": weight,
        "length": length,
        "width": width,
        "height": height,
        "shippingClass": shipping_class,
        "hsCode": hs_code,

        # 子表
        "images": highres_images,
        "attributes": attributes,
        "variants": variants,

        # 原始数据
        "rawData": {
            "tieredPricing": tiered_pricing,
            "supplier": product.get("seller") or product.get("supplier"),
            "aggregateRating": product.get("aggregateRating"),
            "moq": product.get("moq"),
            "url": source_url,
            "capturedAt": datetime.utcnow().isoformat(),
        },
    }


def _map_tiered_to_price(
    tiered_pricing: Optional[list[dict]],
    fallback_price: Optional[float],
) -> tuple[Optional[float], Optional[float]]:
    """
    将阶梯定价映射为 price + compareAtPrice
    
    策略:
    - 无阶梯: 用 fallback_price
    - ≥2档: price=最低价(最后一档), compareAtPrice=最高价(第一档)
    - 仅1档: price=该档价格, compareAtPrice=null
    """
    if not tiered_pricing or len(tiered_pricing) == 0:
        return (fallback_price, None)

    sorted_tiers = sorted(tiered_pricing, key=lambda t: t.get("minQty", 0))

    if len(sorted_tiers) >= 2:
        return (sorted_tiers[-1]["price"], sorted_tiers[0]["price"])
    else:
        return (sorted_tiers[0]["price"], None)


def _extract_numeric_from_specs(
    specs: list[dict], keywords: list[str]
) -> Optional[float]:
    """从规格表中提取数值型属性"""
    for spec in specs:
        name = spec.get("key", spec.get("name", "")).lower()
        value = spec.get("value", "")
        for kw in keywords:
            if kw in name:
                m = re.search(r'([\d.]+)', value)
                if m:
                    return float(m.group(1))
    return None


def _extract_text_from_specs(specs: list[dict], keywords: list[str]) -> Optional[str]:
    """从规格表中提取文本型属性"""
    for spec in specs:
        name = spec.get("key", spec.get("name", "")).lower()
        value = spec.get("value", "")
        for kw in keywords:
            if kw in name:
                return value
    return None
```

---

## 4. Sprint 2: WooCommerce 发布器扩展设计

### 4.1 需要在 buildProductData() 中新增的代码

**文件**: `src/lib/woocommerce-publisher.ts`

#### 4.1.1 供应商信息 → meta_data

```typescript
// 在 buildProductData() 的 meta_data 段落后新增 (第166行后)
// ── 供应商信息 ──
if (product.rawData?.supplier) {
  data.meta_data.push({
    key: '_supplier_info',
    value: typeof product.rawData.supplier === 'string'
      ? product.rawData.supplier
      : JSON.stringify(product.rawData.supplier),
  });
}
```

#### 4.1.2 非变体属性 → meta_data

```typescript
// ── 产品属性 (非变体) ──
if (product.attributes?.length > 0) {
  data.meta_data.push({
    key: '_product_attributes',
    value: JSON.stringify(
      product.attributes.map((a: any) => ({
        name: a.name,
        value: a.value,
        unit: a.unit || null,
      }))
    ),
  });
}
```

#### 4.1.3 HS Code → meta_data

```typescript
// ── HS Code ──
if (product.hsCode) {
  data.meta_data.push({ key: '_hs_code', value: product.hsCode });
}
```

#### 4.1.4 运费分类 → meta_data

```typescript
// ── Shipping Class ──
if (product.shippingClass) {
  data.meta_data.push({ key: '_shipping_class', value: product.shippingClass });
}
```

#### 4.1.5 库存字段 → stock_quantity (直接映射到 WooCommerce 字段)

```typescript
// ── 库存管理 ──
if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
  data.stock_quantity = product.stockQuantity;
  data.manage_stock = true;
}
```

#### 4.1.6 总和: buildProductData() meta_data 完整段落后

```typescript
// 元数据
data.meta_data = [
  { key: '_collected_from', value: product.source || '' },
  { key: '_collected_source_url', value: product.sourceUrl || '' },
];

if (product.productId) {
  data.meta_data.push({ key: '_erp_product_id', value: product.productId });
}

// ★ 新增扩展 meta_data
if (product.rawData?.supplier) {
  data.meta_data.push({
    key: '_supplier_info',
    value: typeof product.rawData.supplier === 'string'
      ? product.rawData.supplier
      : JSON.stringify(product.rawData.supplier),
  });
}

if (product.attributes?.length > 0) {
  data.meta_data.push({
    key: '_product_attributes',
    value: JSON.stringify(
      product.attributes.map((a: any) => ({
        name: a.name,
        value: a.value,
        unit: a.unit || null,
      }))
    ),
  });
}

if (product.hsCode) {
  data.meta_data.push({ key: '_hs_code', value: product.hsCode });
}

if (product.shippingClass) {
  data.meta_data.push({ key: '_shipping_class', value: product.shippingClass });
}

// ★ 新增直接字段
if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
  data.stock_quantity = product.stockQuantity;
  data.manage_stock = true;
}
```

---

## 5. Sprint 2: 梳理后台 API 设计

### 5.1 现有 API 端点清单

| # | 方法 | 路径 | 用途 | 现有状态 | 是否需要调整 |
|---|------|------|------|----------|-------------|
| 1 | GET | `/api/collected-products` | 列表查询（分页+筛选+排序） | ✅ 已有 | ❌ 无需调整 |
| 2 | GET | `/api/collected-products/:id` | 详情（含子表 images/variants/attributes/publishLogs） | ✅ 已有 | ⚠️ 见下方备注 |
| 3 | PUT | `/api/collected-products/:id` | 更新主表字段 | ✅ 已有 | ⚠️ 需扩展字段 |
| 4 | DELETE | `/api/collected-products/:id` | 删除产品 | ✅ 已有 | ❌ 无需调整 |
| 5 | PUT | `/api/collected-products/:id/images` | 更新图片（删除旧+插入新） | ✅ 已有 | ❌ 无需调整 |
| 6 | PUT | `/api/collected-products/:id/attributes` | 更新属性（删除旧+插入新） | ✅ 已有 | ❌ 无需调整 |
| 7 | PUT | `/api/collected-products/:id/variants` | 更新变体（删除旧+插入新） | ✅ 已有 | ❌ 无需调整 |
| 8 | POST | `/api/collected-products/:id/publish` | 发布到 WooCommerce | ✅ 已有 | ❌ 无需调整（发布器内部改进） |
| 9 | POST | `/api/collected-products/:id/translate` | AI 翻译 | ✅ 已有 | ❌ 无需调整 |

### 5.2 需要调整的端点

#### 5.2.1 GET /api/collected-products/:id — 返回 rawData 解析字段

当前详情 API 返回 rawData 作为原始 JSON。需要增加辅助解析字段，方便前端直接展示而不必自己解析 rawData：

```typescript
// 在 GET detail 返回体中新增以下字段（在现有数据基础上补充）

interface ProductDetailResponse {
  // ... 现有字段
  rawData: {
    tieredPricing?: TieredPrice[];
    supplier?: SupplierInfo;
    aggregateRating?: AggregateRating;
    moq?: number;
    // ... 其他原始字段
  } | null;

  // ★ 新增辅助字段（从 rawData 解析，非 DB 持久字段）
  // 前端可以直接展示这些字段，无需自己解析 rawData
  _tieredPricing?: TieredPrice[];    // 从 rawData.tieredPricing 提取
  _supplierInfo?: SupplierInfo;      // 从 rawData.supplier 提取
  _aggregateRating?: AggregateRating; // 从 rawData.aggregateRating 提取
  _moq?: number;                      // 从 rawData.moq 提取
}
```

实现方式: 在 route handler 中增加一个 transformation step，在返回前解析 rawData：

```typescript
// 在 GET /:id route 的返回前
if (product.rawData) {
  const raw = product.rawData as any;
  (product as any)._tieredPricing = raw.tieredPricing || null;
  (product as any)._supplierInfo = raw.supplier || null;
  (product as any)._aggregateRating = raw.aggregateRating || null;
  (product as any)._moq = raw.moq || null;
}
```

#### 5.2.2 PUT /api/collected-products/:id — 扩展可更新字段

当前 PUT 接口已支持更新主表字段。确认以下新采集字段是否在更新逻辑中：

```
字段                 | 当前 PUT 支持 | 备注
title               | ✅ 已有       |
titleEn             | ✅ 已有       |
shortDescription    | ✅ 已有       |
description         | ✅ 已有       |
descriptionEn       | ✅ 已有       |
brand               | ✅ 已有       |
sku                 | ✅ 已有       |
price               | ✅ 已有       |
compareAtPrice      | ✅ 已有       |
currency            | ✅ 已有       |
stockQuantity       | ✅ 已有       |
weight              | ✅ 已有       |
length              | ⚠️ 需确认     | 若未支持需添加
width               | ⚠️ 需确认     | 若未支持需添加
height              | ⚠️ 需确认     | 若未支持需添加
shippingClass       | ⚠️ 需确认     | 若未支持需添加
hsCode              | ⚠️ 需确认     | 若未支持需添加
```

如果 PUT handler 是通用字段映射（直接将 body 中所有匹配的字段写入 Prisma），则无需修改。需要检查现有实现确认。

#### 5.2.3 无额外新 API 端点

梳理后台的编辑页重构不需要新增后端 API 端点。9 个 Section 的数据均来自 3 个现有读写 API：
- 主表字段 (Section 1,3,6,7,8,9) → `GET + PUT /api/collected-products/:id`
- 图片 (Section 2) → `GET 包含在detail + PUT /api/collected-products/:id/images`
- 属性 (Section 4) → `GET 包含在detail + PUT /api/collected-products/:id/attributes`
- 变体 (Section 5) → `GET 包含在detail + PUT /api/collected-products/:id/variants`

**仅需确认** PUT handler 是否覆盖了 length/width/height/shippingClass/hsCode 字段。若不覆盖，在 PUT handler 的 data 解构中补上。

---

## 6. 附录: 接口类型定义

### 6.1 Chrome 插件 ↔ API 通信类型

```typescript
// 插件 → background.js 消息类型
interface ExtensionMessage {
  type: 'EXTRACT_PRODUCT';         // 执行全量采集
  // | 'EXTRACT_PREVIEW'           // 获取预览数据 (已有)
  // | 'EXTRACTION_PROGRESS'       // 进度事件 (新增)
  // | 'EXTRACT_CHECK_DUP'         // 去重检查 (新增)
  payload?: {
    sourceUrl?: string;
    progress?: { phase: string; message: string; time: number };
  };
}

// background.js → API 请求
interface CollectApiRequest {
  url: string;                        // POST /api/external/collect
  method: 'POST';
  headers: { 'X-API-Token': string; 'Content-Type': 'application/json' };
  body: CollectRequestBody;
}

// API 响应
interface CollectApiResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    pipelineStatus: string;
    updated?: boolean;
    alreadyCollected?: boolean;
    message?: string;
  };
  message: string;
}
```

### 6.2 Python 采集器 ↔ API 通信类型

```python
# 与 Chrome 插件使用相同的 API payload 格式

COLLECT_PAYLOAD_SCHEMA = {
    "source": str,          # "alibaba"
    "sourceUrl": str,       # 页面 URL
    "sourceId": str | None, # 产品 ID
    "title": str,
    "titleEn": str | None,
    "shortDescription": str | None,
    "description": str | None,
    "descriptionEn": str | None,
    "brand": str | None,
    "sku": str | None,
    "price": float | None,
    "compareAtPrice": float | None,
    "currency": str,        # 默认 "USD"
    "stockQuantity": int | None,
    "weight": float | None,
    "length": float | None,
    "width": float | None,
    "height": float | None,
    "shippingClass": str | None,
    "hsCode": str | None,
    "images": list,         # CollectImage[]
    "attributes": list,     # CollectAttribute[]
    "variants": list,       # CollectVariant[]
    "rawData": dict | None, # RawData
}

COLLECT_IMAGE_SCHEMA = {
    "type": str,            # "main" | "gallery" | "detail"
    "data": str | None,     # base64
    "originalUrl": str,
    "mimeType": str,
    "fileName": str | None,
    "fileSize": int | None,
    "width": int | None,
    "height": int | None,
    "altText": str | None,
    "sortOrder": int,
}

COLLECT_ATTRIBUTE_SCHEMA = {
    "name": str,
    "nameEn": str | None,
    "value": str,
    "valueEn": str | None,
    "unit": str | None,
    "sortOrder": int,
}

COLLECT_VARIANT_SCHEMA = {
    "sku": str | None,
    "price": float | None,
    "stock": int | None,
    "options": list | None,  # [{"name": str, "value": str}]
}

RAW_DATA_SCHEMA = {
    "tieredPricing": list | None,  # [{"minQty": int, "maxQty": int|null, "price": float, "unit": str}]
    "supplier": dict | None,       # {"name": str, "url": str, "verified": bool, ...}
    "aggregateRating": dict | None, # {"ratingValue": float, "reviewCount": int}
    "moq": int | None,
    "url": str,
    "capturedAt": str,             # ISO datetime
}
```

### 6.3 关键数据流向总结

```
Chrome 插件 / Python 采集器
        │
        │ POST payload (CollectRequestBody)
        ▼
POST /api/external/collect
        │
        ├─ 1. 验证 X-API-Token
        ├─ 2. 查重 (sourceUrl)
        ├─ 3a. 存在 & 已发布 → 返回已存在 (不创建)
        ├─ 3b. 存在 & 未发布 → PUT update (覆盖)
        ├─ 3c. 不存在 → POST create (新的)
        │
        ├─ 主表: 22 字段 (含新增的 length/width/height/shippingClass/hsCode)
        ├─ 子表: images.createMany (delete old + insert new)
        ├─ 子表: attributes.createMany
        └─ 子表: variants.createMany
                │
                ▼
        CollectedProduct (Prisma)
                │
                ▼
        GET /api/collected-products/:id (含 rawData 解析辅助字段)
                │
                ▼
        梳理后台编辑页 (9 Sections)
                │
                ▼
        POST /api/collected-products/:id/publish
                │
                ├─ WooCommercePublisher.create/update
                │   ├─ name, description, price, weight, dimensions
                │   ├─ images (upload → Media Library)
                │   ├─ attributes (变体维度)
                │   ├─ variations (变体组合)
                │   └─ meta_data (supplier/attributes/hsCode/shippingClass)
                │
                ├─ PublishLog.create
                └─ CollectedProduct → pipelineStatus='published'
```

---

*文档结束*
