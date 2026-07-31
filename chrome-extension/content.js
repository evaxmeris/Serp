/**
 * 内容脚本 v2 - 在产品详情页运行时注入
 * 集成 ExtractionEngine v2 + 保留旧解析器作为兜底
 *
 * 新的解析器模块（通过 manifest.json 加载在 content.js 之前）:
 *   parsers/selector-registry.js
 *   parsers/jsonld-parser.js
 *   parsers/tiered-price-parser.js
 *   parsers/variant-parser.js
 *   parsers/spec-parser.js
 *   parsers/image-processor.js
 *   parsers/payload-assembler.js
 *   parsers/alibaba-v2.js
 */
(function () {
  'use strict';

  console.log('[ERP采集 v2] 内容脚本已加载');

  // ===== 平台检测 =====
  function detectPlatform() {
    var url = window.location.href;
    if (url.indexOf('alibaba.com') !== -1 && (url.indexOf('/product-detail/') !== -1 || url.indexOf('/product/') !== -1 || url.indexOf('/item/') !== -1)) return 'alibaba';
    if (url.indexOf('1688.com') !== -1 && (url.indexOf('/offer/') !== -1 || url.indexOf('/item/') !== -1)) return '1688';
    return 'unknown';
  }

  // ===== 旧版 DOM 工具（保留作为兜底） =====
  function queryAllText(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function queryAllHtml(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.innerHTML.trim()) return el.innerHTML.trim();
    }
    return '';
  }

  function extractImages(imgSelectors) {
    var results = [];
    var seen = new Set();
    for (var s = 0; s < imgSelectors.length; s++) {
      document.querySelectorAll(imgSelectors[s]).forEach(function (img) {
        var src = img.getAttribute('src') || '';
        var dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazyload') || img.getAttribute('data-original') || '';
        var zoomSrc = img.getAttribute('data-zoom') || img.getAttribute('data-large') || img.getAttribute('data-big') || '';
        var finalSrc = zoomSrc || dataSrc || src;
        if (!finalSrc || seen.has(finalSrc)) return;
        if (finalSrc.indexOf('placeholder') !== -1 || finalSrc.indexOf('logo') !== -1 || finalSrc.indexOf('icon') !== -1 || finalSrc.indexOf('blank') !== -1 || finalSrc.indexOf('gray') !== -1) return;
        if (finalSrc.indexOf('data:') === 0 && finalSrc.length < 500) return;
        seen.add(finalSrc);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: finalSrc.indexOf('//') === 0 ? 'https:' + finalSrc : finalSrc,
          mimeType: finalSrc.indexOf('.png') !== -1 ? 'image/png' : 'image/jpeg',
          fileName: 'image_' + (results.length + 1) + '.jpg',
        });
      });
    }
    if (results.length === 0) {
      document.querySelectorAll('img').forEach(function (img) {
        var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!src || seen.has(src) || img.width < 80 || img.height < 80) return;
        if (src.indexOf('logo') !== -1 || src.indexOf('icon') !== -1 || src.indexOf('placeholder') !== -1) return;
        if (src.indexOf('data:') === 0 && src.length < 500) return;
        seen.add(src);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: src.indexOf('//') === 0 ? 'https:' + src : src,
          mimeType: src.indexOf('.png') !== -1 ? 'image/png' : 'image/jpeg',
          fileName: 'image_' + (results.length + 1) + '.jpg',
        });
      });
    }
    return results;
  }

  // ===== 阿里国际站解析器（旧版，保留作为兜底） =====
  function parseAlibaba() {
    console.log('[ERP采集] 解析阿里国际站页面 (旧版兜底)');
    var title = queryAllText([
      '.title-main', '[data-testid="product-title"]', 'h1',
      '.product-title', '.detail-title', '[class*="title"] h1',
      'h1[class*="title"]', '[data-pl*="product-title"]',
    ]);

    var priceText = queryAllText([
      '.price-range', '[data-testid="price"]', '.product-price',
      '.price', '[class*="price"]', '[data-pl*="price"]',
      '.offer-price', '.final-price',
    ]);
    var price = parseFloat((priceText.match(/[\d.]+/) || [])[0]) || null;

    var description = queryAllHtml([
      '.detail-description', '[data-testid="description"]', '.product-description',
      '#description', '.description-content', '[class*="description"]',
      '.detail-content', '[data-pl*="description"]',
    ]);

    var images = extractImages([
      '.product-gallery img', '[data-testid="gallery"] img', '.image-thumbnail img',
      '.gallery img', '.main-img img', '[class*="gallery"] img',
      '[class*="preview"] img', '.pic-box img', '[data-role="gallery"] img',
      '.detail-hd img', '.img-list img', '.img-preview img',
      'img[class*="main"]', 'img[class*="gallery"]', 'img[class*="product"]',
    ]);

    var attributes = [];
    var attrSelectors = [
      '.attributes-table tr', '[data-testid="attributes"] tr', '.product-attributes tr',
      '.attribute-list li', '.specification li', '[class*="attribute"] li',
      '.props-table tr', '.params-table tr', '[class*="spec"] li',
      '[data-testid="product-attributes"] tr', '[data-testid="specifications"] tr',
      '.module_product_attrs tr', '.detail-attr tr', '.product-prop tr',
      '.tab-content tr', '[class*="detail"] [class*="attr"] tr',
      '[class*="property"] tr', '[class*="parameter"] tr',
      'table[class*="attr"] tr', 'table[class*="spec"] tr', 'table[class*="prop"] tr',
      'table[class*="param"] tr', 'table[class*="detail"] tr',
      '.detail-item', '[class*="detail"] li', '[class*="info"] li',
    ];
    for (var i = 0; i < attrSelectors.length; i++) {
      var rows = document.querySelectorAll(attrSelectors[i]);
      if (rows.length > 0) {
        rows.forEach(function (row) {
          var tds = row.querySelectorAll('td, th, dt, dd, span');
          var name = '';
          var value = '';
          if (tds.length >= 2) {
            name = tds[0].textContent.trim().replace(/[：:]/g, '');
            value = tds[1].textContent.trim();
          } else {
            var txt = row.textContent.trim();
            var ci = txt.indexOf('：');
            if (ci > 0) { name = txt.substring(0, ci).trim(); value = txt.substring(ci + 1).trim(); }
            if (!name && (ci = txt.indexOf(':')) > 0) { name = txt.substring(0, ci).trim(); value = txt.substring(ci + 1).trim(); }
          }
          if (name && value && !attributes.some(function (a) { return a.name === name; })) {
            attributes.push({ name: name, value: value });
          }
        });
        if (attributes.length > 0) break;
      }
    }
    if (attributes.length === 0) {
      document.querySelectorAll('tr, li, .item, .field').forEach(function (el) {
        var text = el.textContent.trim();
        var ci = text.indexOf('：');
        if (ci > 0 && ci < 30) {
          var n = text.substring(0, ci).trim();
          var v = text.substring(ci + 1).trim();
          if (n && v && v.length < 200 && !attributes.some(function (a) { return a.name === n; })) {
            attributes.push({ name: n, value: v });
          }
        }
      });
    }

    var srcId = (window.location.href.match(/_(a?\d+)\.html/) || [])[1] || null;

    return {
      source: 'alibaba',
      sourceUrl: window.location.href,
      sourceId: srcId,
      title: title || '(无标题)',
      price: price,
      currency: 'USD',
      description: description,
      images: images.slice(0, 20),
      attributes: attributes,
      rawData: { url: window.location.href, capturedAt: new Date().toISOString() },
    };
  }

  // ===== 1688 解析器（旧版，保留作为兜底） =====
  function parse1688() {
    console.log('[ERP采集] 解析1688页面 (旧版兜底)');
    var title = queryAllText([
      '[data-tname="title"]', '.module_title h1', '.detail-title', 'h1',
      '.product-title', '[class*="title"]', '[class*="product-name"]',
    ]);

    var priceText = queryAllText([
      '.price-detail', '.detail-price', '[data-tname="price"]',
      '.price', '[class*="price"]',
    ]);
    var price = parseFloat((priceText.match(/[\d.]+/) || [])[0]) || null;

    var description = queryAllHtml([
      '#desc-layer', '.detail-content', '[data-tname="description"]',
      '.desc-content', '#description', '.description',
    ]);

    var images = extractImages([
      '.detail-gallery img', '.tab-img img', '.main-img img',
      '[data-tname="image"] img', '.gallery img', '.preview img',
      '.img-box img', 'img[class*="preview"]', 'img[class*="gallery"]',
    ]);

    var attributes = [];
    var attrSelectors = [
      '.attributes-list li', '.detail-attributes li', '[data-tname="attributes"] li',
      '.spec-attr li', '.prop-list li', '[class*="attribute"] li',
    ];
    for (var i = 0; i < attrSelectors.length; i++) {
      document.querySelectorAll(attrSelectors[i]).forEach(function (li) {
        var spans = li.querySelectorAll('span');
        if (spans.length >= 2) {
          var name = spans[0].textContent.replace(/[：:]/g, '').trim();
          var value = spans[1].textContent.trim();
          if (name && value && !attributes.some(function (a) { return a.name === name; })) attributes.push({ name: name, value: value });
        }
      });
      if (attributes.length > 0) break;
    }

    var srcId = (window.location.href.match(/offer\/(\d+)\.html/) || [])[1] || null;

    return {
      source: '1688',
      sourceUrl: window.location.href,
      sourceId: srcId,
      title: title || '(无标题)',
      price: price,
      currency: 'CNY',
      description: description,
      images: images.slice(0, 20),
      attributes: attributes,
      rawData: { url: window.location.href, capturedAt: new Date().toISOString() },
    };
  }

  // ===== 图片捕获 =====
  async function captureImageViaFetch(img) {
    try {
      var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!src) return null;
      var fullSrc = src.indexOf('//') === 0 ? 'https:' + src : src;
      var resp = await fetch(fullSrc, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      var blob = await resp.blob();
      if (blob.size < 2000) return null;
      var base64 = await new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onloadend = function () { resolve(reader.result.split(',')[1]); };
        reader.readAsDataURL(blob);
      });
      var w = img.naturalWidth || img.width || 0;
      var h = img.naturalHeight || img.height || 0;
      var mimeType = blob.type || 'image/jpeg';
      return { data: base64, mimeType: mimeType, width: w, height: h };
    } catch (e) { return null; }
  }

  async function captureImages(imageInfos) {
    var results = [];
    var seen = new Set();

    for (var i = 0; i < imageInfos.length; i++) {
      if (results.length >= 8) break;
      var info = imageInfos[i];
      var url = info.originalUrl || info.url || '';
      if (!url || seen.has(url)) continue;
      seen.add(url);

      console.log('[ERP采集] 捕获图片:', url.substring(0, 80));

      // 方法1: fetch 下载
      var cap = await captureImageViaFetchUrl(url);
      if (cap) {
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          data: cap.data,
          mimeType: cap.mimeType || info.mimeType || 'image/jpeg',
          width: cap.width || info.width || 0,
          height: cap.height || info.height || 0,
          originalUrl: url,
          fileName: info.fileName || 'product_' + (i + 1) + '.jpg',
        });
        continue;
      }

      // 方法2: canvas 兜底（从 DOM 中找对应 img 元素）
      var domImg = document.querySelector('img[src*="' + url.split('/').pop().substring(0, 20) + '"]');
      if (!domImg) domImg = document.querySelector('img[data-src*="' + url.substring(0, 40) + '"]');
      if (!domImg) continue;

      var canvasCap = await captureImageViaCanvas(domImg);
      if (canvasCap) {
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          data: canvasCap.data,
          mimeType: canvasCap.mimeType || 'image/jpeg',
          width: canvasCap.width || domImg.naturalWidth || 0,
          height: canvasCap.height || domImg.naturalHeight || 0,
          originalUrl: url,
          fileName: 'product_' + (i + 1) + '.jpg',
        });
      }
    }
    return results;
  }

  async function captureImageViaFetchUrl(url) {
    try {
      var fullUrl = url.indexOf('//') === 0 ? 'https:' + url : url;
      var resp = await fetch(fullUrl, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      var blob = await resp.blob();
      if (blob.size < 2000) return null;
      var base64 = await new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onloadend = function () { resolve(reader.result.split(',')[1]); };
        reader.readAsDataURL(blob);
      });
      return { data: base64, mimeType: blob.type, width: 0, height: 0 };
    } catch (e) { return null; }
  }

  /** canvas 兜底下载（fetch 失败时使用） */
  async function captureImageViaCanvas(imgElement) {
    if (!imgElement) return null;
    if (!imgElement.complete || imgElement.naturalWidth === 0) {
      await new Promise(function (resolve) {
        imgElement.onload = resolve;
        imgElement.onerror = resolve;
        setTimeout(resolve, 3000);
      });
    }
    var w = imgElement.naturalWidth || imgElement.width || 800;
    var h = imgElement.naturalHeight || imgElement.height || 800;
    if (w < 80 || h < 80) return null;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imgElement, 0, 0, w, h);
    var mimeType = 'image/jpeg';
    if (imgElement.src.indexOf('.png') !== -1) mimeType = 'image/png';
    var dataUrl = canvas.toDataURL(mimeType, 0.85);
    var base64 = dataUrl.split(',')[1];
    return { data: base64, mimeType: mimeType, width: w, height: h };
  }

  /** 单张图片捕获（由 CAPTURE_IMAGE 消息触发） */
  async function captureSingleImage(imageInfo) {
    var url = imageInfo.originalUrl || imageInfo.url || '';
    if (!url) throw new Error('No image URL');
    if (url.indexOf('//') === 0) url = 'https:' + url;

    var resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    var blob = await resp.blob();
    if (blob.size < 2000) throw new Error('Image too small');

    var base64 = await new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result.split(',')[1]); };
      reader.readAsDataURL(blob);
    });

    return {
      data: base64,
      mimeType: blob.type || 'image/jpeg',
      width: imageInfo.width || 0,
      height: imageInfo.height || 0,
    };
  }

  // ===== V2 引擎集成 =====
  var v2Available = !!(window.__ERP_PARSERS__ && window.__ERP_PARSERS__.AlibabaV2Engine);

  /** 根据可用引擎收集产品数据 */
  async function collectProductDataV2() {
    var platform = detectPlatform();
    if (platform === 'unknown') throw new Error('请在阿里国际站或 1688 产品详情页使用');

    // 优先使用 v2 引擎，失败时回退到旧版
    if (v2Available) {
      try {
        console.log('[ERP采集] 使用 v2 提取引擎');
        var fullData = window.__ERP_PARSERS__.AlibabaV2Engine.extractFullProduct(platform);
        console.log('[ERP采集 v2] 提取完成:', {
          title: fullData.title,
          images: fullData.images?.length,
          attrs: fullData.attributes?.length,
          variants: fullData.variants?.length,
        });
        // 如果属性为空，从页面直接提取
        if (!fullData.attributes || fullData.attributes.length === 0) {
          try {
            var attrRows = document.querySelectorAll('[data-testid="three-column-key-attributes-row"]');
            if (attrRows.length > 0) {
              fullData.attributes = [];
              attrRows.forEach(function(r) {
                var divs = r.querySelectorAll(':scope > div');
                if (divs.length >= 2) {
                  var nm = divs[0].textContent.trim();
                  var vl = divs[1].textContent.trim();
                  if (nm && vl && nm.length < 100) fullData.attributes.push({ name: nm, value: vl, unit: null });
                }
              });
              console.log('[ERP采集] 内联属性提取:', fullData.attributes.length);
            }
          } catch(e) { console.warn('[ERP采集] 内联属性失败:', e); }
        }
        // 下载图片
        if (fullData.images && fullData.images.length > 0) {
          var imageProcessor = window.__ERP_PARSERS__.ImageProcessor;
          var downloaded = await imageProcessor.downloadImages(fullData.images, function (progress) {
            console.log('[ERP采集 v2] 图片进度:', progress.current + '/' + progress.total);
          });
          fullData.images = downloaded;
        }
        
    // 图片下载完后再试一次属性提取
        if (!fullData.attributes || fullData.attributes.length === 0) {
          try {
            // 轮询等待属性行出现（最多等 5 秒）
            var attrRows = [];
            for (var wi = 0; wi < 10; wi++) {
              attrRows = document.querySelectorAll('[data-testid="three-column-key-attributes-row"]');
              if (attrRows.length === 0) {
                // 备用：从 innerHTML 中查找 row 结构
                var ka = document.querySelector('[data-testid="three-column-key-attributes"]');
                if (ka) {
                  attrRows = ka.querySelectorAll('[class*="flex"][class*="gap"]');
                }
              }
              if (attrRows.length > 0) break;
              await new Promise(function(r) { setTimeout(r, 500); });
            }
            // 如果还没找到，从 innerHTML 文本直接解析
            if (attrRows.length === 0) {
              var ka = document.querySelector('[data-testid="three-column-key-attributes"]');
              if (ka) {
                var html = ka.innerHTML;
                // 取 <p> 标签内容作为属性名和值
                var pTags = ka.querySelectorAll('p');
                var tempAttrs = [];
                pTags.forEach(function(p) {
                  tempAttrs.push(p.textContent.trim());
                });
                // 成对提取（名字、值交替出现）
                for (var pi = 0; pi < tempAttrs.length - 1; pi += 2) {
                  if (tempAttrs[pi] && tempAttrs[pi+1] && tempAttrs[pi].length < 60) {
                    fullData.attributes = fullData.attributes || [];
                    fullData.attributes.push({ name: tempAttrs[pi], value: tempAttrs[pi+1], unit: null });
                  }
                }
              }
            } else {
              fullData.attributes = [];
              attrRows.forEach(function(r) {
                var divs = r.querySelectorAll(':scope > div');
                if (divs.length >= 2) {
                  var nm = divs[0].textContent.replace(/[：:]/g,'').trim();
                  var vl = divs[1].textContent.replace(/[：:]/g,'').trim();
                  if (nm && vl && nm.length < 100) fullData.attributes.push({ name: nm, value: vl, unit: null });
                }
              });
            }
            console.log('[ERP采集] 图片后属性提取:', fullData.attributes?.length || 0);
          } catch(e) { console.warn('[ERP采集] 属性提取失败:', e); }
        }
        
        return fullData;
      } catch (e) {
        console.warn('[ERP采集] v2 引擎失败，回退到旧版:', e.message);
      }
    }

    // 旧版兜底
    console.log('[ERP采集] 使用旧版提取引擎');
    var rawData = platform === 'alibaba' ? parseAlibaba() : parse1688();
    if (rawData.images && rawData.images.length > 0) {
      var captured = await captureImages(rawData.images);
      rawData.images = captured;
      rawData.imageCount = captured.length;
    }
    return rawData;
  }

  /** 收集产品数据（旧版兼容入口） */
  async function collectProductData() {
    return collectProductDataV2();
  }

  // ===== 预览提取 =====
  function extractPreviewData() {
    var platform = detectPlatform();
    if (platform === 'unknown') return { success: false };

    if (v2Available) {
      try {
        var preview = window.__ERP_PARSERS__.AlibabaV2Engine.extractPreview(platform);
        return { success: true, data: preview };
      } catch (e) {
        console.warn('[ERP采集] v2 preview 失败:', e.message);
      }
    }

    // 旧版兜底
    var data = platform === 'alibaba' ? parseAlibaba() : parse1688();
    return {
      success: true,
      data: {
        title: data.title,
        price: data.price,
        currency: data.currency,
        imageCount: data.images.length,
        attrCount: data.attributes.length,
        variantCount: 0,
      },
    };
  }

  /** 深层预览提取（含变体数） */
  async function extractDeepPreviewData() {
    var platform = detectPlatform();
    if (platform === 'unknown') return { success: false };

    if (v2Available) {
      try {
        var deepPreview = window.__ERP_PARSERS__.AlibabaV2Engine.extractDeepPreview(platform);
        return { success: true, data: deepPreview };
      } catch (e) {
        console.warn('[ERP采集] v2 deep preview 失败:', e.message);
      }
    }

    // 旧版兜底：只返回基础预览
    var data = platform === 'alibaba' ? parseAlibaba() : parse1688();
    return {
      success: true,
      data: {
        title: data.title,
        price: data.price,
        currency: data.currency,
        imageCount: data.images.length,
        attrCount: data.attributes.length,
        variantCount: 0,
      },
    };
  }

  // ===== 消息监听 =====
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    // V2: 完整提取（含图片下载）
    if (message.type === 'EXTRACT_PRODUCT_V2') {
      collectProductDataV2()
        .then(function (data) { sendResponse({ success: true, data: data }); })
        .catch(function (err) { console.error('[ERP采集] v2提取失败:', err); sendResponse({ success: false, error: err.message }); });
      return true;
    }

    // V1 兼容：完整提取
    if (message.type === 'EXTRACT_PRODUCT') {
      collectProductData()
        .then(function (data) { sendResponse({ success: true, data: data }); })
        .catch(function (err) { console.error('[ERP采集] 提取失败:', err); sendResponse({ success: false, error: err.message }); });
      return true;
    }

    // 预览提取
    if (message.type === 'EXTRACT_PREVIEW') {
      var result = extractPreviewData();
      sendResponse(result);
      return false;
    }

    // 深层预览（含变体数）
    if (message.type === 'EXTRACT_DEEP_PREVIEW') {
      extractDeepPreviewData()
        .then(function (r) { sendResponse(r); })
        .catch(function (e) { sendResponse({ success: false, error: e.message }); });
      return true;
    }

    // 提取视频链接
    if (message.type === 'EXTRACT_VIDEOS') {
      var videos = [];
      
      // 从页面所有 script 标签中查找视频 URL
      try {
        var scripts = document.querySelectorAll('script');
        for (var si = 0; si < scripts.length; si++) {
          var text = scripts[si].textContent || '';
          // 查找 videoUrl 字段值
          var vu = text.match(/videoUrl["']?\s*[:=]\s*["']([^"']+)["']/i);
          if (vu) videos.push(vu[1]);
          // 查找 mediaVOs 中的视频
          var mv = text.match(/mediaVOs\s*[:=]\s*(\[[^\]]+\])/);
          if (mv) {
            try {
              JSON.parse(mv[1]).forEach(function(m) {
                if (m.mediaType === 'video' || m.type === 'video') {
                  if (m.url) videos.push(m.url);
                  if (m.videoUrl) videos.push(m.videoUrl);
                }
              });
            } catch(e) {}
          }
          // 查找 mp4 链接
          var mp4 = text.match(/"https?:[^"]+\.mp4[^"]*"/gi);
          if (mp4) mp4.forEach(function(m) { videos.push(m.replace(/^"|"$/g, '')); });
        }
      } catch(e) {}
      
      // 只取第一个视频，不管多少个
      var first = videos.length > 0 ? videos[0] : '';
      
      console.log('[ERP采集] 视频:', first ? first.substring(0,80) : '无');
      sendResponse({ success: true, urls: first ? [first] : [] });
      return false;
    }

    // 调试：检查属性区
    if (message.type === 'DEBUG_ATTRS') {
      var sec = document.querySelector('[data-testid="module-attribute"], .module_attribute');
      var body = (document.body.textContent || '');
      
      // 找所有可能含属性的容器
      var containers = document.querySelectorAll('[class*="attribute"], [class*="specification"], [class*="property"], [class*="key-attr"], [data-testid*="attribute"], [data-testid*="spec"], [class*="product-attr"], [class*="detail-attr"]');
      var containerHTML = [];
      containers.forEach(function(el) { containerHTML.push(el.outerHTML.substring(0, 300)); });
      
      // 关键词搜索
      var keywords = ['Key Attributes', 'Specifications', 'Product Details', 'Attributes', '属性', '规格'];
      var foundKeyword = '';
      var sampleStart = 0;
      for (var ki = 0; ki < keywords.length; ki++) {
        var pos = body.indexOf(keywords[ki]);
        if (pos >= 0) { foundKeyword = keywords[ki]; sampleStart = pos; break; }
      }
      var sample = foundKeyword ? body.substring(sampleStart, sampleStart + 400) : body.substring(3000, 4000);
      
      // 额外抓取：页面上所有 grid/grid-cols 结构
      var grids = [];
      document.querySelectorAll('[class*="grid"]').forEach(function(el) {
        var text = el.textContent.trim();
        if (text.length > 20 && text.length < 2000 && /(skin|type|material|weight|size|color|feature|ingredient)/i.test(text)) {
          grids.push(el.outerHTML.substring(0, 500));
        }
      });
      
      // 额外：直接抓取 module_3_tab_key_attribute 的内部结构
      var keyAttrInner = '';
      try {
        var ka = document.querySelector('.module_3_tab_key_attribute, [data-module-name*="key_attribute"]');
        if (ka) keyAttrInner = ka.innerHTML.substring(0, 5000);
      } catch(e) { keyAttrInner = 'ERROR: ' + e.message; }

      // 所有 data-testid 包含 three 的元素
      var threeColStr = '';
      try {
        document.querySelectorAll('[data-testid*="three"]').forEach(function(el) {
          threeColStr += (el.getAttribute('data-testid') || '') + '|' + el.innerHTML.substring(0, 200).replace(/</g, '&lt;') + '\n---\n';
        });
      } catch(e) { threeColStr = 'ERROR: ' + e.message; }
      
      sendResponse({
        attrSectionHtml: sec ? sec.innerHTML.substring(0, 800) : 'NOT FOUND',
        attrSectionExists: !!sec,
        bodyTextSample: sample,
        foundKeyword: foundKeyword || 'none',
        bodyLength: body.length,
        containerCount: containers.length,
        containerSample: containerHTML.slice(0, 3).join('\n---\n'),
        gridCount: grids.length,
        gridSample: grids.slice(0, 2).join('\n---\n'),
        keyAttrInner: keyAttrInner,
        threeCols: threeColStr,
      });
      return false;
    }

    // 训练模式：进入选择器选择状态
    if (message.type === 'TRAIN_START') {
      startTrainMode(sendResponse);
      return true;
    }
    if (message.type === 'TRAIN_STOP') {
      stopTrainMode();
      sendResponse({ success: true });
      return false;
    }

    // 保存训练好的选择器
    if (message.type === 'SAVE_TRAINED_SELECTOR') {
      chrome.storage.local.set({ 'trainedSelector': message.selector }, function() {
        sendResponse({ success: true });
      });
      return true;
    }

    // 设置训练好的选择器到当前页面
    if (message.type === 'SET_TRAINED_SELECTOR') {
      window.__trainedAttrSelector = message.selector;
      sendResponse({ success: true });
      return false;
    }

    // 设置训练好的属性提取模式（容器选择器 + 属性名白名单）
    if (message.type === 'SET_TRAINED_PATTERN') {
      if (message.pattern) {
        window.__trainedAttrPattern = message.pattern;
        // 向前兼容旧的 trainedAttrSelector
        if (message.pattern.containerSelectors && message.pattern.containerSelectors.length > 0) {
          window.__trainedAttrSelector = message.pattern.containerSelectors[0];
        }
      }
      sendResponse({ success: true });
      return false;
    }

    // 获取训练模式
    if (message.type === 'GET_TRAINED_PATTERN') {
      sendResponse({ success: true, pattern: window.__trainedAttrPattern || null });
      return false;
    }

    // 高亮页面上的容器元素（属性训练器点击容器列表时）
    if (message.type === 'HIGHLIGHT_CONTAINER') {
      try {
        // 清除之前的旧高亮
        var oldHighlights = document.querySelectorAll('.__erp_container_highlight');
        oldHighlights.forEach(function(el) { el.classList.remove('__erp_container_highlight'); });
        var oldLabel = document.getElementById('__erp_highlight_label');
        if (oldLabel) oldLabel.remove();

        var selStr = message.selector && message.selector.containerSelector ? message.selector.containerSelector : (message.selector || '');
        if (!selStr) { sendResponse({ success: false, error: 'no selector' }); return false; }

        // 确保高亮样式存在（独立于选择模式）
        if (!document.getElementById('__erp_container_hl_style')) {
          var hlStyle = document.createElement('style');
          hlStyle.id = '__erp_container_hl_style';
          hlStyle.textContent = '.__erp_container_highlight{outline:3px solid #6366f1!important;outline-offset:3px!important;background:rgba(99,102,241,0.08)!important;box-shadow:0 0 20px rgba(99,102,241,0.3)!important}';
          document.head.appendChild(hlStyle);
        }

        var target = document.querySelector(selStr);
        if (!target) { sendResponse({ success: false, error: 'element not found: ' + selStr.substring(0,60) }); return false; }

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('__erp_container_highlight');

        // 添加浮动标签
        var label = document.createElement('div');
        label.id = '__erp_highlight_label';
        label.textContent = '🔍 容器 #' + (message.index != null ? (message.index + 1) : '');
        label.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999999;background:#6366f1;color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;';
        document.body.appendChild(label);

        // 自动清除高亮
        setTimeout(function() {
          target.classList.remove('__erp_container_highlight');
          var lbl = document.getElementById('__erp_highlight_label');
          if (lbl) lbl.remove();
        }, 5000);

        sendResponse({ success: true });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
      return false;
    }

    // 获取训练结果
    if (message.type === 'GET_TRAINED_SELECTOR') {
      sendResponse(getTrainedSelector());
      return false;
    }

    // 从指定容器提取属性列表 (属性训练器第二步)
    if (message.type === 'EXTRACT_ATTRS_FROM_CONTAINERS') {
      try {
        var selectors = message.selectors || [];
        var allAttrs = [];
        var seenNames = {};

        selectors.forEach(function(selItem) {
          try {
            var selStr = (typeof selItem === 'string') ? selItem : (selItem.containerSelector || '');
            if (!selStr) return;
            var containers = document.querySelectorAll(selStr);
            containers.forEach(function(c) {
              // === 策略A: 三列布局行结构（最优先） ===
              // 容器内找行: data-testid 含 row 的子元素
              var rows = c.querySelectorAll('[data-testid$="row"], [data-testid*="-row"], [class*="row"], :scope > div');
              var hasRowStructure = false;
              rows.forEach(function(r) {
                // 检查行内是否有两个子div（name + value）
                var cells = r.querySelectorAll(':scope > div');
                if (cells.length >= 2) {
                  hasRowStructure = true;
                  var nm = cells[0].textContent.replace(/[：:]/g,'').trim();
                  var vl = cells[1].textContent.replace(/[：:]/g,'').trim();
                  if (nm && vl && nm.length < 100 && !seenNames[nm] && vl.length < 500) {
                    seenNames[nm] = true;
                    allAttrs.push({ name: nm, value: vl, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                  }
                }
              });
              if (hasRowStructure) return;

              // === 策略B: <p> 标签成对 ===
              var pTags = c.querySelectorAll('p');
              if (pTags.length >= 2) {
                var texts = [];
                pTags.forEach(function(p) { texts.push(p.textContent.trim()); });
                for (var pi = 0; pi < texts.length - 1; pi += 2) {
                  if (texts[pi] && texts[pi+1] && texts[pi].length < 80 && !seenNames[texts[pi]]) {
                    seenNames[texts[pi]] = true;
                    allAttrs.push({ name: texts[pi], value: texts[pi+1], rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                  }
                }
                return;
              }

              // === 策略C: :scope > div 成对（后备） ===
              var childDivs = c.querySelectorAll(':scope > div');
              if (childDivs.length >= 2) {
                for (var di = 0; di < childDivs.length - 1; di += 2) {
                  var nm = childDivs[di].textContent.replace(/[：:]/g,'').trim();
                  var vl = childDivs[di+1].textContent.replace(/[：:]/g,'').trim();
                  if (nm && vl && nm.length < 100 && !seenNames[nm]) {
                    seenNames[nm] = true;
                    allAttrs.push({ name: nm, value: vl, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                  }
                }
                return;
              }

              // === 策略D: 文本找冒号 ===
              var allText = c.textContent.trim();
              var lines = allText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
              for (var li2 = 0; li2 < lines.length; li2++) {
                var colonIdx = lines[li2].indexOf(':');
                if (colonIdx > 0 && colonIdx < 50) {
                  var nm3 = lines[li2].substring(0, colonIdx).trim();
                  var vl3 = lines[li2].substring(colonIdx + 1).trim();
                  if (nm3 && vl3 && !seenNames[nm3]) {
                    seenNames[nm3] = true;
                    allAttrs.push({ name: nm3, value: vl3, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                  }
                }
              }
            });
          } catch(e) { /* 单个选择器失败不影响其他 */ }
        });

        sendResponse({ success: true, data: { attributes: allAttrs, containerCount: selectors.length, totalAttrs: allAttrs.length } });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
      return false;
    }

    // 单张图片下载（逐张进度）
    if (message.type === 'CAPTURE_IMAGE') {
      captureSingleImage(message.imageInfo)
        .then(function (data) { sendResponse({ success: true, data: data }); })
        .catch(function (err) { sendResponse({ success: false, error: err.message }); });
      return true;
    }

    // 调试
    if (message.type === 'DEBUG_DOM') {
      try {
        debugPageDOM();
        sendResponse({ success: true });
      } catch (e) { sendResponse({ success: false, error: e.message }); }
      return false;
    }

    // 选择模式
    if (message.type === 'ENTER_SELECT_MODE') {
      enterSelectMode();
      sendResponse({ success: true });
      return false;
    }
    if (message.type === 'GET_SELECTED') {
      try {
        var selData = getSelectedData();
        sendResponse({ success: true, data: selData, selector: typeof selectedSelector !== 'undefined' ? selectedSelector : null });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
      return false;
    }
    if (message.type === 'EXIT_SELECT_MODE') {
      exitSelectMode();
      sendResponse({ success: true });
      return false;
    }

    // TOGGLE_PANEL: show/hide in-page floating panel (replaces popup)
    if (message.type === 'TOGGLE_PANEL') {
      togglePanel();
      sendResponse({ success: true, panelActive: !!window.__panelActive });
      return false;
    }
  });

  window.__ERP_EXTENSION__ = { platform: detectPlatform(), isProductPage: detectPlatform() !== 'unknown', v2Available: v2Available };
  console.log('[ERP采集 v2] 平台:', detectPlatform(), 'v2引擎:', v2Available ? '✅ 可用' : '❌ 不可用');

  // 在页面右下角注入一个浮动触发按钮
  (function injectToggleButton() {
    var btn = document.createElement('div');
    btn.id = '__erp_toggle_btn';
    btn.textContent = '📦';
    btn.title = '打开 ERP 采集面板';
    btn.style.cssText = 'position:fixed !important;bottom:20px !important;right:20px !important;z-index:2147483646 !important;width:48px !important;height:48px !important;border-radius:50% !important;background:#6366f1 !important;color:#fff !important;font-size:22px !important;display:flex !important;align-items:center !important;justify-content:center !important;cursor:pointer !important;box-shadow:0 4px 12px rgba(99,102,241,0.4) !important;border:none !important;transition:transform 0.2s !important;';
    btn.onmouseover = function() { this.style.transform = 'scale(1.1)'; };
    btn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    btn.onclick = function() { togglePanel(); };
    setTimeout(function() { document.body.appendChild(btn); }, 1000);
    console.log('[ERP采集] 浮动按钮已注入');
  })();

  // ===== 选择模式（不变） =====
  var selectModeActive = false;
  var selectedImages = new Set();
  var selectedAttrs = [];
  var selectedDescription = null;
  var selectedSelector = null;

  function enterSelectMode() {
    if (selectModeActive) {
      // 重新触发：先清理旧的，再重建
      exitSelectMode();
    }
    selectModeActive = true;
    selectedImages = new Set();
    selectedAttrs = [];
    selectedDescription = null;

    var style = document.createElement('style');
    style.id = '__erp_style__';
    style.textContent = '\n      .__erp_hover { outline: 2px solid #3b82f6 !important; outline-offset: 1px !important; cursor: crosshair !important; background: rgba(59,130,246,0.04) !important; }\n      .__erp_selected { outline: 2px solid #f59e0b !important; background: rgba(245,158,11,0.12) !important; }\n      body { user-select: none !important; -webkit-user-select: none !important; }\n    ';
    document.head.appendChild(style);
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('mouseout', onHoverOut, true);
    document.addEventListener('click', onPickClick, true);
    document.addEventListener('selectstart', preventSelection, true);
    // 更新选容器按钮状态
    var btn = document.getElementById('__erp_select_mode_btn');
    if (btn) { btn.textContent = '✅ 选容器中'; btn.style.background = '#fef3c7'; btn.style.color = '#92400e'; }
  }

  function preventSelection(e) {
    e.preventDefault();
  }

  function onHover(e) {
    var el = e.target;
    if (!el || el.closest('#__erp_hint__') || el.closest('#__erp_style__') || el.tagName === 'HTML' || el.tagName === 'BODY') return;
    if (el.classList.contains('__erp_selected')) return;
    el.classList.add('__erp_hover');
  }

  function onHoverOut(e) {
    e.target.classList.remove('__erp_hover');
  }

  function onPickClick(e) {
    console.log('[B类训练] onPickClick fired shiftKey=', e.shiftKey, 'pairTrainMode=', __pairTrainMode, 'selectModeActive=', selectModeActive, 'target=', e.target.tagName, (e.target.className || '').toString().slice(0, 40));
    // *** BUG FIX: B类训练期间，onPickClick 不处理任何点击，由 __trainClick 负责 ***
    if (__pairTrainMode) {
      console.log('[B类训练] onPickClick DELEGATED — B类训练由 __trainClick 处理');
      return;
    }
    var el = e.target;
    // 跳过面板内点击（用 contains 比 closest 更可靠）
    var panelEl = document.getElementById('__erp_floating_panel');
    if (!el || panelEl?.contains(el) || el.closest('#__erp_hint__') || el.closest('#__erp_style__') || el.tagName === 'HTML' || el.tagName === 'BODY') {
      console.log('[B类训练] GUARD EXIT', {noEl: !el, inPanel: panelEl?.contains(el), inHint: el?.closest('#__erp_hint__'), inStyle: el?.closest('#__erp_style__'), isHtmlBody: el?.tagName === 'HTML' || el?.tagName === 'BODY'});
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    el.classList.remove('__erp_hover');

    // 如果按住 Shift 键点击，标记为属性容器
    if (e.shiftKey) {
      console.log('[B类训练] shiftKey=true, pairTrainMode=', __pairTrainMode);
      // 配对训练模式：Shift+click 选容器做名/值
      if (__pairTrainMode) {
        console.log('[B类训练] calling handlePairTrainClick');
        handlePairTrainClick(el);
        return;
      }
      // 正常容器选择
      var container = el.closest('[data-testid="three-column-key-attributes"], [data-module-name*="key_attribute"], .module_3_tab_key_attribute, [class*="attribute"], [class*="specification"]') || el;
      var sel = getElementSelector(container);
      var entry = { containerSelector: sel, nameIndex: 0, valueIndex: 1 };
      selectedSelector = entry;
      document.querySelectorAll('.__erp_selected').forEach(function(s) { s.classList.remove('__erp_selected'); });
      document.querySelectorAll('.__erp_container_highlight').forEach(function(s) { s.classList.remove('__erp_container_highlight'); });
      container.classList.add('__erp_selected');
      container.style.outline = '3px solid #9ca3af';
      container.style.outlineOffset = '2px';
      // 保存到 storage（弹窗关闭后再打开也能读到）
      try {
        var saveKey = 'tc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        var saveData = {};
        saveData[saveKey] = { selector: entry, name: '框' + Date.now(), createdAt: Date.now() };
        chrome.storage.local.set(saveData);
        console.log('[采集] 保存容器:', saveKey, sel);
      } catch(e) {}
      showFloatingHint('✅ 已选中属性容器');
      // 刷新面板容器列表
      if (typeof renderPanelContainers === 'function') renderPanelContainers();
      return;
    }

    if (el.tagName === 'IMG') {
      var src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      if (!src || el.width < 40) return;
      if (selectedImages.has(src)) { selectedImages.delete(src); el.classList.remove('__erp_selected'); }
      else { selectedImages.add(src); el.classList.remove('__erp_hover'); el.classList.add('__erp_selected'); }
      updateFloatingCount();
      return;
    }

    var text = el.textContent.trim();

    if (el.tagName === 'TABLE' || el.closest('table')) {
      var table = el.tagName === 'TABLE' ? el : el.closest('table');
      var tableHtml = table.outerHTML;
      if (tableHtml.length > 50) {
        if (table.classList.contains('__erp_selected')) { table.classList.remove('__erp_selected'); selectedDescription = null; }
        else { table.classList.remove('__erp_hover'); table.classList.add('__erp_selected'); selectedDescription = tableHtml; }
        updateFloatingCount();
        return;
      }
    }

    if (text.length > 3 && text.length < 500) {
      var ci = text.indexOf('：') > 0 ? text.indexOf('：') : text.indexOf(':');
      if (ci > 0 && ci < 50) {
        var name = text.substring(0, ci).trim();
        var value = text.substring(ci + 1).trim();
        if (name && value && value.length < 300) {
          if (el.classList.contains('__erp_selected')) { el.classList.remove('__erp_selected'); selectedAttrs = selectedAttrs.filter(function (a) { return a.name !== name; }); }
          else { el.classList.remove('__erp_hover'); el.classList.add('__erp_selected'); selectedAttrs.push({ name: name, value: value }); }
          updateFloatingCount();
          return;
        }
      }
    }

    if (text.length > 20) {
      var block = el.closest('div, section, td, li, p, table, [class*="desc"], [class*="detail"], [class*="content"]') || el;
      var blockHtml = block.innerHTML.trim() || '';
      if (blockHtml.length > 30) {
        if (block.classList.contains('__erp_selected')) { block.classList.remove('__erp_selected'); selectedDescription = null; }
        else { block.classList.remove('__erp_hover'); block.classList.add('__erp_selected'); selectedDescription = blockHtml; }
        updateFloatingCount();
        return;
      }
    }

    // 不满足任何采集条件
    // 检查是否点击在属性容器区域内，引导用户 Shift+点击
    if (el.closest('[data-testid*="attribute"], [class*="attribute"], [data-module-name*="key_attribute"], [class*="spec"]')) {
      showFloatingHint('⚠️ 这是属性区域，请按住 Shift 再点击来框选整个容器');
    } else {
      showFloatingHint('ℹ️ 未识别到可采集内容' + (selectedImages.size > 0 || selectedAttrs.length > 0 || selectedDescription ? '' : '（点击图片或带冒号的文字）'));
    }
    setTimeout(updateFloatingCount, 2000);
  }

  function showFloatingHint(text) {
    var existing = document.getElementById('__erp_hint__');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = '__erp_hint__';
    div.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;background:#1f2937;color:white;padding:10px 20px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);text-align:center;max-width:500px;';
    div.textContent = text;
    document.body.appendChild(div);
  }

  function updateFloatingCount() {
    var hint = document.getElementById('__erp_hint__');
    if (hint) {
      var descText = '';
      if (selectedDescription) descText = ' · ' + selectedDescription.length + ' 字描述';
      hint.textContent = '已选 ' + selectedImages.size + ' 张图片 · ' + selectedAttrs.length + ' 项属性' + descText + '  |  继续点击选择  |  完成后到插件点"确认采集"';
    }
  }

  function getSelectedData() {
    var rawData = detectPlatform() === 'alibaba' ? parseAlibaba() : parse1688();
    if (selectedImages.size > 0) {
      var newImages = [];
      selectedImages.forEach(function (src) {
        newImages.push({
          type: newImages.length === 0 ? 'main' : 'gallery',
          originalUrl: src.indexOf('//') === 0 ? 'https:' + src : src,
          mimeType: src.indexOf('.png') !== -1 ? 'image/png' : 'image/jpeg',
          fileName: 'image_' + (newImages.length + 1) + '.jpg',
        });
      });
      rawData.images = newImages;
      rawData.imageCount = newImages.length;
    }
    if (selectedAttrs.length > 0) {
      rawData.attributes = selectedAttrs;
    }
    if (selectedDescription) {
      rawData.description = selectedDescription;
    }
    return rawData;
  }

  /** 生成元素的 CSS 选择器 */
  function getElementSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + el.id;
    // 用 class 名
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\s+/).filter(function(c) {
        return c && !c.startsWith('id-') && !c.startsWith('hover:') && !c.startsWith('__erp');
      }).slice(0, 3).join('.');
      if (cls) {
        var tag = el.tagName.toLowerCase();
        var sel = tag + '.' + cls;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }
    // 用 data-testid
    var tid = el.getAttribute('data-testid');
    if (tid) {
      var sel = '[' + (el.tagName.toLowerCase() ? '' : '') + 'data-testid="' + tid + '"]';
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    // 用 data-module-name
    var dmn = el.getAttribute('data-module-name');
    if (dmn) {
      return '[data-module-name="' + dmn + '"]';
    }
    // 用标签 + 父路径
    var parent = el.parentElement;
    if (parent) {
      var idx = Array.prototype.indexOf.call(parent.children, el) + 1;
      return getElementSelector(parent) + ' > :nth-child(' + idx + ')';
    }
    return el.tagName.toLowerCase();
  }

  function exitSelectMode() {
    selectModeActive = false;
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('mouseout', onHoverOut, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('selectstart', preventSelection, true);
    var style = document.getElementById('__erp_style__');
    if (style) style.remove();
    var hint = document.getElementById('__erp_hint__');
    if (hint) hint.remove();
    // 确保 body 恢复正常选中
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    // 更新选容器按钮状态
    var btn = document.getElementById('__erp_select_mode_btn');
    if (btn) { btn.textContent = '🔲 选容器'; btn.style.background = '#dbeafe'; btn.style.color = '#1e40af'; }
  }

  // ===== 调试工具 =====
  function debugPageDOM() {
    console.log('======== ERP 采集调试 ========');
    console.log('URL:', window.location.href);
    console.log('平台:', detectPlatform());
    console.log('v2引擎:', v2Available ? '可用' : '不可用');

    console.log('--- 页面上的 img 标签 ---');
    document.querySelectorAll('img').forEach(function (img, i) {
      var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (src && src.indexOf('logo') === -1 && src.indexOf('icon') === -1) {
        console.log('[' + i + '] w=' + img.width + ' h=' + img.height + ' src=' + src.substring(0, 120));
      }
    });

    console.log('--- 可能包含属性的元素 ---');
    var attrCandidates = 'table, .attributes, .specs, .params, .props, [class*=attr], [class*=spec], [class*=prop], [class*=param], ul, dl'.split(',').map(function (s) { return s.trim(); });
    attrCandidates.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      if (els.length > 0) {
        els.forEach(function (el, i) {
          var text = (el.textContent.trim() || '').substring(0, 100);
          if (text.length > 10) console.log('[' + sel + '] [' + i + '] ' + (el.className || '').substring(0, 60) + ' → "' + text + '"');
        });
      }
    });
    console.log('======== 调试结束 ========');
  }

  /** 训练模式：进入选择器学习状态 */
  var __trainActive = false;
  var __trainCallback = null;
  var __trainOverlay = null;

  function startTrainMode(callback) {
    __trainActive = true;
    __trainCallback = callback;
    
    // 显示提示
    var hint = document.createElement('div');
    hint.id = '__erp_train_hint';
    hint.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;background:#059669;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);text-align:center;';
    hint.innerHTML = '📝 训练模式：点击任意一个<b>属性名</b>（如 "type"、"Skin Type"），<br>再点击对应的<b>属性值</b>（如 "Toilet soap"、"All skin types"）<br><span style="font-size:12px;opacity:0.8">完成后点插件的「✅ 完成训练」按钮</span>';
    document.body.appendChild(hint);
    
    // 添加高亮样式
    var style = document.createElement('style');
    style.id = '__erp_train_style';
    style.textContent = '.__erp_train_hover{outline:3px solid #059669!important;outline-offset:2px!important;cursor:pointer!important}';
    document.body.appendChild(style);
    
    // 鼠标悬浮高亮
    document.addEventListener('mouseover', __trainMouseOver);
    document.addEventListener('mouseout', __trainMouseOut);
    document.addEventListener('click', __trainClick, true);
    
    callback({ success: true, status: 'training' });
  }

  function stopTrainMode() {
    __trainActive = false;
    document.removeEventListener('mouseover', __trainMouseOver);
    document.removeEventListener('mouseout', __trainMouseOut);
    document.removeEventListener('click', __trainClick, true);
    var hint = document.getElementById('__erp_train_hint');
    if (hint) hint.remove();
    var style = document.getElementById('__erp_train_style');
    if (style) style.remove();
    document.querySelectorAll('.__erp_train_hover').forEach(function(e) { e.classList.remove('__erp_train_hover'); });
  }

  function __trainMouseOver(e) {
    if (!__trainActive) return;
    var target = e.target;
    if (target.id === '__erp_train_hint') return;
    target.classList.add('__erp_train_hover');
  }

  function __trainMouseOut(e) {
    if (!__trainActive) return;
    e.target.classList.remove('__erp_train_hover');
  }

  var __trainClicked = [];
  function __trainClick(e) {
    if (!__trainActive) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (el.id === '__erp_train_hint') return;
    
    el.classList.remove('__erp_train_hover');
    el.style.outline = __trainClicked.length % 2 === 0 ? '3px solid #059669' : '3px solid #3b82f6';
    el.style.outlineOffset = '2px';
    __trainClicked.push(el);
    
    var hint = document.getElementById('__erp_train_hint');
    if (__trainClicked.length % 2 === 1) {
      hint.innerHTML = '✅ 已选属性名："' + el.textContent.trim().substring(0, 30) + '"<br>现在点击对应的<b>属性值</b>';
    } else {
      var nameEl = __trainClicked[__trainClicked.length - 2];
      var valEl = __trainClicked[__trainClicked.length - 1];
      hint.innerHTML = '✅ 已记录：<b>' + nameEl.textContent.trim().substring(0, 30) + '</b> → <b>' + valEl.textContent.trim().substring(0, 30) + '</b><br>继续选择下一对，或点插件的「✅ 完成训练」';
      // *** BUG FIX: B类配对训练自动写入属性项 ***
      if (__pairTrainMode && __pairTrainRowIdx >= 0 && __panelAttrs && __panelAttrs[__pairTrainRowIdx]) {
        var nText = nameEl.textContent.trim();
        var vText = valEl.textContent.trim();
        if (nText && vText) {
          __panelAttrs[__pairTrainRowIdx].name = nText;
          __panelAttrs[__pairTrainRowIdx].value = vText;
          renderPanelAttributes();
          savePanelState();
          // 紫色标识区分
          nameEl.style.outline = '3px solid #6366f1';
          valEl.style.outline = '3px solid #6366f1';
          hint.innerHTML = '✅ 配对完成：<b>' + nText.substring(0,20) + '</b> → <b>' + vText.substring(0,20) + '</b>（已写入属性项）';
          __pairTrainMode = false;
          __pairTrainRowIdx = -1;
          // 1秒后自动退出训练模式，点击页面空白区或右键可立即退出
          setTimeout(stopTrainMode, 1000);
        }
      }
    }
  }

  /** 获取训练结果的选择器 */
  function getTrainedSelector() {
    if (__trainClicked.length < 2) return null;
    // 取第一个属性名的 class 和父结构作为选择器
    var first = __trainClicked[0];
    // 生成选择器：取父容器中相同结构的行
    var parent = first.closest('[data-testid*="row"], [class*="flex"][class*="gap"], [class*="grid"]');
    if (!parent) parent = first.parentElement;
    if (!parent) return null;
    
    var parentSelector = parent.tagName;
    if (parent.id) parentSelector += '#' + parent.id;
    else if (parent.className && typeof parent.className === 'string') {
      parentSelector += '.' + parent.className.trim().split(/\s+/).join('.');
    }
    
    // 返回父容器的选择器和子元素的索引模式
    return {
      containerSelector: parentSelector,
      nameIndex: 0,
      valueIndex: 1,
      childSelector: ':scope > div, :scope > span, :scope > p',
    };
  }

  // ===== Floating Panel (in-page collection UI, replaces popup) =====
  // Global state
  window.__panelActive = false;
  var __panelInstance = null;

  function togglePanel() {
    if (window.__panelActive) {
      removePanel();
    } else {
      injectPanel();
    }
  }

  function injectPanel() {
    if (window.__panelInstance) return;
    window.__panelActive = true;

    // --- inject panel styles ---
    var style = document.createElement('style');
    style.id = '__erp_panel_style';
    style.textContent = '\
.erp-panel * {\
  box-sizing: border-box;\
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\
  line-height: 1.5;\
}\
.erp-panel {\
  all: initial;\
  position: fixed !important;\
  top: 20px !important;\
  right: 20px !important;\
  width: 420px !important;\
  max-height: 90vh !important;\
  background: #ffffff !important;\
  border: 1px solid #e5e7eb !important;\
  border-radius: 12px !important;\
  box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08) !important;\
  z-index: 2147483647 !important;\
  display: flex !important;\
  flex-direction: column !important;\
  overflow: hidden !important;\
  font-size: 13px !important;\
  color: #1f2937 !important;\
}\
.erp-panel-header {\
  display: flex !important;\
  align-items: center !important;\
  justify-content: space-between !important;\
  padding: 12px 16px !important;\
  background: #f8fafc !important;\
  border-bottom: 1px solid #e5e7eb !important;\
  cursor: move !important;\
  user-select: none !important;\
  font-weight: 600 !important;\
  font-size: 14px !important;\
}\
.erp-panel-header .erp-panel-close {\
  cursor: pointer !important;\
  background: none !important;\
  border: none !important;\
  font-size: 18px !important;\
  line-height: 1 !important;\
  color: #9ca3af !important;\
  padding: 2px 6px !important;\
  border-radius: 4px !important;\
}\
.erp-panel-header .erp-panel-close:hover {\
  color: #ef4444 !important;\
  background: #fee2e2 !important;\
}\
.erp-panel-body {\
  flex: 1 !important;\
  overflow-y: auto !important;\
  padding: 12px 16px !important;\
}\
.erp-panel-section {\
  margin-bottom: 12px !important;\
}\
.erp-panel-section:last-child {\
  margin-bottom: 0 !important;\
}\
.erp-panel-label {\
  display: block !important;\
  font-size: 11px !important;\
  font-weight: 600 !important;\
  color: #6b7280 !important;\
  text-transform: uppercase !important;\
  letter-spacing: 0.05em !important;\
  margin-bottom: 6px !important;\
}\
.erp-panel-select {\
  width: 100% !important;\
  padding: 6px 10px !important;\
  border: 1px solid #d1d5db !important;\
  border-radius: 6px !important;\
  font-size: 13px !important;\
  background: #fff !important;\
  color: #1f2937 !important;\
  outline: none !important;\
}\
.erp-panel-select:focus {\
  border-color: #6366f1 !important;\
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15) !important;\
}\
.erp-panel-btn {\
  display: inline-flex !important;\
  align-items: center !important;\
  gap: 5px !important;\
  padding: 7px 14px !important;\
  border-radius: 6px !important;\
  font-size: 13px !important;\
  font-weight: 500 !important;\
  border: 1px solid transparent !important;\
  cursor: pointer !important;\
  transition: all 0.15s ease !important;\
}\
.erp-panel-btn.primary {\
  background: #6366f1 !important;\
  color: #fff !important;\
}\
.erp-panel-btn.primary:hover {\
  background: #4f46e5 !important;\
}\
.erp-panel-btn.secondary {\
  background: #f3f4f6 !important;\
  color: #374151 !important;\
  border-color: #d1d5db !important;\
}\
.erp-panel-btn.secondary:hover {\
  background: #e5e7eb !important;\
}\
.erp-panel-btn.ghost {\
  background: transparent !important;\
  color: #6366f1 !important;\
}\
.erp-panel-btn.ghost:hover {\
  background: #eef2ff !important;\
}\
.erp-panel-btn.small {\
  padding: 3px 8px !important;\
  font-size: 12px !important;\
}\
.erp-panel-btn.mini {\
  padding: 1px 5px !important;\
  font-size: 11px !important;\
  line-height: 1.2 !important;\
  border: none !important;\
  background: none !important;\
  cursor: pointer !important;\
  color: #6b7280 !important;\
}\
.erp-panel-btn.mini:hover {\
  color: #6366f1 !important;\
}\
.swap-cell {\
  width: 28px !important;\
  text-align: center !important;\
  padding: 0 !important;\
  vertical-align: middle !important;\
}\
.num-cell {\
  width: 24px !important;\
  text-align: center !important;\
  color: #9ca3af !important;\
  font-size: 11px !important;\
  padding: 4px 2px !important;\
}\
.erp-panel-btn.danger {\
  color: #ef4444 !important;\
}\
.erp-panel-btn.danger:hover {\
  background: #fef2f2 !important;\
}\
.erp-panel-btn-row {\
  display: flex !important;\
  gap: 8px !important;\
  flex-wrap: wrap !important;\
}\
.erp-panel-input {\
  width: 100% !important;\
  padding: 6px 10px !important;\
  border: 1px solid #d1d5db !important;\
  border-radius: 6px !important;\
  font-size: 13px !important;\
  outline: none !important;\
  color: #1f2937 !important;\
}\
.erp-panel-input:focus {\
  border-color: #6366f1 !important;\
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15) !important;\
}\
.erp-panel-container-item {\
  display: flex !important;\
  align-items: center !important;\
  justify-content: space-between !important;\
  padding: 6px 8px !important;\
  background: #f9fafb !important;\
  border: 1px solid #e5e7eb !important;\
  border-radius: 6px !important;\
  margin-bottom: 4px !important;\
  font-size: 12px !important;\
}\
.erp-panel-container-item .name {\
  font-weight: 500 !important;\
  color: #374151 !important;\
  overflow: hidden !important;\
  text-overflow: ellipsis !important;\
  white-space: nowrap !important;\
  max-width: 200px !important;\
}\
.erp-panel-attr-table {\
  width: 100% !important;\
  border-collapse: collapse !important;\
  font-size: 12px !important;\
}\
.erp-panel-attr-table th,\
.erp-panel-attr-table td {\
  padding: 5px 6px !important;\
  border: 1px solid #e5e7eb !important;\
  text-align: left !important;\
}\
.erp-panel-attr-table th {\
  background: #f9fafb !important;\
  font-weight: 600 !important;\
  color: #6b7280 !important;\
  font-size: 11px !important;\
}\
.erp-panel-attr-table .actions {\
  white-space: nowrap !important;\
}\
.erp-panel-collapsible {\
  border: 1px solid #e5e7eb !important;\
  border-radius: 8px !important;\
  overflow: hidden !important;\
}\
.erp-panel-collapsible-header {\
  display: flex !important;\
  align-items: center !important;\
  justify-content: space-between !important;\
  padding: 8px 12px !important;\
  background: #f9fafb !important;\
  cursor: pointer !important;\
  font-weight: 500 !important;\
  font-size: 13px !important;\
}\
.erp-panel-collapsible-header:hover {\
  background: #f3f4f6 !important;\
}\
.erp-panel-collapsible-body {\
  padding: 12px !important;\
  display: none !important;\
}\
.erp-panel-collapsible.open .erp-panel-collapsible-body {\
  display: block !important;\
}\
.erp-panel-preview-card {\
  background: #f9fafb !important;\
  border: 1px solid #e5e7eb !important;\
  border-radius: 8px !important;\
  padding: 10px 12px !important;\
  margin-bottom: 8px !important;\
}\
.erp-panel-preview-card h4 {\
  margin: 0 0 4px 0 !important;\
  font-size: 12px !important;\
  font-weight: 600 !important;\
  color: #374151 !important;\
}\
.erp-panel-preview-card p {\
  margin: 0 !important;\
  font-size: 12px !important;\
  color: #6b7280 !important;\
  line-height: 1.4 !important;\
  max-height: 60px !important;\
  overflow: hidden !important;\
  text-overflow: ellipsis !important;\
}\
.erp-panel-empty {\
  text-align: center !important;\
  padding: 20px !important;\
  color: #9ca3af !important;\
  font-size: 13px !important;\
}\
.erp-panel-tag {\
  display: inline-flex !important;\
  align-items: center !important;\
  padding: 2px 8px !important;\
  border-radius: 10px !important;\
  font-size: 11px !important;\
  font-weight: 500 !important;\
}\
.erp-panel-tag.green {\
  background: #d1fae5 !important;\
  color: #065f46 !important;\
}\
.erp-panel-tag.blue {\
  background: #dbeafe !important;\
  color: #1e40af !important;\
}\
.erp-panel-tag.gray {\
  background: #f3f4f6 !important;\
  color: #6b7280 !important;\
}\
.erp-panel-divider {\
  height: 1px !important;\
  background: #e5e7eb !important;\
  margin: 8px 0 !important;\
}\
.erp-panel-toast {\
  position: fixed !important;\
  bottom: 20px !important;\
  right: 460px !important;\
  background: #1f2937 !important;\
  color: #fff !important;\
  padding: 8px 16px !important;\
  border-radius: 6px !important;\
  font-size: 13px !important;\
  z-index: 2147483647 !important;\
  box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;\
  animation: erpFadeIn 0.2s ease !important;\
}\
@keyframes erpFadeIn {\
  from { opacity: 0; transform: translateY(10px); }\
  to { opacity: 1; transform: translateY(0); }\
}\
.erp-panel-container-item.active {\
  background: #fef3c7 !important;\
  border-color: #f59e0b !important;\
}\
.__erp_container_highlight {\
  outline: 3px solid #f59e0b !important;\
  outline-offset: 3px !important;\
  background: rgba(245,158,11,0.08) !important;\
  box-shadow: 0 0 20px rgba(245,158,11,0.3) !important;\
}\
';
    document.head.appendChild(style);

    // --- build panel DOM ---
    var panel = document.createElement('div');
    panel.className = 'erp-panel';
    panel.id = '__erp_floating_panel';
    panel.innerHTML = '\
<div class="erp-panel-header" id="__erp_panel_header">\
  <span>📦 采集到 ERP</span>\
  <button class="erp-panel-close" id="__erp_panel_close">✕</button>\
</div>\
<div class="erp-panel-body">\
  <div class="erp-panel-section">\
    <label class="erp-panel-label">配置</label>\
    <select class="erp-panel-select" id="__erp_config_selector">\
      <option value="">— 加载中 —</option>\
    </select>\
  </div>\
  <div class="erp-panel-section">\
    <div class="erp-panel-btn-row">\
      <button class="erp-panel-btn primary" id="__erp_collect_btn">⬇️ 采集到 ERP</button>\
    </div>\
  </div>\
  <div class="erp-panel-section">\
    <div class="erp-panel-btn-row">\
      <button class="erp-panel-btn ghost" id="__erp_preview_btn">🔍 调试预览</button>\
    </div>\
  </div>\
  <div class="erp-panel-section erp-panel-collapsible open" id="__erp_attr_config_panel">\
    <div class="erp-panel-collapsible-header" id="__erp_attr_config_header">\
      <span>🏷️ 属性配置</span>\
      <span class="erp-panel-tag blue" id="__erp_select_mode_btn" style="cursor:pointer;margin-left:8px;font-size:11px">🔲 选容器</span>\
      <span>▼</span>\
    </div>\
    <div class="erp-panel-collapsible-body">\
      <label class="erp-panel-label">容器列表 (Shift+点击页面元素添加)</label>\
      <div id="__erp_container_list"></div>\
      <div style="margin-top:8px">\
        <button class="erp-panel-btn primary small" id="__erp_extract_attrs_btn">确认提取</button>\
      </div>\
      <div class="erp-panel-divider"></div>\
      <label class="erp-panel-label">属性编辑</label>\
      <div id="__erp_attr_table_wrap" style="overflow-x:auto">\
        <table class="erp-panel-attr-table" id="__erp_attr_table">\
          <thead><tr><th class="num-cell">#</th><th>属性名</th><th></th><th>属性值</th><th class="actions">操作</th></tr></thead>\
          <tbody></tbody>\
        </table>\
      </div>\
      <div style="margin-top:6px">\
        <button class="erp-panel-btn ghost small" id="__erp_add_attr_btn">+ 新增属性</button>\
        <button class="erp-panel-btn primary small" id="__erp_reapply_config_btn" style="margin-left:6px">📋 属性采集</button>\
      </div>\
      <div class="erp-panel-divider"></div>\
      <label class="erp-panel-label">保存配置</label>\
      <input class="erp-panel-input" id="__erp_config_name_input" placeholder="配置名称...">\
      <div class="erp-panel-btn-row" style="margin-top:6px">\
        <button class="erp-panel-btn primary small" id="__erp_save_config_btn">保存</button>\
        <button class="erp-panel-btn secondary small" id="__erp_update_config_btn">更新</button>\
        <button class="erp-panel-btn ghost small" id="__erp_save_as_btn">另存</button>\
      </div>\
    </div>\
  </div>\
  <div class="erp-panel-section" id="__erp_preview_section" style="display:none">\
    <label class="erp-panel-label">调试预览</label>\
    <div id="__erp_preview_content"></div>\
  </div>\
</div>\
';
    document.body.appendChild(panel);
    window.__panelInstance = panel;

    // --- draggable ---
    makePanelDraggable(panel);

    // --- close button ---
    document.getElementById('__erp_panel_close').addEventListener('click', function(e) {
      e.stopPropagation();
      removePanel();
    });

    // --- event bindings ---
    document.getElementById('__erp_collect_btn').addEventListener('click', handleCollectClick);
    document.getElementById('__erp_preview_btn').addEventListener('click', handlePreviewClick);
    document.getElementById('__erp_attr_config_header').addEventListener('click', function(e) {
      // 点击选容器按钮时不切换折叠状态
      if (e.target.closest('#__erp_select_mode_btn')) return;
      var panel = this.parentElement;
      panel.classList.toggle('open');
      var arrow = this.querySelector('span:last-child');
      if (arrow) arrow.textContent = panel.classList.contains('open') ? '▼' : '▶';
      // 展开/折叠时不自动切换容器选择模式（用户通过「选容器」按钮控制）
      // 折叠时退出选择模式
      if (!panel.classList.contains('open')) {
        exitSelectMode();
      }
    });
    // 容器选择模式切换按钮
    document.getElementById('__erp_select_mode_btn').addEventListener('click', function(e) {
      e.stopPropagation();
      if (selectModeActive) {
        exitSelectMode();
        this.textContent = '🔲 选容器';
        this.style.background = '#dbeafe';
        this.style.color = '#1e40af';
      } else {
        enterSelectMode();
        this.textContent = '✅ 选容器中';
        this.style.background = '#fef3c7';
        this.style.color = '#92400e';
      }
    });
    document.getElementById('__erp_extract_attrs_btn').addEventListener('click', handleExtractAttrs);
    document.getElementById('__erp_add_attr_btn').addEventListener('click', handleAddAttr);
    // 属性采集按钮：重新执行当前配置的提取规则
    document.getElementById('__erp_reapply_config_btn').addEventListener('click', function() {
      var sel = document.getElementById('__erp_config_selector');
      if (sel && sel.value) {
        panelToast('📋 正在按配置重新采集...', 2000);
        sel.dispatchEvent(new Event('change'));
      } else {
        panelToast('⚠️ 请先选择或保存一个配置');
      }
    });
    document.getElementById('__erp_save_config_btn').addEventListener('click', function() { handleSaveConfig('save'); });
    document.getElementById('__erp_update_config_btn').addEventListener('click', function() { handleSaveConfig('update'); });
    document.getElementById('__erp_save_as_btn').addEventListener('click', function() { handleSaveConfig('saveas'); });

    // --- load configs ---
    renderPanelConfigs();

    // 选择配置后加载容器和属性
    document.getElementById('__erp_config_selector').addEventListener('change', function() {
      var cfgId = this.value;
      if (!cfgId) return;
      chrome.storage.local.get('configs', function(result) {
        var configs = result.configs || {};
        var cfg = configs[cfgId];
        if (!cfg) return;

        // 先清除旧的 tc_ 容器
        chrome.storage.local.get(null, function(all) {
          var removeKeys = Object.keys(all).filter(function(k) { return k.startsWith('tc_'); });
          if (removeKeys.length > 0) {
            chrome.storage.local.remove(removeKeys, function() {
              // 清除完成后，再写入新的容器
              if (cfg.containerSelectors && cfg.containerSelectors.length > 0) {
                var savedCount = 0;
                cfg.containerSelectors.forEach(function(sel, idx) {
                  var saveKey = 'tc_' + Date.now() + '_' + idx;
                  var saveData = {};
                  saveData[saveKey] = { selector: sel, name: '容器' + (idx + 1), createdAt: Date.now() };
                  chrome.storage.local.set(saveData, function() {
                    savedCount++;
                    if (savedCount === cfg.containerSelectors.length) {
                      // 所有容器写入完成，再渲染
                      finishLoad();
                    }
                  });
                });
              } else {
                finishLoad();
              }
            });
          } else {
            finishLoad();
          }
        });

        function finishLoad() {
          // 重置训练配对
          __attrPairs = [];
          // 直接走 JSON 提取（不经过 handleExtractAttrs，避免容器 DOM 提取干扰）
          var jsonFound = false;
          try {
            // 来源1：window 全局变量
            var jsonSources = [
              window.detailData, window.__INITIAL_STATE__, window.__NUXT__?.state,
              window.__NEXT_DATA__?.props?.pageProps?.product,
              window.__NEXT_DATA__?.props?.pageProps?.detailData,
              window.__INITIAL_DATA__, window.__PAGE_DATA__, window.__STORE__,
              window.__DATA__, window.pageData, window.detail,
              window.productInfo, window.skuInfo, window.priceInfo
            ];
            // 来源2：<script> 标签中的 JSON
            try {
              document.querySelectorAll('script').forEach(function(s) {
                var txt = s.textContent.trim();
                if (txt.length > 200 && txt.indexOf('"moq"') > -1) {
                  try { jsonSources.push(JSON.parse(txt)); } catch(e) {
                    // 可能是拼接的 JSON，尝试匹配大括号包裹的部分
                    try {
                      var start = txt.indexOf('{');
                      var end = txt.lastIndexOf('}');
                      if (start >= 0 && end > start) {
                        jsonSources.push(JSON.parse(txt.substring(start, end + 1)));
                      }
                    } catch(e2) {}
                  }
                }
              });
            } catch(e) {}
            // 来源3：遍历 window 所有属性
            try {
              for (var wk in window) {
                try {
                  var wv = window[wk];
                  if (wv && typeof wv === 'object' && !Array.isArray(wv) && wv.constructor === Object) {
                    var wvStr = JSON.stringify(wv);
                    if (wvStr && wvStr.indexOf('"productBasicProperties"') > -1) {
                      jsonSources.push(wv);
                      break;
                    }
                  }
                } catch(e) {}
              }
            } catch(e) {}
            var seen2 = {};
            jsonSources.forEach(function(src) {
              if (!src || jsonFound) return;
              try {
                var d = (typeof src === 'string') ? JSON.parse(src) : src;
                (function find(obj, depth) {
                  if (depth > 5 || jsonFound || !obj || typeof obj !== 'object') return;
                  if (Array.isArray(obj)) { obj.forEach(function(i) { find(i, depth+1); }); return; }
                  var props = obj.productBasicProperties || obj.attributes || obj.props || obj.params || obj.attrList;
                  if (props && Array.isArray(props) && props.length > 0) {
                    var newAttrs = [];
                    props.forEach(function(p) {
                      var nm = (p.attrName || p.name || p.key || '').trim();
                      var vl = (p.attrValue || p.value || p.val || '').trim();
                      if (nm && vl && !seen2[nm]) {
                        seen2[nm] = true;
                        newAttrs.push({ name: nm, value: vl, rowId: 'ar_' + Date.now() + '_' + newAttrs.length });
                      }
                    });
                    // 价格和 MOQ
                    var prod = obj.product || obj;
                    if (prod.price && prod.price.formatLadderPrice && !seen2['Price']) {
                      seen2['Price'] = true;
                      newAttrs.push({ name: 'Price', value: prod.price.formatLadderPrice, rowId: 'ar_' + Date.now() + '_' + newAttrs.length });
                    }
                    if (prod.customPrice && prod.customPrice.formatFixedPrice && !seen2['Price']) {
                      seen2['Price'] = true;
                      newAttrs.push({ name: 'Price', value: prod.customPrice.formatFixedPrice, rowId: 'ar_' + Date.now() + '_' + newAttrs.length });
                    }
                    if (prod.moq && !seen2['Minimum order quantity']) {
                      seen2['Minimum order quantity'] = true;
                      newAttrs.push({ name: 'Minimum order quantity', value: prod.moq + ' pieces', rowId: 'ar_' + Date.now() + '_' + newAttrs.length });
                    }
                    if (newAttrs.length > 0) {
                      __panelAttrs = newAttrs;
                      renderPanelAttributes();
                      savePanelState();
                      panelToast('📋 从页面数据提取 ' + newAttrs.length + ' 项属性', 4000);
                      jsonFound = true;
                    }
                    return;
                  }
                  for (var k in obj) { if (!jsonFound) try { find(obj[k], depth+1); } catch(e) {} }
                })(d, 0);
              } catch(e) {}
            });
          } catch(e) {}
          if (!jsonFound && (!cfg.containerSelectors || cfg.containerSelectors.length === 0) && (!cfg.attrPairs || cfg.attrPairs.length === 0)) {
            panelToast('🔍 未找到 JSON 属性，需按旧流程提取', 3000);
          }
          // 应用 B 类配对规则
          if (cfg.attrPairs && cfg.attrPairs.length > 0) {
            __attrPairs = cfg.attrPairs.slice();
            applyAttrPairs(__attrPairs);
            panelToast('📋 应用了 ' + cfg.attrPairs.length + ' 条配对规则', 3000);
          }
          renderPanelContainers();
          renderPanelAttributes();
        }
      });
    });

    // --- load containers ---
    renderPanelContainers();

    // --- 属性配置折叠面板默认展开 ---
    // (不自动进入容器选择模式，用户点「选容器」按钮才进入)

    // --- restore saved attributes ---
    chrome.storage.local.get('_panelAttrs', function(res) {
      if (res._panelAttrs && res._panelAttrs.length > 0) {
        __panelAttrs = res._panelAttrs;
        renderPanelAttributes();
      }
    });

    // --- load attributes ---
    renderPanelAttributes();
  }

  function removePanel() {
    window.__panelActive = false;
    var panel = window.__panelInstance;
    if (panel) {
      panel.remove();
      window.__panelInstance = null;
    }
    var style = document.getElementById('__erp_panel_style');
    if (style) style.remove();
    var toasts = document.querySelectorAll('.erp-panel-toast');
    toasts.forEach(function(t) { t.remove(); });
  }

  function panelToast(msg) {
    var existing = document.querySelector('.erp-panel-toast');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.className = 'erp-panel-toast';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.remove(); }, 3000);
  }

  // --- drag ---
  function makePanelDraggable(panel) {
    var header = document.getElementById('__erp_panel_header');
    var isDragging = false, startX, startY, origX, origY;
    header.addEventListener('mousedown', function(e) {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      var rect = panel.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      panel.style.right = 'auto';
      panel.style.top = rect.top + 'px';
      panel.style.left = rect.left + 'px';
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      panel.style.left = (origX + e.clientX - startX) + 'px';
      panel.style.top = (origY + e.clientY - startY) + 'px';
    });
    document.addEventListener('mouseup', function() {
      isDragging = false;
    });
  }

  // --- config selector ---
  function renderPanelConfigs() {
    var sel = document.getElementById('__erp_config_selector');
    if (!sel) return;
    sel.innerHTML = '<option value="">选择配置...</option>';
    chrome.storage.local.get('configs', function(result) {
      var configs = result.configs || {};
      // 清理同名重复配置
      var seenNames = {};
      var toRemove = [];
      var ids = Object.keys(configs).sort(function(a, b) { return (configs[b].updatedAt || 0) - (configs[a].updatedAt || 0); });
      ids.forEach(function(id) {
        var name = configs[id].name || '';
        if (seenNames[name]) {
          toRemove.push(id);
        } else {
          seenNames[name] = true;
        }
      });
      if (toRemove.length > 0) {
        toRemove.forEach(function(id) { delete configs[id]; });
        chrome.storage.local.set({ configs: configs });
        console.log('[配置] 清理了 ' + toRemove.length + ' 个重复配置');
      }
      // 渲染去重后的列表
      ids = Object.keys(configs).sort(function(a, b) { return (configs[b].updatedAt || 0) - (configs[a].updatedAt || 0); });
      ids.forEach(function(id) {
        var cfg = configs[id];
        if (!cfg) return;
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = cfg.name + (cfg.isDefault ? ' ★' : '') + (cfg.urlPattern ? ' (' + cfg.urlPattern + ')' : '');
        sel.appendChild(opt);
      });
    });
  }

  // --- container list ---
  function renderPanelContainers() {
    var container = document.getElementById('__erp_container_list');
    if (!container) return;
    container.innerHTML = '<div class="erp-panel-empty">加载中...</div>';

    chrome.storage.local.get(null, function(all) {
      var keys = Object.keys(all).filter(function(k) { return k.startsWith('tc_'); });
      if (keys.length === 0) {
        container.innerHTML = '<div class="erp-panel-empty">暂无容器。在页面上 Shift+点击属性区域来添加。(' + Object.keys(all).length + ' 条存储)</div>';
        return;
      }
      var html = '';
      keys.forEach(function(key, idx) {
        var item = all[key];
        if (!item || !item.selector) return;
        var num = idx + 1;
        var sel = item.selector.containerSelector || item.selector;
        html += '\
<div class="erp-panel-container-item" data-key="' + key + '" data-sel="' + sel.replace(/"/g, '&quot;') + '">\
  <span class="num">' + num + '</span>\
  <span class="name" title="' + sel.replace(/"/g, '&quot;') + '">容器' + num + '</span>\
  <span class="erp-panel-tag gray" style="cursor:pointer;margin-left:auto" data-delete="' + key + '">✕</span>\
</div>';
      });
      container.innerHTML = html;

      // 点击整个容器项 → 切换页面元素高亮（黄色）
      container.querySelectorAll('.erp-panel-container-item').forEach(function(el) {
        el.addEventListener('click', function(e) {
          if (e.target.getAttribute('data-delete')) return;
          var selStr = el.getAttribute('data-sel');
          if (!selStr) { panelToast('⚠️ 无效的选择器'); return; }
          var target = document.querySelector(selStr);
          if (!target) { panelToast('⚠️ 页面中未找到该容器'); return; }

          // 如果已高亮，则取消
          if (target.classList.contains('__erp_container_highlight')) {
            target.classList.remove('__erp_container_highlight');
            el.classList.remove('active');
            return;
          }

          // 清除其他容器的高亮
          document.querySelectorAll('.__erp_container_highlight').forEach(function(h) {
            h.classList.remove('__erp_container_highlight');
          });
          container.querySelectorAll('.erp-panel-container-item.active').forEach(function(a) {
            a.classList.remove('active');
          });

          // 高亮当前容器
          target.classList.add('__erp_container_highlight');
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('active');
          panelToast('🔍 容器 ' + el.querySelector('.num').textContent);
        });
      });

      // 删除按钮
      container.querySelectorAll('[data-delete]').forEach(function(el) {
        el.addEventListener('click', function(e) {
          e.stopPropagation();
          var key = el.getAttribute('data-delete');
          // 从 storage 读选择器，清除页面元素高亮
          chrome.storage.local.get(key, function(items) {
            var item = items[key];
            if (item && item.selector) {
              var selStr = item.selector.containerSelector || item.selector;
              var target = document.querySelector(selStr);
              if (target) {
                target.classList.remove('__erp_selected', '__erp_container_highlight');
                target.style.outline = '';
                target.style.outlineOffset = '';
              }
            }
          });
          chrome.storage.local.remove(key, function() {
            renderPanelContainers();
            panelToast('🗑️ 已删除容器 (key=' + key.substring(0, 16) + ')');
          });
        });
      });
    });
  }

          // --- attribute table ---
  var __panelAttrs = [];

  // 自动保存面板状态
  function savePanelState() {
    try {
      chrome.storage.local.set({ _panelAttrs: __panelAttrs, _panelAttrsSavedAt: Date.now() });
    } catch(e) {}
  }

  function renderPanelAttributes() {
    var tbody = document.querySelector('#__erp_attr_table tbody');
    if (!tbody) return;
    if (__panelAttrs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:10px">点击「确认提取」从容器中提取属性</td></tr>';
      return;
    }
    var html = '';
    __panelAttrs.forEach(function(attr, idx) {
      html += '<tr data-idx="' + idx + '">\
  <td class="num-cell">' + (idx + 1) + '</td>\
  <td contenteditable="true" data-field="name" style="max-width:120px;overflow:hidden;text-overflow:ellipsis">' + escHtml(attr.name) + '</td>\
  <td class="swap-cell"><button class="erp-panel-btn mini" data-swap="' + idx + '" title="交换名与值">🔄</button></td>\
  <td contenteditable="true" data-field="value" style="max-width:160px;overflow:hidden;text-overflow:ellipsis">' + escHtml(attr.value) + '</td>\
  <td class="actions">\
    <button class="erp-panel-btn ghost small" data-pick="' + idx + '" title="配对训练(点页面元素)">📝</button>\
    <button class="erp-panel-btn ghost small danger" data-delattr="' + idx + '" title="删除">✕</button>\
  </td>\
</tr>';
    });
    tbody.innerHTML = html;

    // bind editable cell changes
    tbody.querySelectorAll('td[contenteditable]').forEach(function(td) {
      td.addEventListener('blur', function() {
        var idx = parseInt(td.closest('tr').getAttribute('data-idx'), 10);
        var field = td.getAttribute('data-field');
        if (__panelAttrs[idx]) {
          __panelAttrs[idx][field] = td.textContent.trim();
          savePanelState();
        }
      });
    });

    // bind pick buttons → 配对训练模式
    tbody.querySelectorAll('[data-pick]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-pick'), 10);
        startPairTrain(idx);
      });
    });

    // bind delete attribute buttons
    tbody.querySelectorAll('[data-delattr]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-delattr'), 10);
        __panelAttrs.splice(idx, 1);
        renderPanelAttributes();
        savePanelState();
      });
    });

    // bind swap buttons → 交换属性名与值
    tbody.querySelectorAll('[data-swap]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-swap'), 10);
        if (__panelAttrs[idx]) {
          var tmp = __panelAttrs[idx].name;
          __panelAttrs[idx].name = __panelAttrs[idx].value;
          __panelAttrs[idx].value = tmp;
          renderPanelAttributes();
          savePanelState();
          panelToast('🔄 已交换', 1500);
        }
      });
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- collect click ---
  function handleCollectClick() {
    try {
      var data;
      if (typeof window.__ERP_PARSERS__ !== 'undefined' && window.__ERP_PARSERS__.AlibabaV2Engine) {
        data = window.__ERP_PARSERS__.AlibabaV2Engine.extractFullProduct();
      } else {
        data = detectPlatform() === 'alibaba' ? parseAlibaba() : parse1688();
      }
      // merge in attributes from attr table
      if (__panelAttrs.length > 0) {
        data.attributes = __panelAttrs;
      }
      // send to background for ERP posting
      chrome.runtime.sendMessage({ type: 'COLLECT_TO_ERP', data: data }, function(resp) {
        if (resp && resp.success) {
          panelToast('✅ 已采集并发送到 ERP');
        } else {
          panelToast('⚠️ 发送失败: ' + ((resp && resp.error) || '未知错误'));
        }
      });
    } catch(e) {
      panelToast('❌ 采集出错: ' + e.message);
    }
  }

  // --- attr config toggle ---
  function handleAttrConfigClick() {
    var panel = document.getElementById('__erp_attr_config_panel');
    if (panel) panel.classList.toggle('open');
  }

  // --- preview toggle ---
  function handlePreviewClick() {
    try {
      // 收集当前采集数据
      var data;
      if (typeof window.__ERP_PARSERS__ !== 'undefined' && window.__ERP_PARSERS__.AlibabaV2Engine) {
        data = window.__ERP_PARSERS__.AlibabaV2Engine.extractFullProduct();
      } else {
        data = detectPlatform() === 'alibaba' ? parseAlibaba() : parse1688();
      }
      // 合并属性编辑表格中的属性
      if (__panelAttrs && __panelAttrs.length > 0) {
        data.attributes = __panelAttrs.filter(function(a) { return a.name && a.value; }).map(function(a) { return { name: a.name, value: a.value }; });
      }
      // 如果图片为空，兜底扫描页面上的大图（不依赖 img.width，懒加载图片可能为0）
      if (!data.images || data.images.length === 0) {
        data.images = [];
        try {
          document.querySelectorAll('img').forEach(function(img) {
            var src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazyload') || '';
            if (!src) return;
            // 只跳过明确的小图/图标
            if (/logo|icon|placeholder|blank|gray|loading|spacer|avatar|flag|star|rating|share|cart/i.test(src)) return;
            if (src.indexOf('data:') === 0 && src.length < 500) return;
            if (src.startsWith('//')) src = 'https:' + src;
            // 去重
            var dup = false;
            data.images.forEach(function(e) { if (e.originalUrl === src) dup = true; });
            if (!dup) data.images.push({ originalUrl: src });
          });
        } catch(e) { console.warn('[预览] 图片兜底失败:', e); }
      }
      // 补充视频提取（复用 EXTRACT_VIDEOS 的完整逻辑）
      if (!data.videos || data.videos.length === 0) {
        data.videos = [];
        try {
          document.querySelectorAll('script').forEach(function(s) {
            var txt = s.textContent || '';
            // videoUrl
            var vu = txt.match(/videoUrl["']?\s*[:=]\s*["']([^"']+)["']/i);
            if (vu) data.videos.push(vu[1]);
            // mediaVOs 数组中的视频
            var mv = txt.match(/mediaVOs\s*[:=]\s*(\[[^\]]+\])/);
            if (mv) {
              try {
                JSON.parse(mv[1]).forEach(function(m) {
                  if (m.mediaType === 'video' || m.type === 'video') {
                    if (m.url) data.videos.push(m.url);
                    if (m.videoUrl) data.videos.push(m.videoUrl);
                  }
                });
              } catch(e) {}
            }
            // mp4 链接
            var mp4 = txt.match(/"https?:[^"]+\.mp4[^"]*"/gi);
            if (mp4) mp4.forEach(function(m) { data.videos.push(m.replace(/^"|"$/g, '')); });
          });
          // JSON-LD VideoObject
          document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
            try {
              var parsed = JSON.parse(s.textContent);
              (Array.isArray(parsed) ? parsed : [parsed]).forEach(function(item) {
                if (item['@type'] === 'VideoObject' && item.contentUrl) data.videos.push(item.contentUrl);
              });
            } catch(e) {}
          });
          // 来源3: data-video / data-media 属性
          document.querySelectorAll('[data-video], [data-media-url]').forEach(function(el) {
            var v = el.getAttribute('data-video') || el.getAttribute('data-media-url') || '';
            if (v) data.videos.push(v);
          });
          // 来源4: 页面上的 <video> 标签
          document.querySelectorAll('video').forEach(function(el) {
            var s = el.querySelector('source');
            var src = el.src || (s && s.src) || '';
            if (src) data.videos.push(src);
          });
          // 去重，只保留第一个视频
          var seen = {};
          var first = '';
          data.videos.forEach(function(v) {
            var key = typeof v === 'string' ? v : (v.url || v.videoUrl || '');
            if (key && !seen[key]) { seen[key] = true; if (!first) first = key; }
          });
          data.videos = first ? [first] : [];
        } catch(e) {}
      }
      
      // 生成自包含 HTML 预览
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>采集预览</title>';
      html += '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:960px;margin:0 auto;padding:20px;background:#f5f5f5}';
      html += '.card{background:#fff;border-radius:8px;padding:16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,0.1)}';
      html += 'h2{font-size:16px;margin:0 0 8px 0;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px}';
      html += '.imgs{display:flex;flex-wrap:wrap;gap:8px}';
      html += '.imgs img{width:120px;height:120px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb}';
      html += 'video{width:240px;border-radius:4px}';
      html += 'table{width:100%;border-collapse:collapse}';
      html += 'td{padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px}';
      html += 'td:first-child{font-weight:600;color:#6b7280;width:140px}';
      html += '.desc{white-space:pre-wrap;font-size:13px;line-height:1.6;color:#374151}';
      html += '</style></head><body>';
      html += '<h1 style="margin-bottom:4px">📋 采集预览</h1>';
      html += '<p style="color:#9ca3af;font-size:13px;margin-top:0">' + new Date().toLocaleString() + '</p>';
      
      // 标题
      html += '<div class="card"><h2>标题</h2><p style="font-size:15px;font-weight:500">' + escHtml((data.title || '—')) + '</p></div>';
      // 价格
      html += '<div class="card"><h2>价格</h2><p>' + escHtml('' + (data.price || data.priceRange || '—')) + ' ' + (data.currency || '') + '</p></div>';
      
      // 图片/视频
      var imgs = data.images || [];
      if (imgs.length > 0) {
        // 过滤占位图、图标、小缩略图
        var realImgs = imgs.filter(function(img) {
          var u = (img.originalUrl || img.cleanedUrl || img.url || '');
          if (typeof img === 'string') u = img;
          return u && !/placeholder|logo|icon|blank|gray|loading|spacer|transparent|pixel|thumb|small/i.test(u);
        });
        // 最多显示20张主图
        var showImgs = realImgs.slice(0, 20);
        html += '<div class="card"><h2>图片 (' + showImgs.length + ')</h2><div class="imgs">';
        showImgs.forEach(function(img) {
          var url = img.originalUrl || img.cleanedUrl || img.url || img;
          if (typeof img === 'string') url = img;
          // 处理协议相对URL
          if (url && typeof url === 'string' && url.startsWith('//')) url = 'https:' + url;
          if (url && typeof url === 'string' && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov'))) {
            html += '<video controls src="' + escHtml(url) + '"></video>';
          } else if (url && typeof url === 'string') {
            html += '<img src="' + escHtml(url) + '" onerror="this.style.display=\'none\'">';
          }
        });
        html += '</div></div>';
      }
      // 视频
      var vids = data.videos || [];
      if (vids.length > 0) {
        html += '<div class="card"><h2>视频 (' + vids.length + ')</h2><div class="imgs">';
        vids.forEach(function(v) {
          var vu = typeof v === 'string' ? v : (v.url || v.videoUrl || '');
          if (vu && vu.startsWith('//')) vu = 'https:' + vu;
          if (vu) html += '<video controls src="' + escHtml(vu) + '" style="max-width:320px"></video>';
        });
        html += '</div></div>';
      }
      
      // 属性
      var attrs = data.attributes || [];
      if (attrs.length > 0) {
        html += '<div class="card"><h2>属性 (' + attrs.length + ')</h2><table>';
        attrs.forEach(function(a) {
          html += '<tr><td>' + escHtml(a.name) + '</td><td>' + escHtml(a.value) + (a.unit ? ' ' + a.unit : '') + '</td></tr>';
        });
        html += '</table></div>';
      }
      
      // 详情描述
      var desc = data.description || data.descriptionEn || '';
      if (desc) {
        // 将描述中的相对图片URL转为绝对路径（blob页面无法解析相对路径）
        desc = desc.replace(/<img[^>]+src=["']([^"']+)["']/gi, function(match, src) {
          if (src.startsWith('http') || src.startsWith('data:')) return match;
          var absSrc = src;
          if (src.startsWith('//')) absSrc = 'https:' + src;
          else if (src.startsWith('/')) absSrc = window.location.origin + src;
          else absSrc = window.location.origin + '/' + src;
          return match.replace(src, absSrc);
        });
        html += '<div class="card"><h2>详情描述</h2><div class="desc">' + desc + '</div></div>';
      }
      
      html += '<p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px">— 预览结束 —</p>';
      html += '</body></html>';
      
      // 打开新标签页
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
      
      panelToast('✅ 预览已在新标签页打开');
    } catch(e) {
      panelToast('❌ 预览失败: ' + e.message);
      console.error('[预览错误]', e);
    }
  }

  // --- extract attrs from containers ---
  function handleExtractAttrs() {
    // 先退出选择模式
    exitSelectMode();
    panelToast('🔍 正在读取容器数据...', 1000);
    chrome.storage.local.get(null, function(all) {
      var keys = Object.keys(all).filter(function(k) { return k.startsWith('tc_'); });
      panelToast('🔍 提取: 存储中 tc_ 共 ' + keys.length + ' 个', 1500);
      if (keys.length === 0) {
        panelToast('⚠️ 没有容器，请先 Shift+点击页面属性区域');
        return;
      }
      panelToast('📦 找到 ' + keys.length + ' 个容器', 1000);
      var selectors = [];
      keys.forEach(function(key) {
        var item = all[key];
        if (item && item.selector) {
          selectors.push(item.selector);
        }
      });
      if (selectors.length === 0) {
        panelToast('⚠️ 容器数据异常');
        return;
      }
      panelToast('🔎 正在从 ' + selectors.length + ' 个容器提取属性...', 1500);
      // 诊断：显示第一个选择器
      var firstSel = selectors[0];
      var firstSelStr = (typeof firstSel === 'string') ? firstSel : (firstSel.containerSelector || 'unknown');
      console.log('[提取] 选择器:', firstSelStr, '匹配数:', document.querySelectorAll(firstSelStr).length);
      // inline extraction (same logic as EXTRACT_ATTRS_FROM_CONTAINERS)
      var allAttrs = [];
      var seenNames = {};
      selectors.forEach(function(selItem) {
        try {
          var selStr = (typeof selItem === 'string') ? selItem : (selItem.containerSelector || '');
          if (!selStr) return;
          var containers = document.querySelectorAll(selStr);

          // 策略 0：从 window 数据源读取结构化属性（复用 jsonld-parser 的数据源）
          try {
            var foundJson = false;
            var jsonSources = [
              window.detailData, window.__INITIAL_STATE__, window.__NUXT__?.state,
              window.__NEXT_DATA__?.props?.pageProps?.product,
              window.__NEXT_DATA__?.props?.pageProps?.detailData,
              window.__INITIAL_DATA__, window.__PAGE_DATA__, window.__STORE__,
              window.__DATA__, window.pageData, window.detail,
              window.productInfo, window.skuInfo, window.priceInfo
            ];
            jsonSources.forEach(function(source) {
              if (!source || foundJson) return;
              try {
                var data = (typeof source === 'string') ? JSON.parse(source) : source;
                // 递归搜索 productBasicProperties 或 attributes
                function findAttrs(obj, depth) {
                  if (depth > 5 || !obj || typeof obj !== 'object' || foundJson) return null;
                  if (Array.isArray(obj)) {
                    obj.forEach(function(item) { findAttrs(item, depth + 1); });
                    return;
                  }
                  // 检查当前对象是否有属性列表
                  var props = obj.productBasicProperties || obj.attributes || obj.props || obj.params || obj.attrList;
                  if (props && Array.isArray(props) && props.length > 0) {
                    console.log('[提取] 从 JSON 找到属性:', props.length, '条');
                    props.forEach(function(p) {
                      var nm = (p.attrName || p.name || p.key || '').trim();
                      var vl = (p.attrValue || p.value || p.val || '').trim();
                      if (nm && vl && !seenNames[nm]) {
                        seenNames[nm] = true;
                        allAttrs.push({ name: nm, value: vl, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                      }
                    });
                    // 也提取价格和 MOQ
                    var prod = obj.product || obj;
                    if (prod.price && prod.price.formatLadderPrice && !seenNames['Price']) {
                      seenNames['Price'] = true;
                      allAttrs.push({ name: 'Price', value: prod.price.formatLadderPrice, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                    }
                    if (prod.customPrice && prod.customPrice.formatFixedPrice && !seenNames['Price']) {
                      seenNames['Price'] = true;
                      allAttrs.push({ name: 'Price', value: prod.customPrice.formatFixedPrice, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                    }
                    if (prod.moq && !seenNames['Minimum order quantity']) {
                      seenNames['Minimum order quantity'] = true;
                      allAttrs.push({ name: 'Minimum order quantity', value: prod.moq + ' pieces', rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                    }
                    foundJson = true;
                    return;
                  }
                  // 递归搜索子对象
                  for (var key in obj) {
                    if (foundJson) return;
                    try { findAttrs(obj[key], depth + 1); } catch(e) {}
                  }
                }
                findAttrs(data, 0);
              } catch(e) {}
            });
            if (foundJson) {
              panelToast('📋 从页面 JSON 提取到 ' + allAttrs.length + ' 项属性', 3000);
              return; // JSON 提取成功，跳过 DOM 策略
            }
            panelToast('🔍 未找到 JSON 属性数据，使用 DOM 提取', 2000);
          } catch(e) { /* 回退到 DOM 策略 */ }

          containers.forEach(function(c) {
            // 清除 script 和 style 标签的内容（避免 JSON 数据污染）
            var cleanContainer = c.cloneNode(true);
            cleanContainer.querySelectorAll('script, style').forEach(function(s) { s.remove(); });

            // strategy A: row structure
            var rows = cleanContainer.querySelectorAll('[data-testid$="row"], [data-testid*="-row"], [class*="row"], :scope > div');
            var hasRow = false;
            rows.forEach(function(r) {
              var cells = r.querySelectorAll(':scope > div');
              if (cells.length >= 2) {
                hasRow = true;
                var nm = cells[0].textContent.replace(/[：:]/g, '').trim();
                var vl = cells[1].textContent.replace(/[：:]/g, '').trim();
                if (nm && vl && nm.length < 100 && !seenNames[nm] && vl.length < 500) {
                  seenNames[nm] = true;
                  allAttrs.push({ name: nm, value: vl, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                }
              }
            });
            if (hasRow) return;
            // strategy B: <p> tags
            var pTags = cleanContainer.querySelectorAll('p');
            if (pTags.length >= 2) {
              var texts = [];
              pTags.forEach(function(p) { texts.push(p.textContent.trim()); });
              for (var pi = 0; pi < texts.length - 1; pi += 2) {
                if (texts[pi] && texts[pi + 1] && texts[pi].length < 80 && !seenNames[texts[pi]]) {
                  seenNames[texts[pi]] = true;
                  allAttrs.push({ name: texts[pi], value: texts[pi + 1], rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                }
              }
              return;
            }
            // strategy C: :scope > div pairs
            var childDivs = cleanContainer.querySelectorAll(':scope > div');
            if (childDivs.length >= 2) {
              for (var di = 0; di < childDivs.length - 1; di += 2) {
                var nm2 = childDivs[di].textContent.replace(/[：:]/g, '').trim();
                var vl2 = childDivs[di + 1].textContent.replace(/[：:]/g, '').trim();
                if (nm2 && vl2 && nm2.length < 100 && !seenNames[nm2]) {
                  seenNames[nm2] = true;
                  allAttrs.push({ name: nm2, value: vl2, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                }
              }
              return;
            }
            // strategy D: colon-split text
            var allText = cleanContainer.textContent.trim();
            var lines = allText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
            for (var li2 = 0; li2 < lines.length; li2++) {
              var colonIdx = lines[li2].indexOf(':');
              if (colonIdx > 0 && colonIdx < 50) {
                var nm3 = lines[li2].substring(0, colonIdx).trim();
                var vl3 = lines[li2].substring(colonIdx + 1).trim();
                if (nm3 && vl3 && !seenNames[nm3]) {
                  seenNames[nm3] = true;
                  allAttrs.push({ name: nm3, value: vl3, rowId: 'ar_' + Date.now() + '_' + allAttrs.length });
                }
              }
            }
          });
          // 策略 E：后处理 - 检测价格中的整数/小数分离（如 US$6 和 49 拼成 US$649）
          allAttrs.forEach(function(attr) {
            var rawValue = attr.value;
            // 检查值是否匹配 US$数字（3+位数字）
            var priceMatch = rawValue.match(/^(US\$|¥|€|£|AU\$|CA\$)(\d{3,})$/);
            if (priceMatch) {
              var symbol = priceMatch[1];
              var digits = priceMatch[2];
              // 只有最后2位可能是小数，且总数字 > 2 位才处理
              if (digits.length >= 3) {
                var intPart = digits.substring(0, digits.length - 2);
                var decPart = digits.substring(digits.length - 2);
                attr.value = symbol + intPart + '.' + decPart;
                console.log('[提取] 价格修正:', rawValue, '→', attr.value);
              }
            }
          });
          console.log('[提取] 共提取', allAttrs.length, '个属性:', allAttrs.map(function(a) { return a.name + '=' + a.value; }).join(' | '));
        } catch(e) { /* fail silently */ }
      });
      if (allAttrs.length === 0) {
          panelToast('⚠️ 未能从容器中提取到属性');
        } else {
          __panelAttrs = allAttrs;
          renderPanelAttributes();
          savePanelState();
          var names = allAttrs.map(function(a) { return a.name; }).join(', ');
          panelToast('✅ 提取到 ' + allAttrs.length + ' 项: ' + names.substring(0, 100), 5000);
        }
        // 提取完毕，退出容器选择模式
        exitSelectMode();
        // 应用 B 类配对规则
        if (__attrPairs.length > 0) {
          applyAttrPairs(__attrPairs);
        }
      });
  }

  // --- add new attribute row (just adds empty editable row) ---
  function handleAddAttr() {
    var newId = 'ar_' + Date.now() + '_' + __panelAttrs.length;
    __panelAttrs.push({ name: '', value: '', rowId: newId });
    renderPanelAttributes();
    savePanelState();
    panelToast('✅ 已添加空行，可直接输入或点 📝 选容器', 3000);
  }

  /* pick text from page — removed, use B类配对训练 (startPairTrain) instead */

  // ===== 属性配对训练模式（B 类容器） =====
  var __pairTrainMode = false;
  var __pairTrainRowIdx = -1;
  var __pairTrainPhase = null;
  var __pairTrainNameSelector = '';
  var __pairTrainNameText = '';
  var __pairTrainValueSelector = '';
  var __pairTrainValueText = '';
  var __attrPairs = [];

  function startPairTrain(rowIdx) {
    if (!__panelAttrs[rowIdx]) { panelToast('⚠️ 找不到该属性行'); return; }
    // 如果已在配对模式，点击退出
    if (__pairTrainMode) {
      __pairTrainMode = false;
      __pairTrainRowIdx = -1;
      stopTrainMode();
      panelToast('已退出B类配对模式');
      return;
    }
    // 先退出旧训练模式
    if (__trainActive) stopTrainMode();
    
    __pairTrainMode = true;
    __pairTrainRowIdx = rowIdx;

    // 注册右键退出（一次性，触发后自清除）
    var ctxHandler = function(e) {
      if (!__pairTrainMode) {
        document.removeEventListener('contextmenu', ctxHandler, true);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      __pairTrainMode = false;
      __pairTrainRowIdx = -1;
      stopTrainMode();
      panelToast('✅ 已退出B类配对模式');
      document.removeEventListener('contextmenu', ctxHandler, true);
    };
    document.addEventListener('contextmenu', ctxHandler, true);
    
    // 直接使用旧训练模式的 click 监听（已验证可靠）
    // __trainClick 中已有 B类配对自动写入逻辑
    startTrainMode(function(){}); // 传入空回调，避免 startTrainMode 内部抛错
  }

  function handlePairTrainClick(el) {
    console.log('[B类训练] handlePairTrainClick phase=', __pairTrainPhase, 'pairTrainMode=', __pairTrainMode, 'pairTrainRowIdx=', __pairTrainRowIdx, 'panelAttrsLen=', __panelAttrs.length, 'target=', el.tagName, el.className);
    var sel = getElementSelector(el);
    var text = el.textContent.trim();
    if (!text) { panelToast('⚠️ 该容器无文本'); return; }
    if (__pairTrainPhase === 'name') {
      __pairTrainNameSelector = sel;
      __pairTrainNameText = text;
      __pairTrainPhase = 'value';
      el.style.outline = '3px solid #6366f1';
      panelToast('✅ 属性名: ' + text.substring(0, 30) + '，现在选属性值', 5000);
    } else {
      __pairTrainValueSelector = sel;
      __pairTrainValueText = text;
      el.style.outline = '3px solid #6366f1';
      var pair = {
        attrName: __panelAttrs[__pairTrainRowIdx] ? __panelAttrs[__pairTrainRowIdx].name : '',
        nameSelector: __pairTrainNameSelector,
        valueSelector: __pairTrainValueSelector
      };
      __attrPairs.push(pair);
      if (__panelAttrs[__pairTrainRowIdx]) {
        __panelAttrs[__pairTrainRowIdx].name = __pairTrainNameText;
        __panelAttrs[__pairTrainRowIdx].value = __pairTrainValueText;
        renderPanelAttributes();
        savePanelState();
      }
      __pairTrainMode = false;
      __pairTrainRowIdx = -1;
      __pairTrainPhase = null;
      panelToast('✅ 属性配对已保存，共 ' + __attrPairs.length + ' 对规则', 4000);
      if (window.__panelActive) enterSelectMode();
    }
  }

  function applyAttrPairs(pairs) {
    if (!pairs || !pairs.length) return;
    pairs.forEach(function(pair) {
      var nameEl = document.querySelector(pair.nameSelector);
      var valueEl = document.querySelector(pair.valueSelector);
      if (nameEl && valueEl) {
        var name = nameEl.textContent.trim();
        var value = valueEl.textContent.trim();
        if (name && value) {
          var found = false;
          __panelAttrs.forEach(function(a) {
            if (a.name === pair.attrName || a.name === name) {
              a.name = name; a.value = value; found = true;
            }
          });
          if (!found) {
            __panelAttrs.push({ name: name, value: value, rowId: 'ar_' + Date.now() + '_' + __panelAttrs.length });
          }
        }
      }
    });
    renderPanelAttributes();
  }

  // --- save config ---
  function handleSaveConfig(mode) {
    var nameInput = document.getElementById('__erp_config_name_input');
    var name = nameInput ? nameInput.value.trim() : '';
    var sel = document.getElementById('__erp_config_selector');
    var selectedKey = sel ? sel.value : '';

    chrome.storage.local.get('configs', function(result) {
      var configs = result.configs || {};
      var targetId = null;

      // 更新模式：选中了配置即可，不需输入名称
      if (mode === 'update' && selectedKey && configs[selectedKey]) {
        targetId = selectedKey;
        name = configs[selectedKey].name;  // 自动使用已有配置名
        if (nameInput) nameInput.value = name;
      } else if (mode === 'saveas' && selectedKey) {
        // 另存为：需要输入新名称
        if (!name) { panelToast('⚠️ 请输入新配置名称'); return; }
        targetId = 'cfg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      } else {
        // 新建：需要输入名称
        if (!name) { panelToast('⚠️ 请输入配置名称'); return; }
        // 检查同名
        var existingId = null;
        for (var id in configs) {
          if (configs[id].name === name && id !== selectedKey) {
            existingId = id; break;
          }
        }
        if (existingId) {
          panelToast('⚠️ 配置名 "' + name + '" 已存在，请选中后点「更新」覆盖');
          return;
        }
        targetId = 'cfg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }

      panelToast('💾 保存中: ' + mode, 1000);
      var cfg = configs[targetId] || { id: targetId, createdAt: Date.now() };
      cfg.name = name;
      cfg.updatedAt = Date.now();

      // 读取当前容器
      chrome.storage.local.get(null, function(all) {
        var containerSelectors = [];
        var keys = Object.keys(all).filter(function(k) { return k.startsWith('tc_'); });
        keys.forEach(function(key) {
          var item = all[key];
          if (item && item.selector) containerSelectors.push(item.selector);
        });
        cfg.containerSelectors = containerSelectors;
        cfg.attrPairs = __attrPairs.map(function(p) {
          return { attrName: p.attrName, nameSelector: p.nameSelector, valueSelector: p.valueSelector };
        });

        configs[targetId] = cfg;
        chrome.storage.local.set({ configs: configs }, function() {
          panelToast('✅ 配置已保存: ' + name + ' (' + containerSelectors.length + ' 个容器选择器)');
          renderPanelConfigs();
        });
      });
    });
  }

})();