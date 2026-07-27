/**
 * 图片处理器 — 高清化 URL 升级 + canvas 下载
 *
 * 功能:
 * 1. 将普通图片 URL 升级为高清版本 (HD URL upgrade)
 * 2. 通过 canvas 绕开防盗链下载图片为 base64
 * 3. 逐张下载并支持进度回调
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  /** 阿里 CDN 图片 URL 高清化规则 */
  var HD_RULES = [
    // 尺寸后缀
    { pattern: /_50x50\./g, replacement: '.' },
    { pattern: /_100x100\./g, replacement: '.' },
    { pattern: /_200x200\./g, replacement: '.' },
    { pattern: /_220x220\./g, replacement: '.' },
    { pattern: /_350x350\./g, replacement: '.' },
    { pattern: /_400x400\./g, replacement: '.' },
    { pattern: /_640x640\./g, replacement: '.' },
    // JPG 参数剥离
    { pattern: /\.jpg_.*$/i, replacement: '.jpg' },
    { pattern: /\.png_.*$/i, replacement: '.png' },
    { pattern: /_640x640.*$/i, replacement: '' },
    // 缩略图标识
    { pattern: /\.jpg_\d+x\d+.*$/i, replacement: '.jpg' },
    { pattern: /s\d+x\d+\.jpg/i, replacement: '.jpg' },
    { pattern: /_\d+x\d+\./i, replacement: '.' },
  ];

  /** 升级图片 URL 到最高清版本 */
  function upgradeUrl(url) {
    if (!url) return url;
    var result = url;
    // 去掉协议相对前缀，统一为 https
    if (result.indexOf('//') === 0) result = 'https:' + result;
    // 应用高清规则
    HD_RULES.forEach(function (rule) {
      result = result.replace(rule.pattern, rule.replacement);
    });
    // 如果升级后 URL 比原 URL 短太多，使用原 URL
    if (result.length < url.length * 0.7) return url;
    return result;
  }

  /** 从 DOM 提取图片信息（去重+高清化） */
  function extractImages(selectors, maxCount) {
    if (maxCount === undefined) maxCount = 20;
    var results = [];
    var seen = new Set();

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (img) {
        if (results.length >= maxCount) return;
        var src = img.getAttribute('src') || '';
        var dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazyload') ||
                      img.getAttribute('data-original') || '';
        var zoomSrc = img.getAttribute('data-zoom') || img.getAttribute('data-large') ||
                      img.getAttribute('data-big') || '';
        var finalSrc = zoomSrc || dataSrc || src;
        if (!finalSrc || seen.has(finalSrc)) return;

        // 过滤占位图和图标
        if (finalSrc.indexOf('placeholder') !== -1 || finalSrc.indexOf('logo') !== -1 ||
            finalSrc.indexOf('icon') !== -1 || finalSrc.indexOf('blank') !== -1 ||
            finalSrc.indexOf('gray') !== -1) return;
        // 过滤极小 base64 占位图
        if (finalSrc.indexOf('data:') === 0 && finalSrc.length < 500) return;

        seen.add(finalSrc);
        var hdUrl = upgradeUrl(finalSrc);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: hdUrl,
          mimeType: hdUrl.indexOf('.png') !== -1 || hdUrl.indexOf('.webp') !== -1 ? 'image/png' : 'image/jpeg',
          fileName: 'image_' + (results.length) + '.jpg',
        });
      });
    });

    // 全页兜底：取所有 >= 80px 的图片
    if (results.length === 0) {
      document.querySelectorAll('img').forEach(function (img) {
        if (results.length >= maxCount) return;
        var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!src || seen.has(src) || img.width < 80 || img.height < 80) return;
        if (src.indexOf('logo') !== -1 || src.indexOf('icon') !== -1 || src.indexOf('placeholder') !== -1) return;
        if (src.indexOf('data:') === 0 && src.length < 500) return;
        seen.add(src);
        var hd = upgradeUrl(src);
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          originalUrl: hd,
          mimeType: hd.indexOf('.png') !== -1 ? 'image/png' : 'image/jpeg',
          fileName: 'image_' + (results.length) + '.jpg',
        });
      });
    }

    return results;
  }

  /** 通过 fetch 下载单张图片为 base64 */
  async function downloadImage(imageInfo, signal) {
    var url = imageInfo.originalUrl || imageInfo.url || '';
    if (!url) return null;
    if (url.indexOf('//') === 0) url = 'https:' + url;

    var timeoutMs = 10000;
    try {
      var resp = await fetch(url, { signal: signal || AbortSignal.timeout(timeoutMs) });
      if (!resp.ok) return null;
      var blob = await resp.blob();
      // 过滤太小（< 2KB）的占位图
      if (blob.size < 2000) return null;
      var base64 = await blobToBase64(blob);
      var mimeType = blob.type || imageInfo.mimeType || 'image/jpeg';
      return {
        data: base64,
        mimeType: mimeType,
        width: imageInfo.width || 0,
        height: imageInfo.height || 0,
      };
    } catch (e) {
      return null;
    }
  }

  /** 通过 canvas 下载单张图片（从 DOM img 元素） */
  async function downloadImageViaCanvas(imgElement, maxWidth, quality) {
    if (maxWidth === undefined) maxWidth = 1200;
    if (quality === undefined) quality = 0.85;
    if (!imgElement.complete || imgElement.naturalWidth === 0) {
      await new Promise(function (resolve) {
        imgElement.onload = resolve;
        imgElement.onerror = resolve;
        setTimeout(resolve, 3000);
      });
    }
    var w = imgElement.naturalWidth || imgElement.width || 800;
    var h = imgElement.naturalHeight || imgElement.height || 800;
    if (w > maxWidth) {
      h = Math.round(h * (maxWidth / w));
      w = maxWidth;
    }
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imgElement, 0, 0, w, h);
    var mimeType = guessMimeType(imgElement.src);
    var dataUrl = canvas.toDataURL(mimeType, quality);
    var base64 = dataUrl.split(',')[1];
    return { data: base64, mimeType: mimeType, width: w, height: h };
  }

  /** 批量下载图片（支持进度回调） */
  async function downloadImages(images, onProgress) {
    var results = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      console.log('[ImageProcessor] 下载图片 ' + (i + 1) + '/' + images.length + ': ' + (img.originalUrl || '').substring(0, 80));
      var cap = await downloadImage(img);
      if (cap) {
        results.push({
          type: results.length === 0 ? 'main' : 'gallery',
          data: cap.data,
          mimeType: cap.mimeType,
          width: cap.width,
          height: cap.height,
          originalUrl: img.originalUrl,
          fileName: 'product_' + (i + 1) + '.jpg',
        });
      } else {
        console.warn('[ImageProcessor] 图片下载失败, 跳过: ' + (img.originalUrl || '').substring(0, 80));
      }
      if (onProgress) {
        onProgress({ current: i + 1, total: images.length, success: !!cap });
      }
    }
    return results;
  }

  /** Blob → base64 辅助函数 */
  function blobToBase64(blob) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result.split(',')[1]); };
      reader.readAsDataURL(blob);
    });
  }

  function guessMimeType(url) {
    if (!url) return 'image/jpeg';
    if (url.indexOf('.png') !== -1) return 'image/png';
    if (url.indexOf('.gif') !== -1) return 'image/gif';
    if (url.indexOf('.webp') !== -1) return 'image/webp';
    return 'image/jpeg';
  }

  parsers.ImageProcessor = {
    upgradeUrl: upgradeUrl,
    extractImages: extractImages,
    downloadImage: downloadImage,
    downloadImageViaCanvas: downloadImageViaCanvas,
    downloadImages: downloadImages,
  };
})();
