/**
 * Popup 脚本 v2 - 增强版采集进度反馈 + 去重检测 + 成功跳转
 *
 * 状态机: IDLE → EXTRACTING → CAPTURING → UPLOADING → DONE / ERROR
 */
'use strict';

// ===== 状态定义 =====
var CollectionState = {
  IDLE: 'IDLE',
  EXTRACTING: 'EXTRACTING',
  CAPTURING: 'CAPTURING',
  UPLOADING: 'UPLOADING',
  DONE: 'DONE',
  ERROR: 'ERROR',
};

var currentState = CollectionState.IDLE;
var retryData = null; // 保存重试上下文

// ===== DOM 引用 =====
var configView = document.getElementById('config-view');
var collectView = document.getElementById('collect-view');
var openConfigBtn = document.getElementById('open-config');
var backFromConfigBtn = document.getElementById('back-from-config');
var erpUrlInput = document.getElementById('erp-url');
var apiTokenInput = document.getElementById('api-token');
var saveConfigBtn = document.getElementById('save-config-btn');
var testBtn = document.getElementById('test-btn');
var configStatus = document.getElementById('config-status');
var collectBtn = document.getElementById('collect-btn');
var retryBtn = document.getElementById('retry-btn');
var selectBtn = document.getElementById('select-btn');
var confirmBtn = document.getElementById('confirm-btn');
var debugBtn = document.getElementById('debug-btn');
var trainBtn = document.getElementById('attr-train-btn');
var trainPanel = document.getElementById('attr-train-panel');
var containerList = document.getElementById('selected-containers');
var trainConfirmBtn = document.getElementById('train-confirm-btn');
var trainCancelBtn = document.getElementById('train-cancel-btn');
var trainStatus = document.getElementById('train-status');
var attrResultPanel = document.getElementById('attr-result-panel');
var collectStatus = document.getElementById('collect-status');
var platformIcon = document.getElementById('platform-icon');
var platformText = document.getElementById('platform-text');
var previewArea = document.getElementById('preview-area');
var previewTitle = document.getElementById('preview-title');
var previewPrice = document.getElementById('preview-price');
var previewImages = document.getElementById('preview-images');
var previewAttrs = document.getElementById('preview-attrs');
var previewVariants = document.getElementById('preview-variants');
var erpStatus = document.getElementById('erp-status');
var erpStatusText = document.getElementById('erp-status-text');
var progressArea = document.getElementById('progress-area');
var progressFill = document.getElementById('progress-fill');
var progressText = document.getElementById('progress-text');
var subProgress = document.getElementById('sub-progress');
var subProgressText = document.getElementById('sub-progress-text');
var successCard = document.getElementById('success-card');
var viewInErpLink = document.getElementById('view-in-erp-link');
var duplicateWarning = document.getElementById('duplicate-warning');
var dupTime = document.getElementById('dup-time');
var dupTitle = document.getElementById('dup-title');

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async function () {
  await loadConfig();
  await checkConnection();
  await detectCurrentPage();
});

// ===== 配置管理 =====

async function loadConfig() {
  var saved = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  if (saved.erpUrl) erpUrlInput.value = saved.erpUrl;
  if (saved.apiToken) apiTokenInput.value = saved.apiToken;

  if (!saved.erpUrl || !saved.apiToken) {
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, function (result) {
      if (result) {
        if (!saved.erpUrl) erpUrlInput.value = result.erpUrl || '';
        if (!saved.apiToken) apiTokenInput.value = result.apiToken || '';
      }
    });
  }
}

function getErpBaseUrl() {
  return (erpUrlInput.value || '').replace(/\/$/, '');
}

openConfigBtn.addEventListener('click', function () {
  configView.classList.remove('hidden');
  collectView.classList.add('hidden');
  configStatus.textContent = '';
  configStatus.className = 'status-msg';
});

backFromConfigBtn.addEventListener('click', function () {
  configView.classList.add('hidden');
  collectView.classList.remove('hidden');
});

saveConfigBtn.addEventListener('click', async function () {
  var erpUrl = erpUrlInput.value.trim();
  var apiToken = apiTokenInput.value.trim();

  if (!erpUrl || !apiToken) {
    showStatus(configStatus, '请填写 ERP 地址和 API Token', 'error');
    return;
  }

  saveConfigBtn.disabled = true;
  saveConfigBtn.textContent = '⏳ 保存中...';
  showStatus(configStatus, '⏳ 正在保存...', 'loading');

  try {
    await chrome.storage.local.set({ erpUrl: erpUrl, apiToken: apiToken });
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

testBtn.addEventListener('click', async function () {
  var erpUrl = erpUrlInput.value.trim();
  var apiToken = apiTokenInput.value.trim();

  if (!erpUrl || !apiToken) {
    showStatus(configStatus, '请先填写配置', 'error');
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = '⏳ 测试中...';
  showStatus(configStatus, '⏳ 测试连接中...', 'loading');

  try {
    var healthResp = await fetch(erpUrl.replace(/\/$/, '') + '/api/health', {
      signal: AbortSignal.timeout(8000),
    });
    if (!healthResp.ok) {
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
      showStatus(configStatus, '❌ 服务器不可达 (HTTP ' + healthResp.status + ')', 'error');
      return;
    }

    var testResp = await fetch(erpUrl.replace(/\/$/, '') + '/api/external/collect?test=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': apiToken },
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
      showStatus(configStatus, '❌ 验证失败 (HTTP ' + testResp.status + ')', 'error');
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

// ===== 连接状态 =====

async function checkConnection() {
  var saved = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  var url = saved.erpUrl || '';
  var token = saved.apiToken || '';
  if (url && token) {
    erpStatus.className = 'status-dot connected';
    erpStatusText.textContent = url.replace(/^https?:\/\//, '');
  } else {
    erpStatus.className = 'status-dot disconnected';
    erpStatusText.textContent = '未配置';
  }
}

// ===== 页面检测与预览 =====

async function detectCurrentPage() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];

  if (!tab?.id || !tab?.url) {
    setPlatform('unknown', '无法获取当前页面');
    return;
  }

  var url = tab.url;
  var detectedPlatform = 'unknown';

  if (url.indexOf('alibaba.com') !== -1 && (url.indexOf('/product-detail/') !== -1 || url.indexOf('/product/') !== -1)) {
    detectedPlatform = 'alibaba';
  } else if (url.indexOf('1688.com') !== -1 && url.indexOf('/offer/') !== -1) {
    detectedPlatform = '1688';
  }

  if (detectedPlatform === 'unknown') {
    setPlatform('unknown', '请在阿里国际站或 1688 产品详情页使用');
    collectBtn.disabled = true;
    selectBtn.disabled = true;
    return;
  }

  var names = { alibaba: '阿里国际站', '1688': '1688' };
  setPlatform(detectedPlatform, names[detectedPlatform] + ' · 产品详情页');
  collectBtn.disabled = false;
  selectBtn.disabled = false;

  // 获取预览信息
  try {
    var resp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PREVIEW' });
    if (resp?.success && resp.data) {
      showPreview(resp.data);
      // 去重检测
      checkDuplicate(url);
    }
  } catch (e) {
    // content script 可能未加载，先注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['parsers/selector-registry.js', 'parsers/jsonld-parser.js', 'parsers/tiered-price-parser.js', 'parsers/variant-parser.js', 'parsers/spec-parser.js', 'parsers/image-processor.js', 'parsers/payload-assembler.js', 'parsers/alibaba-v2.js', 'content.js'],
      });
      // 重试预览
      setTimeout(async function () {
        var retryResp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PREVIEW' });
        if (retryResp?.success && retryResp.data) {
          showPreview(retryResp.data);
          checkDuplicate(url);
        }
      }, 500);
    } catch (injectErr) {
      console.warn('[ERP] inject failed:', injectErr);
    }
  }
}

function setPlatform(type, text) {
  var icons = {
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
  previewPrice.textContent = data.price ? (data.currency || '') + ' ' + data.price : '-';
  previewImages.textContent = data.imageCount || 0;
  document.getElementById('preview-attrs').textContent = data.attrCount || 0;
  document.getElementById('preview-variants').textContent = data.variantCount || 0;
}

// ===== 去重检测 =====

async function checkDuplicate(sourceUrl) {
  try {
    var saved = await chrome.storage.local.get(['erpUrl', 'apiToken']);
    var erpUrl = saved.erpUrl;
    var apiToken = saved.apiToken;
    if (!erpUrl || !apiToken) return;

    var resp = await fetch(
      erpUrl.replace(/\/$/, '') + '/api/external/collect/check?sourceUrl=' + encodeURIComponent(sourceUrl),
      { headers: { 'X-API-Token': apiToken } }
    );
    if (!resp.ok) return;

    var data = await resp.json();
    if (data.exists) {
      duplicateWarning.classList.remove('hidden');
      dupTime.textContent = formatMinutesAgo(data.minutesAgo);
      dupTitle.textContent = data.title || '(无标题)';
    }
  } catch (e) {
    console.warn('[ERP采集] 去重查询失败:', e.message);
  }
}

function formatMinutesAgo(minutes) {
  if (minutes < 60) return minutes + ' 分钟';
  var hours = Math.floor(minutes / 60);
  var mins = minutes % 60;
  return mins > 0 ? hours + ' 小时 ' + mins + ' 分钟' : hours + ' 小时';
}

// ===== 状态机渲染 =====

function renderState(state, payload) {
  if (payload === undefined) payload = {};

  // 隐藏所有切换元素
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
      var current = payload.current || 0;
      var total = payload.total || '?';
      progressText.textContent = '⏳ 下载图片 (' + current + '/' + total + ')...';
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
      // 跳转链接
      var erpUrl = getErpBaseUrl();
      if (payload.id) {
        viewInErpLink.href = erpUrl + '/collected-products/' + payload.id;
      } else {
        viewInErpLink.href = erpUrl + '/collected-products';
      }
      setTimeout(function () { hideSubProgress(); }, 500);
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

function updateSteps(states) {
  ['extract', 'capture', 'upload', 'done'].forEach(function (id) {
    var dot = document.getElementById('dot-' + id);
    var step = dot.closest('.step');
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
  subProgress.classList.remove('hidden');
  subProgressText.textContent = text;
}

function hideSubProgress() {
  subProgress.classList.add('hidden');
}

// ===== 采集主流程 =====

collectBtn.addEventListener('click', async function () {
  // 检查配置
  var saved = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  var erpUrl = saved.erpUrl;
  var apiToken = saved.apiToken;
  if (!erpUrl || !apiToken) {
    showStatus(collectStatus, '⚠️ 请先在设置中配置 ERP 地址和 Token', 'error');
    return;
  }

  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];
  if (!tab?.id) return;

  // === Phase 1: EXTRACTING ===
  transitionTo(CollectionState.EXTRACTING, { detail: '正在提取产品信息...' });

  try {
    transitionTo(CollectionState.EXTRACTING, { detail: '解析 DOM 中...' });
    // 发送 V2 提取
    var extractResp = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_PRODUCT_V2',
      enableProgress: true,
    });

    if (!extractResp?.success) {
      throw new Error(extractResp?.error || '提取失败');
    }

    var productData = extractResp.data;
    retryData = productData; // 保存用于重试

    // === Phase 2: CAPTURING ===
    var totalImages = (productData.images || []).length;
    if (totalImages > 0) {
      transitionTo(CollectionState.CAPTURING, { current: 0, total: totalImages });

      for (var i = 0; i < productData.images.length; i++) {
        var img = productData.images[i];

        transitionTo(CollectionState.CAPTURING, {
          current: i + 1,
          total: totalImages,
          detail: '正在下载图片 ' + (i + 1) + '/' + totalImages + '...',
        });

        var capResp = await chrome.tabs.sendMessage(tab.id, {
          type: 'CAPTURE_IMAGE',
          imageInfo: img,
          index: i,
        });

        if (capResp?.success) {
          productData.images[i] = capResp.data;
          renderState(CollectionState.CAPTURING, {
            current: i + 1, total: totalImages,
            detail: '图片 ' + (i + 1) + '/' + totalImages + ' 下载完成',
          });
        } else {
          renderState(CollectionState.CAPTURING, {
            current: i + 1, total: totalImages,
            detail: '图片 ' + (i + 1) + ' 下载失败，跳过 (共 ' + totalImages + ' 张)',
          });
        }
      }
    }

    // === Phase 3: UPLOADING ===
    transitionTo(CollectionState.UPLOADING);

    var apiEndpoint = erpUrl.replace(/\/$/, '') + '/api/external/collect';
    var apiResp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': apiToken },
      body: JSON.stringify(productData),
    });

    var result = await apiResp.json();

    if (apiResp.ok && result.success) {
      // === Phase 4: DONE ===
      var productId = result.data?.id || result.data?.product?.id || null;
      transitionTo(CollectionState.DONE, { id: productId });
    } else {
      throw new Error(result.message || 'HTTP ' + apiResp.status);
    }
  } catch (e) {
    transitionTo(CollectionState.ERROR, {
      error: e.message,
      detail: '请检查网络连接后重试',
    });
  }
});

// ===== 重试逻辑 =====

retryBtn.addEventListener('click', function () {
  transitionTo(CollectionState.IDLE);
  setTimeout(function () {
    collectBtn.click();
  }, 100);
});

// ===== 状态转换 =====

function transitionTo(newState, payload) {
  renderState(newState, payload);
  currentState = newState;
}

// ===== 选择模式 =====

selectBtn.addEventListener('click', async function () {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  await chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' });
  await chrome.storage.local.set({ selectModeActive: true });
  showStatus(collectStatus, '👆 请在页面上点击选择图片和属性，选好后重新点开本插件点"确认采集"', 'success');
  selectBtn.classList.add('hidden');
  collectBtn.classList.add('hidden');
  confirmBtn.classList.remove('hidden');
});

// 弹窗打开时检查是否在选择模式中
chrome.storage.local.get('selectModeActive').then(function (result) {
  if (result.selectModeActive) {
    selectBtn.classList.add('hidden');
    collectBtn.classList.add('hidden');
    confirmBtn.classList.remove('hidden');
  }
});

confirmBtn.addEventListener('click', async function () {
  var saved = await chrome.storage.local.get(['erpUrl', 'apiToken']);
  var erpUrl = saved.erpUrl;
  var apiToken = saved.apiToken;
  if (!erpUrl || !apiToken) {
    showStatus(collectStatus, '⚠️ 请先在设置中配置 ERP 地址和 Token', 'error');
    return;
  }

  confirmBtn.disabled = true;
  confirmBtn.textContent = '⏳ 处理中...';
  showStatus(collectStatus, '⏳ 获取选择数据...', 'loading');

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('无法获取当前页面');

    var resp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTED' });
    if (!resp?.success) throw new Error(resp?.error || '获取失败');
    var productData = resp.data;

    // 如果手动选择了属性容器，保存选择器
    if (resp.selector) {
      await chrome.storage.local.set({ trainedAttrSelector: resp.selector });
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_TRAINED_SELECTOR', selector: resp.selector });
      console.log('[训练] 保存属性容器选择器:', resp.selector);
    }

    await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' });
    await chrome.storage.local.remove('selectModeActive');

    // 下载用户选择的图片
    if (productData.images && productData.images.length > 0) {
      showStatus(collectStatus, '⏳ 下载 ' + productData.images.length + ' 张图片...', 'loading');
      for (var i = 0; i < productData.images.length; i++) {
        var img = productData.images[i];
        try {
          var fullSrc = img.originalUrl.indexOf('//') === 0 ? 'https:' + img.originalUrl : img.originalUrl;
          var fetchResp = await fetch(fullSrc, { signal: AbortSignal.timeout(5000) });
          if (fetchResp.ok) {
            var blob = await fetchResp.blob();
            var base64 = await new Promise(function (r) {
              var fr = new FileReader();
              fr.onloadend = function () { r(fr.result.split(',')[1]); };
              fr.readAsDataURL(blob);
            });
            img.data = base64;
            img.mimeType = blob.type || 'image/jpeg';
          }
        } catch (e) { /* skip */ }
      }
    }

    showStatus(collectStatus, '⏳ 上传到 ERP...', 'loading');
    var apiEndpoint = erpUrl.replace(/\/$/, '') + '/api/external/collect';
    var apiResp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': apiToken },
      body: JSON.stringify(productData),
    });
    var apiResult = await apiResp.json();

    confirmBtn.disabled = false;
    confirmBtn.textContent = '✅ 确认采集';
    confirmBtn.classList.add('hidden');
    selectBtn.classList.remove('hidden');
    collectBtn.classList.remove('hidden');

    if (apiResp.ok && apiResult.success) {
      showStatus(collectStatus, '✅ 采集成功！已添加到 ERP', 'success');
    } else {
      showStatus(collectStatus, '❌ 采集失败: ' + (apiResult.message || 'HTTP ' + apiResp.status), 'error');
    }
  } catch (e) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = '✅ 确认采集';
    showStatus(collectStatus, '❌ 失败: ' + (e.message || '未知'), 'error');
    // 恢复按钮状态，退出选择模式
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});
    await chrome.storage.local.remove('selectModeActive').catch(function(){});
    confirmBtn.classList.add('hidden');
    selectBtn.classList.remove('hidden');
    collectBtn.classList.remove('hidden');
  }
});

// ===== 调试 =====

debugBtn.addEventListener('click', async function () {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  
  showStatus(collectStatus, '⏳ 正在提取数据...', '');
  
  try {
    var resp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_PRODUCT_V2' });
    if (!resp || !resp.success) {
      showStatus(collectStatus, '❌ 提取失败: ' + (resp?.error || '无响应'), 'error');
      return;
    }
    
    var data = resp.data;
    data.pageUrl = tabs[0].url;
    
    showStatus(collectStatus, '⏳ 正在生成预览...', '');
    
    // 顺便检查属性区
    var attrDebugInfo = '';
    try {
      var attrResp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'DEBUG_ATTRS' });
      if (attrResp) {
        var issues = [];
        if (!attrResp.attrSectionExists) issues.push('data-testid="module-attribute" 未找到');
        issues.push('关键词: ' + (attrResp.foundKeyword || '无'));
        issues.push('容器数: ' + (attrResp.containerCount || 0));
        if (attrResp.bodyTextSample) issues.push('文本: ' + attrResp.bodyTextSample.substring(0, 200));
        if (attrResp.containerSample) issues.push('容器HTML: ' + attrResp.containerSample.substring(0, 200));
        if (attrResp.keyAttrInner) issues.push('内HTML: ' + attrResp.keyAttrInner.substring(0, 500));
        if (attrResp.threeCols) issues.push('3列: ' + attrResp.threeCols.substring(0, 500));
        attrDebugInfo = issues.length > 0 ? issues.join('; ') : '';
      }
    } catch(e) {}
    
    // 也从页面额外获取视频链接
    var videoUrls = [];
    try {
      var videoResp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_VIDEOS' });
      if (videoResp && videoResp.success && videoResp.urls) {
        videoUrls = videoResp.urls;
      }
    } catch(e) {}
    
    // 发送到服务器生成 HTML 预览
    var config = await chrome.storage.local.get(['erpUrl', 'apiToken']);
    var erpUrl = (config.erpUrl || 'http://localhost:3001').replace(/\/$/, '');
    
    var apiResp = await fetch(erpUrl + '/api/debug/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        price: data.price,
        currency: data.currency,
        brand: data.brand,
        sku: data.sku,
        moq: data.moq || data.minOrderQuantity,
        pageUrl: data.pageUrl,
        description: data.description || data.descriptionEn || '',
        attrDebugInfo: attrDebugInfo,
        attributeCount: (data.attributes || []).length,
        images: (function(){
          var seenUrls = {};
          var all = (data.images || []).map(function(img) {
            var url = typeof img === 'string' ? img : (img.originalUrl || img.url || '');
            var isVideo = /\.(mp4|webm|mov|avi)$/i.test(url) || img.type === 'video';
            return { url: url, type: isVideo ? 'video' : 'image' };
          }).filter(function(u) { return u.url; });
          // 合并视频 URL（去重）
          videoUrls.forEach(function(v) {
            var key = v.replace(/^https?:/i,'').replace(/\/+$/,'').split('?')[0];
            var exists = all.some(function(a) { return a.url.replace(/^https?:/i,'').replace(/\/+$/,'').split('?')[0] === key; });
            if (!exists) all.push({ url: v, type: 'video' });
          });
          return all;
        })(),
        attributes: (data.attributes || []).map(function(a) {
          return { name: a.name || a.nameCn || '', value: a.value || a.valueCn || '' };
        }),
      }),
    });
    
    var result = await apiResp.json();
    if (result.success) {
      // 打开预览目录
      chrome.tabs.create({ url: erpUrl + '/api/debug/preview/view?dir=' + encodeURIComponent(result.data.dir), active: true });
    } else {
      showStatus(collectStatus, '❌ 生成预览失败: ' + (result.error || '未知'), 'error');
    }
    
  } catch (e) {
    showStatus(collectStatus, '❌ 调试失败: ' + e.message, 'error');
  }
});

// ===== 属性选择器 =====
var trainingContainers = [];
var trainActive = false;
var attrResultData = []; // { rowId, name, value, kept }

trainBtn.addEventListener('click', async function() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  
  if (!trainActive) {
    trainActive = true;
    trainingContainers = [];
    attrResultData = [];
    
    // 从 storage 读取之前 Shift+click 选中的容器（弹窗关闭期间的）
    try {
      var allItems = await chrome.storage.local.get(null);
      var loaded = [];
      // 从 tc_ 开头的 key 读取每个容器
      Object.keys(allItems).forEach(function(k) {
        if (k.startsWith('tc_') && allItems[k] && allItems[k].selector) {
          loaded.push({
            id: k,
            name: allItems[k].name || ('框' + (loaded.length + 1)),
            selector: allItems[k].selector,
          });
        }
      });
      if (loaded.length > 0) {
        trainingContainers = loaded;
      }
    } catch(e) {}
    
    // 隐藏结果面板（如果有之前的）
    attrResultPanel.classList.add('hidden');
    trainPanel.classList.remove('hidden');
    
    renderContainerList();
    
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' });
    showStatus(trainStatus, trainingContainers.length > 0
      ? '✅ 已有 ' + trainingContainers.length + ' 个选中容器，可继续添加或点确认'
      : '🖱️ 按住 Shift + 点击属性容器框', 'success');
  }
});

// 监听页面点击选择的结果
chrome.runtime.onMessage.addListener(function(msg, sender) {
  if (msg.type === 'CONTAINER_SELECTED' && msg.selector) {
    var selStr = msg.selector.containerSelector || msg.selector;
    var idx = trainingContainers.length + 1;
    trainingContainers.push({ id: 'c' + Date.now(), name: '框' + idx, selector: msg.selector });
    renderContainerList();
    showStatus(trainStatus, '✅ 已添加 ' + selStr.substring(0,40), 'success');
  }
});

function renderContainerList() {
  if (trainingContainers.length === 0) {
    containerList.innerHTML = '<div class="train-hint">还没有选中容器，在页面上按住 Shift 点击属性框</div>';
    return;
  }
  containerList.innerHTML = trainingContainers.map(function(c, i) {
    var selStr = c.selector && c.selector.containerSelector ? c.selector.containerSelector : (c.selector || '');
    return '<div class="container-item"><span>#' + (i+1) + ' ' + c.name + '<br><span style="color:#9ca3af;font-size:10px">' + selStr.substring(0,50) + '</span></span><span class="del-btn" data-id="' + c.id + '">✕</span></div>';
  }).join('');
  containerList.querySelectorAll('.del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-id');
      trainingContainers = trainingContainers.filter(function(c) { return c.id !== id; });
      renderContainerList();
    });
  });
}

// 确认容器选择 → 提取属性 → 显示表格
trainConfirmBtn.addEventListener('click', async function() {
  if (trainingContainers.length === 0) {
    showStatus(trainStatus, '⚠️ 请至少选择一个属性容器', 'error');
    return;
  }
  
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  
  // 退出选择模式
  await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});
  
  showStatus(trainStatus, '⏳ 正在提取属性...', 'loading');
  
  // 发送提取请求
  var selectors = trainingContainers.map(function(c) { return c.selector; });
  var resp;
  try {
    resp = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'EXTRACT_ATTRS_FROM_CONTAINERS',
      selectors: selectors
    });
  } catch(e) {
    showStatus(trainStatus, '❌ 提取失败: ' + e.message, 'error');
    return;
  }
  
  if (!resp || !resp.success) {
    showStatus(trainStatus, '❌ 提取失败: ' + (resp?.error || '无响应'), 'error');
    return;
  }
  
  var attrs = resp.data.attributes || [];
  if (attrs.length === 0) {
    showStatus(trainStatus, '⚠️ 未从容器中提取到属性，尝试重新选择', 'error');
    return;
  }
  
  attrResultData = attrs.map(function(a) {
    return { rowId: a.rowId, name: a.name, value: a.value, kept: true };
  });
  
  // 隐藏容器选择面板，显示结果表格
  trainPanel.classList.add('hidden');
  renderAttrResultTable();
  document.getElementById('attr-result-panel').classList.remove('hidden');
  showStatus(trainStatus, ''); // 清空旧状态
});

function renderAttrResultTable() {
  var tbody = document.getElementById('attr-result-tbody');
  var badge = document.getElementById('attr-count-badge');
  var kept = attrResultData.filter(function(a) { return a.kept; }).length;
  
  badge.textContent = kept + '/' + attrResultData.length + ' 项';
  
  tbody.innerHTML = attrResultData.map(function(a, i) {
    var checked = a.kept ? 'checked' : '';
    var cls = a.kept ? '' : 'removed';
    return '<tr class="' + cls + '" data-rowid="' + a.rowId + '">' +
      '<td><input type="checkbox" class="attr-row-cb" ' + checked + ' data-rowid="' + a.rowId + '"></td>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + escHtml(a.name) + '</td>' +
      '<td>' + escHtml(a.value) + '</td>' +
    '</tr>';
  }).join('');
  
  // 各行的 checkbox 事件
  tbody.querySelectorAll('.attr-row-cb').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var rowId = this.getAttribute('data-rowid');
      var kept = this.checked;
      for (var j = 0; j < attrResultData.length; j++) {
        if (attrResultData[j].rowId === rowId) {
          attrResultData[j].kept = kept;
          break;
        }
      }
      renderAttrResultTable();
    });
  });
}

// 全选/取消
document.getElementById('attr-select-all').addEventListener('change', function() {
  var checked = this.checked;
  attrResultData.forEach(function(a) { a.kept = checked; });
  renderAttrResultTable();
});

// 保存模式
document.getElementById('attr-save-btn').addEventListener('click', async function() {
  var keptAttrs = attrResultData.filter(function(a) { return a.kept; });
  if (keptAttrs.length === 0) {
    showStatus(document.getElementById('attr-result-status'), '⚠️ 请至少保留一个属性', 'error');
    return;
  }
  
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 保存容器选择器 + 保留的属性名列表
  var pattern = {
    containerSelectors: trainingContainers.map(function(c) { return c.selector; }),
    attributeNames: keptAttrs.map(function(a) { return a.name; }),
    savedAt: Date.now()
  };
  
  await chrome.storage.local.set({ trainedAttrPattern: pattern });
  // 清理临时容器 storage
  try {
    var all = await chrome.storage.local.get(null);
    var removeKeys = Object.keys(all).filter(function(k) { return k.startsWith('tc_') || k === 'tc_keys'; });
    if (removeKeys.length > 0) await chrome.storage.local.remove(removeKeys);
  } catch(e) {}
  
  // 通知当前页面
  if (tabs[0]?.id) {
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_TRAINED_PATTERN', pattern: pattern }).catch(function(){});
  }
  
  showStatus(document.getElementById('attr-result-status'), '✅ 已保存！共保留 ' + keptAttrs.length + ' 个属性', 'success');
  
  setTimeout(function() {
    document.getElementById('attr-result-panel').classList.add('hidden');
    trainActive = false;
    trainingContainers = [];
  }, 1500);
});

// 重新选择
document.getElementById('attr-retry-btn').addEventListener('click', async function() {
  document.getElementById('attr-result-panel').classList.add('hidden');
  trainActive = false;
  trainingContainers = [];
  
  // 重新进入选择模式
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    trainActive = true;
    trainingContainers = [];
    attrResultData = [];
    trainPanel.classList.remove('hidden');
    renderContainerList();
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' });
    showStatus(trainStatus, '🖱️ 重新选择属性容器', 'success');
  }
});

// 取消
trainCancelBtn.addEventListener('click', async function() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});
  }
  trainPanel.classList.add('hidden');
  trainActive = false;
  trainingContainers = [];
  attrResultData = [];
  // 清理临时容器 storage
  try {
    var all = await chrome.storage.local.get(null);
    var removeKeys = Object.keys(all).filter(function(k) { return k.startsWith('tc_') || k === 'tc_keys'; });
    if (removeKeys.length > 0) await chrome.storage.local.remove(removeKeys);
  } catch(e) {}
});

// ===== 工具 =====

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = 'status-msg ' + (type || '');
}
