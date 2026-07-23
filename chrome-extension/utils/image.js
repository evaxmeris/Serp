/**
 * 图片处理工具
 *
 * 通过 canvas 绕过图片防盗链，将图片转换为 base64 格式。
 * 在 content script 中运行，利用浏览器已登录的上下文获取图片。
 */

/**
 * 将图片元素通过 canvas 转为 base64
 * @param {HTMLImageElement} img - 图片元素
 * @param {number} maxWidth - 最大宽度（默认 1200）
 * @param {number} quality - JPEG 质量（0-1，默认 0.85）
 * @returns {Promise<{data: string, mimeType: string, width: number, height: number}>}
 */
export async function captureImage(img, maxWidth = 1200, quality = 0.85) {
  // 等待图片加载完成
  if (!img.complete || img.naturalWidth === 0) {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => resolve(); // 加载失败也继续
      setTimeout(resolve, 3000); // 3秒超时
    });
  }

  const width = img.naturalWidth || img.width || 800;
  const height = img.naturalHeight || img.height || 800;

  // 等比例缩放
  let targetWidth = width;
  let targetHeight = height;
  if (width > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = Math.round(height * (maxWidth / width));
  }

  // 通过 canvas 绘制（绕过防盗链）
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 设置背景为白色（防止透明背景变成黑色）
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 绘制图片
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 转为 base64
  const mimeType = guessMimeType(img.src);
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.split(',')[1];

  return {
    data: base64,
    mimeType,
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
export async function captureImages(images, options = {}) {
  const results = [];
  const seen = new Set();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';

    // 去重
    if (!src || seen.has(src)) continue;
    seen.add(src);

    // 过滤小图标
    if (img.width < 50 || img.height < 50) continue;

    try {
      const captured = await captureImage(img, options.maxWidth, options.quality);
      results.push({
        type: results.length === 0 ? 'main' : 'gallery',
        data: captured.data,
        mimeType: captured.mimeType,
        width: captured.width,
        height: captured.height,
        originalUrl: src,
        fileName: `product_${i + 1}.${captured.mimeType.split('/')[1] || 'jpg'}`,
      });

      // 最多处理 10 张
      if (results.length >= 10) break;
    } catch (e) {
      console.warn('Image capture failed:', src, e);
    }
  }

  return results;
}

function guessMimeType(url) {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.gif')) return 'image/gif';
  if (url.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
