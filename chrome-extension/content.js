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
  });

  window.__ERP_EXTENSION__ = { platform: detectPlatform(), isProductPage: detectPlatform() !== 'unknown', v2Available: v2Available };
  console.log('[ERP采集 v2] 平台:', detectPlatform(), 'v2引擎:', v2Available ? '✅ 可用' : '❌ 不可用');

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
    style.textContent = '\n      .__erp_hover { outline: 2px solid #3b82f6 !important; outline-offset: 1px !important; cursor: crosshair !important; background: rgba(59,130,246,0.04) !important; }\n      .__erp_selected { outline: 2px solid #f59e0b !important; background: rgba(245,158,11,0.12) !important; }\n    ';
    document.head.appendChild(style);
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('mouseout', onHoverOut, true);
    document.addEventListener('click', onPickClick, true);
    showFloatingHint('🖱️ 点击图片=采集  |  点击带冒号的文字=属性  |  Shift+点击属性区域=记住容器  |  点完回插件点"确认采集"');
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
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (!el || el.closest('#__erp_hint__') || el.closest('#__erp_style__') || el.tagName === 'HTML' || el.tagName === 'BODY') return;

    el.classList.remove('__erp_hover');

    // 如果按住 Shift 键点击，标记为属性容器
    if (e.shiftKey) {
      var container = el.closest('[data-testid="three-column-key-attributes"], [data-module-name*="key_attribute"], .module_3_tab_key_attribute, [class*="attribute"], [class*="specification"]') || el;
      var sel = getElementSelector(container);
      var entry = { containerSelector: sel, nameIndex: 0, valueIndex: 1 };
      selectedSelector = entry;
      document.querySelectorAll('.__erp_selected').forEach(function(s) { s.classList.remove('__erp_selected'); });
      container.classList.add('__erp_selected');
      container.style.outline = '3px solid #059669';
      // 保存到 storage（弹窗关闭后再打开也能读到）
      try {
        var saveKey = 'tc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        var saveData = {};
        saveData[saveKey] = { selector: entry, name: '框' + Date.now(), createdAt: Date.now() };
        chrome.storage.local.set(saveData);
        // 也保存一份索引列表，方便读取
        chrome.storage.local.get('tc_keys', function(res) {
          var keys = res.tc_keys || [];
          if (keys.indexOf(saveKey) < 0) {
            keys.push(saveKey);
            chrome.storage.local.set({ tc_keys: keys });
          }
        });
      } catch(e) {}
      showFloatingHint('✅ 已选中属性容器! 回插件查看列表 → 确认');
      // 通知 popup（如果还开着）
      try { chrome.runtime.sendMessage({ type: 'CONTAINER_SELECTED', selector: entry }); } catch(e) {}
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
    var style = document.getElementById('__erp_style__');
    if (style) style.remove();
    var hint = document.getElementById('__erp_hint__');
    if (hint) hint.remove();
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
      childSelector: '> div, > span, > p',
    };
  }

})();
