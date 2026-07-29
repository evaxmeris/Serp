/**
 * Popup 脚本 v3 - 多配置管理 + 属性编辑 + 选文字模式
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
var retryData = null;

// ===== 配置管理状态 =====
var configs = {};              // { id: config, ... }
var activeConfigId = null;
var activeConfig = null;

// ===== 属性训练器状态 =====
var trainingContainers = [];   // [{ id, name, selector }]
var attrResultData = [];       // [{ rowId, name, value, kept }]
var trainActive = false;

// ===== 选文字模式 =====
var pickTextMode = null;       // { type: 'name'|'value', inputEl: dom }

// ===== DOM 引用 =====
// 视图
var configView = document.getElementById('config-view');
var collectView = document.getElementById('collect-view');

// ERP 配置视图
var openConfigBtn = document.getElementById('open-config');
var backFromConfigBtn = document.getElementById('back-from-config');
var erpUrlInput = document.getElementById('erp-url');
var apiTokenInput = document.getElementById('api-token');
var saveErpConfigBtn = document.getElementById('save-erp-config-btn') || document.getElementById('save-config-btn');
var testBtn = document.getElementById('test-btn');
var configStatus = document.getElementById('config-status');

// 采集视图
var collectBtn = document.getElementById('collect-btn');
var retryBtn = document.getElementById('retry-btn');
var selectBtn = document.getElementById('select-btn');
var confirmBtn = document.getElementById('confirm-btn');
var debugBtn = document.getElementById('debug-btn');
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

// 多配置管理
var configSelect = document.getElementById('config-select');
var configDefaultStar = document.getElementById('config-default-star');

// 属性配置面板
var attrConfigBtn = document.getElementById('attr-config-btn');
var attrConfigPanel = document.getElementById('attr-config-panel');
var configNameInput = document.getElementById('config-name-input');
var saveAttrConfigBtn = document.getElementById('save-attr-config-btn');
var updateConfigBtn = document.getElementById('update-config-btn');
var saveAsBtn = document.getElementById('save-as-btn');
var configSaveStatus = document.getElementById('config-save-status');

// 属性编辑
var attrEditTbody = document.getElementById('attr-edit-tbody');
var attrEditStep = document.getElementById('attr-edit-step');
var addAttrBtn = document.getElementById('add-attr-btn');
var extractAttrsBtn = document.getElementById('extract-attrs-btn');
var attrEditTableWrap = document.getElementById('attr-edit-table-wrap');

// 容器选择
var containerList = document.getElementById('selected-containers');
var trainCancelBtn = document.getElementById('train-cancel-btn');
var trainStatus = document.getElementById('train-status');

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async function () {
  await loadConfig();
  await loadConfigs();          // 加载多配置
  await checkConnection();
  await detectCurrentPage();

  // 恢复之前的属性选择状态（弹窗因点击页面关闭后）
  try {
    var pending = await chrome.storage.local.get(['pendingAttrPick', 'pendingPickResult']);
    if (pending.pendingAttrPick && pending.pendingAttrPick.attrResultData && pending.pendingAttrPick.attrResultData.length > 0) {
      var age = Date.now() - (pending.pendingAttrPick.timestamp || 0);
      if (age < 60000) {  // 1分钟内
        attrResultData = pending.pendingAttrPick.attrResultData;
        pickAttrUndoStack = pending.pendingAttrPick.undoStack || [];
        // 打开属性配置面板
        attrConfigPanel.classList.remove('hidden');
        renderAttrEditTable();
        renderContainerList();
        // 如果有 pick 结果，应用
        if (pending.pendingPickResult && pending.pendingPickResult.text) {
          var pickText = pending.pendingPickResult.text;
          var pickPhase = pending.pendingPickResult.phase || 'name';
          // 填入到对应行
          for (var ri = 0; ri < attrResultData.length; ri++) {
            if (attrResultData[ri].rowId === pending.pendingAttrPick.rowId) {
              attrResultData[ri][pickPhase] = pickText;
              break;
            }
          }
          renderAttrEditTable();
          chrome.storage.local.remove('pendingPickResult').catch(function(){});
          showStatus(trainStatus, '✅ ' + (pickPhase === 'name' ? '属性名' : '属性值') + '已恢复: ' + pickText.substring(0, 30), 'success');
          // 如果 phase 是 name，继续 value
          if (pending.pendingAttrPick.phase === 'value') {
            setTimeout(function() { doPickAttrText(pending.pendingAttrPick.rowId, 'value'); }, 200);
          }
        } else {
          showStatus(trainStatus, '🔄 检测到未完成的属性选择，继续操作', 'success');
        }
      } else {
        chrome.storage.local.remove(['pendingAttrPick', 'pendingPickResult']).catch(function(){});
      }
    }
  } catch(e) {}
});

// ===== ERP 配置管理 =====

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

saveErpConfigBtn.addEventListener('click', async function () {
  var erpUrl = erpUrlInput.value.trim();
  var apiToken = apiTokenInput.value.trim();

  if (!erpUrl || !apiToken) {
    showStatus(configStatus, '请填写 ERP 地址和 API Token', 'error');
    return;
  }

  saveErpConfigBtn.disabled = true;
  saveErpConfigBtn.textContent = '⏳ 保存中...';
  showStatus(configStatus, '⏳ 正在保存...', 'loading');

  try {
    await chrome.storage.local.set({ erpUrl: erpUrl, apiToken: apiToken });
    saveErpConfigBtn.disabled = false;
    saveErpConfigBtn.textContent = '保存';
    showStatus(configStatus, '✅ 配置已保存', 'success');
    checkConnection();
  } catch (e) {
    saveErpConfigBtn.disabled = false;
    saveErpConfigBtn.textContent = '保存';
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

    var extractResp = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_PRODUCT_V2',
      enableProgress: true,
    });

    if (!extractResp?.success) {
      throw new Error(extractResp?.error || '提取失败');
    }

    var productData = extractResp.data;
    retryData = productData;

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

    // 如果存在活跃的 attribute 配置，注入 attributes 到 productData
    if (activeConfig && activeConfig.attributes && activeConfig.attributes.length > 0) {
      var keptAttrs = activeConfig.attributes.filter(function(a) { return a.kept !== false; });
      if (keptAttrs.length > 0) {
        productData.attributes = keptAttrs.map(function(a) { return { name: a.name, value: a.value }; });
      }
    }

    var apiEndpoint = erpUrl.replace(/\/$/, '') + '/api/external/collect';
    var apiResp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': apiToken },
      body: JSON.stringify(productData),
    });

    var result = await apiResp.json();

    if (apiResp.ok && result.success) {
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

if (selectBtn) {
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

chrome.storage.local.get('selectModeActive').then(function (result) {
  if (result.selectModeActive) {
    selectBtn.classList.add('hidden');
    collectBtn.classList.add('hidden');
    confirmBtn.classList.remove('hidden');
  }
});
}

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

    if (resp.selector) {
      await chrome.storage.local.set({ trainedAttrSelector: resp.selector });
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_TRAINED_SELECTOR', selector: resp.selector });
      console.log('[训练] 保存属性容器选择器:', resp.selector);
    }

    await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' });
    await chrome.storage.local.remove('selectModeActive');

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
    // 1. 先获取基础数据（标题/价格/图片等）
    var resp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_PRODUCT_V2' });
    if (!resp || !resp.success) {
      showStatus(collectStatus, '❌ 提取失败: ' + (resp?.error || '无响应'), 'error');
      return;
    }

    var data = resp.data;
    data.pageUrl = tabs[0].url;

    // 2. 用当前活跃配置的属性数据
    var keptTrainingAttrs = [];
    if (activeConfig && activeConfig.attributes && activeConfig.attributes.length > 0) {
      keptTrainingAttrs = activeConfig.attributes.filter(function(a) { return a.kept !== false; }).map(function(a) { return { name: a.name, value: a.value }; });
    }
    if (keptTrainingAttrs.length > 0) {
      console.log('[Debug] 使用配置的 ' + keptTrainingAttrs.length + ' 项属性');
      showStatus(collectStatus, '使用配置的 ' + keptTrainingAttrs.length + ' 项属性', 'success');
      data.attributes = keptTrainingAttrs;
    } else if (typeof attrResultData !== 'undefined' && attrResultData.length > 0) {
      var sessionAttrs = attrResultData.filter(function(a) { return a.kept; }).map(function(a) { return { name: a.name, value: a.value }; });
      if (sessionAttrs.length > 0) {
        console.log('[Debug] 使用属性训练器最新提取的 ' + sessionAttrs.length + ' 项属性');
        showStatus(collectStatus, '使用属性训练器的 ' + sessionAttrs.length + ' 项属性', 'success');
        data.attributes = sessionAttrs;
      }
    } else {
      var stored = await chrome.storage.local.get(['trainedAttrPattern']);
      if (stored.trainedAttrPattern && stored.trainedAttrPattern.attributes && stored.trainedAttrPattern.attributes.length > 0) {
        console.log('[Debug] 从 storage 读取保存的属性数据（' + stored.trainedAttrPattern.attributes.length + '项）');
        showStatus(collectStatus, '使用已保存的 ' + stored.trainedAttrPattern.attributes.length + ' 项属性', 'success');
        data.attributes = stored.trainedAttrPattern.attributes;
      } else if (stored.trainedAttrPattern && stored.trainedAttrPattern.containerSelectors && stored.trainedAttrPattern.containerSelectors.length > 0) {
        showStatus(collectStatus, '⏳ 从容器重新提取属性...', '');
        var attrResp = await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EXTRACT_ATTRS_FROM_CONTAINERS',
          selectors: stored.trainedAttrPattern.containerSelectors
        }).catch(function(){ return null; });
        if (attrResp && attrResp.success && attrResp.data && attrResp.data.attributes && attrResp.data.attributes.length > 0) {
          console.log('[Debug] 从容器重新提取属性（' + attrResp.data.attributes.length + '项）');
          showStatus(collectStatus, '已提取 ' + attrResp.data.attributes.length + ' 项属性', 'success');
          data.attributes = attrResp.data.attributes;
          var nameWhitelist = stored.trainedAttrPattern.attributeNames || null;
          if (nameWhitelist && nameWhitelist.length > 0) {
            data.attributes = data.attributes.filter(function(a) {
              return nameWhitelist.indexOf(a.name) >= 0;
            });
          }
        } else {
          showStatus(collectStatus, '⚠️ 无属性数据，使用 v2 引擎结果', 'error');
        }
      }
    }

    // 3-7: 发送到预览
    showStatus(collectStatus, '⏳ 正在生成预览...', '');

    var attrDebugInfo = '';
    try {
      var attrRespDebug = await chrome.tabs.sendMessage(tabs[0].id, { type: 'DEBUG_ATTRS' });
      if (attrRespDebug) {
        var issues = [];
        if (!attrRespDebug.attrSectionExists) issues.push('data-testid="module-attribute" 未找到');
        issues.push('关键词: ' + (attrRespDebug.foundKeyword || '无'));
        issues.push('容器数: ' + (attrRespDebug.containerCount || 0));
        if (attrRespDebug.bodyTextSample) issues.push('文本: ' + attrRespDebug.bodyTextSample.substring(0, 200));
        if (attrRespDebug.containerSample) issues.push('容器HTML: ' + attrRespDebug.containerSample.substring(0, 200));
        if (attrRespDebug.keyAttrInner) issues.push('内HTML: ' + attrRespDebug.keyAttrInner.substring(0, 500));
        if (attrRespDebug.threeCols) issues.push('3列: ' + attrRespDebug.threeCols.substring(0, 500));
        attrDebugInfo = issues.length > 0 ? issues.join('; ') : '';
      }
    } catch(e) {}

    var videoUrls = [];
    try {
      var videoResp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_VIDEOS' });
      if (videoResp && videoResp.success && videoResp.urls) {
        videoUrls = videoResp.urls;
      }
    } catch(e) {}

    var config = await chrome.storage.local.get(['erpUrl', 'apiToken']);
    var erpUrlDebug = (config.erpUrl || 'http://localhost:3001').replace(/\/$/, '');

    var apiResp = await fetch(erpUrlDebug + '/api/debug/preview', {
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
      chrome.tabs.create({ url: erpUrlDebug + '/api/debug/preview/view?dir=' + encodeURIComponent(result.data.dir), active: true });
    } else {
      showStatus(collectStatus, '❌ 生成预览失败: ' + (result.error || '未知'), 'error');
    }

  } catch (e) {
    showStatus(collectStatus, '❌ 调试失败: ' + e.message, 'error');
  }
});

// ===================================================================
//  多配置管理
// ===================================================================

/**
 * 从 storage 加载所有配置
 */
async function loadConfigs() {
  try {
    var saved = await chrome.storage.local.get(['configs', 'activeConfigId']);
    configs = saved.configs || {};

    // 尝试自动匹配当前 URL 或加载默认配置
    var matchedId = null;
    if (Object.keys(configs).length > 0) {
      matchedId = await findBestMatchingConfig();
      if (!matchedId && saved.activeConfigId && configs[saved.activeConfigId]) {
        matchedId = saved.activeConfigId;
      }
      if (!matchedId) {
        // 找默认配置
        for (var id in configs) {
          if (configs[id].isDefault) {
            matchedId = id;
            break;
          }
        }
      }
      if (!matchedId) {
        // 第一个
        var ids = Object.keys(configs);
        matchedId = ids[0];
      }
    }

    renderConfigSelector();

    if (matchedId) {
      await switchConfig(matchedId);
    }
  } catch (e) {
    console.warn('[配置] 加载配置失败:', e.message);
  }
}

/**
 * 渲染配置下拉框
 */
function renderConfigSelector() {
  if (!configSelect) return;

  var currentUrl = '';
  chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    if (tabs[0]?.url) currentUrl = tabs[0].url;
  }).catch(function(){});

  var ids = Object.keys(configs);
  if (ids.length === 0) {
    configSelect.innerHTML = '<option value="">— 无配置 —</option>';
    if (configDefaultStar) configDefaultStar.textContent = '';
    return;
  }

  configSelect.innerHTML = ids.map(function(id) {
    var cfg = configs[id];
    var label = cfg.name || id;
    var matched = currentUrl && cfg.urlPattern && currentUrl.indexOf(cfg.urlPattern.replace(/\*/g, '')) !== -1;
    var suffix = matched ? ' 🔗' : '';
    var selected = (id === activeConfigId) ? 'selected' : '';
    return '<option value="' + id + '" ' + selected + '>' + escHtml(label) + suffix + '</option>';
  }).join('');

  // 显示默认星号
  if (configDefaultStar) {
    var defaultId = null;
    for (var id in configs) {
      if (configs[id].isDefault) { defaultId = id; break; }
    }
    configDefaultStar.textContent = (defaultId === activeConfigId) ? '★' : '';
  }
}

/**
 * 切换当前配置
 */
async function switchConfig(id) {
  if (!id || !configs[id]) return;

  activeConfigId = id;
  activeConfig = configs[id];

  // 保存到 storage
  await chrome.storage.local.set({ activeConfigId: id });

  // 更新下拉选中状态
  if (configSelect) configSelect.value = id;

  // 渲染星号
  if (configDefaultStar) {
    configDefaultStar.textContent = activeConfig.isDefault ? '★' : '';
  }

  // 加载配置的容器选择器和属性
  if (activeConfig.containerSelectors && activeConfig.containerSelectors.length > 0) {
    trainingContainers = activeConfig.containerSelectors.map(function(sel, i) {
      return {
        id: 'cfg_c_' + i,
        name: '框' + (i + 1),
        selector: sel,
      };
    });
  } else {
    trainingContainers = [];
  }

  // 恢复属性数据
  if (activeConfig.attributes && activeConfig.attributes.length > 0) {
    attrResultData = activeConfig.attributes.map(function(a, i) {
      return {
        rowId: a.rowId || ('attr_' + i),
        name: a.name,
        value: a.value,
        kept: a.kept !== false,
      };
    });
  } else {
    attrResultData = [];
  }

  // 刷新属性编辑表格和容器列表
  if (attrEditStep) {
    if (activeConfig.attributeNames && activeConfig.attributeNames.length > 0) {
      attrEditStep.classList.remove('hidden');
    } else {
      attrEditStep.classList.add('hidden');
    }
  }
  renderAttrEditTable();
  renderContainerList();

  // 更新配置名称输入框
  if (configNameInput) {
    configNameInput.value = activeConfig.name || '';
  }

  console.log('[配置] 切换到:', activeConfig.name);
}

/**
 * 保存配置
 * mode: 'new' | 'update' | 'saveas'
 */
async function saveConfig(name, mode) {
  if (!name || !name.trim()) {
    showStatus(configSaveStatus, '⚠️ 请输入配置名称', 'error');
    return null;
  }
  name = name.trim();

  if (mode === 'update' && !activeConfigId) {
    showStatus(configSaveStatus, '⚠️ 没有可更新的配置', 'error');
    return null;
  }

  // 构建配置数据
  var containerSelectors = trainingContainers.map(function(c) { return c.selector; });
  var keptAttrs = attrResultData.filter(function(a) { return a.kept; });
  var attributes = attrResultData.map(function(a) {
    return { rowId: a.rowId, name: a.name, value: a.value, kept: a.kept };
  });
  var attributeNames = keptAttrs.map(function(a) { return a.name; });

  var now = Date.now();
  var newConfig = {
    id: null, // filled below
    name: name,
    urlPattern: activeConfig ? (activeConfig.urlPattern || '') : '',
    isDefault: false,
    createdAt: activeConfig ? activeConfig.createdAt : now,
    updatedAt: now,
    containerSelectors: containerSelectors,
    attributeNames: attributeNames,
    attributes: attributes,
    detailSelector: activeConfig ? (activeConfig.detailSelector || null) : null,
  };

  if (mode === 'update') {
    // 更新现有配置
    newConfig.id = activeConfigId;
    newConfig.createdAt = activeConfig.createdAt;
    newConfig.isDefault = activeConfig.isDefault;
    newConfig.urlPattern = activeConfig.urlPattern || '';
    newConfig.detailSelector = activeConfig.detailSelector || null;
    configs[activeConfigId] = newConfig;
    activeConfig = newConfig;
  } else {
    // 'new' 或 'saveas' — 创建新配置
    var newId = 'cfg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    newConfig.id = newId;
    configs[newId] = newConfig;
    activeConfigId = newId;
    activeConfig = newConfig;
  }

  // 保存到 storage
  try {
    await chrome.storage.local.set({ configs: configs, activeConfigId: activeConfigId });
    renderConfigSelector();
    if (configNameInput) configNameInput.value = name;
    showStatus(configSaveStatus, '✅ 配置已保存', 'success');
    return activeConfigId;
  } catch (e) {
    showStatus(configSaveStatus, '❌ 保存失败: ' + (e.message || '未知'), 'error');
    return null;
  }
}

/**
 * 删除配置
 */
async function deleteConfig(id) {
  if (!id || !configs[id]) return false;

  if (!confirm('确定删除配置 "' + (configs[id].name || id) + '" 吗？')) {
    return false;
  }

  delete configs[id];

  if (activeConfigId === id) {
    activeConfigId = null;
    activeConfig = null;
    trainingContainers = [];
    attrResultData = [];
    attrEditStep.classList.add('hidden');
    renderAttrEditTable();
    renderContainerList();
  }

  await chrome.storage.local.set({ configs: configs, activeConfigId: activeConfigId });
  renderConfigSelector();
  showStatus(configSaveStatus, '✅ 配置已删除', 'success');
  return true;
}

/**
 * 根据当前 URL 匹配最佳配置
 */
async function findBestMatchingConfig() {
  var currentUrl = '';
  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) currentUrl = tabs[0].url;
  } catch(e) {}

  var bestMatch = null;
  var bestScore = -1;

  for (var id in configs) {
    var cfg = configs[id];
    if (!cfg.urlPattern) continue;

    var pattern = cfg.urlPattern;
    var regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
    try {
      var re = new RegExp(regexStr);
      if (currentUrl && re.test(currentUrl)) {
        var score = cfg.isDefault ? 100 : 50;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = id;
        }
      }
    } catch(e) {}
  }

  return bestMatch;
}

// ===================================================================
//  属性配置面板
// ===================================================================

// 打开属性配置面板
attrConfigBtn.addEventListener('click', async function() {
  attrConfigPanel.classList.remove('hidden');
  renderAttrEditTable();
  renderContainerList();

  // 进入容器选择模式
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' }).catch(function(){});
  }
  // 立即拉取一次容器列表
  await refreshContainersFromStorage();

  // 启动定时轮询，检测新容器（500ms间隔，content script存tc_后自动出现）
  if (window.__containerPoll) clearInterval(window.__containerPoll);
  window.__containerPoll = setInterval(function() {
    refreshContainersFromStorage();
  }, 500);

  // 填入当前配置名称
  if (configNameInput && activeConfig) {
    configNameInput.value = activeConfig.name || '';
  }

  if (configSaveStatus) {
    configSaveStatus.textContent = '';
    configSaveStatus.className = 'status-msg';
  }
});

// 保存新配置
saveAttrConfigBtn.addEventListener('click', async function() {
  var name = configNameInput ? configNameInput.value.trim() : '';
  if (!name) {
    showStatus(configSaveStatus, '⚠️ 请输入配置名称', 'error');
    return;
  }
  await saveConfig(name, 'new');
});

// 更新配置
updateConfigBtn.addEventListener('click', async function() {
  var name = configNameInput ? configNameInput.value.trim() : '';
  if (!name) {
    showStatus(configSaveStatus, '⚠️ 请输入配置名称', 'error');
    return;
  }
  if (!activeConfigId) {
    showStatus(configSaveStatus, '⚠️ 没有可更新的配置', 'error');
    return;
  }
  await saveConfig(name, 'update');
});

// 另存为
saveAsBtn.addEventListener('click', async function() {
  var name = configNameInput ? configNameInput.value.trim() : '';
  if (!name) {
    showStatus(configSaveStatus, '⚠️ 请输入配置名称', 'error');
    return;
  }
  await saveConfig(name + ' (副本)', 'new');
});

// 配置选择器切换
if (configSelect) {
  configSelect.addEventListener('change', async function() {
    var id = this.value;
    if (id) {
      await switchConfig(id);
    }
  });
}

// 返回采集视图
// 添加返回按钮逻辑 - 从 attrConfigPanel 返回
var backFromAttrConfigBtn = document.getElementById('back-from-attr-config');
if (backFromAttrConfigBtn) {
  backFromAttrConfigBtn.addEventListener('click', function() {
    attrConfigPanel.classList.add('hidden');
    collectView.classList.remove('hidden');
    // 退出选文字模式
    exitPickTextMode();
    // 停止轮询
    if (window.__containerPoll) { clearInterval(window.__containerPoll); window.__containerPoll = null; }
  });
}

// ===================================================================
//  属性编辑表格
// ===================================================================

/**
 * 渲染属性编辑表格
 */
function renderAttrEditTable() {
  if (!attrEditTbody) return;

  if (attrResultData.length === 0) {
    attrEditTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:16px">暂无属性，点击"提取属性"或手动添加</td></tr>';
    if (attrEditStep) attrEditStep.classList.add('hidden');
    return;
  }

  if (attrEditStep) attrEditStep.classList.remove('hidden');

  var kept = attrResultData.filter(function(a) { return a.kept; }).length;
  var badge = document.getElementById('attr-count-badge');
  if (badge) badge.textContent = kept + '/' + attrResultData.length + ' 项';

  attrEditTbody.innerHTML = attrResultData.map(function(a, i) {
    var checked = a.kept ? 'checked' : '';
    var cls = a.kept ? '' : 'removed';
    var isNamePicking = (pickTextMode && pickTextMode.type === 'name' && pickTextMode.inputEl && pickTextMode.inputEl.dataset && pickTextMode.inputEl.dataset.rowid === a.rowId);
    var isValuePicking = (pickTextMode && pickTextMode.type === 'value' && pickTextMode.inputEl && pickTextMode.inputEl.dataset && pickTextMode.inputEl.dataset.rowid === a.rowId);
    var nameCls = 'attr-cell-input attr-name-input' + (isNamePicking ? ' pick-mode' : '');
    var valueCls = 'attr-cell-input attr-value-input' + (isValuePicking ? ' pick-mode' : '');

    return '<tr class="' + cls + '" data-rowid="' + a.rowId + '">' +
      '<td><input type="checkbox" class="attr-row-cb" ' + checked + ' data-rowid="' + a.rowId + '"></td>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input type="text" class="' + nameCls + '" value="' + escHtml(a.name) + '" placeholder="属性名" data-rowid="' + a.rowId + '"></td>' +
      '<td><input type="text" class="' + valueCls + '" value="' + escHtml(a.value) + '" placeholder="属性值" data-rowid="' + a.rowId + '"></td>' +
      '<td><span class="row-del" data-rowid="' + a.rowId + '">✕</span></td>' +
    '</tr>';
  }).join('');

  // 绑定 checkbox 事件
  attrEditTbody.querySelectorAll('.attr-row-cb').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var rowId = this.getAttribute('data-rowid');
      for (var j = 0; j < attrResultData.length; j++) {
        if (attrResultData[j].rowId === rowId) {
          attrResultData[j].kept = this.checked;
          break;
        }
      }
      renderAttrEditTable();
    });
  });

  // 绑定删除事件
  attrEditTbody.querySelectorAll('.row-del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var rowId = this.getAttribute('data-rowid');
      attrResultData = attrResultData.filter(function(a) { return a.rowId !== rowId; });
      renderAttrEditTable();
    });
  });

  // 绑定名称输入框事件（支持直接输入）
  attrEditTbody.querySelectorAll('.attr-name-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var rowId = this.getAttribute('data-rowid');
      for (var j = 0; j < attrResultData.length; j++) {
        if (attrResultData[j].rowId === rowId) {
          attrResultData[j].name = this.value;
          break;
        }
      }
    });
  });

  // 绑定值输入框事件（支持直接输入）
  attrEditTbody.querySelectorAll('.attr-value-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var rowId = this.getAttribute('data-rowid');
      for (var j = 0; j < attrResultData.length; j++) {
        if (attrResultData[j].rowId === rowId) {
          attrResultData[j].value = this.value;
          break;
        }
      }
    });
  });

  // 全选
  var attrSelectAll = document.getElementById('attr-select-all');
  if (attrSelectAll) {
    // 移除旧监听再添加
    var newCb = function() {
      var checked = this.checked;
      attrResultData.forEach(function(a) { a.kept = checked; });
      renderAttrEditTable();
    };
    attrSelectAll.onchange = newCb;
  }
}

/**
 * 手动添加一行属性
 */
function addManualAttrRow() {
  var newRowId = 'attr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  attrResultData.push({
    rowId: newRowId,
    name: '',
    value: '',
    kept: true,
  });
  renderAttrEditTable();

  // 聚焦到新行的名称输入框
  setTimeout(function() {
    var newInput = attrEditTbody.querySelector('.attr-name-input[data-rowid="' + newRowId + '"]');
    if (newInput) newInput.focus();
  }, 50);
}

if (addAttrBtn) {
  addAttrBtn.addEventListener('click', startPickAttrPair);
}

// ===================================================================
//  选文字模式 (Pick Text Mode) — 两阶段选择 + 撤销栈
// ===================================================================
// 用户第一次 Shift+drag → 选属性名，第二次 Shift+drag → 选属性值
// 右→左拖动 = 撤销最后一次选择（后进先出）
var pickAttrUndoStack = [];  // [{ rowId, field: 'name'|'value', prevValue }]

/**
 * 开始两阶段属性选择（新增一行后调用）
 */
function startPickAttrPair() {
  // 1. 新增空行
  addManualAttrRow();

  // 2. 找刚新增的行（最后一行）
  if (attrResultData.length === 0) return;
  var lastRow = attrResultData[attrResultData.length - 1];

  // 3. 清撤销栈
  pickAttrUndoStack = [];

  // 4. 保存当前状态到 storage（弹窗关闭后再打开可恢复）
  try {
    chrome.storage.local.set({
      pendingAttrPick: {
        rowId: lastRow.rowId,
        phase: 'name',
        attrResultData: attrResultData,
        undoStack: [],
        timestamp: Date.now()
      }
    });
  } catch(e) {}

  // 5. 进入阶段1：选属性名
  showStatus(trainStatus, '🖱️ 第一步：Shift+拖动选择属性名（左→右选，右→左取消）', 'success');
  doPickAttrText(lastRow.rowId, 'name');
}

/**
 * 执行单次文字选择，phase='name' 或 'value'
 */
function doPickAttrText(rowId, phase) {
  var row = null;
  for (var ri = 0; ri < attrResultData.length; ri++) {
    if (attrResultData[ri].rowId === rowId) { row = attrResultData[ri]; break; }
  }
  if (!row) { showStatus(trainStatus, '❌ 找不到属性行', 'error'); return; }

  // 找对应的输入框
  var inputEl = null;
  if (attrEditTbody) {
    var inputs = attrEditTbody.querySelectorAll(phase === 'name' ? '.attr-name-input' : '.attr-value-input');
    for (var ii = 0; ii < inputs.length; ii++) {
      if (inputs[ii].getAttribute('data-rowid') === rowId) {
        inputEl = inputs[ii]; break;
      }
    }
  }
  if (!inputEl) { showStatus(trainStatus, '❌ 找不到页面输入框', 'error'); return; }

  inputEl.classList.add('pick-mode');

  // 退出容器选择模式，避免 Shift 冲突
  chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    if (!tabs[0]?.id) { showStatus(trainStatus, '❌ 找不到当前页面', 'error'); return; }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});

    chrome.tabs.sendMessage(tabs[0].id, { type: 'PICK_ATTR_TEXT', phase: phase }).then(function(resp) {
      if (!resp) { showStatus(trainStatus, '❌ 无响应，请重试', 'error'); return; }

      if (resp.cancel) {
        undoLastPick();
        return;
      }

      if (resp.success && resp.text) {
        var text = resp.text;

        if (phase === 'name') {
          // 记录撤销信息
          pickAttrUndoStack.push({ rowId: rowId, field: 'name', prevValue: row.name });
          row.name = text;
          if (inputEl) { inputEl.value = text; inputEl.classList.remove('pick-mode'); inputEl.classList.add('picked'); }
          showStatus(trainStatus, '✅ 属性名已填入: ' + text.substring(0, 30) + '，下一步选择属性值', 'success');
          // 更新 storage 状态
          try { chrome.storage.local.set({ pendingAttrPick: { rowId: rowId, phase: 'value', attrResultData: attrResultData, undoStack: pickAttrUndoStack, timestamp: Date.now() } }); } catch(e){}
          // 自动进入阶段2：选属性值
          setTimeout(function() { doPickAttrText(rowId, 'value'); }, 100);
        } else {
          pickAttrUndoStack.push({ rowId: rowId, field: 'value', prevValue: row.value });
          row.value = text;
          if (inputEl) { inputEl.value = text; inputEl.classList.remove('pick-mode'); inputEl.classList.add('picked'); }
          showStatus(trainStatus, '✅ 属性值已填入: ' + text.substring(0, 30) + '，选择完成', 'success');
          // 清除 pending 状态
          try { chrome.storage.local.remove('pendingAttrPick').catch(function(){}); } catch(e){}
          try { chrome.storage.local.remove('pendingPickResult').catch(function(){}); } catch(e){}
          // 回到容器选择模式
          chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' }).catch(function(){});
        }
      }
    }).catch(function(err) {
      console.warn('[PickText] 选择失败:', err.message);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' }).catch(function(){});
    });
  });
}

/**
 * 撤销最后一次选择（后进先出）
 */
function undoLastPick() {
  if (pickAttrUndoStack.length === 0) {
    showStatus(trainStatus, '⚠️ 没有可撤销的选择', 'error');
    return;
  }
  var last = pickAttrUndoStack.pop();
  for (var ri = 0; ri < attrResultData.length; ri++) {
    if (attrResultData[ri].rowId === last.rowId) {
      attrResultData[ri][last.field] = last.prevValue;
      break;
    }
  }
  renderAttrEditTable();
  showStatus(trainStatus, '↩️ 已撤销' + (last.field === 'name' ? '属性名' : '属性值'), 'success');

  // 重新进入该阶段的选择
  chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});
      setTimeout(function() { doPickAttrText(last.rowId, last.field); }, 100);
    }
  });
}

/**
 * 退出选文字模式（清理状态）
 */
function exitPickTextMode() {
  if (pickTextMode) {
    if (pickTextMode.inputEl) {
      pickTextMode.inputEl.classList.remove('pick-mode');
    }
    pickTextMode = null;
    chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_PICK_TEXT_MODE' }).catch(function(){});
      }
    });
  }
  pickAttrUndoStack = [];
}

// ===================================================================
//  容器选择（属性训练器）
// ===================================================================

// 从 storage 重新加载容器列表（共享函数，供多处调用）
function refreshContainersFromStorage() {
  return chrome.storage.local.get(null).then(function(allItems) {
    var loaded = [];
    Object.keys(allItems).forEach(function(k) {
      if (k.startsWith('tc_') && allItems[k] && allItems[k].selector) {
        loaded.push({
          id: k,
          name: allItems[k].name || ('框' + (loaded.length + 1)),
          selector: allItems[k].selector,
        });
      }
    });
    trainingContainers = loaded;
    renderContainerList();
  }).catch(function(){});
}

// 打开容器选择模式
// 监听 storage 变化：content script 保存 tc_ 容器时自动刷新列表
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'local') {
    var hasTcChange = Object.keys(changes).some(function(k) { return k.startsWith('tc_'); });
    if (hasTcChange) {
      refreshContainersFromStorage();
    }
  }
});

// 监听页面点击选择的结果
chrome.runtime.onMessage.addListener(function(msg, sender) {
  // 消息: 选中容器
  if (msg.type === 'CONTAINER_SELECTED' && msg.selector) {
    var selStr = msg.selector.containerSelector || msg.selector;
    // 去重
    var exists = trainingContainers.some(function(c) {
      var existing = c.selector && c.selector.containerSelector ? c.selector.containerSelector : (c.selector || '');
      return existing === selStr;
    });
    if (exists) {
      showStatus(trainStatus, 'ℹ️ 此容器已在列表中，无需重复添加', 'success');
      return;
    }
    var idx = trainingContainers.length + 1;
    trainingContainers.push({ id: 'c' + Date.now(), name: '框' + idx, selector: msg.selector });
    renderContainerList();
    showStatus(trainStatus, '✅ 已添加 ' + selStr.substring(0, 40), 'success');
    return;
  }

  // 消息: 选中的文字
  if (msg.type === 'TEXT_SELECTED' && msg.text) {
    if (pickTextMode && pickTextMode.inputEl) {
      var inputEl = pickTextMode.inputEl;
      inputEl.value = msg.text;
      inputEl.classList.remove('pick-mode');

      // 更新数据
      var rowId = inputEl.getAttribute('data-rowid');
      for (var j = 0; j < attrResultData.length; j++) {
        if (attrResultData[j].rowId === rowId) {
          if (pickTextMode.type === 'name') {
            attrResultData[j].name = msg.text;
          } else {
            attrResultData[j].value = msg.text;
          }
          break;
        }
      }

      pickTextMode = null;
      showStatus(document.getElementById('attr-edit-status') || trainStatus, '✅ 已填入: ' + msg.text.substring(0, 30), 'success');
    }
    return;
  }
});

// 添加手动选择容器的入口
// 在 attrConfigPanel 显示时，"选择容器" 按钮
var startContainerSelectBtn = document.getElementById('start-container-select');
if (startContainerSelectBtn) {
  startContainerSelectBtn.addEventListener('click', async function() {
    trainActive = false;
    trainingContainers = [];

    // 从 storage 加载之前选中的容器
    try {
      var allItems = await chrome.storage.local.get(null);
      var loaded = [];
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

    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' });
      showStatus(trainStatus, trainingContainers.length > 0
        ? '✅ 已有 ' + trainingContainers.length + ' 个选中容器，可继续添加或点提取'
        : '🖱️ 按住 Shift + 点击属性容器框', 'success');
    }
  });
}

function renderContainerList() {
  if (!containerList) return;
  if (trainingContainers.length === 0) {
    containerList.innerHTML = '<div class="train-hint">还没有选中容器，点击上方按钮选择</div>';
    return;
  }
  containerList.innerHTML = trainingContainers.map(function(c, i) {
    var selStr = c.selector && c.selector.containerSelector ? c.selector.containerSelector : (c.selector || '');
    var active = c._highlighted ? ' container-item-active' : '';
    return '<div class="container-item' + active + '" data-cid="' + c.id + '"><span>#' + (i+1) + ' ' + c.name + '<br><span style="color:#9ca3af;font-size:10px">' + escHtml(selStr.substring(0, 50)) + '</span></span><span class="del-btn" data-id="' + c.id + '">✕</span></div>';
  }).join('');

  containerList.querySelectorAll('.del-btn').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      var id = this.getAttribute('data-id');
      if (id && id.startsWith('tc_')) {
        await chrome.storage.local.remove(id).catch(function(){});
      }
      try {
        var allItems = await chrome.storage.local.get(null);
        var loaded = [];
        Object.keys(allItems).forEach(function(k) {
          if (k.startsWith('tc_') && allItems[k] && allItems[k].selector) {
            loaded.push({
              id: k,
              name: allItems[k].name || ('框' + (loaded.length + 1)),
              selector: allItems[k].selector,
            });
          }
        });
        trainingContainers = loaded;
      } catch(e) {}
      renderContainerList();
      // 删除容器后刷新页面高亮状态
      chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});
          chrome.tabs.sendMessage(tabs[0].id, { type: 'ENTER_SELECT_MODE' }).catch(function(){});
        }
      }).catch(function(){});
    });
  });

  containerList.querySelectorAll('.container-item').forEach(function(item) {
    item.addEventListener('click', async function() {
      var cid = this.getAttribute('data-cid');
      var container = trainingContainers.find(function(c) { return c.id === cid; });
      if (!container) return;
      trainingContainers.forEach(function(c) { c._highlighted = false; });
      container._highlighted = true;
      renderContainerList();
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'HIGHLIGHT_CONTAINER',
          selector: container.selector
        }).catch(function(){});
      }
    });
  });
}

// 提取属性按钮（原 train-confirm-btn）
if (extractAttrsBtn) {
  extractAttrsBtn.addEventListener('click', async function() {
    if (trainingContainers.length === 0) {
      showStatus(trainStatus, '⚠️ 请至少选择一个属性容器', 'error');
      return;
    }

    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;

    await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});

    showStatus(trainStatus, '⏳ 正在提取属性...', 'loading');

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
      return { rowId: a.rowId || ('attr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)), name: a.name, value: a.value, kept: true };
    });

    renderAttrEditTable();
    showStatus(trainStatus, '✅ 已提取 ' + attrResultData.length + ' 个属性，可在下方编辑', 'success');
  });
}

// 取消容器选择
if (trainCancelBtn) {
  trainCancelBtn.addEventListener('click', async function() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXIT_SELECT_MODE' }).catch(function(){});
    }
    trainingContainers = [];
    renderContainerList();

    // 清理临时容器 storage
    try {
      var all = await chrome.storage.local.get(null);
      var removeKeys = Object.keys(all).filter(function(k) { return k.startsWith('tc_') || k === 'tc_keys'; });
      if (removeKeys.length > 0) await chrome.storage.local.remove(removeKeys);
    } catch(e) {}

    // 隐藏属性配置面板
    if (attrConfigPanel) attrConfigPanel.classList.add('hidden');
    // 停止轮询
    if (window.__containerPoll) { clearInterval(window.__containerPoll); window.__containerPoll = null; }
  });
}

// ===== 工具 =====

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg ' + (type || '');
}
