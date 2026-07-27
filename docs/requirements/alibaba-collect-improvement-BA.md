# 阿里国际站商品采集改进 — 用户需求规格说明书 (BA)

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2026-07-26 | Hermes BA | 初始需求规格 |

---

## 1. 业务目标

### 1.1 问题陈述

当前 Trade ERP 系统的"采集→梳理→发布"管线中，**采集环节是最大瓶颈**：

| 问题 | 具体表现 | 影响 |
|------|----------|------|
| **字段缺失严重** | Chrome 插件只采集 title、price、description、images、attributes 5 类基础数据 | 采集后的产品需要大量人工补齐字段才能发布 |
| **无阶梯定价** | 阿里国际站的核心卖点是 tiered pricing（如 10-99个=$15，100+个=$12），但完全不采集 | 无法在 WooCommerce 上实现批量价格策略 |
| **无变体提取** | 颜色、尺寸等多规格变体（如 红色/S、蓝色/M）未提取 | 发布到 WooCommerce 后需要手动创建变体 |
| **选择器脆弱** | CSS 选择器靠猜测，没有多重回退机制 | 页面改版即采集失败 |
| **店铺批量采集不可靠** | store_collector_v2.py 的选择器过于宽泛，提取率低 | 批量采集后数据质量差，大量需人工重采 |
| **数据模型不匹配** | 采集的数据字段远少于 CollectedProduct 模型可容纳的字段 | 梳理后台的大量字段（brand、weight、hsCode、meta 等）需手动录入 |

### 1.2 解决目标

1. **一次采集，直接可用**：Chrome 插件采集的数据字段量达到 CollectedProduct 模型的 80% 以上覆盖率，用户打开梳理后台即可看到完整的产品信息。
2. **批量店铺商品同步**：运营人员可以在 1 小时内完成自己阿里国际站店铺（如 intellirise.en.alibaba.com）所有在售商品的采集。
3. **抗页面改版**：多重 CSS 选择器回退 + JSON-LD 结构化数据提取，选择器失效时仍有数据。

---

## 2. 全局架构定位

改进后的采集模块在整个系统中的位置：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          改进后的采集层                                    │
│                                                                          │
│  ┌─────────────────────────────────┐   ┌──────────────────────────────┐  │
│  │  Chrome 插件 v2                  │   │  Python 采集引擎 v2          │  │
│  │                                 │   │                              │  │
│  │  功能：                         │   │  功能：                       │  │
│  │  • 手动单商品全字段采集          │   │  • 店铺商品列表爬取           │  │
│  │  • 手动选择模式（用户点选）      │   │  • 关键词搜索批量采集         │  │
│  │  • 页面改版自适应                │   │  • 分类页批量采集             │  │
│  │                                 │   │  • Open API 卖家产品采集      │  │
│  │  数据流：                       │   │  • 图片批量下载+压缩          │  │
│  │  content.js → background.js     │   │                              │  │
│  │    → POST /api/external/collect │   │  数据流：                    │  │
│  └──────────────┬──────────────────┘   │  lib/extractor.py            │  │
│                 │                       │    → build_erp_payload()    │  │
│                 │                       │    → POST /api/external/    │  │
│                 │                       │          collect            │  │
│                 │                       └──────────────┬───────────────┘  │
│                 │                                      │                  │
│                 ▼                                      ▼                  │
│        ┌────────────────────────────────────────────────────────┐        │
│        │              API 层（无变化）                           │        │
│        │  POST /api/external/collect       ← 外部 API Token    │        │
│        │  POST /api/collected-products     ← 内部 Session      │        │
│        └──────────────────────┬─────────────────────────────────┘        │
│                               ▼                                         │
│        ┌────────────────────────────────────────────────────────┐        │
│        │        CollectedProduct 数据模型（已有，字段对齐）       │        │
│        │  采集时尽可能填充所有字段                                │        │
│        │                                                        │        │
│        │  Pipeline: collected → organizing → ready →            │        │
│        │            publishing → published / discarded / error   │        │
│        └──────────────────────┬─────────────────────────────────┘        │
│                               ▼                                         │
│        ┌────────────────────────────────────────────────────────┐        │
│        │  梳理后台（无变化）  /collected-products/[id]            │        │
│        │  用户编辑、翻译、发布                                     │        │
│        └──────────────────────┬─────────────────────────────────┘        │
│                               ▼                                         │
│        ┌────────────────────────────────────────────────────────┐        │
│        │  WooCommerce 发布器（无变化）                            │        │
│        │  完整字段 → WooCommerce API                            │        │
│        └────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 边界（不变的部分）

- **API 层不变**：`POST /api/external/collect` 接口的 payload 格式不变，只是发来的数据更完整
- **CollectedProduct 模型不变**：字段已足够容纳阿里国际站所有可采集字段
- **梳理后台不变**：编辑页 /collected-products/[id] 现有 UI 可直接展示新字段
- **WooCommerce 发布器不变**：`woocommerce-publisher.ts` 的字段映射无需修改

### 2.2 变的部分

- Chrome 插件增加**阶梯定价**、**变体**、**物流**、**品牌**、**MOQ** 等字段提取
- Python 采集引擎增加**店铺商品列表页可靠解析**、**变体提取**、**阶梯定价**
- 两个采集源统一字段映射到 CollectedProduct 模型

---

## 3. 用户角色

| 角色 | 描述 | 使用方式 | 典型场景 |
|------|------|----------|----------|
| **运营人员 (P0)** | 日常负责产品采集和上架的运营同事 | Chrome 插件 + 梳理后台 | 打开一个阿里国际站商品页 → 一键采集 → 切换到 ERP 梳理 → 编辑 → 发布 |
| **批量运营负责人 (P0)** | 负责店铺商品批量管理的团队负责人 | Python CLI 或 API 触发 | 定时跑 `python store_collector_v2.py` 将全店商品拉入 ERP |
| **产品经理 (P1)** | 制定选品策略的决策者 | 梳理后台查看 | 查看采集到的新款，决定哪些上架、哪些废弃 |
| **管理员 (P2)** | 维护采集 Token 和系统配置 | 系统设置页 | 重新生成 API Token、配置 WooCommerce |

---

## 4. 功能需求列表

### 4.1 Chrome 插件改进 (优先级覆盖)

#### P0 — 核心数据完整性（必须）

| 编号 | 需求名称 | 说明 |
|------|----------|------|
| EXT-P0-01 | **阶梯定价提取** | 采集阿里国际站的产品价格区间表（tiered pricing），如 "1-99 units: US$15.00, 100+ units: US$12.00"。存入 rawData 同时尝试映射为 compareAtPrice（最高价）和 price（最低价） |
| EXT-P0-02 | **变体/规格完整提取** | 提取 SKU 变体的组合，包括颜色、尺寸等。每个变体需采集：sku、price、库存、关联图片。结构匹配 CollectedProductVariant.options Json |
| EXT-P0-03 | **供应商信息** | 采集 supplierName、supplierUrl、supplier是否Verified（金牌供应商标识） |
| EXT-P0-04 | **MOQ** | Minimum Order Quantity 最小起订量 |
| EXT-P0-05 | **产品属性全覆盖** | 规格表中的所有属性行全部采集，包括属性单位（如 kg、cm、ml），匹配 CollectedProductAttribute 模型的 name/value/unit |
| EXT-P0-06 | **多重 CSS 选择器回退** | 对每个字段维护 5-8 个备选选择器，按优先级尝试。最后兜底走 JSON-LD |

#### P1 — 重要增强

| 编号 | 需求名称 | 说明 |
|------|----------|------|
| EXT-P1-01 | **品牌采集** | 从规格表的 "Brand" 行或标题中的品牌信息提取 brand 字段 |
| EXT-P1-02 | **物流信息采集** | 提取重量（weight）、包装尺寸（length/width/height）、运费分类 |
| EXT-P1-03 | **海关编码** | 采集产品页显示的 HS Code / 海关编码 |
| EXT-P1-04 | **评分与评价数** | 采集 aggregateRating（ratingValue + reviewCount） |
| EXT-P1-05 | **图片高清化** | 将 CDN URL 中的尺寸限定后缀（`_350x350.jpg`）替换为原图 `_640x640.jpg` 或去掉尺寸后缀取最大图 |
| EXT-P1-06 | **采集状态反馈** | 插件 popup 显示详细进度：`正在提取...已获取 3/5 个阶梯价格`、`已提取 12 个变体`，增强用户信心 |
| EXT-P1-07 | **采集去重检测** | 在 popup 中显示"该产品已在 XX 时间采集过，上次采集标题：XXX，是否重新采集？" |

#### P2 — 锦上添花

| 编号 | 需求名称 | 说明 |
|------|----------|------|
| EXT-P2-01 | **多图片类型区分** | 区分 main（主图）、gallery（图库图）、detail（详情描述中的说明图），对应 CollectedProductImage.type |
| EXT-P2-02 | **描述图片嵌入采集** | 详细描述中的 `<img>` 标签图片也采集为 detail 类型 |
| EXT-P2-03 | **采集历史记录** | 插件本地存储最近 20 条采集记录，显示标题和采集时间 |

### 4.2 Python 采集服务改进

#### P0 — 核心（必须）

| 编号 | 需求名称 | 说明 |
|------|----------|------|
| PY-P0-01 | **店铺商品列表可靠解析** | 支持 intellirise.en.alibaba.com/productlist 页面。当前 v2 版用 `a[href*='/product-detail/']` 全量提取，太脆弱。改为：① 等待 product-card/link-items 类容器出现 ② 多重选择器回退 ③ 页面滚动惰性加载 ④ 翻页检测（页码/URL 参数） |
| PY-P0-02 | **阶梯定价提取** | 在 extract_product_detail() 中增加阿里国际站价格区间表的 DOM 解析。阿里价格表格式一般为 `.price-range-table .price-item` 或阶梯表格 |
| PY-P0-03 | **变体/规格提取** | 增加 SKU 区域解析，提取颜色、尺寸等变体。参考 json `window.detailData` 或 DOM 中的 sku-selector 区域 |
| PY-P0-04 | **JSON-LD + `window.detailData` 双路径** | 除了 JSON-LD 外，尝试从 `window.detailData` 全局变量获取完整数据（阿里详情页的 Vue/React 状态经常挂在这个变量上） |
| PY-P0-05 | **去重检查** | 采集前检查 CollectedProduct 表中是否已存在相同 sourceId + source。可通过 HEAD 请求 `/api/external/collect?check=sourceId` 或本地维护采集过的 URL 集合 |

#### P1 — 重要增强

| 编号 | 需求名称 | 说明 |
|------|----------|------|
| PY-P1-01 | **反检测增强** | User-Agent 轮换、请求间隔随机化 (1-3s)、鼠标模拟、随机滚动行为 |
| PY-P1-02 | **图片压缩优化** | 当前 PIL 压缩 JPEG quality=85，可接受。增加图片最大宽度参数配置（默认 1200px） |
| PY-P1-03 | **采集进度报告** | 实时输出到 stdout 的进度条 + 最终汇总报告（JSON）中展示各字段的采集成功率 |
| PY-P1-04 | **Open API 补充字段** | api_collector.py 目前通过 Open API 采集的字段较少，补充：brand、weight、package dimensions、category、HS Code |

#### P2 — 进阶

| 编号 | 需求名称 | 说明 |
|------|----------|------|
| PY-P2-01 | **分类页批量采集** | 支持输入分类 URL，采集分类下所有产品（参考 lablnet 的 getProductsLinksFromCategory 策略） |
| PY-P2-02 | **定时任务集成** | 支持 cron 定时运行，`python collector.py --cron "0 6 * * 1" --keyword "solar panel"` |
| PY-P2-03 | **多卖家店铺支持** | 支持配置多个店铺 URL，批量采集多个阿里国际站店铺 |

---

## 5. 业务流程

### 5.1 正常流程

#### 流程 A：Chrome 插件手动采集单个商品

```
┌──────────────────────────────────────────────────────────────────────┐
│  用户打开阿里国际站商品详情页                                         │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  点击插件图标 → popup 弹出                                            │
│  • 检测平台：✓ 阿里国际站                                             │
│  • 显示预览：标题 / 价格 / 图片数 / 属性数                            │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  用户点击「采集到 ERP」                                                │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  content.js 执行 parseAlibabaFull()                                   │
│  1. 多重选择器尝试提取标题、价格、描述、品牌、SKU                      │
│  2. JSON-LD 提取结构化数据                                            │
│  3. 提取阶梯定价表（如存在）                                           │
│  4. 提取变体选择器区域 → 解析 SKU/价格/图片/库存                      │
│  5. 提取规格表 → 所有属性行（含单位）                                  │
│  6. 提取 MOQ、包装信息、供应商                                        │
│  7. 提取所有图片（主图+图库+详情图）                                    │
│  8. 通过 canvas 下载图片→base64                                       │
│  9. 组装完整 payload                                                  │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  background.js POST → /api/external/collect                          │
│  返回 { id, pipelineStatus: "collected" }                           │
│  popup 显示「✅ 采集成功！已添加到 ERP」                              │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  用户打开 ERP 梳理后台 → /collected-products                         │
│  列表页新条目出现，状态「待梳理」                                     │
│  点开详情页：所有字段已预填充（标题、价格、品牌、属性、变体、物流）   │
│  用户只需：翻译 → 微调 → 发布                                         │
└──────────────────────────────────────────────────────────────────────┘
```

#### 流程 B：Python 批量采集店铺产品

```
┌──────────────────────────────────────────────────────────────────────┐
│  运营人员执行：                                                       │
│  cd services/alibaba-collector                                       │
│  python store_collector_v2.py                                        │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  1. Playwright 启动 Chromium 无头模式                                │
│  2. 注入 stealth 防检测脚本                                          │
│  3. 访问 STORE_URL/productlist                                       │
│  4. 滚动加载 + 翻页 → 提取所有产品链接                                │
│     去重：跳过已在 CollectedProduct 中存在的 sourceId                │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  循环（最多 CONCURRENCY 并发）：                                      │
│  5. 访问每个产品详情页                                               │
│  6. 提取完整字段：同流程 A 的步骤 3                                  │
│  7. 下载图片（同一页导航到图片 URL）                                  │
│  8. 构建 payload → POST /api/external/collect                        │
│  9. 间隔 1-3s 随机等待                                               │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  完成后：                                                             │
│  • 汇总报告保存到 output/ 目录                                       │
│  • 梳理后台出现 N 条「已采集」状态的产品                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 异常流程

| 场景 | 处理方式 | 用户感知 |
|------|----------|----------|
| **页面未加载完整** | 自动等待 3s 后重试，最多重试 2 次 | 插件显示"⏳ 页面加载中..." |
| **选择器全部失效** | 降级到 JSON-LD 提取；JSON-LD 也空时降级到 meta tags | 字段显示"(需手动填写)" |
| **图片下载失败** | 跳过该图片，继续下载其余图片 | 插件显示"图片 3/8 下载失败" |
| **图片防盗链** | canvas 绘制绕过（已有实现） | 无感知 |
| **API 投递失败** | 自动重试 1 次 | 插件显示"❌ 上传失败，请检查连接" |
| **阿里反爬检测** | Python 服务：stealth 脚本 + 随机 User-Agent + 请求间隔；Chrome 插件：依赖浏览器用户已登录的 cookie | Python 服务降速重试 |
| **店铺无商品/商品已下架** | 跳过该商品，日志记录 | 采集报告显示"已跳过 N 个" |
| **Open API 限流** | 自动等待 1s 重试，连续 3 次失败则停止 | 日志显示"API rate limit exceeded" |
| **网络超时** | 30s 超时，跳过该商品继续下一个 | 采集进度显示"❌ 超时" |

---

## 6. 数据字段清单

### 6.1 阿里国际站 → CollectedProduct 字段映射

以下是从阿里国际站产品页可提取的完整字段清单（对标 YrayPixels/alibaba-scraper 的 30+ 字段能力）：

#### 基本信息

| 字段名 | CollectedProduct 模型字段 | 阿里国际站来源 | 当前采集状态 | 改进后状态 |
|--------|-------------------------|----------------|-------------|-----------|
| 标题 | `title` | h1 / .title-main / JSON-LD `name` | ✅ 已有 | ✅ 增强选择器 |
| 英文标题 | `titleEn` | 同 title（阿里已是英文） | ✅ 已有 | ✅ 不变 |
| 短描述 | `shortDescription` | JSON-LD `description`（短版） | ❌ 缺失 | ✅ 新增 |
| 详细描述 | `description` | .detail-description / JSON-LD | ✅ 已有 | ✅ 增强 |
| 品牌 | `brand` | 规格表 Brand 行 / JSON-LD `brand.name` | ❌ 缺失 | ✅ 新增 |
| SKU | `sku` | JSON-LD `sku` / DOM | ❌ 缺失 | ✅ 新增 |

#### 价格信息

| 字段名 | CollectedProduct 模型字段 | 阿里国际站来源 | 当前采集状态 | 改进后状态 |
|--------|-------------------------|----------------|-------------|-----------|
| 售价 | `price` | .price-range / JSON-LD `offers.price` | ✅ 已有 | ✅ 取最低价 |
| 划线价 | `compareAtPrice` | 如果阶梯价最高价 > 最低价，最高价作为原价 | ❌ 缺失 | ✅ 新增 |
| 币种 | `currency` | 价格前缀（USD/EUR/CNY） | ✅ 已有 | ✅ 增强检测 |
| 阶梯定价 | `rawData` | .price-range-table / JSON-LD 无此结构 | ❌ 缺失 | ✅ 新增(rawData中) |

#### 阶梯定价表（新增，不直映射模型，存入 rawData）

| 字段 | 说明 | 来源 |
|------|------|------|
| tieredPricing[].minQty | 最小数量（如 1, 100, 500） | DOM 价格表 |
| tieredPricing[].maxQty | 最大数量（如 99, 499, null） | DOM 价格表 |
| tieredPricing[].price | 该档单价 | DOM 价格表 |
| tieredPricing[].unit | 单位 | DOM 价格表 |

#### 物流信息

| 字段名 | CollectedProduct 模型字段 | 阿里国际站来源 | 当前采集状态 | 改进后状态 |
|--------|-------------------------|----------------|-------------|-----------|
| 重量 | `weight` | 规格表 / Shipping info | ❌ 缺失 | ✅ 新增 |
| 长 | `length` | 包装尺寸 | ❌ 缺失 | ✅ 新增 |
| 宽 | `width` | 包装尺寸 | ❌ 缺失 | ✅ 新增 |
| 高 | `height` | 包装尺寸 | ❌ 缺失 | ✅ 新增 |
| 运费分类 | `shippingClass` | 物流信息区域 | ❌ 缺失 | ✅ 新增 |
| 海关编码 | `hsCode` | 规格表 HS Code 行 | ❌ 缺失 | ✅ 新增 |

#### 变体信息 → CollectedProductVariant[]

| 字段 | 模型字段 | 当前 | 改进后 |
|------|----------|------|--------|
| 变体 SKU | `sku` | ❌ | ✅ |
| 变体价格 | `price` | ❌ | ✅ |
| 变体库存 | `stock` | ❌ | ✅ |
| 选项1：名称+值 | `options[0]`（如 `{"name":"颜色","value":"红色"}`） | ❌ | ✅ |
| 选项2：名称+值 | `options[1]`（如 `{"name":"尺寸","value":"M"}`） | ❌ | ✅ |
| 变体关联图片 | `imageId` | ❌ | ✅ |

|## 属性信息 → CollectedProductAttribute[]
|
|阿里国际站产品详情页的「Key Attributes」规格表包含大量关键产品属性，对于化妆品/美容产品，以下属性是必须采集的重点：
|
|#### 化妆品/美容产品核心属性清单
|
|**这些属性来自阿里国际站规格表（Key Attributes / Specifications）中的 key-value 行，采集器应识别并提取这些常见属性名：**
|
|| 属性名（中文） | 属性名（英文，阿里页面上常见） | 说明 | 映射到模型字段 | 当前采集状态 |
||---------------|-------------------------------|------|-------------|-------------|
|| 成分 / 主要成分 | Ingredient / Main Ingredients / Key Ingredient | 产品核心成分列表 | `attributes[{name:"成分", value:"..."}]` | ❌ 缺失 |
|| 功效 / 主要功效 | Benefit / Function / Effect | 产品功效描述（如美白、保湿） | `attributes[{name:"功效", value:"..."}]` | ❌ 缺失 |
|| 颜色 | Color | 产品颜色（如白色、透明、珠光） | `attributes[{name:"颜色", value:"..."}]` 或变体 | ❌ 缺失 |
|| 种类 / 产品种类 | Type / Product Type / Category | 产品类型（如精华、面霜、喷雾） | `attributes[{name:"种类", value:"..."}]` | ❌ 缺失 |
|| 尺寸 | Size / Product Size | 产品尺寸（如 15×5×3cm） | `attributes[{name:"尺寸", value:"..."}]` 或变体 | ❌ 缺失 |
|| 容量 / 体积 | Capacity / Volume / Net Content | 产品容量（如 100ml、50g） | `attributes[{name:"容量", value:"..."}]` | ❌ 缺失 |
|| 净重 | Net Weight | 产品净重 | `attributes[{name:"净重", value:"..."}]` 或 `weight` | ❌ 缺失 |
|| 重量 | Weight / Gross Weight | 产品毛重（含包装） | `weight`（模型字段）或 attributes | ❌ 缺失 |
|| 箱规 / 包装规格 | Packing / Package / Packaging Details | 包装方式（如 1pc/box, 12pcs/carton） | `attributes[{name:"箱规", value:"..."}]` | ❌ 缺失 |
|| 适用肤质 | Skin Type / Suitable Skin | 适用肤质（如 All Skin Types, Oily, Sensitive） | `attributes[{name:"适用肤质", value:"..."}]` | ❌ 缺失 |
|| 保质期 | Shelf Life / Expiry | 产品保质期（如 3 Years） | `attributes[{name:"保质期", value:"..."}]` | ❌ 缺失 |
|| 产地 | Place of Origin | 产地（如 China、Guangdong） | `attributes[{name:"产地", value:"..."}]` | ❌ 缺失 |
|| 认证 | Certificate / Certification | 产品认证（如 FDA、MSDS、GMP） | `attributes[{name:"认证", value:"..."}]` | ❌ 缺失 |
|| 材质 | Material | 包装材质或产品材质 | `attributes[{name:"材质", value:"..."}]` | ❌ 缺失 |
|| 使用说明 | Usage / How to Use | 使用方法 | `attributes[{name:"使用说明", value:"..."}]` | ❌ 缺失 |
|
|#### 属性存储到模型
|
|| 字段 | 模型字段 | 当前 | 改进后 |
||------|----------|------|--------|
|| 属性名 | `name` | ✅ | ✅ 增加化妆品属性名识别 |
|| 属性名(英文) | `nameEn` | ❌ | ❌（翻译步骤处理） |
|| 属性值 | `value` | ✅ | ✅ 全量提取所有规格行 |
|| 属性值(英文) | `valueEn` | ❌ | ❌（翻译步骤处理） |
|| 单位 | `unit` | ❌ | ✅ 从属性值中分离单位（如"100ml"→值"100"+单位"ml"） |
|| 排序 | `sortOrder` | ❌ | ✅ 按 DOM 中的出现顺序排列 |
|
|> ⚠️ **重要说明**：上述属性来自阿里国际站详情页的 **规格表（Key Attributes）** 区域。每个产品的规格表内容不同（化妆品类和电子类的规格字段完全不同），采集器应全量提取规格表中的所有 key-value 行，不仅限于上面列出的属性名。上面列出的化妆品核心属性名用于验证提取完整度和测试用例设计。

#### 图片信息 → CollectedProductImage[]

| 字段 | 模型字段 | 当前 | 改进后 |
|------|----------|------|--------|
| 类型 | `type`（main/gallery/detail） | ✅ | ✅ 增加 detail 类型 |
| 图片二进制 | `data` | ✅ base64 | ✅ |
| 原始URL | `originalUrl` | ✅ | ✅ |
| 文件名 | `fileName` | ✅ | ✅ |
| 文件大小 | `fileSize` | ❌ | ✅ 新增 |
| 宽高 | `width, height` | ✅ | ✅ |
| ALT文字 | `altText` | ❌ | ✅ 新增 |
| 排序 | `sortOrder` | ❌ | ✅ 新增 |

#### 供应商信息（新增，存入 rawData 或扩展字段）

| 字段 | 说明 | 来源 |
|------|------|------|
| supplier.name | 供应商名称 | .company-name / supplier section |
| supplier.url | 供应商店铺链接 | DOM |
| supplier.verified | 是否为Verified供应商 | Verified 图标检测 |
| supplier.rating | 供应商评分 | 评分区域 |
| supplier.responseRate | 响应率 | 店铺信息区域 |

#### 评分信息（新增，存入 rawData）

| 字段 | 说明 | 来源 |
|------|------|------|
| ratingValue | 综合评分 | JSON-LD aggregateRating / 评分区域 |
| reviewCount | 评价数 | JSON-LD aggregateRating / 评价区域 |
| moq | 最小起订量 | MOQ 区域 |

### 6.2 当前采集 vs 目标采集 覆盖对比

| 分类 | 总可采集字段数 | 当前采集数 | 当前覆盖率 | 目标采集数 | 目标覆盖率 |
|------|--------------|-----------|-----------|-----------|-----------|
| 基本信息 | 6 | 3 | 50% | 6 | **100%** |
| 价格信息 | 4 | 2 | 50% | 4 | **100%** |
| 阶梯定价 | 4 | 0 | 0% | 4(存入rawData) | **100%** |
| 物流信息 | 6 | 0 | 0% | 6 | **100%** |
| 变体 | 6 | 0 | 0% | 6 | **100%** |
| 属性 | 4 | 2 | 50% | 4 | **100%** |
| 图片 | 8 | 4 | 50% | 8 | **100%** |
| 供应商 | 5 | 0 | 0% | 5(存入rawData) | **100%** |
| 评分/MOQ | 3 | 0 | 0% | 3(存入rawData) | **100%** |
| **合计** | **46** | **11** | **24%** | **46** | **100%** |

---

## 7. 验收标准

### 7.1 Chrome 插件验收

| # | 验收标准 | 通过条件 |
|---|----------|----------|
| AC-01 | 打开任意阿里国际站商品详情页 → 点插件 → 点「采集到 ERP」 | popup 显示 ✅ 采集成功 |
| AC-02 | 采集完成后 → 打开 ERP 梳理后台对应产品的详情页 | 标题、价格、描述**自动填充** |
| AC-03 | 产品有变体（如颜色/尺寸）→ 采集后 | 梳理后台的「变体」区域显示完整变体列表，含 sku、价格、options |
| AC-04 | 产品有阶梯定价 → 采集后 | `rawData` 字段包含 tieredPricing 数组，`price` 取最低价，`compareAtPrice` 取最高价 |
| AC-05 | 产品有规格表（属性表格）→ 采集后 | 梳理后台「属性」区域显示全部属性行，含单位 |
| AC-06 | 产品有品牌和 SKU → 采集后 | 品牌和 SKU 字段已填充 |
| AC-07 | 产品有物流/包装信息 → 采集后 | weight/length/width/height 字段已填充 |
| AC-08 | 产品有 MOQ → 采集后 | rawData 包含 moq 字段 |
| AC-09 | 产品有海关编码 → 采集后 | hsCode 字段已填充 |
| AC-10 | 同一产品重复采集 | popup 提示"该产品已在 X 分钟前采集过" |

### 7.2 Python 采集验收

| # | 验收标准 | 通过条件 |
|---|----------|----------|
| AC-11 | `python store_collector_v2.py` 执行 | Playwright 打开店铺首页 → 列出所有产品链接 |
| AC-12 | 店铺有 50 个产品 | 成功提取 50 个链接，无遗漏 |
| AC-13 | 逐个详情页采集 | 每个产品采集后都有完整字段（同 AC-01~AC-09） |
| AC-14 | 采集后 ERP 中有 N 条新记录 | 梳理后台列表显示 N 条「待梳理」状态的产品 |
| AC-15 | 翻页 | 店铺产品跨越多页时，能自动翻页直到最后一页 |
| AC-16 | 去重 | 同一产品或已采集过的产品被自动跳过 |
| AC-17 | 反检测 | 连续采集 100 个产品没有被阿里封 IP |

### 7.3 综合验收

| # | 验收标准 | 通过条件 |
|---|----------|----------|
| AC-18 | 采集一个产品 → 在梳理后台编辑 → 发布到 WooCommerce | 产品成功出现在独立站 |
| AC-19 | 发布后产品有变体 | WooCommerce 产品有对应的变体（颜色/尺寸） |
| AC-20 | 发布后产品有多图 | WooCommerce 产品有主图 + 图库 |

---

## 8. 非功能性需求

### 8.1 性能

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| Chrome 插件单商品采集耗时 | ≤ 15s（含图片下载） | 从点击采集到显示成功的时间 |
| Chrome 插件提取阶段耗时 | ≤ 3s（不含图片下载） | 从开始提取到 payload 组装 |
| Python 批量采集速度 | ≥ 5 个产品/分钟（含图片） | 总成功数 / 总耗时 |
| Python 单个详情页采集 | ≤ 20s（含图片下载） | 每个产品的采集时间 |
| 图片下载成功率 | ≥ 90% | 成功下载的图片 / 应下载的图片总数 |
| 字段采集完整率 | ≥ 80%（所有产品平均） | 每个产品填充的非空字段数 / 可填充字段总数 |

### 8.2 稳定性

| 指标 | 目标 | 说明 |
|------|------|------|
| 采集成功率 | ≥ 95% | 成功写入 ERP 的产品 / 尝试采集的产品数 |
| 断点续采 | Python 服务支持 | 中途中断后重跑自动跳过已采集的（按 sourceId 去重） |
| 超时处理 | 详情页 30s 超时 | 超时后跳过继续下一个 |
| 重试机制 | 网络错误重试 2 次 | 2 次失败后跳过，日志记录 |
| 内存泄漏防护 | Python 服务执行完 500 个产品后内存不增长超过 50MB | 监控 RSS 内存 |

### 8.3 反检测

| 措施 | 实现层级 | 说明 |
|------|----------|------|
| User-Agent 轮换 | Python | 从 5 个主流 Chrome/Firefox UA 中随机选择 |
| 请求间隔随机化 | Python | 每次请求后随机等待 1-3s |
| Stealth 脚本 | Python（已有） | 覆盖 navigator.webdriver、plugins、languages |
| 鼠标模拟 | Python | 随机滚动、鼠标移动路径（非必须，但加分） |
| `--disable-blink-features=AutomationControlled` | Python（已有） | Chrome flag |
| 浏览器登录态复用 | Chrome 插件 | 利用用户已登录的浏览器上下文，天然反检测 |
| Cookie 持久化 | Python store_collector.py（已有） | 避免重复登录 |

### 8.4 可维护性

| 指标 | 要求 |
|------|------|
| 选择器维护 | 每个字段的 CSS 选择器维护在一个中心化数组中，注释标明每个选择器的来源和最后验证日期 |
| 测试覆盖率 | 关键提取函数需有至少 3 个不同版式的阿里详情页测试用例 |
| 日志可读性 | Python 采集器的日志清晰显示：当前进度、每个字段的提取状态、失败的详细原因 |
| 配置化 | 超时时间、并发数、最大图片数等参数通过 config.py 或环境变量控制 |

---

## 9. 技术实现建议

### 9.1 借鉴策略

| 参考项目 | 可借鉴点 | 我们的应用 |
|----------|----------|-----------|
| **YrayPixels/alibaba-scraper** (TypeScript) | 30+ 字段的多重选择器策略、阶梯定价提取、变体解析 | 改造 Chrome 插件的 `parsers/alibaba.js`，重写为全字段提取器 |
| **lablnet/alibaba_scraper** (Node.js) | `getProductsLinksFromCategory` 分类页爬取、Worker Threads 并发 | Python 采集器增加分类页爬取模式 |
| **现用 extractor.py** | JSON-LD 解析、clean_image_url | 保留并增强，增加 `window.detailData` 提取 |

### 9.2 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| Chrome 插件提取器 | TypeScript（Module 方式），新建 `parsers/alibaba-v2.js` | YrayPixels 是 TS，可参考其模式，且 content.js 以 inline IIFE 运行，新模块可先独立开发再集成 |
| Python 变体提取 | 在 `lib/extractor.py` 中增加 `_extract_variants()` + `_extract_tiered_pricing()` | 复用现有 page.evaluate() 机制 |
| 店铺列表解析 | 重写 `store_collector_v2.py` 的 extract_product_links | 基于 Playwright 的 locator + evaluate 组合 |
| 数据校验 | Zod schema 校验采集的 payload | 采集端确保字段格式正确再发往 API |

### 9.3 优先级执行顺序

```
Sprint 1 (P0)                        Sprint 2 (P1)                  Sprint 3 (P2)
─────────────────────                ───────────────────            ─────────────────────
EXT-P0-01 阶梯定价                    EXT-P1-01 品牌                  EXT-P2-01 多图片类型
EXT-P0-02 变体                        EXT-P1-02 物流信息              EXT-P2-02 描述图嵌入
EXT-P0-03 供应商信息                   EXT-P1-03 HS Code              EXT-P2-03 采集历史
EXT-P0-04 MOQ                        EXT-P1-04 评分                  PY-P2-01 分类页
EXT-P0-05 属性全覆盖                   EXT-P1-05 图片高清化            PY-P2-02 定时任务
EXT-P0-06 多重选择器回退               EXT-P1-06 采集状态反馈          PY-P2-03 多店铺
PY-P0-01 店铺列表可靠解析              EXT-P1-07 去重检测
PY-P0-02 Python 阶梯定价              PY-P1-01 反检测增强
PY-P0-03 Python 变体                  PY-P1-02 图片压缩优化
PY-P0-04 detailData双路径            PY-P1-03 进度报告
PY-P0-05 去重检查                     PY-P1-04 Open API补充
```

---

## 10. 附录

### 10.1 术语表

| 术语 | 说明 |
|------|------|
| 阿里国际站 | alibaba.com，B2B 跨境平台 |
| 1688 | 1688.com，国内批发平台 |
| Tiered Pricing | 阶梯定价，根据购买数量分档定价 |
| MOQ | Minimum Order Quantity，最小起订量 |
| JSON-LD | 结构化数据标记格式，阿里详情页的 `<script type="application/ld+json">` 标签 |
| CollectedProduct | ERP 中的采集产品数据模型 |
| Pipeline Status | 产品在管线中的状态：collected → organizing → ready → publishing → published |
| Stealth | 防反爬检测脚本集合 |

### 10.2 参考文档

- [CollectedProduct Schema](/Users/apple/clawd/trade-erp/prisma/collected-product.schema.prisma)
- [CollectedProduct API 文档](/Users/apple/clawd/trade-erp/docs/collected-product-api.md)
- [CollectedProduct 前端设计](/Users/apple/clawd/trade-erp/docs/collected-product-frontend.md)
- lablnet/alibaba_scraper — [GitHub](https://github.com/lablnet/alibaba_scraper)
- YrayPixels/alibaba-scraper — 参见任务描述中的参考集
