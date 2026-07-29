/**
 * 规格属性解析器 — 基于 YrayPixels/alibaba-scraper 验证的提取逻辑
 *
 * 提取策略（按优先级）:
 *   1. [data-testid="module-attribute"] → Key Attributes 区域
 *      - [class*="grid-cols-2"] > div → 网格行
 *   2. .product-specs table / .specifications table → 表格格式
 *   3. .specification-item / [class*="property"] → 键值对格式
 *   4. 通用冒号兜底
 *
 * 支持:
 *   - 属性名/值/单位 解析
 *   - 中英文冒号分隔
 *   - 表格/网格/定义列表等不同 DOM 结构
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  /**
   * 主入口：从 DOM 提取规格属性列表
   * 返回: [{ name, value, unit }] 或 []
   */
  function extractAttributes() {
     var attributes = [];
     var seen = {};

     try {
       // === 策略 0: 从页面文本直接提取 Key Attributes ===
       var bodyText = document.body.textContent || '';
       var keyAttrMatch = bodyText.match(/Key\s*Attributes?\s*\n([\s\S]{0,3000})/i);
       if (keyAttrMatch) {
         var section = keyAttrMatch[1];
         var lines = section.split('\n');
         for (var li = 0; li < lines.length - 1; li++) {
           var line = lines[li].trim();
           var nextLine = lines[li + 1].trim();
           // Key attributes pattern: name line followed by value line
           if (line && nextLine && line.length < 60 && nextLine.length < 300 &&
               !line.match(/^(Key Attributes|Details|Description|Shipping|Packaging)$/i) &&
               !seen[line] && line !== nextLine) {
             // Check if next line looks like a value (not a heading)
             if (!nextLine.match(/^(Key Attributes|Details|Packaging|Lead Time)/i) && nextLine.length > 2) {
               seen[line] = true;
               attributes.push({ name: line, value: nextLine, unit: null });
               li++; // skip the value line
             }
           }
         }
       }
      // === 策略 1: 阿里国际站 Key Attributes 区域 ===
      var attributeSection = document.querySelector(
        '[data-testid="module-attribute"], .module_attribute, ' +
        '[data-testid="three-column-key-attributes"], ' +
        '[data-module-name*="key_attribute"], .module_3_tab_key_attribute, ' +
        '[data-testid*="three-column"], [data-testid*="attribute"]'
      );
      // 尝试 data-testid 包含 attribute 的 section
      if (!attributeSection) {
        var allSections = document.querySelectorAll('[class*="key_attr"], [class*="key-attr"], [data-module-name]');
        for (var asi = 0; asi < allSections.length; asi++) {
          if (allSections[asi].textContent.trim().length > 50 && 
              /(key.attr|attribute|specification)/i.test(allSections[asi].getAttribute('data-module-name') || '')) {
            attributeSection = allSections[asi];
            break;
          }
        }
      }
      if (attributeSection) {
        // 查找三列布局中的属性行
        var rows = attributeSection.querySelectorAll(
          '[data-testid="three-column-key-attributes-row"], ' +
          '[class*="grid-cols-2"] > div, [class*="grid-cols-3"] > div, ' +
          '.id-grid > div, [class*="AttrVOS"] > div, [class*="items"] > div, ' +
          '[class*="three-col-overview"] > [class*="three-col"], ' +
          '[data-section*="ThreeCol"] > div, ' +
          '.three-column-layout > div > div, ' +
          '[class*="three-col"] [class*="overview"] > div'
        );
        rows.forEach(function (row) {
          var cells = row.querySelectorAll(':scope > div, :scope > span, :scope > label');
          // 2列或3列布局都支持（三列：序号/名称/值 或 名称/值/单位）
          if (cells.length >= 2) {
            var key = cells[0].textContent.trim();
            var value = cells[cells.length - 1].textContent.trim();
            // 尝试用 cells[1] 作为值（三列时取中间列）
            if (cells.length >= 3) {
              var midVal = cells[1].textContent.trim();
              if (midVal && midVal !== key) value = midVal;
            }
            if (key && value && key.length < 100 && !seen[key]) {
              seen[key] = true;
              attributes.push(parseAttrValue(key, value));
            }
          }
        });
      }

      // === 策略 2: 表格格式 ===
      if (attributes.length === 0) {
        var specSelectors = [
          '.product-specs table',
          '.specifications table',
          '[class*="spec"] table',
          '.product-properties table',
          '.attributes-table',
          '.product-attributes',
          '[data-testid="attributes"] table',
          '.module_product_attrs',
          '.detail-attr table',
          '.product-prop table',
          '.tab-content table',
          'table[class*="attr"]',
          'table[class*="spec"]',
          'table[class*="prop"]',
          'table[class*="param"]',
          'table[class*="detail"]',
        ];

        for (var t = 0; t < specSelectors.length; t++) {
          var table = document.querySelector(specSelectors[t]);
          if (!table) continue;

          var tableRows = table.querySelectorAll('tr');
          if (tableRows.length === 0) continue;

          var found = false;
          tableRows.forEach(function (row) {
            var cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              var key = cells[0].textContent.trim();
              var value = cells[1].textContent.trim();
              // Clean key
              key = key.replace(/[：:*\s]/g, '').trim();
              if (key && value && !seen[key] && key.length < 100 && value.length < 500) {
                seen[key] = true;
                attributes.push(parseAttrValue(key, value));
                found = true;
              }
            }
          });
          if (found && attributes.length > 0) break;
        }
      }

      // === 策略 3: 键值对格式 (li / .spec-item) ===
      if (attributes.length === 0) {
        var itemSelectors = [
          '.specification-item',
          '.spec-item',
          '[class*="property"]',
          '.attribute-list li',
          '.specification li',
          '[class*="attribute"] li',
          '.props-table tr',
          '.params-table tr',
          '[class*="spec"] li',
          '.detail-item',
          '[class*="detail"] li',
          '[class*="info"] li',
        ];

        for (var i = 0; i < itemSelectors.length; i++) {
          var items = document.querySelectorAll(itemSelectors[i]);
          if (items.length === 0) continue;

          var found2 = false;
          items.forEach(function (item) {
            var key = (item.querySelector('.spec-key, .property-key, dt') || {}).textContent;
            var value = (item.querySelector('.spec-value, .property-value, dd') || {}).textContent;

            if (key && value) {
              key = key.trim();
              value = value.trim();
              if (key && value && !seen[key] && key.length < 100) {
                seen[key] = true;
                attributes.push(parseAttrValue(key, value));
                found2 = true;
                return;
              }
            }

            // Parse from list item with spans
            var spans = item.querySelectorAll('span, label, .name, .value');
            if (spans.length >= 2) {
              key = spans[0].textContent.replace(/[：:]/g, '').trim();
              value = spans[1].textContent.trim();
              var unit = '';
              if (spans.length >= 3) unit = spans[2].textContent.trim();
              if (key && value && !seen[key]) {
                seen[key] = true;
                attributes.push({ name: key, value: value, unit: unit || null });
                found2 = true;
              }
            }
          });
          if (found2) break;
        }
      }

      // === 策略 4: 定义列表 (dl/dt/dd) ===
      if (attributes.length === 0) {
        var dls = document.querySelectorAll(
          'dl[class*="attr"], dl[class*="spec"], dl[class*="prop"], dl[class*="param"]'
        );
        dls.forEach(function (dl) {
          var terms = dl.querySelectorAll('dt');
          terms.forEach(function (dt) {
            var dd = dt.nextElementSibling;
            if (dd && dd.tagName === 'DD') {
              var key = dt.textContent.trim();
              var value = dd.textContent.trim();
              if (key && value && !seen[key] && key.length < 100 && value.length < 500) {
                seen[key] = true;
                attributes.push({ name: key, value: value, unit: '' });
              }
            }
          });
        });
      }

      // === 策略 4.5: Key Attributes 文本直接解析 ===
      if (attributes.length === 0) {
        var bt = document.body.textContent || '';
        var kaIdx = bt.toLowerCase().indexOf('key attributes');
        if (kaIdx >= 0) {
          var section = bt.substring(kaIdx + 14, kaIdx + 800);
          var knownAttrs = ['type', 'Application', 'Skin Type', 'age group', 'form', 'size type', 'feature', 'ingredient', 'Material', 'Color', 'Size', 'Weight', 'Brand', 'Model', 'Place of Origin', 'MOQ', 'Supply Type', 'Ingredient', 'Benefit', 'Capacity', 'Net Weight'];
          knownAttrs.forEach(function(kaname) {
            var ki = section.indexOf(kaname);
            if (ki >= 0 && !seen[kaname]) {
              var valStart = ki + kaname.length;
              var valEnd = section.length;
              knownAttrs.forEach(function(other) {
                if (other === kaname) return;
                var ni = section.indexOf(other, valStart);
                if (ni > 0 && ni < valEnd) valEnd = ni;
              });
              var val = section.substring(valStart, valEnd).replace(/^[：:\s]+/, '').trim();
              if (val && val.length < 150) {
                seen[kaname] = true;
                attributes.push({ name: kaname, value: val, unit: null });
              }
            }
          });
        }
      }

      // === 策略 5: 通配兜底 — 页面中所有带冒号的短文本 ===
      if (attributes.length === 0) {
        var allEls = document.querySelectorAll(
          'tr, li, .item, .field, .row, div[class*="item"], span[class*="label"], p'
        );
        var seenCount = 0;
        allEls.forEach(function (el) {
          if (seenCount > 50) return;
          var text = el.textContent.trim();
          if (text.length < 5 || text.length > 300) return;

          var ci = text.indexOf('：');
          if (ci === -1) ci = text.indexOf(':');
          if (ci > 0 && ci < 40) {
            var key = text.substring(0, ci).trim();
            var rest = text.substring(ci + 1).trim();
            if (key && rest && !seen[key] && rest.length < 250) {
              seen[key] = true;
              attributes.push({ name: key, value: rest, unit: null });
              seenCount++;
            }
          }
        });
      }
    } catch (e) {
      console.error('[SpecParser] Error extracting attributes:', e);
    }

    // Deduplicate, limit to 50
    var result = [];
    var resultSeen = {};
    for (var a = 0; a < attributes.length && result.length < 50; a++) {
      var attr = attributes[a];
      if (!resultSeen[attr.name]) {
        resultSeen[attr.name] = true;
        result.push({
          name: attr.name,
          value: attr.value,
          unit: attr.unit || null,
        });
      }
    }

    return result;
  }

  /**
   * 解析属性值，尝试拆分为 value + unit
   */
  function parseAttrValue(name, value) {
    var unit = '';
    // Check if value has unit (e.g., "100 ml")
    var unitMatch = value.match(/^([\d.]+)\s*([a-zA-Z°%μ]+)$/);
    if (unitMatch) {
      value = unitMatch[1];
      unit = unitMatch[2];
    }
    return { name: name, value: value, unit: unit };
  }

  /**
   * 从 DOM 文本中提取品牌名
   */
  function extractBrand() {
    var selectors = [
      '[data-testid="brand"]', '.brand-name', '.brand-info', '[class*="brand"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = el.textContent.trim();
        text = text.replace(/^(品牌|Brand|制造商|Manufacturer)[：:]\s*/i, '').trim();
        if (text && text.length < 100) return text;
      }
    }
    return null;
  }

  /**
   * 从 DOM 文本中提取 SKU
   */
  function extractSku() {
    var selectors = [
      '[class*="sku"]', '[class*="product-id"]', '.item-number',
      'meta[property="product:sku"]',
      '[data-testid="sku"]', '.product-sku', '.sku-code', '.item-code',
      '[class*="sku"] .value', '.offer-id',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        // Handle meta tags
        if (el.tagName === 'META') {
          var content = el.getAttribute('content');
          if (content) return content;
          continue;
        }
        var text = el.textContent.trim();
        text = text.replace(/^(SKU|sku|货号|产品编号)[：:]\s*/i, '').trim();
        if (text && text.length < 100) {
          var skuMatch = text.match(/[A-Z0-9-]+/);
          if (skuMatch) return skuMatch[0];
        }
      }
    }
    // URL-based extraction
    var url = window.location.href;
    var match = url.match(/_(a?\d+)\.html/) || url.match(/offer\/(\d+)\.html/);
    if (match) return match[1];
    return null;
  }

  /**
   * 提取重量信息
   */
  function extractWeight() {
    var selectors = [
      '[data-testid="weight"]', '.product-weight', '.item-weight', '[class*="weight"]',
      '.shipping-weight', '.package-weight',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = el.textContent.trim();
        var numMatch = text.match(/([\d.]+)\s*(kg|g|KG|KG|克|千克)?/i);
        if (numMatch) return parseFloat(numMatch[1]);
      }
    }
    return null;
  }

  /**
   * 提取物流尺寸
   */
  function extractDimensions() {
    var selectors = [
      '[data-testid="dimensions"]', '.product-dimensions', '.package-size',
      '[class*="dimension"]', '.shipping-dimensions',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = el.textContent.trim();
        var dimMatch = text.match(/([\d.]+)\s*[×xX]\s*([\d.]+)\s*[×xX]\s*([\d.]+)/);
        if (dimMatch) {
          return {
            length: parseFloat(dimMatch[1]),
            width: parseFloat(dimMatch[2]),
            height: parseFloat(dimMatch[3]),
          };
        }
      }
    }
    return null;
  }

  /**
   * 提取 MOQ
   */
  function extractMoq() {
    // From ladder pricing first
    var priceItem = document.querySelector('[data-testid="ladder-price"] .price-item, .price-item');
    if (priceItem) {
      var text = priceItem.textContent.trim();
      var match = text.match(/(\d+)\s*-\s*\d+\s*(pairs?|pieces?|units?)/i);
      if (match) return parseInt(match[1], 10);
      var simpleMatch = text.match(/(\d+)\s*(pairs?|pieces?|units?)/i);
      if (simpleMatch) return parseInt(simpleMatch[1], 10);
    }

    var selectors = [
      '[data-testid="ladder-price"] .price-item', '.price-item',
      '[class*="moq"]', '[class*="minimum-order"]', '.min-order',
      '[data-pl="moq"]', '.moq-info', '.min-buy',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = el.textContent.trim();
        var numMatch = text.match(/(\d+)/);
        if (numMatch) return parseInt(numMatch[1], 10);
      }
    }

    // Try body text pattern
    var bodyText = document.body.textContent;
    var bodyMatch = bodyText.match(/(?:MOQ|Minimum Order|Min\. Order)[:\s]+(\d+\s*\w+)/i);
    if (bodyMatch) {
      var numOnly = bodyMatch[1].match(/(\d+)/);
      if (numOnly) return parseInt(numOnly[1], 10);
    }

    return null;
  }

  /**
   * 提取供应商信息
   */
  function extractSupplier() {
    var selectors = [
      '.company-name a', '.product-company-info .company-name a',
      '.supplier-name', '[class*="company-name"]', '.store-name',
      '[data-pl="supplier-name"]',
      '.company-info', '.shop-info',
      '[data-testid="supplier"]', '.supplier-info',
      '[class*="company"]', '[class*="supplier"]',
    ];
    var name = '';
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = el.getAttribute('title') || el.textContent.trim();
        if (text && text.length < 200 && text.length > 2) {
          name = text;
          break;
        }
      }
    }

    if (!name) return null;

    return {
      name: name,
      url: window.location.hostname,
      verified: document.querySelector('[class*="verified"], [class*="authenticated"], [class*="gold-supplier"]') ? true : false,
    };
  }

  /**
   * 提取 HS Code
   */
  function extractHsCode() {
    var selectors = ['.hs-code', '[data-testid="hs-code"]', '.customs-code', '[class*="hs-code"]'];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = el.textContent.trim();
        if (text.length < 20) return text;
      }
    }
    return null;
  }

  function detectPlatform() {
    var url = window.location.href;
    if (url.indexOf('alibaba.com') !== -1) return 'alibaba';
    if (url.indexOf('1688.com') !== -1) return '1688';
    return 'unknown';
  }

  parsers.SpecParser = {
    extractAttributes: extractAttributes,
    extractBrand: extractBrand,
    extractSku: extractSku,
    extractWeight: extractWeight,
    extractDimensions: extractDimensions,
    extractMoq: extractMoq,
    extractSupplier: extractSupplier,
    extractHsCode: extractHsCode,
  };
})();
