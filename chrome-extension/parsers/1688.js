/**
 * 1688 产品详情页解析器
 *
 * 从 1688 产品详情页的 DOM 中提取标题、价格、描述、图片、属性、变体等信息。
 * 注意：选择器可能随平台改版变化，需定期维护。
 */

export function parse1688Product() {
  const url = window.location.href;

  // --- 标题 ---
  const titleEl =
    document.querySelector('[data-tname="title"]') ||
    document.querySelector('.module_title h1') ||
    document.querySelector('.detail-title') ||
    document.querySelector('h1');
  const title = titleEl?.textContent?.trim() || '';

  // --- 价格 ---
  const priceEl =
    document.querySelector('.price-detail') ||
    document.querySelector('.detail-price') ||
    document.querySelector('[data-tname="price"]');
  const priceText = priceEl?.textContent?.trim() || '';
  const priceMatch = priceText.match(/[\d.]+/);
  const price = priceMatch ? parseFloat(priceMatch[0]) : null;

  // --- 描述 ---
  const descEl =
    document.querySelector('#desc-layer') ||
    document.querySelector('.detail-content') ||
    document.querySelector('[data-tname="description"]') ||
    document.querySelector('.desc-content');
  const description = descEl?.innerHTML?.trim() || '';

  // --- 图片 ---
  const imageElements =
    document.querySelectorAll('.detail-gallery img, .tab-img img, .main-img img, [data-tname="image"] img');
  const images = extractImages(imageElements);

  // --- 属性 ---
  const attrEls =
    document.querySelectorAll('.attributes-list li, .detail-attributes li, [data-tname="attributes"] li');
  const attributes = Array.from(attrEls)
    .map(li => {
      const spans = li.querySelectorAll('span');
      if (spans.length >= 2) {
        return {
          name: spans[0].textContent?.replace(/[：:]/g, '').trim() || '',
          value: spans[1].textContent?.trim() || '',
        };
      }
      const text = li.textContent?.trim() || '';
      const colonIdx = text.indexOf('：');
      if (colonIdx > 0) {
        return {
          name: text.substring(0, colonIdx).trim(),
          value: text.substring(colonIdx + 1).trim(),
        };
      }
      return null;
    })
    .filter(Boolean);

  // --- 变体 ---
  const variantEls = document.querySelectorAll('.sku-item, [data-tname="sku"] .sku-option');
  const variants = Array.from(variantEls)
    .map(el => {
      const label = el.textContent?.trim();
      if (label && !label.includes('请选择')) {
        return { name: label };
      }
      return null;
    })
    .filter(Boolean);

  return {
    source: '1688',
    sourceUrl: url,
    sourceId: extractProductId(url),
    title,
    price,
    currency: 'CNY',
    description,
    images,
    attributes,
    variants: variants.length > 0 ? variants : undefined,
    rawData: {
      url,
      capturedAt: new Date().toISOString(),
    },
  };
}

function extractProductId(url) {
  // 1688 URL 格式: https://detail.1688.com/offer/123456789.html
  const match = url.match(/offer\/(\d+)\.html/);
  return match ? match[1] : null;
}

function extractImages(elements) {
  const seen = new Set();
  const results = [];

  elements.forEach((img, idx) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazyload') || '';
    if (!src || seen.has(src)) return;
    seen.add(src);

    if (src.includes('placeholder') || src.includes('logo') || img.width < 50) return;

    results.push({
      type: results.length === 0 ? 'main' : 'gallery',
      originalUrl: src,
      width: img.naturalWidth || undefined,
      height: img.naturalHeight || undefined,
      mimeType: guessMimeType(src),
      fileName: `image_${idx + 1}.jpg`,
    });
  });

  return results;
}

function guessMimeType(url) {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.gif')) return 'image/gif';
  if (url.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
