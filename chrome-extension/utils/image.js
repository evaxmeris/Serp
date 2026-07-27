/**
 * 图片处理工具
 *
 * 通过 canvas 绕过图片防盗链，将图片转换为 base64 格式。
 * 在 content script 中运行，利用浏览器已登录的上下文获取图片。
 * v2.0 新增: 高清 URL 升级 + 画质优先
 */

/** 阿里 CDN 高清化规则 */
var HD_RULES = [
  { pattern: /_50x50\./g, replacement: '.' },
  { pattern: /_100x100\./g, replacement: '.' },
  { pattern: /_200x200\./g, replacement: '.' },
  { pattern: /_220x220\./g, replacement: '.' },
  { pattern: /_350x350\./g, replacement: '.' },
  { pattern: /_400x400\./g, replacement: '.' },
  { pattern: /_640x640\./g, replacement: '.' },
  { pattern: /\.jpg_.*$/i, replacement: '.jpg' },
  { pattern: /\.png_.*$/i, replacement: '.png' },
  { pattern: /_640x640.*$/i, replacement: '' },
  { pattern: /\.jpg_\d+x\d+.*$/i, replacement: '.jpg' },
  { pattern: /s\d+x\d+\.jpg/i, replacement: '.jpg' },
  { pattern: /_\d+x\d+\./i, replacement: '.' },
];

/** 升级图片 URL 到最高清版本 */
export function upgradeImageUrl(url) {
  if (!url) return url;
  var result = url;
  if (result.indexOf('//') === 0) result = 'https:' + result;
  HD_RULES.forEach(function (rule) {
    result = result.replace(rule.pattern, rule.replacement);
  });
  if (result.length < url.length * 0.7) return url;
  return result;
}

/**
 * 将图片元素通过 canvas 转为 base64
 * @param {HTMLImageElement} img - 图片元素
 * @param {number} maxWidth - 最大宽度（默认 1200）
 * @param {number} quality - JPEG 质量（0-1，默认 0.92，v2 提高画质）
 * @returns {Promise<{data: string, mimeType: string, width: number, height: number}>}
 */
export async function captureImage(img, maxWidth, quality) {
  if (maxWidth === undefined) maxWidth = 1200;
  if (quality === undefined) quality = 0.92;

  // 等待图片加载完成
  if (!img.complete || img.naturalWidth === 0) {
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = function () { resolve(); };
      setTimeout(resolve, 3000);
    });
  }

  var width = img.naturalWidth || img.width || 800;
  var height = img.naturalHeight || img.height || 800;

  // 等比例缩放（增大 maxWidth 获取更高清）
  var targetWidth = width;
  var targetHeight = height;
  if (width > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = Math.round(height * (maxWidth / width));
  }

  // 优先使用高清 URL
  var hdSrc = upgradeImageUrl(img.src);

  // 通过 canvas 绘制（绕过防盗链）
  var canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  var ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 设置背景为白色（防止透明背景变成黑色）
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 绘制图片
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 转为 base64
  var mimeType = guessMimeType(hdSrc);
  var dataUrl = canvas.toDataURL(mimeType, quality);
  var base64 = dataUrl.split(',')[1];

  return {
    data: base64,
    mimeType: mimeType,
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * 批量处理图片
 * @param {HTMLImageElement[]} images - 图片元素数组
 * @param {object} options
 * @returns {Promise<Array>}
 */
export async function captureImages(images, options) {
  if (options === undefined) options = {};
  var results = [];
  var seen = new Set();

  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var src = img.getAttribute('src') || img.getAttribute('data-src') || '';

    // 去重
    if (!src || seen.has(src)) continue;
    seen.add(src);

    // 过滤小图标
    if (img.width < 50 || img.height < 50) continue;

    try {
      var captured = await captureImage(img, options.maxWidth, options.quality);
      results.push({
        type: results.length === 0 ? 'main' : 'gallery',
        data: captured.data,
        mimeType: captured.mimeType,
        width: captured.width,
        height: captured.height,
        originalUrl: upgradeImageUrl(src),
        fileName: 'product_' + (i + 1) + '.' + (captured.mimeType.split('/')[1] || 'jpg'),
      });

      if (results.length >= 10) break;
    } catch (e) {
      console.warn('Image capture failed:', src, e);
    }
  }

  return results;
}

/**
 * 通过 fetch URL 下载图片
 * @param {string} url - 图片 URL
 * @returns {Promise<{data: string, mimeType: string, width: number, height: number}>}
 */
export async function captureImageByUrl(url) {
  if (!url) return null;
  var hdUrl = upgradeImageUrl(url);
  if (hdUrl.indexOf('//') === 0) hdUrl = 'https:' + hdUrl;

  try {
    var resp = await fetch(hdUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    var blob = await resp.blob();
    if (blob.size < 2000) return null;

    var base64 = await new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result.split(',')[1]); };
      reader.readAsDataURL(blob);
    });

    return {
      data: base64,
      mimeType: blob.type || 'image/jpeg',
      width: 0,
      height: 0,
    };
  } catch (e) {
    return null;
  }
}

function guessMimeType(url) {
  if (!url) return 'image/jpeg';
  if (url.indexOf('.png') !== -1) return 'image/png';
  if (url.indexOf('.gif') !== -1) return 'image/gif';
  if (url.indexOf('.webp') !== -1) return 'image/webp';
  return 'image/jpeg';
}
