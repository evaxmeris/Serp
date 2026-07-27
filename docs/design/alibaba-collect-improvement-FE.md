# 阿里国际站商品采集改进 — 前端详细设计方案 (FE)

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2026-07-26 | Hermes 前端设计师(FE) | Popup 增强 + 梳理后台重构详细设计 |

---

## 目录

1. [Chrome 插件 popup 增强设计](#1-chrome-插件-popup-增强设计)
   - [1.1 目标分析](#11-目标分析)
   - [1.2 新增字段预览](#12-新增字段预览)
   - [1.3 HTML 结构草图](#13-html-结构草图)
   - [1.4 CSS 样式设计（增量）](#14-css-样式设计增量)
   - [1.5 状态机设计](#15-状态机设计)
   - [1.6 popup.js 核心改造](#16-popupjs-核心改造)
   - [1.7 与 content.js 的消息交互](#17-与-contentjs-的消息交互)
   - [1.8 去重查询流程](#18-去重查询流程)
   - [1.9 新消息类型汇总表](#19-新消息类型汇总表)
2. [梳理后台编辑页重构设计 (Sprint 2)](#2-梳理后台编辑页重构设计-sprint-2)
   - [2.1 页面组件树](#21-页面组件树)
   - [2.2 组件文件结构](#22-组件文件结构)
   - [2.3 表单状态管理设计 (useReducer)](#23-表单状态管理设计-usereducer)
   - [2.4 每个 Section 的交互行为](#24-每个-section-的交互行为)
   - [2.5 与 API 的对接方式](#25-与-api-的对接方式)
   - [2.6 可复用 UI 组件盘点（shadcn/ui）](#26-可复用-ui-组件盘点shadcnui)
   - [2.7 新增组件清单](#27-新增组件清单)
   - [2.8 数据流与保存策略](#28-数据流与保存策略)
   - [2.9 响应式布局设计](#29-响应式布局设计)

---

## 1. Chrome 插件 popup 增强设计

### 1.1 目标分析

**现状分析**（基于 `popup.html` + `popup.js` 代码审查）：

| 维度 | 现状 | 问题 |
|------|------|------|
| 预览字段 | title, price, imageCount, attrCount | 缺少变体数、去重提示、采集时间 |
| 状态反馈 | 只有静态文本（"⏳ 提取数据..." / "✅ 采集成功"） | 无进度条、无阶段标记 |
| 去重处理 | 无 | 重复采集无感知 |
| 成功后操作 | 仅显示成功消息 | 无跳转 ERP 入口 |
| 采集按钮 | 单按钮「采集到 ERP」一次性触发 | 无法展示拆分阶段 |
| 宽度 | 360px | 可以适当扩展宽度容纳更多信息 |
| 配置 | 独立配置页 | OK，保持 |

**改进目标**（对应 BA 需求 EXT-P1-06、EXT-P1-07）：

1. 预览模式：展示 **标题、价格区间、图片数、属性数、变体数** 共 5 个核心指标
2. 去重提示：`"该产品已在 X 分钟前采集过"`
3. 采集进度：**状态机** IDLE → EXTRACTING → CAPTURING → UPLOADING → DONE / ERROR
4. 成功后跳转：`"查看 ERP 详情 ▸"` 链接
5. 错误重试：失败时显示 `"重试"` 按钮

### 1.2 新增字段预览

| 预览字段 | 来源 | 获取时机 | 数据格式 |
|----------|------|----------|----------|
| 标题 | content.js `parseAlibaba().title` | `EXTRACT_PREVIEW` 响应 | string |
| 价格区间 | price / compareAtPrice | `EXTRACT_PREVIEW` 响应 | `"$12.00 - $15.00"` |
| 图片数 | images.length | `EXTRACT_PREVIEW` 响应 | number |
| 属性数 | attributes.length | `EXTRACT_PREVIEW` 响应 | number |
| 变体数 | variants?.length (新增) | `EXTRACT_PREVIEW` 响应 | number（新增 `EXTRACT_DEEP_PREVIEW`） |
| 去重状态 | GET `/api/external/collect/check?sourceUrl=` | popup 打开时 | `{ exists: true, minutesAgo: 15, title: "..." }` |
| 平台状态 | detectPlatform() | `EXTRACT_PREVIEW` | `alibaba` / `1688` |

### 1.3 HTML 结构草图

> `chrome-extension/popup/popup.html` — 完整替换方案

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ERP 采集管理 v2</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app" class="popup-container">

    <!-- ⚙️ 配置界面 (不变) -->
    <div id="config-view" class="view hidden">…</div>

    <!-- 📦 主采集界面 -->
    <div id="collect-view" class="view">

      <!-- 头部 -->
      <div class="header">
        <h2 class="title">📦 采集到 ERP</h2>
        <button id="open-config" class="icon-btn" title="设置">⚙️</button>
      </div>

      <!-- 平台识别 -->
      <div id="status-area">
        <div class="platform-info">
          <span id="platform-icon">🌐</span>
          <span id="platform-text">检测中...</span>
        </div>
      </div>

      <!-- ===== 预览卡片 ===== -->
      <div id="preview-area" class="preview-card hidden">
        <div class="preview-row">
          <span class="label">标题</span>
          <span id="preview-title" class="value truncate">-</span>
        </div>
        <div class="preview-row">
          <span class="label">价格</span>
          <span id="preview-price" class="value">-</span>
        </div>
        <div class="preview-row preview-stats">
          <span class="stat-badge">
            <span class="stat-icon">🖼</span>
            <span id="preview-images">0</span> 图
          </span>
          <span class="stat-badge">
            <span class="stat-icon">🏷</span>
            <span id="preview-attrs">0</span> 属性
          </span>
          <span class="stat-badge">
            <span class="stat-icon">🔀</span>
            <span id="preview-variants">0</span> 变体
          </span>
        </div>
        <!-- ⚠️ 去重提示 -->
        <div id="duplicate-warning" class="duplicate-warning hidden">
          🔄 该产品已在 <span id="dup-time">-</span> 前采集过
          <div class="dup-meta">
            上次标题: <span id="dup-title" class="text-muted">-</span>
          </div>
        </div>
      </div>

      <!-- ===== 进度条区域（采集进行中） ===== -->
      <div id="progress-area" class="hidden">
        <div class="progress-bar-track">
          <div id="progress-fill" class="progress-bar-fill" style="width: 0%"></div>
        </div>
        <div class="step-indicators">
          <div class="step" data-step="extract"><span class="step-dot" id="dot-extract">○</span> 提取</div>
          <div class="step" data-step="capture"><span class="step-dot" id="dot-capture">○</span> 图片</div>
          <div class="step" data-step="upload"><span class="step-dot" id="dot-upload">○</span> 上传</div>
          <div class="step" data-step="done"><span class="step-dot" id="dot-done">○</span> 完成</div>
        </div>
        <div id="progress-text" class="progress-text">初始化...</div>
        <!-- 子进度 -->
        <div id="sub-progress" class="sub-progress hidden">
          <span id="sub-progress-text"></span>
        </div>
      </div>

      <!-- ===== 操作按钮 ===== -->
      <button id="collect-btn" class="btn btn-primary btn-large" disabled>
        ⬇️ 采集到 ERP
      </button>

      <button id="retry-btn" class="btn btn-secondary btn-large hidden">
        🔄 重试采集
      </button>

      <div class="secondary-btn-row">
        <button id="select-btn" class="btn btn-secondary btn-small" disabled>
          👆 手动选择
        </button>
        <button id="debug-btn" class="btn btn-ghost btn-small">
          🔍 调试
        </button>
      </div>

      <!-- 选择模式确认按钮（不变） -->
      <button id="confirm-btn" class="btn btn-primary btn-large hidden">
        ✅ 确认采集
      </button>

      <!-- ===== 采集状态消息 ===== -->
      <div id="collect-status" class="status-msg"></div>

      <!-- ===== 成功卡片 ===== -->
      <div id="success-card" class="success-card hidden">
        <div class="success-icon">✅</div>
        <div class="success-title">采集成功！</div>
        <div class="success-sub">已添加到 ERP 梳理后台</div>
        <a id="view-in-erp-link" class="link-btn" href="#" target="_blank">
          查看 ERP 详情 ▸
        </a>
      </div>

      <!-- 底部 -->
      <div class="footer">
        <span class="status-group">
          <span id="erp-status" class="status-dot disconnected"></span>
          <span id="erp-status-text">未连接</span>
        </span>
        <span class="footer-right">
          <span class="version">v2.0</span>
        </span>
      </div>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

### 1.4 CSS 样式设计（增量）

在现有 `popup.css` 基础上新增以下样式：

```css
/* popup.css — 新增样式 (v2.0) */

/* 宽度扩展 */
body { width: 400px; min-height: 380px; }

/* 预览统计徽章行 */
.preview-stats { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 4px; }
.stat-badge { display: inline-flex; align-items: center; gap: 3px; background: #f3f4f6; border-radius: 12px; padding: 2px 8px; font-size: 11px; color: #374151; }
.stat-icon { font-size: 12px; }

/* 去重警告 */
.duplicate-warning { margin-top: 6px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 12px; color: #92400e; }
.dup-meta { font-size: 11px; color: #a16207; margin-top: 2px; }
.text-muted { color: #6b7280; }

/* 进度条 */
.progress-bar-track { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #10b981); border-radius: 3px; transition: width 0.4s ease; }

/* 阶段指示器 */
.step-indicators { display: flex; justify-content: space-between; margin-top: 8px; }
.step { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #9ca3af; }
.step.active { color: #2563eb; font-weight: 600; }
.step.done { color: #10b981; }
.step.error { color: #ef4444; }
.step-dot { font-size: 14px; }
.step.active .step-dot,
.step.done .step-dot { content: "●"; }

/* 进度文本 */
.progress-text { font-size: 12px; color: #4b5563; text-align: center; margin-top: 4px; }
.sub-progress { font-size: 11px; color: #6b7280; text-align: center; }

/* 成功卡片 */
.success-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px; background: #ecfdf5; border-radius: 8px; text-align: center; }
.success-icon { font-size: 28px; }
.success-title { font-size: 15px; font-weight: 600; color: #065f46; }
.success-sub { font-size: 12px; color: #059669; }

/* 按钮行调整 */
.secondary-btn-row { display: flex; gap: 6px; }
.btn-small { padding: 6px 12px; font-size: 12px; }
.btn-ghost { background: transparent; border: 1px solid #e5e7eb; color: #6b7280; }
.btn-ghost:hover { background: #f9fafb; }

/* 底部布局 */
.status-group { display: flex; align-items: center; gap: 4px; }
.footer-right { display: flex; align-items: center; gap: 8px; }
```

### 1.5 状态机设计

**核心状态**（采集流程 5 态）：

```
                    ┌─────────────────────────────────────────┐
                    │          状态流（正常路径）               │
                    │                                         │
  IDLE ──→ EXTRACTING ──→ CAPTURING ──→ UPLOADING ──→ DONE
   ▲         │               │               │              │
   │         │               │               │              │
   │         ▼               ▼               ▼              ▼
   │       ERROR           ERROR           ERROR           ERROR
   └─────────────────────────── ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                          （点击「重试」回到 IDLE）
```

| 状态名 | 含义 | 触发时机 | 阶段指示器 | 进度条 | 主按钮 |
|--------|------|----------|-----------|--------|--------|
| `IDLE` | 等待用户操作 | 页面加载/重试 | 全部灰色 ○ | 0% | 「⬇️ 采集到 ERP」可点击 |
| `EXTRACTING` | content.js 解析 DOM | 点击「采集到 ERP」 | 提取 ○→● 高亮 | 0-33% | 禁用，「⏳ 提取数据中...」 |
| `CAPTURING` | 图片下载 | 解析完成 | 图片 ○→● 高亮 | 33-66% | 禁用，「⏳ 下载图片 N/M...」 |
| `UPLOADING` | POST 到 ERP API | 图片下载完成 | 上传 ○→● 高亮 | 66-95% | 禁用，「⏳ 上传到 ERP...」 |
| `DONE` | 采集成功 | API 返回成功 | 完成 ○→● 绿色 | 100% | 隐藏，显示成功卡片（含"查看ERP详情"链接） |
| `ERROR` | 采集失败 | 任一阶段异常 | 错误阶段红色 ✕ | 停在当前 | 隐藏，「🔄 重试采集」显示 |

**子进度（EXTRACTING 阶段细化）**：

```
EXTRACTING 阶段内:
  "正在提取产品信息..."
  → "已获取标题 ✓"
  → "已获取 3/5 个阶梯价格 ✓"
  → "已提取 12 个变体 ✓"
  → "JSON-LD 兜底中..."

CAPTURING 阶段内:
  "正在下载图片 3/8..."
  → "图片 3/8 下载失败，跳过"
  → "已完成 8/8 张图片"
```

**UI 映射代码**（`popup.js` 内部状态定义）：

```javascript
const CollectionState = {
  IDLE: 'IDLE',
  EXTRACTING: 'EXTRACTING',
  CAPTURING: 'CAPTURING',
  UPLOADING: 'UPLOADING',
  DONE: 'DONE',
  ERROR: 'ERROR',
};

let currentState = CollectionState.IDLE;
let retryData = null; // 保存出错时的上下文，用于重试

function transitionTo(newState, payload = {}) {
  // 退出旧状态
  // 进入新状态
  renderState(newState, payload);
  currentState = newState;
}
```

### 1.6 popup.js 核心改造

```javascript
// ===== 状态机渲染 =====
function renderState(state, payload) {
  const progressArea = document.getElementById('progress-area');
  const collectBtn = document.getElementById('collect-btn');
  const retryBtn = document.getElementById('retry-btn');
  const successCard = document.getElementById('success-card');
  const collectStatus = document.getElementById('collect-status');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // 隐藏所有状态区域
  retryBtn.classList.add('hidden');
  successCard.classList.add('hidden');
  collectStatus.className = 'status-msg';
  collectStatus.textContent = '';

  switch (state) {
    case CollectionState.IDLE:
      progressArea.classList.add('hidden');
      collectBtn.disabled = false;
      collectBtn.textContent = '⬇️ 采集到 ERP';
      collectBtn.classList.remove('hidden');
      break;

    case CollectionState.EXTRACTING:
      progressArea.classList.remove('hidden');
      collectBtn.disabled = true;
      collectBtn.textContent = '⏳ 提取数据中...';
      updateSteps({ extract: 'active', capture: '', upload: '', done: '' });
      progressFill.style.width = '15%';
      progressText.textContent = '⏳ 正在提取产品信息...';
      showSubProgress(payload.detail || '');
      break;

    case CollectionState.CAPTURING:
      updateSteps({ extract: 'done', capture: 'active', upload: '', done: '' });
      progressFill.style.width = '40%';
      progressText.textContent = `⏳ 下载图片 (${payload.current || 0}/${payload.total || '?'})...`;
      showSubProgress(payload.detail || '');
      break;

    case CollectionState.UPLOADING:
      updateSteps({ extract: 'done', capture: 'done', upload: 'active', done: '' });
      progressFill.style.width = '70%';
      progressText.textContent = '⏳ 上传到 ERP...';
      hideSubProgress();
      break;

    case CollectionState.DONE:
      updateSteps({ extract: 'done', capture: 'done', upload: 'done', done: 'done' });
      progressFill.style.width = '100%';
      progressText.textContent = '✅ 采集完成！';
      collectBtn.classList.add('hidden');
      successCard.classList.remove('hidden');
      // 设置跳转链接
      const erpUrl = getErpBaseUrl();
      document.getElementById('view-in-erp-link').href =
        `${erpUrl}/collected-products/${payload.id}`;
      setTimeout(() => hideSubProgress(), 500);
      break;

    case CollectionState.ERROR:
      updateSteps({ extract: 'done', capture: 'done', upload: 'done', done: '' });
      progressFill.style.width = payload.progress || '70%';
      progressText.textContent = '❌ ' + (payload.error || '采集失败');
      collectBtn.classList.add('hidden');
      retryBtn.classList.remove('hidden');
      collectStatus.textContent = payload.detail || '请检查网络连接后重试';
      collectStatus.className = 'status-msg error';
      break;
  }
}

// ===== 阶段指示器辅助 =====
function updateSteps(states) {
  ['extract', 'capture', 'upload', 'done'].forEach(id => {
    const dot = document.getElementById(`dot-${id}`);
    const step = dot.closest('.step');
    step.className = 'step';
    if (states[id] === 'active') {
      step.classList.add('active');
      dot.textContent = '●';
    } else if (states[id] === 'done') {
      step.classList.add('done');
      dot.textContent = '●';
    } else {
      dot.textContent = '○';
    }
  });
}

function showSubProgress(text) {
  const el = document.getElementById('sub-progress');
  el.classList.remove('hidden');
  document.getElementById('sub-progress-text').textContent = text;
}

function hideSubProgress() {
  document.getElementById('sub-progress').classList.add('hidden');
}

// ===== 去重检查（页面打开时自动执行） =====
async function checkDuplicate(sourceUrl) {
  try {
    const { erpUrl, apiToken } = await chrome.storage.local.get(['erpUrl', 'apiToken']);
    if (!erpUrl || !apiToken) return;

    const resp = await fetch(
      `${erpUrl.replace(/\/$/, '')}/api/external/collect/check?sourceUrl=${encodeURIComponent(sourceUrl)}`,
      { headers: { 'X-API-Token': apiToken } }
    );
    if (!resp.ok) return;

    const data = await resp.json();
    if (data.exists) {
      const warning = document.getElementById('duplicate-warning');
      warning.classList.remove('hidden');
      document.getElementById('dup-time').textContent = formatMinutesAgo(data.minutesAgo);
      document.getElementById('dup-title').textContent = data.title || '(无标题)';
    }
  } catch (e) {
    // 去重查询失败不阻塞主要流程
    console.warn('[ERP采集] 去重查询失败:', e.message);
  }
}

function formatMinutesAgo(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
}
```

### 1.7 与 content.js 的消息交互

**新增消息类型**：

```javascript
// 在 popup.js 中，collectBtn 点击处理改为分阶段驱动：

collectBtn.addEventListener('click', async () => {
  // 获取配置
  const { erpUrl, apiToken } = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  if (!erpUrl || !apiToken) {
    showStatus(collectStatus, '⚠️ 请先配置 ERP 地址和 Token', 'error');
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return;

  // --- Phase 1: EXTRACTING ---
  transitionTo(CollectionState.EXTRACTING, { detail: '正在提取产品信息...' });

  try {
    // 发送 EXTRACT_PRODUCT_V2（代替旧的 EXTRACT_PRODUCT）
    // 这个新消息类型分阶段报告进度
    transitionTo(CollectionState.EXTRACTING, { detail: '解析 DOM 中...' });

    const extractResp = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_PRODUCT_V2',
      // V2 新增参数：启用详细进度报告
      enableProgress: true,
    });

    if (!extractResp?.success) throw new Error(extractResp?.error || '提取失败');

    const productData = extractResp.data;
    retryData = productData; // 保存用于重试

    // --- Phase 2: CAPTURING ---
    const totalImages = productData.images?.length || 0;
    if (totalImages > 0) {
      transitionTo(CollectionState.CAPTURING, { current: 0, total: totalImages });

      // 逐张下载图片，每张完成后更新进度
      for (let i = 0; i < productData.images.length; i++) {
        const img = productData.images[i];

        // 发送 CAPTURE_IMAGE 消息让 content.js 用 canvas 下载此图片
        transitionTo(CollectionState.CAPTURING, {
          current: i + 1,
          total: totalImages,
          detail: `正在下载图片 ${i + 1}/${totalImages}...`,
        });

        const capResp = await chrome.tabs.sendMessage(tab.id, {
          type: 'CAPTURE_IMAGE',
          imageInfo: img,
          index: i,
        });

        if (capResp?.success) {
          productData.images[i] = capResp.data; // 包含 data(base64) + mimeType
          renderState(CollectionState.CAPTURING, {
            current: i + 1, total: totalImages,
            detail: `图片 ${i + 1}/${totalImages} 下载完成`,
          });
        } else {
          renderState(CollectionState.CAPTURING, {
            current: i + 1, total: totalImages,
            detail: `图片 ${i + 1} 下载失败，跳过 (共 ${totalImages} 张)`,
          });
        }
      }
    }

    // --- Phase 3: UPLOADING ---
    transitionTo(CollectionState.UPLOADING);

    // 从 background.js 获取配置（确保用最新）
    const configResp = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    const apiEndpoint = `${configResp.erpUrl.replace(/\/$/, '')}/api/external/collect`;

    const apiResp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': configResp.apiToken,
      },
      body: JSON.stringify(productData),
    });

    const result = await apiResp.json();

    if (apiResp.ok && result.success) {
      // --- Phase 4: DONE ---
      transitionTo(CollectionState.DONE, {
        id: result.data?.id || result.data?.product?.id,
      });
    } else {
      throw new Error(result.message || `HTTP ${apiResp.status}`);
    }
  } catch (e) {
    transitionTo(CollectionState.ERROR, {
      error: e.message,
      detail: '请检查网络连接后重试',
    });
  }
});

// ===== 重试逻辑 =====
document.getElementById('retry-btn').addEventListener('click', async () => {
  transitionTo(CollectionState.IDLE);
  // 自动重试
  document.getElementById('collect-btn').click();
});
```

### 1.8 去重查询流程

```
popup 打开时:
  1. chrome.tabs.query → 获取当前 Tab URL
  2. 检测是否为产品详情页
  3. 发送 EXTRACT_PREVIEW → 获取 title/imageCount/attrCount
  4. **同时** GET /api/external/collect/check?sourceUrl=<当前URL>
     ├─ 返回 { exists: false } → 隐藏去重提示
     └─ 返回 { exists: true, minutesAgo: 15, title: "xxx" }
        → 显示 ⚠️ 去重提示
```

### 1.9 新消息类型汇总表

| 消息类型 | 发送方 | 接收方 | 参数 | 响应 | V2 新增 |
|----------|--------|--------|------|------|---------|
| `EXTRACT_PREVIEW` | popup | content | 无 | `{ title, price, currency, imageCount, attrCount, variantCount }` | ✅ 增加 variantCount |
| `EXTRACT_PRODUCT_V2` | popup | content | `{ enableProgress: true }` | `{ success, data: ProductPayload }` | ✅ 新增，替代旧版 |
| `CAPTURE_IMAGE` | popup | content | `{ imageInfo, index }` | `{ success, data: { data(base64), mimeType, width, height } }` | ✅ 新增 |
| `EXTRACT_PRODUCT` | popup | content | 无 | `{ success, data }` | 保留兼容 |
| `DEBUG_DOM` | popup | content | 无 | `{ success }` | 不变 |
| `ENTER_SELECT_MODE` | popup | content | 无 | `{ success }` | 不变 |
| `GET_SELECTED` | popup | content | 无 | `{ success, data }` | 不变 |
| `EXIT_SELECT_MODE` | popup | content | 无 | `{ success }` | 不变 |

**新增 content.js 消息处理**（在 content.js 中添加）：

```javascript
// content.js 新增消息处理器
if (message.type === 'EXTRACT_PRODUCT_V2') {
  collectProductData()
    .then(data => sendResponse({ success: true, data }))
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true;
}

if (message.type === 'CAPTURE_IMAGE') {
  // 用已有 captureImageViaFetch 逻辑，但入参改为从 popup 传递的 imageInfo
  captureSingleImage(message.imageInfo)
    .then(data => sendResponse({ success: true, data }))
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true;
}

// 新增：提取深层预览（含变体数）
async function extractDeepPreview() {
  const platform = detectPlatform();
  if (platform === 'unknown') return { success: false };

  const data = platform === 'alibaba' ? parseAlibaba() : parse1688();
  // 尝试提取变体数（新增）
  const variantCount = extractVariantCount();

  return {
    success: true,
    data: {
      ...data,
      variantCount,
    }
  };
}

// content.js 新增 EXTRACT_DEEP_PREVIEW 处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... 保持现有监听器，增加：
  if (message.type === 'EXTRACT_DEEP_PREVIEW') {
    extractDeepPreview()
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});
```

---

## 2. 梳理后台编辑页重构设计 (Sprint 2)

### 2.1 页面组件树

完整组件层次（基于架构文档 §7.4 展开为具体 React 代码形式）：

```
<CollectedProductEditPage>                          // src/app/collected-products/[id]/page.tsx
│
├── <PageHeader>                                    // 顶栏固定区
│   ├── <BackButton onClick={() => router.back()} />
│   ├── <EditableTitle                              // 标题 inline 编辑
│   │     value={form.titleEn || form.title}
│   │     onChange={v => dispatch({type:'UPDATE_FIELD', field:'title', value:v})}
│   │   />
│   ├── <PipelineBadge status={form.pipelineStatus} />
│   └── <ActionBar>
│       ├── <TranslateButton onClick={handleTranslate} loading={translating} />
│       ├── <SaveButton onClick={handleSave} loading={saving} />
│       ├── <PublishButton onClick={handlePublish}
│       │     disabled={!canPublish} loading={publishing} />
│       └── <MoreMenu>
│           ├── <MenuItem>转为正式产品</MenuItem>
│           ├── <MenuItem>废弃</MenuItem>
│           └── <MenuItem>复制</MenuItem>
│         </MoreMenu>
│   │
│── <MainLayout className="flex gap-6">             // 主内容 flex 容器
│   │
│   ├── <FormPanel className="flex-[2]">             // 左侧 2/3 表单区
│   │   │
│   │   ├── <SectionDivider title="1. 基本信息" icon="📋" />
│   │   ├── <BasicInfoSection                        // Section 1
│   │   │     form={form}
│   │   │     dispatch={dispatch}
│   │   │   >
│   │   │   ├── <FormField label="标题" name="title"
│   │   │   │     value={form.title}
│   │   │   │     onChange={v => dispatch({type:'UPDATE_FIELD',field:'title',value:v})}
│   │   │   │   />
│   │   │   ├── <FormField label="英文标题" name="titleEn" ... />
│   │   │   ├── <FormRow>
│   │   │   │   ├── <FormField label="品牌" name="brand" ... />
│   │   │   │   └── <FormField label="SKU" name="sku" ... />
│   │   │   └── <SourceInfo source={product.source} sourceUrl={product.sourceUrl} />
│   │   │
│   │   ├── <SectionDivider title="2. 产品图片" icon="🖼️" />
│   │   ├── <ImageSection                             // Section 2
│   │   │     images={form.images || []}
│   │   │     dispatch={dispatch}
│   │   │   >
│   │   │   ├── <ImageGrid>
│   │   │   │   └── <SortableImageCard                // 拖拽排序
│   │   │   │         key={img.id || index}
│   │   │   │         image={img}
│   │   │   │         onDelete={() => dispatch({type:'REMOVE_IMAGE', index})}
│   │   │   │         onSetMain={() => dispatch({type:'SET_MAIN_IMAGE', index})}
│   │   │   │         onReorder={(from, to) => dispatch({type:'REORDER_IMAGE', from, to})}
│   │   │   │       />
│   │   │   ├── <AddImageButton
│   │   │   │     onAdd={files => dispatch({type:'ADD_IMAGES', files})} />
│   │   │   └── <ImageTypeFilter                      // 按类型筛选
│   │   │         selected={imageFilter}
│   │   │         onChange={setImageFilter}
│   │   │       />
│   │   │
│   │   ├── <SectionDivider title="3. 价格信息" icon="💲" />
│   │   ├── <PriceSection                              // Section 3
│   │   │     form={form}
│   │   │     dispatch={dispatch}
│   │   │     product={product}                        // 用于原始数据只读展示
│   │   │   >
│   │   │   ├── <PriceRow>
│   │   │   │   ├── <FormField label="售价" name="price" type="number" ... />
│   │   │   │   ├── <FormField label="划线价" name="compareAtPrice" type="number" ... />
│   │   │   │   └── <FormField label="币种" name="currency" type="select"
│   │   │   │         options={['USD','CNY','EUR']} ... />
│   │   │   ├── <FormField label="库存数量" name="stockQuantity" type="number" ... />
│   │   │   └── <TieredPricingTable                    // 只读
│   │   │         tiers={product?.rawData?.tieredPricing || []}
│   │   │       />
│   │   │
│   │   ├── <SectionDivider title="4. 规格属性" icon="🏷️" />
│   │   ├── <AttributesSection                          // Section 4
│   │   │     attributes={form.attributes || []}
│   │   │     dispatch={dispatch}
│   │   │   >
│   │   │   ├── <AttributesTable>
│   │   │   │   └── <AttributeRow
│   │   │   │         index={i}
│   │   │   │         attr={attr}
│   │   │   │         onChange={(field, val) =>
│   │   │   │           dispatch({type:'UPDATE_ATTRIBUTE', index:i, field, value:val})}
│   │   │   │         onDelete={() =>
│   │   │   │           dispatch({type:'DELETE_ATTRIBUTE', index:i})}
│   │   │   │       />
│   │   │   └── <AddRowButton
│   │   │         onClick={() => dispatch({type:'ADD_ATTRIBUTE'})} />
│   │   │
│   │   ├── <SectionDivider title="5. 变体/规格" icon="🔀" />
│   │   ├── <VariantsSection                            // Section 5
│   │   │     variants={form.variants || []}
│   │   │     dispatch={dispatch}
│   │   │   >
│   │   │   ├── <VariantOptionGroups                    // 变体维度定义
│   │   │   │     variants={form.variants}
│   │   │   │     onGroupsChange={(groups) =>
│   │   │   │       dispatch({type:'SET_VARIANT_GROUPS', groups})}
│   │   │   │   />
│   │   │   ├── <VariantsTable>
│   │   │   │   └── <VariantRow
│   │   │   │         index={i}
│   │   │   │         variant={v}
│   │   │   │         onChange={(field, val) =>
│   │   │   │           dispatch({type:'UPDATE_VARIANT', index:i, field, value:val})}
│   │   │   │         onDelete={() =>
│   │   │   │           dispatch({type:'DELETE_VARIANT', index:i})}
│   │   │   │       />
│   │   │   ├── <AddVariantButton
│   │   │   │     onClick={() => dispatch({type:'ADD_VARIANT'})} />
│   │   │   └── <GenerateVariantsButton                 // 从属性自动生成
│   │   │         attributes={form.attributes}
│   │   │         onClick={(v) => dispatch({type:'SET_VARIANTS', variants: v})}
│   │   │       />
│   │   │
│   │   ├── <SectionDivider title="6. 描述详情" icon="📝" />
│   │   ├── <DescriptionSection                         // Section 6
│   │   │     form={form}
│   │   │     dispatch={dispatch}
│   │   │   >
│   │   │   ├── <FormField label="短描述" name="shortDescription"
│   │   │   │     type="textarea" rows={3} ... />
│   │   │   └── <DescriptionRow>
│   │   │       ├── <RichTextEditor
│   │   │       │     label="详细描述（中文）"
│   │   │       │     value={form.description || ''}
│   │   │       │     onChange={v => dispatch({type:'UPDATE_FIELD', field:'description', value:v})}
│   │   │       │   />
│   │   │       └── <RichTextEditor
│   │   │             label="英文描述"
│   │   │             value={form.descriptionEn || ''}
│   │   │             onChange={v => dispatch({type:'UPDATE_FIELD', field:'descriptionEn', value:v})}
│   │   │           />
│   │   │
│   │   ├── <SectionDivider title="7. 物流信息" icon="🚚" />
│   │   ├── <ShippingSection                            // Section 7
│   │   │     form={form}
│   │   │     dispatch={dispatch}
│   │   │   >
│   │   │   ├── <FormField label="重量 (kg)" name="weight" type="number" step="0.01" ... />
│   │   │   ├── <DimensionsRow>
│   │   │   │   ├── <FormField label="长 (cm)" name="length" type="number" ... />
│   │   │   │   ├── <FormField label="宽 (cm)" name="width" type="number" ... />
│   │   │   │   └── <FormField label="高 (cm)" name="height" type="number" ... />
│   │   │   ├── <FormField label="运费分类" name="shippingClass" ... />
│   │   │   └── <FormField label="HS Code" name="hsCode" ... />
│   │   │
│   │   ├── <SectionDivider title="8. 供应商信息" icon="🏢" />
│   │   ├── <SupplierSection                            // Section 8
│   │   │     rawData={product?.rawData}
│   │   │     form={form}
│   │   │   >
│   │   │   ├── <SupplierInfoCard supplier={rawData?.supplier}>
│   │   │   │   ├── <SupplierName name={supplier.name} />
│   │   │   │   ├── <SupplierVerified verified={supplier.verified} />
│   │   │   │   ├── <SupplierRating rating={supplier.rating} />
│   │   │   │   ├── <SupplierResponseRate rate={supplier.responseRate} />
│   │   │   │   └── <SupplierLink url={supplier.url} />
│   │   │   └── <FormField label="MOQ" name="moq" type="number" ... />
│   │   │
│   │   ├── <SectionDivider title="9. 认证信息" icon="✅" />
│   │   └── <CertificationSection                       // Section 9
│   │         certs={certList}                          // 从 rawData 或独立字段读取
│   │         dispatch={dispatch}
│   │       >
│   │       ├── <CertTagList>
│   │       │   └── <CertTag                            // FDA/MSDS/GMP 等标签
│   │       │         name={cert}
│   │       │         active={selected}
│   │       │         onToggle={() => dispatch({type:'TOGGLE_CERT', cert})}
│   │       │       />
│   │       └── <AddCertButton
│   │             onAdd={name => dispatch({type:'ADD_CERT', name})} />
│   │
│   └── <SidePanel className="flex-[1] sticky top-20">  // 右侧 1/3 面板
│       ├── <PipelineStatusPanel status={form.pipelineStatus}>
│       │   └── <StatusSteps>
│       │       ├── <StatusStep name="已采集" step={0} active={step >= 0} done={step > 0} />
│       │       ├── <StatusStep name="梳理中" step={1} active={step >= 1} done={step > 1} />
│       │       ├── <StatusStep name="已就绪" step={2} active={step >= 2} done={step > 2} />
│       │       └── <StatusStep name="已发布" step={3} active={step >= 3} done={step > 3} />
│       │   </StatusSteps>
│       ├── <CollectedInfo>
│       │   ├── <InfoRow label="采集时间"
│       │   │     value={formatDateTime(product.collectedAt)} />
│       │   └── <InfoRow label="来源"
│       │         value={<a href={product.sourceUrl} target="_blank">打开源页面 ↗</a>} />
│       ├── <PublishHistory>
│       │   ├── <SectionTitle>发布历史</SectionTitle>
│       │   ├── <PublishLogList>
│       │   │   └── <PublishLogItem log={log} />
│       │   └── <ViewAllLink onClick={() => setActiveTab(4)} />
│       ├── <WooCommerceInfo>
│       │   ├── <InfoRow label="WooCommerce ID" value={form.woocommerceId || '-'} />
│       │   └── {form.woocommerceUrl &&
│       │       <Button variant="link" onClick={() => window.open(form.woocommerceUrl)}>
│       │         打开独立站 ↗
│       │       </Button>}
│       └── <ActivityLog>
│           <SectionTitle>操作记录</SectionTitle>
│           <ActivityItem icon="✅" text="采集完成" time="..." />
│           <ActivityItem icon="📝" text="内容编辑 2次" time="..." />
│           <ActivityItem icon="🌐" text="发布 1次" time="..." />
│         </ActivityLog>
│
└── <BottomActionBar>                                   // 底部固定栏（非必须，顶栏已有按钮组）
    ├── <Button variant="destructive" onClick={handleDelete}>🗑 废弃产品</Button>
    ├── <Button variant="outline" onClick={handleConvert}>🔄 转为正式产品</Button>
    └── <SavePublishRow>
        ├── <Button variant="outline" onClick={handleSave}>💾 保存</Button>
        └── <Button onClick={handlePublish}>🌐 发布到独立站</Button>
```

### 2.2 组件文件结构

```
src/
├── app/collected-products/[id]/
│   ├── page.tsx                        ← 入口，加载数据 + 组合各 Section
│   │
├── components/collected-product-edit/  ← 新建目录，所有 Section 组件
│   ├── PageHeader.tsx
│   ├── EditableTitle.tsx
│   ├── PipelineBadge.tsx
│   ├── ActionBar.tsx
│   ├── MoreMenu.tsx
│   │
│   ├── FormPanel.tsx                   ← 左侧表单容器
│   ├── SectionDivider.tsx              ← Section 分隔线（含图标 + 标题）
│   ├── FormField.tsx                   ← 通用表单字段包装（Input/Select/Textarea）
│   ├── FormRow.tsx                     ← 水平排列的字段行
   │
│   ├── BasicInfoSection.tsx
│   ├── SourceInfo.tsx
│   │
│   ├── ImageSection.tsx
│   ├── ImageGrid.tsx
│   ├── SortableImageCard.tsx
│   ├── ImageTypeBadge.tsx
│   ├── AddImageButton.tsx
│   │
│   ├── PriceSection.tsx
│   ├── PriceRow.tsx
│   ├── TieredPricingTable.tsx
│   │
│   ├── AttributesSection.tsx
│   ├── AttributesTable.tsx
│   ├── AttributeRow.tsx
│   │
│   ├── VariantsSection.tsx
│   ├── VariantOptionGroups.tsx
│   ├── VariantsTable.tsx
│   ├── VariantRow.tsx
│   ├── GenerateVariantsButton.tsx
│   │
│   ├── DescriptionSection.tsx
│   ├── RichTextEditor.tsx             ← 富文本编辑器封装（TipTap/Quill）
│   │
│   ├── ShippingSection.tsx
│   ├── DimensionsRow.tsx
│   │
│   ├── SupplierSection.tsx
│   ├── SupplierInfoCard.tsx
│   ├── SupplierName.tsx
│   ├── SupplierVerified.tsx
│   ├── SupplierRating.tsx
│   │
│   ├── CertificationSection.tsx
│   ├── CertTagList.tsx
│   ├── CertTag.tsx
│   │
│   ├── SidePanel.tsx                  ← 右侧状态面板容器
│   ├── PipelineStatusPanel.tsx
│   ├── StatusSteps.tsx
│   ├── CollectedInfo.tsx
│   ├── PublishHistory.tsx
│   ├── PublishLogList.tsx
│   ├── PublishLogItem.tsx
│   ├── WooCommerceInfo.tsx
│   ├── ActivityLog.tsx
│   │
│   └── hooks/
│       ├── useEditPageReducer.ts      ← useReducer 逻辑
│       └── useCollectProductApi.ts    ← API 调用封装
```

### 2.3 表单状态管理设计 (useReducer)

#### State 定义

```typescript
// ~/clawd/trade-erp/src/components/collected-product-edit/types.ts

/** 编辑页完整状态 */
export interface EditPageState {
  // 从 API 加载的原始产品数据（用于比较 dirty）
  product: ProductDetail | null;

  // 编辑中的表单数据
  form: ProductFormData;

  // UI 状态
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  translating: boolean;
  error: string | null;
  sidePanelCollapsed: boolean;

  // 拖拽状态
  dragActive: boolean;
}

/** 表单数据结构（与 ProductDetail 一致，但全部可编辑） */
export interface ProductFormData {
  // Section 1: 基本信息
  title: string;
  titleEn: string;
  brand: string;
  sku: string;

  // Section 2: 图片
  images: EditableImage[];

  // Section 3: 价格
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  stockQuantity: number | null;

  // Section 4: 属性
  attributes: EditableAttribute[];

  // Section 5: 变体
  variants: EditableVariant[];

  // Section 6: 描述
  shortDescription: string;
  description: string;
  descriptionEn: string;

  // Section 7: 物流
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shippingClass: string;
  hsCode: string;

  // Section 8: 供应商 (来自 rawData, 只读展示)
  // Section 9: 认证

  // 管线状态
  pipelineStatus: string;
  woocommerceId: number | null;
  woocommerceUrl: string | null;
  productId: string | null;
}

export interface EditableImage {
  id?: string;
  type: 'main' | 'gallery' | 'detail';
  dataUrl: string;
  originalUrl: string;
  mimeType: string;
  fileName: string;
  sortOrder: number;
  altText: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface EditableAttribute {
  id?: string;
  name: string;
  value: string;
  unit: string;
  sortOrder: number;
}

export interface EditableVariant {
  id?: string;
  sku: string;
  price: number | null;
  stock: number | null;
  options: { name: string; value: string }[];
  imageId?: string;
}
```

#### Action 定义

```typescript
// ~/clawd/trade-erp/src/components/collected-product-edit/hooks/useEditPageReducer.ts

export type EditPageAction =
  // --- 初始化 ---
  | { type: 'INIT_PRODUCT'; payload: ProductDetail }

  // --- 通用字段更新 ---
  | { type: 'UPDATE_FIELD'; field: keyof ProductFormData; value: any }

  // --- Section 2: 图片 ---
  | { type: 'REORDER_IMAGE'; fromIndex: number; toIndex: number }
  | { type: 'REMOVE_IMAGE'; index: number }
  | { type: 'ADD_IMAGES'; images: EditableImage[] }
  | { type: 'SET_MAIN_IMAGE'; index: number }
  | { type: 'UPDATE_IMAGE'; index: number; field: string; value: any }

  // --- Section 4: 属性 ---
  | { type: 'UPDATE_ATTRIBUTE'; index: number; field: 'name' | 'value' | 'unit'; value: string }
  | { type: 'ADD_ATTRIBUTE' }
  | { type: 'DELETE_ATTRIBUTE'; index: number }
  | { type: 'REORDER_ATTRIBUTES'; fromIndex: number; toIndex: number }

  // --- Section 5: 变体 ---
  | { type: 'UPDATE_VARIANT'; index: number; field: 'sku' | 'price' | 'stock'; value: any }
  | { type: 'UPDATE_VARIANT_OPTION'; index: number; optionIndex: number; field: 'name' | 'value'; value: string }
  | { type: 'ADD_VARIANT' }
  | { type: 'DELETE_VARIANT'; index: number }
  | { type: 'SET_VARIANTS'; variants: EditableVariant[] }
  | { type: 'SET_VARIANT_GROUPS'; groups: { name: string; values: string[] }[] }

  // --- Section 9: 认证 ---
  | { type: 'TOGGLE_CERT'; cert: string }
  | { type: 'ADD_CERT'; name: string }
  | { type: 'REMOVE_CERT'; name: string }

  // --- UI 控制 ---
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_PUBLISHING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'APPLY_TRANSLATION'; payload: Partial<ProductFormData> }
  | { type: 'TOGGLE_SIDE_PANEL' }
  | { type: 'SET_DRAG_ACTIVE'; payload: boolean };
```

#### Reducer 实现

```typescript
// ~/clawd/trade-erp/src/components/collected-product-edit/hooks/useEditPageReducer.ts

import { useReducer, useCallback } from 'react';
import type { EditPageState, EditPageAction, ProductFormData } from '../types';

const initialState: EditPageState = {
  product: null,
  form: {
    title: '', titleEn: '', brand: '', sku: '',
    images: [],
    price: null, compareAtPrice: null, currency: 'USD', stockQuantity: null,
    attributes: [],
    variants: [],
    shortDescription: '', description: '', descriptionEn: '',
    weight: null, length: null, width: null, height: null,
    shippingClass: '', hsCode: '',
    pipelineStatus: 'collected',
    woocommerceId: null, woocommerceUrl: null, productId: null,
  },
  loading: true,
  saving: false,
  publishing: false,
  translating: false,
  error: null,
  sidePanelCollapsed: false,
  dragActive: false,
};

function editPageReducer(state: EditPageState, action: EditPageAction): EditPageState {
  switch (action.type) {
    // === 初始化 ===
    case 'INIT_PRODUCT':
      return {
        ...state,
        product: action.payload,
        form: mapProductToForm(action.payload),
        loading: false,
      };

    // === 通用字段 ===
    case 'UPDATE_FIELD':
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
      };

    // === 图片 ===
    case 'REORDER_IMAGE': {
      const images = [...state.form.images];
      const [moved] = images.splice(action.fromIndex, 1);
      images.splice(action.toIndex, 0, moved);
      // 重新分配 sortOrder
      const reordered = images.map((img, i) => ({
        ...img, sortOrder: i,
        type: i === 0 ? 'main' : (img.type === 'main' ? 'gallery' : img.type),
      }));
      return { ...state, form: { ...state.form, images: reordered } };
    }
    case 'REMOVE_IMAGE': {
      const images = state.form.images.filter((_, i) => i !== action.index);
      // 如果删除了主图，第一张变主图
      if (images.length > 0 && images[0].type !== 'main') {
        images[0] = { ...images[0], type: 'main' };
      }
      return { ...state, form: { ...state.form, images } };
    }
    case 'ADD_IMAGES':
      return {
        ...state,
        form: {
          ...state.form,
          images: [...state.form.images, ...action.images.map((img, i) => ({
            ...img,
            sortOrder: state.form.images.length + i,
          }))],
        },
      };
    case 'SET_MAIN_IMAGE': {
      const images = state.form.images.map((img, i) => ({
        ...img,
        type: i === action.index ? 'main' : (img.type === 'main' ? 'gallery' : img.type),
        sortOrder: i,
      }));
      return { ...state, form: { ...state.form, images } };
    }
    case 'UPDATE_IMAGE': {
      const images = state.form.images.map((img, i) =>
        i === action.index ? { ...img, [action.field]: action.value } : img
      );
      return { ...state, form: { ...state.form, images } };
    }

    // === 属性 ===
    case 'UPDATE_ATTRIBUTE': {
      const attributes = state.form.attributes.map((attr, i) =>
        i === action.index ? { ...attr, [action.field]: action.value } : attr
      );
      return { ...state, form: { ...state.form, attributes } };
    }
    case 'ADD_ATTRIBUTE':
      return {
        ...state,
        form: {
          ...state.form,
          attributes: [
            ...state.form.attributes,
            { name: '', value: '', unit: '', sortOrder: state.form.attributes.length },
          ],
        },
      };
    case 'DELETE_ATTRIBUTE': {
      const attributes = state.form.attributes
        .filter((_, i) => i !== action.index)
        .map((a, i) => ({ ...a, sortOrder: i }));
      return { ...state, form: { ...state.form, attributes } };
    }
    case 'REORDER_ATTRIBUTES': {
      const attributes = [...state.form.attributes];
      const [moved] = attributes.splice(action.fromIndex, 1);
      attributes.splice(action.toIndex, 0, moved);
      return { ...state, form: { ...state.form, attributes: attributes.map((a, i) => ({ ...a, sortOrder: i })) } };
    }

    // === 变体 ===
    case 'UPDATE_VARIANT': {
      const variants = state.form.variants.map((v, i) =>
        i === action.index ? { ...v, [action.field]: action.value } : v
      );
      return { ...state, form: { ...state.form, variants } };
    }
    case 'ADD_VARIANT':
      return {
        ...state,
        form: {
          ...state.form,
          variants: [
            ...state.form.variants,
            { sku: '', price: null, stock: null, options: [] },
          ],
        },
      };
    case 'DELETE_VARIANT': {
      const variants = state.form.variants.filter((_, i) => i !== action.index);
      return { ...state, form: { ...state.form, variants } };
    }
    case 'SET_VARIANTS':
      return { ...state, form: { ...state.form, variants: action.variants } };
    case 'UPDATE_VARIANT_OPTION': {
      const variants = state.form.variants.map((v, i) => {
        if (i !== action.index) return v;
        const options = v.options.map((opt, oi) =>
          oi === action.optionIndex ? { ...opt, [action.field]: action.value } : opt
        );
        return { ...v, options };
      });
      return { ...state, form: { ...state.form, variants } };
    }
    case 'SET_VARIANT_GROUPS': {
      // 从变体组定义生成所有组合
      const { groups } = action;
      const combinations = generateCombinations(groups);
      const variants = combinations.map((combo, i) => ({
        sku: `VAR-${String(i + 1).padStart(3, '0')}`,
        price: state.form.price,
        stock: 0,
        options: combo,
      }));
      return { ...state, form: { ...state.form, variants } };
    }

    // === 认证 ===
    case 'TOGGLE_CERT': {
      const certs = getCertsFromState(state.form);
      const newCerts = certs.includes(action.cert)
        ? certs.filter(c => c !== action.cert)
        : [...certs, action.cert];
      return applyCertsToState(state, newCerts);
    }
    case 'ADD_CERT': {
      const certs = getCertsFromState(state.form);
      if (!certs.includes(action.name)) {
        return applyCertsToState(state, [...certs, action.name]);
      }
      return state;
    }
    case 'REMOVE_CERT': {
      const certs = getCertsFromState(state.form).filter(c => c !== action.name);
      return applyCertsToState(state, certs);
    }

    // === UI ===
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_SAVING': return { ...state, saving: action.payload };
    case 'SET_PUBLISHING': return { ...state, publishing: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'APPLY_TRANSLATION':
      return {
        ...state,
        form: { ...state.form, ...action.payload },
      };
    case 'TOGGLE_SIDE_PANEL':
      return { ...state, sidePanelCollapsed: !state.sidePanelCollapsed };
    case 'SET_DRAG_ACTIVE':
      return { ...state, dragActive: action.payload };

    default:
      return state;
  }
}

export function useEditPageReducer() {
  return useReducer(editPageReducer, initialState);
}

// === 辅助函数 ===

/** 将 ProductDetail API 响应映射为表单数据 */
function mapProductToForm(product: ProductDetail): ProductFormData {
  return {
    title: product.title || '',
    titleEn: product.titleEn || '',
    brand: product.brand || '',
    sku: product.sku || '',
    images: (product.images || []).map((img: any, i: number) => ({
      id: img.id,
      type: img.type || (i === 0 ? 'main' : 'gallery'),
      dataUrl: img.dataUrl || '',
      originalUrl: img.originalUrl || '',
      mimeType: img.mimeType || 'image/jpeg',
      fileName: img.fileName || `image_${i + 1}.jpg`,
      sortOrder: img.sortOrder ?? i,
      altText: img.altText || '',
      fileSize: img.fileSize,
      width: img.width,
      height: img.height,
    })),
    price: product.price ? Number(product.price) : null,
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    currency: product.currency || 'USD',
    stockQuantity: product.stockQuantity ?? null,
    attributes: (product.attributes || []).map((a: any, i: number) => ({
      id: a.id,
      name: a.name || '',
      value: a.value || '',
      unit: a.unit || '',
      sortOrder: a.sortOrder ?? i,
    })),
    variants: (product.variants || []).map((v: any) => ({
      id: v.id,
      sku: v.sku || '',
      price: v.price ? Number(v.price) : null,
      stock: v.stock ?? null,
      options: v.options || [],
      imageId: v.imageId,
    })),
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    descriptionEn: product.descriptionEn || '',
    weight: product.weight ? Number(product.weight) : null,
    length: product.length ? Number(product.length) : null,
    width: product.width ? Number(product.width) : null,
    height: product.height ? Number(product.height) : null,
    shippingClass: product.shippingClass || '',
    hsCode: product.hsCode || '',
    pipelineStatus: product.pipelineStatus || 'collected',
    woocommerceId: product.woocommerceId ?? null,
    woocommerceUrl: product.woocommerceUrl || null,
    productId: product.productId || null,
  };
}

/** 生成笛卡尔积组合 */
function generateCombinations(groups: { name: string; values: string[] }[]): { name: string; value: string }[][] {
  if (groups.length === 0) return [];
  const result: { name: string; value: string }[][] = [];

  function backtrack(index: number, current: { name: string; value: string }[]) {
    if (index === groups.length) {
      result.push([...current]);
      return;
    }
    for (const val of groups[index].values) {
      current.push({ name: groups[index].name, value: val });
      backtrack(index + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

/** 从 form 中提取认证列表（默认存储在 rawData.certifications 或单独的 field） */
function getCertsFromState(form: ProductFormData): string[] {
  // 认证信息可能存储在 (form as any).certifications 或 form.rawData.certifications
  return (form as any).certifications || [];
}

function applyCertsToState(state: EditPageState, certs: string[]): EditPageState {
  return {
    ...state,
    form: { ...state.form, certifications: certs } as any,
  };
}
```

### 2.4 每个 Section 的交互行为

| Section | 交互行为 | 编辑能力 | 排序 | 新增 | 删除 | 特殊 |
|---------|----------|---------|------|------|------|------|
| **1. BasicInfo** | Input 编辑标题/品牌/SKU | ✅ inline | - | - | - | 来源只读 |
| **2. Image** | 网格展示 + 拖拽排序 + 主图标记 | ✅ type/altText | ✅ 拖拽 | ✅ 上传新图 | ✅ 删除 | 主图自动标记 |
| **3. Price** | 数字输入 + Select 币种 | ✅ price/compareAt | - | - | - | 阶梯价只读 |
| **4. Attribute** | 行编辑表格，3列可编辑 | ✅ name/value/unit | ✅ 拖动排序 | ✅ 添加行 | ✅ 删除行 | 采集全量保留 |
| **5. Variant** | 表格编辑 + 维度组从选项自动提取 | ✅ sku/price/stock | - | ✅ 添加变体 | ✅ 删除变体 | ✅「从属性生成」按钮 |
| **6. Description** | 富文本编辑（中文+英文） | ✅ 全部 | - | - | - | 短描述为文本域 |
| **7. Shipping** | 数字输入 + 文本输入 | ✅ 全部 | - | - | - | 带单位后缀(kg/cm) |
| **8. Supplier** | 展示卡片 + MOQ可编辑 | ⚠️ 仅MOQ | - | - | - | 供应商信息采集只读 |
| **9. Certification** | Tag 开关 + 新增 Tag | ✅ 开关/新增 | - | ✅ 添加 Tag | ✅ 移除 Tag | 预设5种常见认证 |

### 2.5 与 API 的对接方式

#### 获取数据（页面加载）

```typescript
// page.tsx — 加载逻辑
const [state, dispatch] = useEditPageReducer();

useEffect(() => {
  async function loadProduct() {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const resp = await fetch(`/api/collected-products/${id}`);
      const data = await resp.json();
      if (data.success && data.data) {
        dispatch({ type: 'INIT_PRODUCT', payload: data.data });
      } else {
        dispatch({ type: 'SET_ERROR', payload: '产品不存在' });
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: '加载失败: ' + (e as Error).message });
    }
  }
  loadProduct();
}, [id]);
```

#### 保存数据

```typescript
// page.tsx — 保存逻辑（覆盖更新子表）
async function handleSave() {
  dispatch({ type: 'SET_SAVING', payload: true });
  try {
    const resp = await fetch(`/api/collected-products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.form),
    });
    const data = await resp.json();
    if (data.success) {
      dispatch({ type: 'UPDATE_FIELD', field: 'pipelineStatus', value: 'ready' });
    } else {
      dispatch({ type: 'SET_ERROR', payload: data.message || '保存失败' });
    }
  } catch (e) {
    dispatch({ type: 'SET_ERROR', payload: '保存失败' });
  } finally {
    dispatch({ type: 'SET_SAVING', payload: false });
  }
}
```

#### 翻译 + 发布

```typescript
// page.tsx — 翻译
async function handleTranslate() {
  dispatch({ type: 'SET_LOADING', payload: true }); // 复用为 translating
  try {
    const resp = await fetch(`/api/collected-products/${id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: ['title', 'description', 'shortDescription'],
      }),
    });
    const data = await resp.json();
    if (data.success) {
      dispatch({ type: 'APPLY_TRANSLATION', payload: data.data });
    }
  } finally {
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}

// page.tsx — 发布
async function handlePublish() {
  dispatch({ type: 'SET_PUBLISHING', payload: true });
  try {
    // 先保存
    await handleSave();
    // 再发布
    const resp = await fetch(`/api/collected-products/${id}/publish`, {
      method: 'POST',
    });
    const data = await resp.json();
    if (data.success) {
      dispatch({
        type: 'APPLY_TRANSLATION',
        payload: {
          pipelineStatus: 'published',
          woocommerceId: data.data?.woocommerceId,
          woocommerceUrl: data.data?.woocommerceUrl,
        },
      });
    } else {
      dispatch({ type: 'SET_ERROR', payload: data.data?.publishError || '发布失败' });
    }
  } finally {
    dispatch({ type: 'SET_PUBLISHING', payload: false });
  }
}
```

#### API 变更汇总

| API 端点 | 方法 | 变更 | 说明 |
|----------|------|------|------|
| `/api/collected-products/:id` | GET | 不变 | 返回完整 product + images + variants + attributes + publishLogs |
| `/api/collected-products/:id` | PUT | **增强** | body 改为接受完整 form 数据（含 images/variants/attributes 子表覆盖更新） |
| `/api/collected-products/:id/publish` | POST | 不变 | 保存 → 发布 → 记录日志 |
| `/api/collected-products/:id/translate` | POST | 不变 | AI 翻译指定字段 |
| `/api/collected-products/:id/convert` | POST | 不变 | 转为正式产品 |
| `/api/external/collect/check` | GET | 不变 | 去重查询（Sprint 1 新增） |

**PUT 接口子表处理策略**：后端接收到 images/variants/attributes 时，执行：

```
1. 删除现有所有子表记录（deleteMany）
2. 重新创建（createMany）
这比增量更新更可靠，因为用户可能做了批量删除和排序。
```

### 2.6 可复用 UI 组件盘点（shadcn/ui）

**已有组件**（`src/components/ui/` 目录），全部可直接复用：

| 组件名 | 文件 | 用途 | 复用场景 |
|--------|------|------|----------|
| `Button` | button.tsx | 通用按钮 | ActionBar、SaveButton、PublishButton、AddRow 等 |
| `Input` | input.tsx | 文本/数字输入 | FormField、标题、品牌、SKU、价格等 |
| `Textarea` | textarea.tsx | 多行文本 | shortDescription |
| `Select` | select.tsx | 下拉选择 | currency、运费分类 |
| `Badge` | badge.tsx | 标签/Badge | PipelineBadge、ImageTypeBadge、CertTag |
| `Card` | card.tsx | 卡片容器 | 预览卡片、SupplierInfoCard |
| `Progress` | progress.tsx | 进度条 | PipelineStatusPanel 中的进度指示 |
| `Dialog` | dialog.tsx | 弹窗 | 删除确认、发布确认 |
| `Separator` | separator.tsx | 分隔线 | SectionDivider |
| `Tabs` | tabs.tsx | Tab（保留） | 只在发布记录 Tab 保留（从侧面板打开） |
| `Table` | table.tsx | 表格 | AttributesTable、VariantsTable、TieredPricingTable |
| `Skeleton` | skeleton.tsx | 加载骨架屏 | 页面加载中的占位 |
| `Tooltip` | tooltip.tsx | 提示 | 字段说明、操作提示 |
| `Toast` | toast.tsx | 通知 | 保存成功/失败通知（替代 alert） |
| `DropdownMenu` | dropdown-menu.tsx | 下拉菜单 | MoreMenu |
| `Switch` | switch.tsx | 开关 | CertTag 开关样式 |
| `ConfirmationDialog` | confirmation-dialog.tsx | 确认弹窗 | 删除确认、废弃确认 |
| `Alert` | alert.tsx | 警告框 | 去重提示、错误提示 |
| `EmptyState` | empty-state.tsx | 空状态 | 无属性、无变体、无图片 |
| `Loading` | loading.tsx | 加载态 | 页面加载 |
| `Pagination` | pagination.tsx | 分页 | 发布日志分页（如超过5条） |

**需要额外安装的依赖**：

| 依赖 | 用途 | 备选方案 |
|------|------|----------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | 图片拖拽排序、属性拖拽排序 | 也可用 `react-beautiful-dnd`，但 dnd-kit 更轻量且维护活跃 |
| `@tiptap/react` + `@tiptap/starter-kit` | 富文本编辑器 | Quill、Slate、Lexical |
| `@radix-ui/react-select` | 已安装（select.tsx 已封装） | - |
| `lucide-react` | 图标（已安装，`ArrowLeft`, `Save`, `Globe` 等已在用） | - |

### 2.7 新增组件清单

需要新建的组件文件：

| 文件路径 | 组件名 | 预计行数 | 关键 props |
|----------|--------|---------|------------|
| `components/collected-product-edit/FormField.tsx` | `<FormField>` | ~50 | `label, name, value, onChange, type, options, suffix, placeholder` |
| `components/collected-product-edit/SectionDivider.tsx` | `<SectionDivider>` | ~15 | `title, icon, defaultOpen` |
| `components/collected-product-edit/SortableImageCard.tsx` | `<SortableImageCard>` | ~60 | `image, index, onDelete, onSetMain, isMain` |
| `components/collected-product-edit/TieredPricingTable.tsx` | `<TieredPricingTable>` | ~40 | `tiers: Tier[]` |
| `components/collected-product-edit/AttributeRow.tsx` | `<AttributeRow>` | ~40 | `attr, index, onChange, onDelete` |
| `components/collected-product-edit/VariantOptionGroups.tsx` | `<VariantOptionGroups>` | ~60 | `variants, onGroupsChange` |
| `components/collected-product-edit/VariantRow.tsx` | `<VariantRow>` | ~50 | `variant, index, onChange, onDelete, groupNames` |
| `components/collected-product-edit/RichTextEditor.tsx` | `<RichTextEditor>` | ~80 | `label, value, onChange, locale, placeholder` |
| `components/collected-product-edit/PipelineStatusPanel.tsx` | `<PipelineStatusPanel>` | ~50 | `status: string` |
| `components/collected-product-edit/StatusSteps.tsx` | `<StatusSteps>` | ~30 | `currentStep: number` |
| `components/collected-product-edit/CertTag.tsx` | `<CertTag>` | ~30 | `name, active, onToggle` |
| `components/collected-product-edit/hooks/useEditPageReducer.ts` | useReducer | ~200 | 见上文完整实现 |
| `components/collected-product-edit/hooks/useCollectProductApi.ts` | API 封装 | ~80 | `id, onError` |

**page.tsx 重构后规模预计**：从当前 480 行 → 约 120 行（主要做数据加载 + 布局编排，业务逻辑迁移到子组件和 hooks）

### 2.8 数据流与保存策略

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         保存流程                                         │
│                                                                         │
│  用户编辑任意字段                                                       │
│       │                                                                 │
│       ▼                                                                 │
│  dispatch(UPDATE_FIELD) → form 状态更新（纯客户端）                      │
│                                                                         │
│  用户点击「保存」                                                       │
│       │                                                                 │
│       ▼                                                                 │
│  PUT /api/collected-products/:id                                        │
│  body: {                                                                │
│    ...form (所有主表字段),                                               │
│    images: form.images (完整列表, 后端全量替换),                          │
│    variants: form.variants (完整列表),                                   │
│    attributes: form.attributes (完整列表),                               │
│    pipelineStatus: 'ready' (自动标记)                                    │
│  }                                                                      │
│       │                                                                 │
│       ▼                                                                 │
│  API 层:                                                                │
│  1. prisma.collectedProduct.update({ data: { ...主表字段 } })            │
│  2. 删除旧 images / variants / attributes                               │
│  3. 创建新 images / variants / attributes                               │
│       │                                                                 │
│       ▼                                                                 │
│  返回 { success: true }                                                 │
│  前端: dispatch(INIT_PRODUCT) 更新原始 product 为当前 form               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                 自动保存策略（可选优化，Sprint 2 可暂不实现）             │
│                                                                         │
│  • 用户停止编辑 30 秒后自动保存（debounce）                              │
│  • 自动保存仅增量更新 text 字段，不触发图片上传                          │
│  • 页面关闭前 if (dirty) 显示「有未保存的修改」提示                       │
│  • dirty 检测: JSON.stringify(form) !== JSON.stringify(product)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.9 响应式布局设计

| 断点 | 布局 | 说明 |
|------|------|------|
| >= 1280px (xl) | 左侧 2/3 表单 + 右侧 1/3 面板 (sticky) | 全功能 |
| >= 1024px (lg) | 同上，但面板宽度固定 320px | 全功能 |
| >= 768px (md) | 单列，面板折叠为可展开的抽屉 | 面板在顶部可展开 |
| < 768px (sm) | 单列全宽，所有 Section 纵向排列 | 面板在顶部折叠 |

**Tailwind 实现**：

```tsx
<div className="flex flex-col lg:flex-row gap-6">
  {/* 左侧表单 */}
  <div className="flex-1 min-w-0">
    {/* 9 个 Section */}
  </div>

  {/* 右侧面板 - 大屏 sticky，小屏折叠 */}
  <aside className="
    w-full lg:w-80 xl:w-96
    lg:sticky lg:top-20 lg:self-start
    max-lg:border-t max-lg:pt-4 max-lg:mt-4
  ">
    <SidePanelContent />
  </aside>
</div>
```

---

## 附录 A：CollectedProductDetail API 类型定义

```typescript
// 供前端使用的完整 ProductDetail 类型（与 API 返回结构一致）
export interface ProductDetail {
  id: string;
  source: string;
  sourceUrl: string;
  sourceId: string | null;
  title: string;
  titleEn: string | null;
  shortDescription: string | null;
  description: string | null;
  descriptionEn: string | null;
  brand: string | null;
  sku: string | null;
  price: number | null;       // Prisma Decimal → JS Number
  compareAtPrice: number | null;
  currency: string;
  stockQuantity: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shippingClass: string | null;
  hsCode: string | null;
  pipelineStatus: string;
  woocommerceId: number | null;
  woocommerceUrl: string | null;
  productId: string | null;
  publishError: string | null;
  collectedAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  publishLogs: PublishLog[];
  rawData: Record<string, any> | null;  // tieredPricing + supplier + rating
  // 翻译相关
  metaTitle?: string;
  metaDescription?: string;
  urlSlug?: string;
  tags?: string[];
  woocommerceCategoryId?: number | null;
}

export interface ProductImage {
  id: string;
  type: 'main' | 'gallery' | 'detail';
  dataUrl: string;         // base64 (Buffer 转换而来)
  originalUrl: string;
  mimeType: string;
  fileName: string;
  sortOrder: number;
  altText: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  price: number | null;
  stock: number | null;
  options: { name: string; value: string }[];
  imageId?: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  sortOrder: number;
}

export interface PublishLog {
  id: string;
  action: string;
  status: string;
  woocommerceId?: number;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
}
```

## 附录 B：迁移计划

### Sprint 1 完成项（采集端 — 插件 popup 增强）

| 文件 | 变更内容 | 预计工时 |
|------|----------|----------|
| `chrome-extension/popup/popup.html` | 重写 HTML：增加进度条、去重提示、成功卡片 | 半天 |
| `chrome-extension/popup/popup.css` | 新增样式：step-indicators、progress-bar、duplicate-warning、success-card | 半天 |
| `chrome-extension/popup/popup.js` | 状态机重构、分阶段采集、去重查询、重试逻辑 | 1天 |
| `chrome-extension/content.js` | 新增 `EXTRACT_PRODUCT_V2`、`CAPTURE_IMAGE`、`EXTRACT_DEEP_PREVIEW` 处理器 | 1天 |
| `chrome-extension/background.js` | 无需修改（配置管理不变） | 0 |

### Sprint 2 完成项（梳理后台重构）

| 文件 | 变更内容 | 预计工时 |
|------|----------|----------|
| 新建 `components/collected-product-edit/` 约 20 个组件文件 | 按 §2.2 新建所有 Section 组件 | 3天 |
| `src/app/collected-products/[id]/page.tsx` | 从 480 行 → ~120 行，改为编排式入口 | 半天 |
| `src/app/api/collected-products/[id]/route.ts` (PUT) | 增强支持子表全量替换 | 半天 |
| 安装 `@dnd-kit/core` + `@dnd-kit/sortable` | 拖拽排序 | 0.5天 |
| 安装 `@tiptap/react` + `@tiptap/starter-kit` | 富文本编辑器 | 0.5天 |
| 整体联调 + QA | E2E 测试 | 1天 |
