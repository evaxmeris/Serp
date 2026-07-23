/**
 * 阿里国际站 (alibaba.com) 产品详情页解析器
 *
 * 从产品详情页的 DOM 中提取标题、价格、描述、图片、属性、变体等信息。
 * 注意：选择器可能随平台改版变化，需定期维护。
 */

export function parseAlibabaProduct() {
  const url = window.location.href;

  // --- 标题 ---
  const titleEl =
    document.querySelector('.title-main') ||
    document.querySelector('[data-testid="product-title"]') ||
    document.querySelector('h1');
  const title = titleEl?.textContent?.trim() || '';

  // --- 价格 ---
  const priceEl =
    document.querySelector('.price-range') ||
    document.querySelector('[data-testid="price"]') ||
    document.querySelector('.product-price');
  const priceText = priceEl?.textContent?.trim() || '';
  // 从价格文本中提取数字: "$15.99" 或 "US $15.99"
  const priceMatch = priceText.match(/[\d.]+/);
  const price = priceMatch ? parseFloat(priceMatch[0]) : null;
  const currency = priceText.includes('US') ? 'USD' : 'USD';

  // --- 描述 ---
  const descEl =
    document.querySelector('.detail-description') ||
    document.querySelector('[data-testid="description"]') ||
    document.querySelector('.product-description');
  const description = descEl?.innerHTML?.trim() || '';

  // --- 图片 ---
  const imageElements =
    document.querySelectorAll('.product-gallery img, [data-testid="gallery"] img, .image-thumbnail img');
  const images = extractImages(imageElements);

  // --- 属性 ---
  const attrRows =
    document.querySelectorAll('.attributes-table tr, [data-testid="attributes"] tr, .product-attributes tr');
  const attributes = Array.from(attrRows)
    .map(row => {
      const tds = row.querySelectorAll('td, th');
      if (tds.length >= 2) {
        return {
          name: tds[0].textContent?.trim() || '',
          value: tds[1].textContent?.trim() || '',
        };
      }
      return null;
    })
    .filter(Boolean);

  // --- 变体 ---
  const variantContainers =
    document.querySelectorAll('.sku-selector, [data-testid="variations"] .variant-item');
  const variants = extractVariants(variantContainers);

  // --- SKU ---
  const skuEl =
    document.querySelector('[data-testid="sku"]') ||
    document.querySelector('.product-sku');
  const sku = skuEl?.textContent?.trim() || '';

  return {
    source: 'alibaba',
    sourceUrl: url,
    sourceId: extractProductId(url),
    title,
    price,
    currency,
    description,
    images,
    attributes,
    variants: variants.length > 0 ? variants : undefined,
    sku: sku || undefined,
    rawData: {
      url,
      capturedAt: new Date().toISOString(),
    },
  };
}

function extractProductId(url) {
  // 阿里国际站 URL 格式: https://www.alibaba.com/product-detail/xxx_123456789.html
  const match = url.match(/_(\d+)\.html/);
  return match ? match[1] : null;
}

function extractImages(elements) {
  const seen = new Set();
  const results = [];

  elements.forEach((img, idx) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src || seen.has(src)) return;
    seen.add(src);

    // 过滤小图标和占位图
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

function extractVariants(containers) {
  const results = [];
  containers.forEach((container) => {
    const options = container.querySelectorAll('option, li, .sku-option');
    options.forEach((opt) => {
      const label = opt.textContent?.trim();
      if (label && !label.includes('请选择')) {
        results.push({ name: label });
      }
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
