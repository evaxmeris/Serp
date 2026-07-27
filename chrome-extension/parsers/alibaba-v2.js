/**
 * 阿里国际站全字段提取引擎 v2
 *
 * 这是 content.js 的核心提取引擎，整合所有解析器模块。
 * 按以下顺序提取 46 个字段:
 * 1. DOM 选择器直接提取 (SelectorRegistry)
 * 2. JSON-LD 解析 (JsonLdParser)
 * 3. window.detailData 兜底 (JsonLdParser.windowData)
 * 4. 特殊解析 (tiered pricing, variants, specs)
 * 5. 图片处理器 (高清URL + canvas下载)
 * 6. 数据组装 (PayloadAssembler)
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  // 预缓存选择器引用
  var SelectorRegistry = parsers.SelectorRegistry;
  var JsonLdParser = parsers.JsonLdParser;
  var TieredPriceParser = parsers.TieredPriceParser;
  var VariantParser = parsers.VariantParser;
  var SpecParser = parsers.SpecParser;
  var ImageProcessor = parsers.ImageProcessor;
  var PayloadAssembler = parsers.PayloadAssembler;

  /** 主入口：全字段提取 */
  function extractFullProduct(platform) {
    if (!platform) platform = detectPlatform();
    if (!SelectorRegistry[platform]) platform = 'alibaba';
    var selectors = SelectorRegistry[platform] || SelectorRegistry.alibaba;

    console.log('[ERP采集 v2] 开始提取, 平台:', platform);

    // Phase 1: DOM 选择器直接提取
    var extracted = extractBySelectors(selectors);

    // Phase 2: JSON-LD 结构化数据提取
    var jsonld = JsonLdParser.extract();
    if (jsonld) mergeExtracted(extracted, jsonld);
    console.log('[ERP采集 v2] JSON-LD 数据:', jsonld ? '已合并' : '无');

    // Phase 3: window.detailData 兜底
    var windowData = JsonLdParser.extractWindowData();
    if (windowData) fillMissing(extracted, windowData);

    // Phase 4: 特殊解析 (仅填充缺失字段)
    if (!extracted.tieredPricing || extracted.tieredPricing.length === 0) {
      extracted.tieredPricing = TieredPriceParser.extract();
    }
    if (!extracted.attributes || extracted.attributes.length === 0) {
      extracted.attributes = SpecParser.extractAttributes();
    }
    if (!extracted.brand) {
      extracted.brand = SpecParser.extractBrand();
    }
    if (!extracted.sku) {
      extracted.sku = SpecParser.extractSku();
    }
    if (!extracted.weight) {
      extracted.weight = SpecParser.extractWeight();
    }
    if (!extracted.moq) {
      var moqEl = document.querySelector('.min-order, [class*="moq"]');
      extracted.moq = moqEl ? moqEl.textContent.trim() : null;
    }

    // 变体
    if (!extracted.variants || extracted.variants.length === 0) {
      extracted.variants = VariantParser.extract();
    }

    // Phase 5: 图片处理器
    extracted.supplier = extracted.supplier || SpecParser.extractSupplier();
    extracted.hsCode = extracted.hsCode || SpecParser.extractHsCode();

    console.log('[ERP采集 v2] 提取完成:', {
      title: extracted.title,
      price: extracted.price,
      images: extracted.images?.length,
      attributes: extracted.attributes?.length,
      variants: extracted.variants?.length,
      tieredPricing: extracted.tieredPricing?.length,
    });

    // Phase 5: 图片 URL 高清化
    if (extracted.images && extracted.images.length > 0) {
      extracted.images = extracted.images.map(function (img) {
        img.originalUrl = ImageProcessor.upgradeUrl(img.originalUrl || img.src || '');
        return img;
      });
    }

    // Phase 6: 组装为最终 payload
    return PayloadAssembler.assemble(extracted);
  }

  /** 通过 DOM 选择器提取基础字段 */
  function extractBySelectors(selectors) {
    var result = {};

    // 标题
    result.title = queryAllText(selectors.title);

    // 价格
    var priceText = queryAllText(selectors.price);
    if (priceText) {
      var priceMatch = priceText.match(/[\d.]+/);
      result.price = priceMatch ? parseFloat(priceMatch[0]) : null;
    }

    // 划线价
    var compareText = queryAllText(selectors.compareAtPrice || []);
    if (compareText && !result.compareAtPrice) {
      var cmpMatch = compareText.match(/[\d.]+/);
      result.compareAtPrice = cmpMatch ? parseFloat(cmpMatch[0]) : null;
    }

    // 描述
    result.description = queryAllHtml(selectors.description);

    // 短描述
    result.shortDescription = queryAllText(selectors.shortDescription || []);

    // 图片
    result.images = ImageProcessor.extractImages(selectors.images);

    // 属性 (使用 SpecParser 的增强提取)
    result.attributes = SpecParser.extractAttributes();
    console.log('[alibaba-v2] SpecParser attrs:', result.attributes?.length);
    
    // 如果属性为空，尝试从 data-testid 行直接提取
    if (!result.attributes || result.attributes.length === 0) {
      try {
        var rows = document.querySelectorAll('[data-testid="three-column-key-attributes-row"]');
        console.log('[alibaba-v2] direct rows found:', rows.length);
        if (rows.length > 0) {
          var newAttrs = [];
          rows.forEach(function(r) {
            var divs = r.querySelectorAll(':scope > div');
            if (divs.length >= 2) {
              var nm = divs[0].textContent.trim();
              var vl = divs[1].textContent.trim();
              if (nm && vl && nm.length < 100) newAttrs.push({ name: nm, value: vl, unit: null });
            }
          });
          if (newAttrs.length > 0) result.attributes = newAttrs;
        }
      } catch(e) { console.warn('[alibaba-v2] direct attr error:', e); }
    }

    // 品牌
    result.brand = queryAllText(selectors.brand || []);

    // SKU
    result.sku = queryAllText(selectors.sku || []);

    // 重量
    var weightText = queryAllText(selectors.weight || []);
    if (weightText) {
      var wm = weightText.match(/([\d.]+)/);
      result.weight = wm ? parseFloat(wm[1]) : null;
    }

    // 货币
    if (priceText && priceText.indexOf('CN') !== -1) result.currency = 'CNY';
    else if (priceText && priceText.indexOf('US') !== -1) result.currency = 'USD';

    return result;
  }

  /** 合并提取数据（不覆盖已存在字段） */
  function mergeExtracted(target, source) {
    if (!source) return;
    var fields = ['title', 'price', 'compareAtPrice', 'currency', 'description',
      'shortDescription', 'brand', 'sku', 'sourceId', 'category'];
    fields.forEach(function (f) {
      if (!target[f] && source[f]) target[f] = source[f];
    });
    if (!target.images || target.images.length === 0) {
      if (source.images && source.images.length > 0) {
        target.images = JsonLdParser.extractHdImages(source.images);
      }
    }
    if (source.aggregateRating) target.aggregateRating = source.aggregateRating;
  }

  /** 填充缺失字段（不覆盖已存在） */
  function fillMissing(target, source) {
    if (!source) return;
    ['title', 'price', 'currency', 'description', 'sourceId', 'brand'].forEach(function (f) {
      if (!target[f] && source[f]) target[f] = source[f];
    });
    if ((!target.images || target.images.length === 0) && source.images && source.images.length > 0) {
      target.images = source.images.map(function (url) {
        return {
          type: 'gallery',
          originalUrl: typeof url === 'string' ? url : (url.url || ''),
          mimeType: 'image/jpeg',
          fileName: 'image.jpg',
        };
      });
    }
    // 变体
    if ((!target.variants || target.variants.length === 0) && source.variants) {
      try {
        target.variants = normalizeImportedVariants(source.variants);
      } catch (e) { /*skip*/ }
    }
  }

  /** 规范化导入的变体数据 */
  function normalizeImportedVariants(variants) {
    if (!Array.isArray(variants)) return [];
    return variants.map(function (v) {
      if (v.price || v.stock) {
        return {
          sku: v.sku || v.id || null,
          price: v.price ? parseFloat(v.price) : null,
          stock: v.stock !== undefined ? parseInt(v.stock, 10) : null,
          options: v.options || v.attrs || v.props || v.specs || [],
        };
      }
      return null;
    }).filter(Boolean);
  }

  /** 提取预览摘要（轻量级，不执行全部解析） */
  function extractPreview(platform) {
    if (!platform) platform = detectPlatform();
    if (!SelectorRegistry[platform]) platform = 'alibaba';
    var selectors = SelectorRegistry[platform] || SelectorRegistry.alibaba;

    var title = queryAllText(selectors.title);
    var priceText = queryAllText(selectors.price);
    var price = null;
    var compareAtPrice = null;
    if (priceText) {
      var pm = priceText.match(/[\d.]+/);
      price = pm ? parseFloat(pm[0]) : null;
    }
    var compareText = queryAllText(selectors.compareAtPrice || []);
    if (compareText) {
      var cm = compareText.match(/[\d.]+/);
      compareAtPrice = cm ? parseFloat(cm[0]) : null;
    }
    var currency = 'USD';
    if (priceText && priceText.indexOf('CN') !== -1) currency = 'CNY';
    var images = ImageProcessor.extractImages(selectors.images, 5);
    var attributes = SpecParser.extractAttributes();
    var attributes = attributes ? attributes.slice(0, 20) : [];
    var variantCount = VariantParser.estimateCount();
    if (variantCount === 0) variantCount = TieredPriceParser.estimateVariantCount();

    return {
      title: title || '(无标题)',
      price: price,
      compareAtPrice: compareAtPrice,
      currency: currency,
      imageCount: images.length,
      attrCount: attributes.length,
      variantCount: variantCount,
    };
  }

  /** 提取深层预览（含完整变体数） */
  function extractDeepPreview(platform) {
    if (!platform) platform = detectPlatform();
    var preview = extractPreview(platform);

    // 尝试获取真实变体数
    var variants = VariantParser.extract();
    if (variants && variants.length > 0) {
      preview.variantCount = variants.length;
    }

    return preview;
  }

  // ===== 通用 DOM 工具 =====
  function queryAllText(selectors) {
    if (!selectors || !Array.isArray(selectors)) return '';
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function queryAllHtml(selectors) {
    if (!selectors || !Array.isArray(selectors)) return '';
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.innerHTML.trim()) return el.innerHTML.trim();
    }
    return '';
  }

  function detectPlatform() {
    var url = window.location.href;
    if (url.indexOf('alibaba.com') !== -1) return 'alibaba';
    if (url.indexOf('1688.com') !== -1) return '1688';
    return 'unknown';
  }

  parsers.AlibabaV2Engine = {
    extractFullProduct: extractFullProduct,
    extractPreview: extractPreview,
    extractDeepPreview: extractDeepPreview,
    detectPlatform: detectPlatform,
  };
})();
