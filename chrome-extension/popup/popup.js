/**
 * Popup 脚本 - 插件弹出窗口的交互逻辑
 */

// DOM 引用
const configView = document.getElementById('config-view');
const collectView = document.getElementById('collect-view');
const openConfigBtn = document.getElementById('open-config');
const backFromConfigBtn = document.getElementById('back-from-config');
const erpUrlInput = document.getElementById('erp-url');
const apiTokenInput = document.getElementById('api-token');
const saveConfigBtn = document.getElementById('save-config-btn');
const testBtn = document.getElementById('test-btn');
const configStatus = document.getElementById('config-status');
const collectBtn = document.getElementById('collect-btn');
const collectStatus = document.getElementById('collect-status');
const platformIcon = document.getElementById('platform-icon');
const platformText = document.getElementById('platform-text');
const previewTitle = document.getElementById('preview-title');
const previewPrice = document.getElementById('preview-price');
const previewImages = document.getElementById('preview-images');
const previewArea = document.getElementById('preview-area');
const erpStatus = document.getElementById('erp-status');
const erpStatusText = document.getElementById('erp-status-text');

// 当前提取的产品数据
let currentProductData = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await checkConnection();
  await detectCurrentPage();
});

// ---- 配置管理 ----

async function loadConfig() {
  // 优先从 storage 读取用户保存的配置，没有则 fallback 到 background 的 ERP_CONFIG
  const saved = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  if (saved.erpUrl) erpUrlInput.value = saved.erpUrl;
  if (saved.apiToken) apiTokenInput.value = saved.apiToken;

  // 如果 storage 中没有，从 background 获取默认值
  if (!saved.erpUrl || !saved.apiToken) {
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (result) => {
      if (result) {
        if (!saved.erpUrl) erpUrlInput.value = result.erpUrl || '';
        if (!saved.apiToken) apiTokenInput.value = result.apiToken || '';
      }
    });
  }
}

openConfigBtn.addEventListener('click', () => {
  configView.classList.remove('hidden');
  collectView.classList.add('hidden');
  configStatus.textContent = '';
  configStatus.className = 'status-msg';
});

backFromConfigBtn.addEventListener('click', () => {
  configView.classList.add('hidden');
  collectView.classList.remove('hidden');
});

saveConfigBtn.addEventListener('click', async () => {
  const erpUrl = erpUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();

  if (!erpUrl || !apiToken) {
    showStatus(configStatus, '请填写 ERP 地址和 API Token', 'error');
    return;
  }

  // 显示加载状态
  saveConfigBtn.disabled = true;
  saveConfigBtn.textContent = '⏳ 保存中...';
  showStatus(configStatus, '⏳ 正在保存...', 'loading');

  try {
    // 直接存到 chrome.storage.local，不经过 background.js
    await chrome.storage.local.set({ erpUrl, apiToken });
    saveConfigBtn.disabled = false;
    saveConfigBtn.textContent = '保存';
    showStatus(configStatus, '✅ 配置已保存', 'success');
    checkConnection();
  } catch (e) {
    saveConfigBtn.disabled = false;
    saveConfigBtn.textContent = '保存';
    showStatus(configStatus, '❌ 保存失败: ' + (e.message || '未知错误'), 'error');
  }
});

testBtn.addEventListener('click', async () => {
  const erpUrl = erpUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();

  if (!erpUrl || !apiToken) {
    showStatus(configStatus, '请先填写配置', 'error');
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = '⏳ 测试中...';
  showStatus(configStatus, '⏳ 测试连接中...', 'loading');

  try {
    // 第一步：测试服务器是否可达
    const healthResp = await fetch(`${erpUrl.replace(/\/$/, '')}/api/health`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!healthResp.ok) {
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
      showStatus(configStatus, `❌ 服务器不可达 (HTTP ${healthResp.status})`, 'error');
      return;
    }

    // 第二步：用 API Token 验证
    const testResp = await fetch(`${erpUrl.replace(/\/$/, '')}/api/external/collect?test=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': apiToken,
      },
      body: JSON.stringify({ source: 'test', sourceUrl: 'https://test.com/test', title: '__test__' }),
      signal: AbortSignal.timeout(8000),
    });

    testBtn.disabled = false;
    testBtn.textContent = '测试连接';

    if (testResp.ok) {
      showStatus(configStatus, '✅ 连接成功！Token 有效', 'success');
    } else if (testResp.status === 401) {
      showStatus(configStatus, '❌ API Token 无效，请重新生成', 'error');
    } else {
      showStatus(configStatus, `❌ 验证失败 (HTTP ${testResp.status})`, 'error');
    }
  } catch (e) {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      showStatus(configStatus, '❌ 连接超时，请检查 ERP 地址是否正确', 'error');
    } else {
      showStatus(configStatus, '❌ 无法连接到 ERP 服务器', 'error');
    }
  }
});

// ---- 连接状态 ----

async function checkConnection() {
  const { erpUrl, apiToken } = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  const url = erpUrl || '';
  const token = apiToken || '';
  if (url && token) {
    erpStatus.className = 'status-dot connected';
    erpStatusText.textContent = url.replace(/^https?:\/\//, '');
  } else {
    erpStatus.className = 'status-dot disconnected';
    erpStatusText.textContent = '未配置';
  }
}

// ---- 页面检测与采集 ----

async function detectCurrentPage() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id || !tab?.url) {
    setPlatform('unknown', '无法获取当前页面');
    return;
  }

  const url = tab.url;
  let detectedPlatform = 'unknown';

  if (url.includes('alibaba.com') && (url.includes('/product-detail/') || url.includes('/product/'))) {
    detectedPlatform = 'alibaba';
  } else if (url.includes('1688.com') && url.includes('/offer/')) {
    detectedPlatform = '1688';
  }

  if (detectedPlatform === 'unknown') {
    setPlatform('unknown', '请在阿里国际站或 1688 产品详情页使用');
    collectBtn.disabled = true;
    return;
  }

  const names = { alibaba: '阿里国际站', '1688': '1688' };
  setPlatform(detectedPlatform, names[detectedPlatform] + ' · 产品详情页');
  collectBtn.disabled = false;
  document.getElementById('select-btn').disabled = false;

  // 获取预览信息
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PREVIEW' });
    if (resp?.success && resp.data) {
      previewArea.classList.remove('hidden');
      previewTitle.textContent = resp.data.title || '(无标题)';
      previewPrice.textContent = resp.data.price ? `${resp.data.currency || ''} ${resp.data.price}` : '-';
      previewImages.textContent = resp.data.imageCount + ' 张';
      document.getElementById('preview-attrs').textContent = (resp.data.attrCount || 0) + ' 项';
    }
  } catch (e) {
    // content script 可能未加载，先注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch {}
  }
}

function setPlatform(type, text) {
  const icons = {
    alibaba: '🌐',
    '1688': '🏭',
    unknown: '❓',
  };
  platformIcon.textContent = icons[type] || '❓';
  platformText.textContent = text;
}

function showPreview(data) {
  previewArea.classList.remove('hidden');
  previewTitle.textContent = data.title || '(无标题)';
  previewPrice.textContent = data.price ? `${data.currency || ''} ${data.price}` : '-';
  previewImages.textContent = (data.imageCount || (data.images?.length || 0)) + ' 张';
}

// ---- 采集 ----

collectBtn.addEventListener('click', async () => {
  // 检查配置
  const { erpUrl, apiToken } = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  if (!erpUrl || !apiToken) {
    showStatus(collectStatus, '⚠️ 请先在设置中配置 ERP 地址和 Token', 'error');
    return;
  }

  collectBtn.disabled = true;
  collectBtn.textContent = '⏳ 提取数据...';
  showStatus(collectStatus, '⏳ 正在提取产品数据...', 'loading');

  try {
    // 从当前页面提取完整数据（含图片）
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) throw new Error('无法获取当前页面');

    const extractResp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PRODUCT' });
    if (!extractResp?.success) throw new Error(extractResp?.error || '提取失败');

    const productData = extractResp.data;

    // 发送到 ERP
    collectBtn.textContent = '⏳ 上传到 ERP...';
    showStatus(collectStatus, '⏳ 正在上传到 ERP...', 'loading');

    const apiEndpoint = `${erpUrl.replace(/\/$/, '')}/api/external/collect`;
    const resp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': apiToken },
      body: JSON.stringify(productData),
    });
    const result = await resp.json();

    collectBtn.disabled = false;
    collectBtn.textContent = '⬇️ 采集到 ERP';

    if (resp.ok && result.success) {
      showStatus(collectStatus, '✅ 采集成功！已添加到 ERP', 'success');
    } else {
      showStatus(collectStatus, '❌ 采集失败: ' + (result.message || `HTTP ${resp.status}`), 'error');
    }
  } catch (e) {
    collectBtn.disabled = false;
    collectBtn.textContent = '⬇️ 采集到 ERP';
    showStatus(collectStatus, '❌ 采集失败: ' + (e.message || '未知错误'), 'error');
  }
});

// ---- 调试 ----
document.getElementById('debug-btn').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  await chrome.tabs.sendMessage(tabs[0].id, { type: 'DEBUG_DOM' });
  showStatus(collectStatus, '🔍 调试信息已输出到 Console（F12）', 'success');
});

// ---- 选择模式 ----
document.getElementById('select-btn').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  await chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' });
  // 标记选择模式已激活，存入 storage
  await chrome.storage.local.set({ selectModeActive: true });
  showStatus(collectStatus, '👆 请在页面上点击选择图片和属性，选好后重新点开本插件点"确认采集"', 'success');
  document.getElementById('select-btn').style.display = 'none';
  document.getElementById('collect-btn').style.display = 'none';
  document.getElementById('confirm-btn').style.display = 'block';
});

// 弹窗打开时检查是否在选择模式中
chrome.storage.local.get('selectModeActive').then(result => {
  if (result.selectModeActive) {
    document.getElementById('select-btn').style.display = 'none';
    document.getElementById('collect-btn').style.display = 'none';
    document.getElementById('confirm-btn').style.display = 'block';
  }
});

document.getElementById('confirm-btn').addEventListener('click', async () => {
  const { erpUrl, apiToken } = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  if (!erpUrl || !apiToken) {
    showStatus(collectStatus, '⚠️ 请先在设置中配置 ERP 地址和 Token', 'error');
    return;
  }

  document.getElementById('confirm-btn').disabled = true;
  document.getElementById('confirm-btn').textContent = '⏳ 处理中...';
  showStatus(collectStatus, '⏳ 获取选择数据...', 'loading');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('无法获取当前页面');

    // 退出选择模式并获取数据
    const resp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTED' });
    if (!resp?.success) throw new Error(resp?.error || '获取失败');
    let productData = resp.data;

    // 退出选择模式（清除高亮）
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' });
    await chrome.storage.local.remove('selectModeActive');

    // 下载用户选择的图片
    if (productData.images?.length > 0) {
      showStatus(collectStatus, `⏳ 下载 ${productData.images.length} 张图片...`, 'loading');
      for (let i = 0; i < productData.images.length; i++) {
        const img = productData.images[i];
        try {
          const fullSrc = img.originalUrl.startsWith('//') ? 'https:' + img.originalUrl : img.originalUrl;
          const resp = await fetch(fullSrc, { signal: AbortSignal.timeout(5000) });
          if (resp.ok) {
            const blob = await resp.blob();
            const base64 = await new Promise(r => { const fr = new FileReader(); fr.onloadend = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
            img.data = base64;
            img.mimeType = blob.type || 'image/jpeg';
          }
        } catch {}
      }
    }

    // 发送到 ERP
    showStatus(collectStatus, '⏳ 上传到 ERP...', 'loading');
    const apiEndpoint = `${erpUrl.replace(/\/$/, '')}/api/external/collect`;
    const apiResp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': apiToken },
      body: JSON.stringify(productData),
    });
    const result = await apiResp.json();

    document.getElementById('confirm-btn').disabled = false;
    document.getElementById('confirm-btn').textContent = '✅ 确认采集';
    document.getElementById('confirm-btn').style.display = 'none';
    document.getElementById('select-btn').style.display = 'block';
    document.getElementById('collect-btn').style.display = 'block';

    if (apiResp.ok && result.success) {
      showStatus(collectStatus, '✅ 采集成功！已添加到 ERP', 'success');
    } else {
      showStatus(collectStatus, '❌ 采集失败: ' + (result.message || `HTTP ${apiResp.status}`), 'error');
    }
  } catch (e) {
    document.getElementById('confirm-btn').disabled = false;
    document.getElementById('confirm-btn').textContent = '✅ 确认采集';
    showStatus(collectStatus, '❌ 失败: ' + (e.message || '未知'), 'error');
  }
});

// ---- 工具 ----

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = 'status-msg ' + (type || '');
}
