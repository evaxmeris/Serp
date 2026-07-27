/**
 * JSON-LD + window.detailData 解析器
 *
 * 从页面嵌入的 JSON-LD (schema.org) 结构化数据和 window 全局变量中提取产品信息。
 * 作为 DOM 选择器提取的兜底方案，通常在 SPA 渲染的页面更为可靠。
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  /** 从 JSON-LD script 标签提取结构化数据 */
  function extractJsonLd() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var productData = null;

    scripts.forEach(function (script) {
      try {
        var data = JSON.parse(script.textContent);
        var items = data['@graph'] || [data];

        items.forEach(function (item) {
          if (!item) return;
          // 产品类型: Product, IndividualProduct, ProductGroup
          if (item['@type'] && item['@type'].toLowerCase().indexOf('product') !== -1) {
            if (!productData) productData = {};
            // 标题
            if (item.name && !productData.title) productData.title = item.name;
            // 描述
            if (item.description && !productData.description) productData.description = item.description;
            // SKU
            if (item.sku && !productData.sku) productData.sku = item.sku;
            // 品牌
            if (item.brand) {
              var brandName = typeof item.brand === 'string' ? item.brand :
                (item.brand.name || (item.brand['@id'] || '').split('/').pop());
              if (brandName && !productData.brand) productData.brand = brandName;
            }
            // 图片
            if (item.image) {
              var images = Array.isArray(item.image) ? item.image : [item.image];
              images = images.map(function (img) {
                return typeof img === 'string' ? img : (img.url || img.contentUrl || '');
              }).filter(Boolean);
              if (images.length > 0 && !productData.images) productData.images = images;
            }
            // 价格
            if (item.offers) {
              var offers = Array.isArray(item.offers) ? item.offers : [item.offers];
              offers.forEach(function (offer) {
                if (!offer) return;
                if (offer.price && !productData.price) productData.price = parseFloat(offer.price);
                if (offer.priceCurrency && !productData.currency) productData.currency = offer.priceCurrency;
                if (offer.priceSpecification && !productData.tieredPricing) {
                  productData.tieredPricing = extractTieredFromOffer(offer.priceSpecification);
                }
                // 划线价
                if (offer.priceSpecification) {
                  var specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification];
                  specs.forEach(function (spec) {
                    if (spec['@type'] === 'UnitPriceSpecification' && spec.priceType === 'OriginalPrice' && spec.price) {
                      productData.compareAtPrice = parseFloat(spec.price);
                    }
                  });
                }
              });
            }
            // 聚合评分
            if (item.aggregateRating) {
              productData.aggregateRating = {
                ratingValue: parseFloat(item.aggregateRating.ratingValue) || null,
                reviewCount: parseInt(item.aggregateRating.reviewCount, 10) || null,
              };
            }
            // 产品ID
            if (item.productId && !productData.sourceId) productData.sourceId = item.productId;
            // 属性/规格（从 additionalProperty 提取）
            if (item.additionalProperty) {
              var props = Array.isArray(item.additionalProperty) ? item.additionalProperty : [item.additionalProperty];
              var attrList = [];
              props.forEach(function(p) {
                if (p && p.name && p.value) attrList.push({ name: p.name, value: p.value, unit: null });
              });
              if (attrList.length > 0) {
                productData.attributes = (productData.attributes || []).concat(attrList);
              }
            }
            // 分类
            if (item.category && !productData.category) {
              productData.category = typeof item.category === 'string' ? item.category :
                (item.category.name || '');
            }
          }
        });
      } catch (e) {
        // 单个 JSON-LD 解析失败不影响其他
      }
    });

    return productData;
  }

  /** 从价格规格中提取阶梯定价 */
  function extractTieredFromOffer(spec) {
    var specs = Array.isArray(spec) ? spec : [spec];
    var tiers = [];
    specs.forEach(function (s) {
      if (s['@type'] === 'UnitPriceSpecification' && s.price) {
        tiers.push({
          minQty: parseInt(s.eligibleQuantity?.value, 10) || 1,
          maxQty: s.eligibleQuantity?.maxValue ? parseInt(s.eligibleQuantity.maxValue, 10) : null,
          price: parseFloat(s.price),
          unit: s.unitText || s.priceCurrency || 'USD',
        });
      }
    });
    return tiers.length > 0 ? tiers : null;
  }

  /** 从 window.detailData 或 window.__INITIAL_STATE__ 提取数据 */
  function extractWindowData() {
    var result = {};
    var sources = [
      window.detailData,
      window.__INITIAL_STATE__,
      window.__NUXT__?.state,
      window.__NEXT_DATA__?.props?.pageProps?.product,
      window.__NEXT_DATA__?.props?.pageProps?.detailData,
      window.__INITIAL_DATA__,
      window.__PAGE_DATA__,
      window.__STORE__,
      window.__DATA__,
      window.pageData,
      window.detail,
      window.productInfo,
      window.skuInfo,
      window.priceInfo,
    ];

    sources.forEach(function (source) {
      if (!source) return;
      try {
        var data = typeof source === 'string' ? JSON.parse(source) : source;

        // 递归搜索可能的 product 对象
        var product = findProductObject(data);
        if (product) {
          if (product.title || product.subject) result.title = product.title || product.subject;
          if (product.price) result.price = parseFloat(product.price);
          if (product.currency) result.currency = product.currency;
          if (product.description || product.detail) result.description = product.description || product.detail;
          if (product.sku || product.productId || product.offerId) result.sourceId = product.sku || product.productId || product.offerId;
          if (product.brand) result.brand = product.brand;
          if (product.images || product.imageList || product.pictures) {
            var imgs = product.images || product.imageList || product.pictures || [];
            result.images = imgs.map(function (i) {
              return typeof i === 'string' ? i : (i.url || i.src || i.original || '');
            }).filter(Boolean);
          }
          // 变体
          if (product.skuList || product.variants || product.specs) {
            result.variants = product.skuList || product.variants || product.specs;
          }
          // 属性
          if (product.attributes || product.props || product.params) {
            result.attributes = product.attributes || product.props || product.params;
          }
        }
      } catch (e) {
        // 单个数据源解析失败不影响
      }
    });

    return Object.keys(result).length > 0 ? result : null;
  }

  /** 递归搜索可能的 product 对象（深度 <= 3） */
  function findProductObject(obj, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 3 || !obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) return null;

    // 检测是否像 product 对象
    var keys = Object.keys(obj);
    var score = 0;
    var productIndicators = ['title', 'price', 'description', 'images', 'sku', 'brand'];
    productIndicators.forEach(function (key) {
      if (keys.indexOf(key) !== -1) score++;
    });
    if (score >= 3) return obj;

    // 递归搜索子属性
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (['product', 'item', 'offer', 'skuData', 'detail'].indexOf(key) !== -1) {
        var found = findProductObject(obj[key], depth + 1);
        if (found) return found;
      }
    }
    // 通搜所有对象属性
    for (var j = 0; j < keys.length; j++) {
      var val = obj[keys[j]];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        var found2 = findProductObject(val, depth + 1);
        if (found2) return found2;
      }
    }
    return null;
  }

  /** 高清 URL 升级 — 将普通图片 URL 转为更高清版本 */
  function upgradeImageUrl(url) {
    if (!url) return url;
    // 阿里 CDN 规格后缀
    var hdRules = [
      // 去掉尺寸限制
      [/_50x50\./g, '.'],
      [/_100x100\./g, '.'],
      [/_200x200\./g, '.'],
      [/_220x220\./g, '.'],
      [/_350x350\./g, '.'],
      [/_400x400\./g, '.'],
      [/\.jpg_.*$/, '.jpg'],
      [/\.png_.*$/, '.png'],
      // 替换缩略图后缀
      [/\.jpg_640x640.*$/i, '.jpg'],
      [/\.jpg_310x310.*$/i, '.jpg'],
    ];
    var result = url;
    hdRules.forEach(function (rule) {
      result = result.replace(rule[0], rule[1]);
    });
    return result;
  }

  /** 提取高清版图片 URLs */
  function extractHdImages(rawImages) {
    if (!rawImages || rawImages.length === 0) return [];
    var seen = new Set();
    return rawImages.map(function (img) {
      var url = typeof img === 'string' ? img : (img.originalUrl || img.src || img.url || '');
      var hdUrl = upgradeImageUrl(url);
      if (seen.has(hdUrl)) return null;
      seen.add(hdUrl);
      return {
        type: 'gallery',
        originalUrl: hdUrl.startsWith('//') ? 'https:' + hdUrl : hdUrl,
        mimeType: hdUrl.indexOf('.png') !== -1 ? 'image/png' : 'image/jpeg',
        fileName: 'image_' + (seen.size) + '.jpg',
      };
    }).filter(Boolean);
  }

  parsers.JsonLdParser = {
    extract: extractJsonLd,
    extractWindowData: extractWindowData,
    upgradeImageUrl: upgradeImageUrl,
    extractHdImages: extractHdImages,
  };
})();
