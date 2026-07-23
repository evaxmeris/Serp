/**
 * 内容脚本 - 在产品详情页运行时注入
 * 内联解析器，支持阿里国际站和 1688
 */

(function () {
  'use strict';

  console.log('[ERP采集] 内容脚本已加载');

  function detectPlatform() {
    const url = window.location.href;
    if (url.includes('alibaba.com') && (url.includes('/product-detail/') || url.includes('/product/') || url.includes('/item/'))) return 'alibaba';
    if (url.includes('1688.com') && (url.includes('/offer/') || url.includes('/item/'))) return '1688';
    return 'unknown';
  }

  // ===== 通用工具 =====
  function queryAllText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) return el.textContent.trim();
    }
    return '';
  }

  function queryAllHtml(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerHTML?.trim()) return el.innerHTML.trim();
    }
    return '';
  }

  function extractImages(imgSelectors) {
    const results = [];
    const seen = new Set();
    for (const sel of imgSelectors) {
      document.querySelectorAll(sel).forEach(img => {
        // 取最高清版本的 URL
        const src = img.getAttribute('src') || '';
        const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazyload') || img.getAttribute('data-original') || '';
        const zoomSrc = img.getAttribute('data-zoom') || img.getAttribute('data-large') || img.getAttribute('data-big') || '';
        // 优先用高清图链接
        const finalSrc = zoomSrc || dataSrc || src;
        if (!finalSrc || seen.has(finalSrc)) return;
        // 过滤占位符和 logo
        if (finalSrc.includes('placeholder') || finalSrc.includes('logo') || finalSrc.includes('icon') || finalSrc.includes('blank') || finalSrc.includes('gray')) return;
        // 过滤极小的 base64 占位图
        if (finalSrc.startsWith('data:') && finalSrc.length < 500) return;
        seen.add(finalSrc);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: finalSrc.startsWith('//') ? 'https:' + finalSrc : finalSrc,
          mimeType: finalSrc.endsWith('.png') ? 'image/png' : 'image/jpeg',
          fileName: `image_${results.length+1}.jpg`,
        });
      });
    }
    // 如果没找到任何图片，兜底：取页面上所有 >=100px 的图片
    if (results.length === 0) {
      document.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!src || seen.has(src) || img.width < 80 || img.height < 80) return;
        if (src.includes('logo') || src.includes('icon') || src.includes('placeholder')) return;
        if (src.startsWith('data:') && src.length < 500) return;
        seen.add(src);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: src.startsWith('//') ? 'https:' + src : src,
          mimeType: src.endsWith('.png') ? 'image/png' : 'image/jpeg',
          fileName: `image_${results.length+1}.jpg`,
        });
      });
    }
    return results;
  }

  // ===== 阿里国际站 =====
  function parseAlibaba() {
    console.log('[ERP采集] 解析阿里国际站页面');
    const title = queryAllText([
      '.title-main', '[data-testid="product-title"]', 'h1',
      '.product-title', '.detail-title', '[class*="title"] h1',
      'h1[class*="title"]', '[data-pl*="product-title"]',
    ]);
    console.log('[ERP采集] 标题:', title);

    const priceText = queryAllText([
      '.price-range', '[data-testid="price"]', '.product-price',
      '.price', '[class*="price"]', '[data-pl*="price"]',
      '.offer-price', '.final-price',
    ]);
    const price = parseFloat((priceText.match(/[\d.]+/) || [])[0]) || null;
    console.log('[ERP采集] 价格:', price);

    const description = queryAllHtml([
      '.detail-description', '[data-testid="description"]', '.product-description',
      '#description', '.description-content', '[class*="description"]',
      '.detail-content', '[data-pl*="description"]',
    ]);
    console.log('[ERP采集] 描述长度:', description?.length || 0);

    const images = extractImages([
      '.product-gallery img', '[data-testid="gallery"] img', '.image-thumbnail img',
      '.gallery img', '.main-img img', '[class*="gallery"] img',
      '[class*="preview"] img', '.pic-box img', '[data-role="gallery"] img',
      '.detail-hd img', '.img-list img', '.img-preview img',
      'img[class*="main"]', 'img[class*="gallery"]', 'img[class*="product"]',
    ]);
    console.log('[ERP采集] 图片数:', images.length);

    const attributes = [];
    const attrSelectors = [
      '.attributes-table tr', '[data-testid="attributes"] tr', '.product-attributes tr',
      '.attribute-list li', '.specification li', '[class*="attribute"] li',
      '.props-table tr', '.params-table tr', '[class*="spec"] li',
      // 更多阿里国际站常用选择器
      '[data-testid="product-attributes"] tr', '[data-testid="specifications"] tr',
      '.module_product_attrs tr', '.detail-attr tr', '.product-prop tr',
      '.tab-content tr', '[class*="detail"] [class*="attr"] tr',
      '[class*="property"] tr', '[class*="parameter"] tr',
      'table[class*="attr"] tr', 'table[class*="spec"] tr', 'table[class*="prop"] tr',
      'table[class*="param"] tr', 'table[class*="detail"] tr',
      // 通用 dl/dt/dd
      '.detail-item', '[class*="detail"] li', '[class*="info"] li',
    ];
    for (const sel of attrSelectors) {
      const rows = document.querySelectorAll(sel);
      if (rows.length > 0) {
        rows.forEach(row => {
          const tds = row.querySelectorAll('td, th, dt, dd, span');
          let name = '', value = '';
          if (tds.length >= 2) {
            name = tds[0].textContent?.trim()?.replace(/[：:]/g, '') || '';
            value = tds[1].textContent?.trim() || '';
          } else {
            const txt = row.textContent?.trim() || '';
            const ci = txt.indexOf('：');
            if (ci > 0) { name = txt.substring(0, ci).trim(); value = txt.substring(ci + 1).trim(); }
            const ci2 = txt.indexOf(':');
            if (!name && ci2 > 0) { name = txt.substring(0, ci2).trim(); value = txt.substring(ci2 + 1).trim(); }
          }
          if (name && value && !attributes.find(a => a.name === name)) {
            attributes.push({ name, value });
          }
        });
        if (attributes.length > 0) break;
      }
    }
    // 最后尝试：取所有带 label 的表格行
    if (attributes.length === 0) {
      document.querySelectorAll('tr, li, .item, .field').forEach(el => {
        const text = el.textContent?.trim() || '';
        const ci = text.indexOf('：');
        if (ci > 0 && ci < 30) {
          const name = text.substring(0, ci).trim();
          const value = text.substring(ci + 1).trim();
          if (name && value && value.length < 200 && !attributes.find(a => a.name === name)) {
            attributes.push({ name, value });
          }
        }
      });
    }
    console.log('[ERP采集] 属性数:', attributes.length);

    const srcId = (window.location.href.match(/_(\d+)\.html/) || [])[1] || null;
    console.log('[ERP采集] 产品ID:', srcId);

    return {
      source: 'alibaba',
      sourceUrl: window.location.href,
      sourceId: srcId,
      title: title || '(无标题)',
      price,
      currency: 'USD',
      description,
      images: images.slice(0, 20),
      attributes,
      rawData: { url: window.location.href, capturedAt: new Date().toISOString() },
    };
  }

  // ===== 1688 =====
  function parse1688() {
    console.log('[ERP采集] 解析1688页面');
    const title = queryAllText([
      '[data-tname="title"]', '.module_title h1', '.detail-title', 'h1',
      '.product-title', '[class*="title"]', '[class*="product-name"]',
    ]);
    console.log('[ERP采集] 标题:', title);

    const priceText = queryAllText([
      '.price-detail', '.detail-price', '[data-tname="price"]',
      '.price', '[class*="price"]',
    ]);
    const price = parseFloat((priceText.match(/[\d.]+/) || [])[0]) || null;
    console.log('[ERP采集] 价格:', price);

    const description = queryAllHtml([
      '#desc-layer', '.detail-content', '[data-tname="description"]',
      '.desc-content', '#description', '.description',
    ]);
    console.log('[ERP采集] 描述长度:', description?.length || 0);

    const images = extractImages([
      '.detail-gallery img', '.tab-img img', '.main-img img',
      '[data-tname="image"] img', '.gallery img', '.preview img',
      '.img-box img', 'img[class*="preview"]', 'img[class*="gallery"]',
    ]);
    console.log('[ERP采集] 图片数:', images.length);

    const attributes = [];
    const attrSelectors = [
      '.attributes-list li', '.detail-attributes li', '[data-tname="attributes"] li',
      '.spec-attr li', '.prop-list li', '[class*="attribute"] li',
    ];
    for (const sel of attrSelectors) {
      document.querySelectorAll(sel).forEach(li => {
        const spans = li.querySelectorAll('span');
        if (spans.length >= 2) {
          const name = spans[0].textContent?.replace(/[：:]/g, '').trim() || '';
          const value = spans[1].textContent?.trim() || '';
          if (name && value && !attributes.find(a => a.name === name)) attributes.push({ name, value });
        }
      });
      if (attributes.length > 0) break;
    }
    console.log('[ERP采集] 属性数:', attributes.length);

    const srcId = (window.location.href.match(/offer\/(\d+)\.html/) || [])[1] || null;

    return {
      source: '1688',
      sourceUrl: window.location.href,
      sourceId: srcId,
      title: title || '(无标题)',
      price,
      currency: 'CNY',
      description,
      images: images.slice(0, 20),
      attributes,
      rawData: { url: window.location.href, capturedAt: new Date().toISOString() },
    };
  }

  // ===== 图片处理 =====
  async function captureImageViaFetch(img) {
    try {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!src) return null;
      // 处理协议相对 URL
      const fullSrc = src.startsWith('//') ? 'https:' + src : src;
      const resp = await fetch(fullSrc, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (blob.size < 2000) return null; // 太小可能是占位图
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      const mimeType = blob.type || 'image/jpeg';
      return { data: base64, mimeType, width: w, height: h };
    } catch (e) { return null; }
  }

  async function captureImages(imageInfos) {
    const results = [];
    const seen = new Set();
    const allImgs = document.querySelectorAll('img');
    const urlSet = new Set();
    imageInfos.forEach(i => {
      const u = i.originalUrl.replace(/^https?:/, '');
      urlSet.add(u);
      urlSet.add(i.originalUrl);
    });

    for (const img of allImgs) {
      if (results.length >= 8) break;
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!src || seen.has(src) || img.width < 80) continue;
      const srcRelative = src.replace(/^https?:/, '');
      if (!urlSet.has(srcRelative) && !urlSet.has(src)) {
        if (results.length === 0) continue; // 第一张必须匹配，之后放宽
      }
      seen.add(src);
      console.log('[ERP采集] 捕获图片:', src.substring(0, 80));
      const cap = await captureImageViaFetch(img);
      if (cap) results.push({ type: results.length === 0 ? 'main' : 'gallery', ...cap, originalUrl: src, fileName: `product_${results.length+1}.jpg` });
    }
    return results;
  }

  // ===== 消息监听 =====
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_PRODUCT') {
      collectProductData()
        .then(data => sendResponse({ success: true, data }))
        .catch(err => { console.error('[ERP采集] 提取失败:', err); sendResponse({ success: false, error: err.message }); });
      return true;
    }
    if (message.type === 'EXTRACT_PREVIEW') {
      try {
        const platform = detectPlatform();
        if (platform === 'unknown') { sendResponse({ success: false }); return; }
        const data = platform === 'alibaba' ? parseAlibaba() : parse1688();
        sendResponse({ success: true, data: { title: data.title, price: data.price, currency: data.currency, imageCount: data.images.length, attrCount: data.attributes.length } });
      } catch (e) { sendResponse({ success: false, error: e.message }); }
      return false;
    }
    if (message.type === 'DEBUG_DOM') {
      try {
        debugPageDOM();
        sendResponse({ success: true });
      } catch (e) { sendResponse({ success: false, error: e.message }); }
      return false;
    }
    if (message.type === 'ENTER_SELECT_MODE') {
      enterSelectMode();
      sendResponse({ success: true });
      return false;
    }
    if (message.type === 'GET_SELECTED') {
      sendResponse({ success: true, data: getSelectedData() });
      return false;
    }
    if (message.type === 'EXIT_SELECT_MODE') {
      exitSelectMode();
      sendResponse({ success: true });
      return false;
    }
  });

  async function collectProductData() {
    const platform = detectPlatform();
    if (platform === 'unknown') throw new Error('请在阿里国际站或 1688 产品详情页使用');
    const rawData = platform === 'alibaba' ? parseAlibaba() : parse1688();
    console.log('[ERP采集] 原始数据:', { title: rawData.title, images: rawData.images.length, attrs: rawData.attributes.length });
    if (rawData.images?.length > 0) {
      console.log('[ERP采集] 开始捕获图片...');
      const captured = await captureImages(rawData.images);
      rawData.images = captured;
      rawData.imageCount = captured.length;
      console.log('[ERP采集] 捕获完成:', captured.length, '张');
    }
    return rawData;
  }

  window.__ERP_EXTENSION__ = { platform: detectPlatform(), isProductPage: detectPlatform() !== 'unknown' };
  console.log('[ERP采集] 平台:', detectPlatform());

  // ===== 选择模式 =====
  let selectModeActive = false;
  let selectedImages = new Set();
  let selectedAttrs = [];
  let selectedDescription = null;
  function enterSelectMode() {
    if (selectModeActive) return;
    selectModeActive = true;
    selectedImages = new Set();
    selectedAttrs = [];
    selectedDescription = null;

    const style = document.createElement('style');
    style.id = '__erp_style__';
    style.textContent = `
      .__erp_hover { outline: 2px solid #3b82f6 !important; outline-offset: 1px !important; cursor: crosshair !important; background: rgba(59,130,246,0.04) !important; }
      .__erp_selected { outline: 2px solid #f59e0b !important; background: rgba(245,158,11,0.12) !important; }
    `;
    document.head.appendChild(style);

    // 全局事件监听（捕获阶段，拦截所有）
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('mouseout', onHoverOut, true);
    document.addEventListener('click', onPickClick, true);

    showFloatingHint('🖱️ 点击页面上任何内容 → 自动识别类型并采集  |  点完回插件点"确认采集"');
  }

  function onHover(e) {
    const el = e.target;
    if (!el || el.closest('#__erp_hint__') || el.closest('#__erp_style__') || el.tagName === 'HTML' || el.tagName === 'BODY') return;
    // 已经选中的保持黄色，不覆盖
    if (el.classList.contains('__erp_selected')) return;
    el.classList.add('__erp_hover');
  }

  function onHoverOut(e) {
    e.target.classList.remove('__erp_hover');
  }

  function onPickClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (!el || el.closest('#__erp_hint__') || el.closest('#__erp_style__') || el.tagName === 'HTML' || el.tagName === 'BODY') return;

    el.classList.remove('__erp_hover');

    // 1. 点击的是图片
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      if (!src || el.width < 40) return;
      if (selectedImages.has(src)) { selectedImages.delete(src); el.classList.remove('__erp_selected'); }
      else { selectedImages.add(src); el.classList.remove('__erp_hover'); el.classList.add('__erp_selected'); }
      updateFloatingCount();
      return;
    }

    const text = el.textContent?.trim() || '';

    // 2. 点击的是表格 → 描述
    if (el.tagName === 'TABLE' || el.closest('table')) {
      const table = el.tagName === 'TABLE' ? el : el.closest('table');
      const tableHtml = table.outerHTML;
      if (tableHtml.length > 50) {
        if (table.classList.contains('__erp_selected')) { table.classList.remove('__erp_selected'); selectedDescription = null; }
        else { table.classList.remove('__erp_hover'); table.classList.add('__erp_selected'); selectedDescription = tableHtml; }
        updateFloatingCount();
        return;
      }
    }

    // 3. 带冒号的文本 → 属性
    if (text.length > 3 && text.length < 500) {
      const ci = text.indexOf('：') > 0 ? text.indexOf('：') : text.indexOf(':');
      if (ci > 0 && ci < 50) {
        const name = text.substring(0, ci).trim();
        const value = text.substring(ci + 1).trim();
        if (name && value && value.length < 300) {
          if (el.classList.contains('__erp_selected')) { el.classList.remove('__erp_selected'); selectedAttrs = selectedAttrs.filter(a => a.name !== name); }
          else { el.classList.remove('__erp_hover'); el.classList.add('__erp_selected'); selectedAttrs.push({ name, value }); }
          updateFloatingCount();
          return;
        }
      }
    }

    // 4. 大段文本/内容块 → 描述
    if (text.length > 20) {
      const block = el.closest('div, section, td, li, p, table, [class*="desc"], [class*="detail"], [class*="content"]') || el;
      const blockHtml = block.innerHTML?.trim() || '';
      if (blockHtml.length > 30) {
        if (block.classList.contains('__erp_selected')) { block.classList.remove('__erp_selected'); selectedDescription = null; }
        else { block.classList.remove('__erp_hover'); block.classList.add('__erp_selected'); selectedDescription = blockHtml; }
        updateFloatingCount();
        return;
      }
    }

    // 5. 其他 → 忽略
    showFloatingHint('ℹ️ 未识别到可采集内容');
    setTimeout(updateFloatingCount, 2000);
  }

  function showFloatingHint(text) {
    const existing = document.getElementById('__erp_hint__');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = '__erp_hint__';
    div.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;background:#1f2937;color:white;padding:10px 20px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);text-align:center;max-width:500px;';
    div.textContent = text;
    document.body.appendChild(div);
  }

  function updateFloatingCount() {
    const hint = document.getElementById('__erp_hint__');
    if (hint) {
      let descText = '';
      if (selectedDescription) descText = ` · ${selectedDescription.length} 字描述`;
      hint.textContent = `已选 ${selectedImages.size} 张图片 · ${selectedAttrs.length} 项属性${descText}  |  继续点击选择  |  完成后到插件点"确认采集"`;
    }
  }

  function getSelectedData() {
    // 获取已有解析数据
    const rawData = detectPlatform() === 'alibaba' ? parseAlibaba() : parse1688();
    // 用用户选择的图片覆盖
    if (selectedImages.size > 0) {
      const newImages = [];
      selectedImages.forEach(src => {
        newImages.push({
          type: newImages.length === 0 ? 'main' : 'gallery',
          originalUrl: src.startsWith('//') ? 'https:' + src : src,
          mimeType: src.endsWith('.png') ? 'image/png' : 'image/jpeg',
          fileName: `image_${newImages.length+1}.jpg`,
        });
      });
      rawData.images = newImages;
      rawData.imageCount = newImages.length;
    }
    // 用用户选择的属性覆盖
    if (selectedAttrs.length > 0) {
      rawData.attributes = selectedAttrs;
    }
    // 用用户选择的描述覆盖
    if (selectedDescription) {
      rawData.description = selectedDescription;
    }
    return rawData;
  }

  function exitSelectMode() {
    selectModeActive = false;
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('mouseout', onHoverOut, true);
    document.removeEventListener('click', onPickClick, true);
    const style = document.getElementById('__erp_style__');
    if (style) style.remove();
    const hint = document.getElementById('__erp_hint__');
    if (hint) hint.remove();
  }

  // ===== 调试工具 =====
  function debugPageDOM() {
    console.log('======== ERP 采集调试 ========');
    console.log('URL:', window.location.href);
    console.log('平台:', detectPlatform());

    // 列出所有可能包含图片的元素
    console.log('--- 页面上的 img 标签 ---');
    document.querySelectorAll('img').forEach((img, i) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (src && !src.includes('logo') && !src.includes('icon')) {
        console.log(`[${i}] w=${img.width} h=${img.height} src=${src.substring(0, 120)}`);
      }
    });

    // 列出所有可能包含属性的表格/列表
    console.log('--- 可能包含属性的元素 ---');
    const attrCandidates = 'table, .attributes, .specs, .params, .props, [class*=attr], [class*=spec], [class*=prop], [class*=param], ul, dl'.split(',').map(s => s.trim());
    attrCandidates.forEach(sel => {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        els.forEach((el, i) => {
          const text = el.textContent?.trim()?.substring(0, 100) || '';
          if (text.length > 10) console.log(`[${sel}] [${i}] ${el.className?.substring(0, 60) || ''} → "${text}"`);
        });
      }
    });

    // 列出主要文本区域
    console.log('--- 大文本块（可能包含描述） ---');
    document.querySelectorAll('div, section').forEach((el, i) => {
      const text = el.textContent?.trim() || '';
      if (text.length > 200 && text.length < 50000) {
        console.log(`[div] [${i}] class="${(el.className || '').substring(0, 80)}" text=${text.length}chars`);
      }
    });

    console.log('======== 调试结束 ========');
  }
})();
