/**
 * 数据组装器 — 将所有解析器提取的数据组装为完整的 46 字段 API payload
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  /** 组装完整 payload */
  function assemble(extracted) {
    if (!extracted) extracted = {};

    // 判断平台：阿里国际站(英文) → descriptionEn, 1688(中文) → description
    var isChinesePlatform = window.location.href.indexOf('1688.com') !== -1;

    var payload = {
      // === 基本信息 ===
      source: extracted.source || 'alibaba',
      sourceUrl: extracted.sourceUrl || window.location.href,
      sourceId: extracted.sourceId || extractSourceId(),
      title: extracted.title || parsers.SpecParser?.extractSku() || '(无标题)',
      titleEn: extracted.titleEn || '',
      brand: extracted.brand || parsers.SpecParser?.extractBrand() || null,
      sku: extracted.sku || parsers.SpecParser?.extractSku() || null,

      // === 价格信息 ===
      price: extracted.price || null,
      compareAtPrice: extracted.compareAtPrice || null,
      currency: extracted.currency || guessCurrency(),

      // === 图片 ===
      images: extracted.images || [],

      // === 描述 ===
      // 阿里国际站(英文) → descriptionEn, 1688(中文) → description
      description: extracted.description || '',
      descriptionEn: isChinesePlatform ? (extracted.descriptionEn || '') : (extracted.description || ''),
      shortDescription: extracted.shortDescription || '',

      // === 规格属性 ===
      attributes: extracted.attributes || [],

      // === 变体 ===
      variants: extracted.variants || [],

      // === 物流信息 ===
      weight: extracted.weight || parsers.SpecParser?.extractWeight() || null,
      length: extracted.dimensions?.length || null,
      width: extracted.dimensions?.width || null,
      height: extracted.dimensions?.height || null,
      shippingClass: extracted.shippingClass || null,
      hsCode: extracted.hsCode || parsers.SpecParser?.extractHsCode() || null,

      // === 原始数据 ===
      rawData: buildRawData(extracted),

      // === meta ===
      meta: {
        extractedAt: new Date().toISOString(),
        extractorVersion: '2.0',
        platform: extracted.source || 'alibaba',
      },
    };

    // 清理 null/undefined 值（不需要发送 null）
    return cleanPayload(payload);
  }

  /** 从 URL 提取产品 ID */
  function extractSourceId() {
    var url = window.location.href;
    var match = url.match(/_(a?\d+)\.html/) || url.match(/offer\/(\d+)\.html/) || url.match(/product\/(\d+)/);
    return match ? match[1] : null;
  }

  /** 猜测货币单位 */
  function guessCurrency() {
    var url = window.location.href;
    if (url.indexOf('1688.com') !== -1) return 'CNY';
    if (url.indexOf('alibaba.com') !== -1) return 'USD';
    return 'USD';
  }

  /** 构建 rawData（包含阶梯定价/供应商/评分等不直接映射的字段） */
  function buildRawData(extracted) {
    return {
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      tieredPricing: extracted.tieredPricing || null,
      supplier: extracted.supplier || parsers.SpecParser?.extractSupplier() || null,
      aggregateRating: extracted.aggregateRating || null,
      moq: extracted.moq || parsers.SpecParser?.extractMoq() || null,
      category: extracted.category || null,
      certifications: extracted.certifications || [],
    };
  }

  /** 递归清理 null/undefined 值 */
  function cleanPayload(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
      var cleaned = obj.map(cleanPayload).filter(function (v) { return v !== undefined; });
      return cleaned.length > 0 ? cleaned : undefined;
    }
    if (typeof obj === 'object') {
      var result = {};
      var keys = Object.keys(obj);
      var hasValue = false;
      keys.forEach(function (key) {
        var val = cleanPayload(obj[key]);
        if (val !== undefined) {
          // 空对象也清理
          if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return;
          if (Array.isArray(val) && val.length === 0) return;
          result[key] = val;
          hasValue = true;
        }
      });
      return hasValue ? result : undefined;
    }
    return obj;
  }

  /** 从提取数据中计算预览摘要 */
  function buildPreview(extracted) {
    return {
      title: extracted.title || '(无标题)',
      price: extracted.price || null,
      compareAtPrice: extracted.compareAtPrice || null,
      currency: extracted.currency || guessCurrency(),
      imageCount: (extracted.images || []).length,
      attrCount: (extracted.attributes || []).length,
      variantCount: (extracted.variants || []).length,
    };
  }

  parsers.PayloadAssembler = {
    assemble: assemble,
    buildPreview: buildPreview,
  };
})();
