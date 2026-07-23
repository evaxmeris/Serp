# Chrome 浏览器插件设计

## 概述

Chrome 插件负责采集环节：用户在阿里国际站或 1688 浏览产品详情页时，通过点击插件图标将产品数据采集到 Trade ERP。

## 插件架构

```
┌─────────────────────────────────────┐
│        Chrome 浏览器插件              │
│                                     │
│  ┌─────────────┐   ┌─────────────┐  │
│  │ 背景脚本     │   │ 弹出窗口     │  │
│  │ background.js│   │ popup.html  │  │
│  │             │   │            │  │
│  │ - 平台检测   │   │ - 状态显示  │  │
│  │ - DOM 提取  │   │ - 配置页面  │  │
│  │ - 图片处理  │   │ - 采集按钮  │  │
│  │ - API 发送  │   │ - 结果通知  │  │
│  └─────────────┘   └─────────────┘  │
│         │                           │
│         ▼                           │
│  ┌─────────────┐                    │
│  │ 内容脚本     │                    │
│  │ content.js  │                    │
│  │             │                    │
│  │ - 读取DOM   │                    │
│  │ - 提取数据  │                    │
│  └─────────────┘                    │
└─────────────────────────────────────┘
         │
         ▼ POST（base64 图片 + JSON 数据）
  ┌──────────────────┐
  │  Trade ERP 后端   │
  │  /api/external/collect │
  └──────────────────┘
```

## 工作流程

```
用户浏览到感兴趣的产品
    ↓
点开详情页
    ↓
点击插件图标
    ↓
弹出窗口显示提取到的产品信息概览（标题、价格、图片数）
    ↓
用户点击"采集到 ERP"
    ↓
背景脚本执行：
  1. 向当前页面注入内容脚本
  2. 内容脚本提取页面数据
  3. 下载所有图片 → 转为 base64
  4. 打包为 JSON + base64 图片
  5. POST 到 Trade ERP API
    ↓
弹出窗口显示"采集成功"或"采集失败"
```

---

## 三、解析器设计

### 阿里国际站解析器 (parsers/alibaba.ts)

```typescript
interface ParserResult {
  source: string
  sourceUrl: string
  sourceId: string | null

  title: string
  price: number
  currency: string

  description: string       // 产品描述的 HTML
  images: ImageData[]       // 所有图片
  attributes: Attribute[]   // 产品属性

  variants: Variant[]       // 规格（如有）
  rawData: object           // 原始数据备查
}

// 阿里国际站详情页的 DOM 提取点：
// 标题：    document.querySelector('.title-main') 或类似选择器
// 价格：    document.querySelector('.price-range')
// 描述：    document.querySelector('.detail-description')
// 图片：    document.querySelectorAll('.product-gallery img')
// 属性：    document.querySelectorAll('.attributes-table tr')
// 规格：    document.querySelectorAll('.sku-selector')
//
// ⚠️ 选择器会随平台改版变化，需维护
```

### 1688 解析器 (parsers/1688.ts)

```typescript
// 1688 详情页的 DOM 提取点：
// 标题：    document.querySelector('[data-tname="title"]')
// 价格：    document.querySelector('.price-detail')
// 描述：    document.querySelector('#desc-layer') 或 .detail-content
// 图片：    document.querySelectorAll('.detail-gallery img')
// 属性：    document.querySelectorAll('.attributes-list li')
// 规格：    document.querySelectorAll('.sku-item')
//
// ⚠️ 选择器会随平台改版变化，需维护
```

### 平台检测

```typescript
function detectPlatform(url: string): 'alibaba' | '1688' | 'unknown' {
  if (url.includes('alibaba.com')) return 'alibaba'
  if (url.includes('1688.com')) return '1688'
  return 'unknown'
}
```

---

## 四、图片处理

```typescript
async function processImages(imageElements: HTMLImageElement[]): Promise<ImageData[]> {
  const results: ImageData[] = []

  for (const img of imageElements) {
    // 通过 canvas 绕过防盗链
    const dataUrl = await captureImage(img)

    // 去 base64 header, 得到纯 base64
    const base64 = dataUrl.split(',')[1]

    results.push({
      type: results.length === 0 ? 'main' : 'gallery',
      data: base64,
      mimeType: getMimeType(img.src),
      fileName: generateFileName(img),
      originalUrl: img.src,
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
  }

  return results
}

// 通过 canvas 绕过图片防盗链
async function captureImage(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.9)
}
```

---

## 五、API 调用

```typescript
async function sendToERP(data: CollectPayload): Promise<boolean> {
  const response = await fetch('https://your-erp.com/api/external/collect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': config.apiToken,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`ERP 返回错误: ${response.status}`)
  }

  return true
}
```

---

## 六、插件配置

用户在插件弹出窗口中设置：

```
┌─── 采集插件设置 ───────────────────┐
│                                     │
│  ERP 地址                           │
│  [ https://your-erp.com      ]      │
│                                     │
│  API Token                          │
│  [ tcp_abc123...             ]      │
│                                     │
│  [保存配置]                          │
│                                     │
│  ── 状态 ──                         │
│  ✅ 已连接 ERP                       │
│  今日采集: 5 个产品                   │
└─────────────────────────────────────┘
```

---

## 七、插件文件结构

```
collected-product-extension/
├── manifest.json          ← 插件清单（权限: activeTab, storage, host permissions）
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           ← 弹出窗口逻辑
├── background.js          ← 背景脚本（消息中转）
├── content.js             ← 内容脚本（DOM 提取）
├── parsers/
│   ├── index.ts           ← 平台检测
│   ├── alibaba.ts         ← 阿里国际站解析器
│   └── _1688.ts           ← 1688 解析器
├── utils/
│   ├── image.ts           ← 图片处理（canvas 截取）
│   └── api.ts             ← ERP API 调用
├── config.js              ← 配置管理
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 八、manifest.json 权限

```json
{
  "manifest_version": 3,
  "name": "ERP 产品采集器",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://*.alibaba.com/*",
    "https://*.1688.com/*",
    "https://your-erp.com/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.alibaba.com/*",
        "https://*.1688.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```
