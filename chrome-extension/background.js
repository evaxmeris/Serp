// 背景脚本 - 负责消息中转和与 ERP API 通信
// service_worker 模式下不能使用 DOM API

// 加载配置文件（可在 config.js 中修改 ERP 地址和 Token）
importScripts('config.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('ERP 采集管理插件已安装');
  console.log(`ERP 地址: ${ERP_CONFIG.erpUrl}`);
});

// 监听来自 popup 或 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'COLLECT_PRODUCT':
      handleCollect(message.data, sendResponse);
      return true;

    case 'GET_CONFIG':
      // 优先返回用户保存的配置，如果没有则用 config.js 的默认值
      chrome.storage.local.get(['erpUrl', 'apiToken']).then((result) => {
        sendResponse({
          erpUrl: result.erpUrl || ERP_CONFIG.erpUrl,
          apiToken: result.apiToken || ERP_CONFIG.apiToken,
        });
      });
      return true;

    case 'SAVE_CONFIG':
      // 通过 popup 修改的配置会覆盖 config.js 的默认值
      chrome.storage.local.set({
        erpUrl: message.erpUrl,
        apiToken: message.apiToken,
      }).then(() => {
        sendResponse({ success: true });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true;

    case 'CHECK_CONFIG':
      chrome.storage.local.get(['erpUrl', 'apiToken']).then((result) => {
        const url = result.erpUrl || ERP_CONFIG.erpUrl;
        const token = result.apiToken || ERP_CONFIG.apiToken;
        sendResponse({
          configured: !!(url && token),
          erpUrl: url,
        });
      });
      return true;

    case 'TEST_CONNECTION':
      testConnection(message.erpUrl, message.apiToken, sendResponse);
      return true;
  }
});

async function handleCollect(data, sendResponse) {
  try {
    const erpUrl = ERP_CONFIG.erpUrl;
    const apiToken = ERP_CONFIG.apiToken;

    const apiEndpoint = `${erpUrl.replace(/\/$/, '')}/api/external/collect`;

    const resp = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': apiToken,
      },
      body: JSON.stringify(data),
    });

    const result = await resp.json();

    if (resp.ok && result.success) {
      sendResponse({ success: true, data: result.data });
    } else {
      sendResponse({ success: false, error: result.message || `HTTP ${resp.status}` });
    }
  } catch (e) {
    sendResponse({ success: false, error: '网络错误: ' + (e.message || '未知') });
  }
}

async function testConnection(erpUrl, apiToken, sendResponse) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // 先测试服务器是否可达
    const healthResp = await fetch(`${erpUrl.replace(/\/$/, '')}/api/health`, {
      signal: controller.signal,
    });
    if (!healthResp.ok) {
      clearTimeout(timeout);
      sendResponse({ success: false, error: `服务器不可达 (HTTP ${healthResp.status})` });
      return;
    }
    // 再用 API Token 测试外部采集接口
    const testResp = await fetch(`${erpUrl.replace(/\/$/, '')}/api/external/collect?test=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': apiToken,
      },
      body: JSON.stringify({ source: 'test', sourceUrl: 'https://test.com/test', title: '__connection_test__' }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (testResp.status === 401) {
      sendResponse({ success: false, error: 'API Token 无效，请重新生成' });
    } else if (testResp.ok) {
      sendResponse({ success: true, status: 200 });
    } else {
      sendResponse({ success: false, error: `Token 验证失败 (HTTP ${testResp.status})` });
    }
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      sendResponse({ success: false, error: '连接超时，请检查 ERP 地址是否正确' });
    } else {
      sendResponse({ success: false, error: '无法连接到 ERP 服务器' });
    }
  }
}
