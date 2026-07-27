/**
 * 变体解析器 — 基于 YrayPixels/alibaba-scraper 验证的提取逻辑
 *
 * 提取策略:
 *   1. [data-testid="sku-list"] → 每个 sku-list 代表一种变体类型（Color/Size 等）
 *      - [data-testid="sku-list-title"] → 变体名称
 *      - [data-testid="sku-list-item"] → 选项容器
 *      - [data-testid="non-last-sku-item"] → 每个选项
 *        - img → 色块图片（alt/title 作为值）
 *        - background-color CSS → 颜色值
 *        - span → 文本值（尺寸等）
 *   2. .module_sku / [data-module-name="module_sku"] → 兜底
 *
 * 输出: [{ name, type, options: [{ value, imageUrl, selected }] }]
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  /**
   * 将十六进制颜色转换为 RGB
   */
  function hexToRgb(hex) {
    if (hex.length === 3) {
      hex = hex.split('').map(function (c) { return c + c; }).join('');
    }
    var result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : null;
  }

  /**
   * 将 RGB 值转换为颜色名称
   */
  function rgbToColorName(r, g, b) {
    var colors = [
      { name: 'White', rgb: [255, 255, 255] },
      { name: 'Black', rgb: [0, 0, 0] },
      { name: 'Red', rgb: [255, 0, 0] },
      { name: 'Green', rgb: [0, 128, 0] },
      { name: 'Blue', rgb: [0, 0, 255] },
      { name: 'Yellow', rgb: [255, 255, 0] },
      { name: 'Pink', rgb: [255, 192, 203] },
      { name: 'Orange', rgb: [255, 165, 0] },
      { name: 'Purple', rgb: [128, 0, 128] },
      { name: 'Brown', rgb: [165, 42, 42] },
      { name: 'Gray', rgb: [128, 128, 128] },
      { name: 'Grey', rgb: [128, 128, 128] },
      { name: 'Silver', rgb: [192, 192, 192] },
      { name: 'Gold', rgb: [255, 215, 0] },
      { name: 'Navy', rgb: [0, 0, 128] },
      { name: 'Beige', rgb: [245, 245, 220] },
      { name: 'Cyan', rgb: [0, 255, 255] },
      { name: 'Magenta', rgb: [255, 0, 255] },
    ];

    var minDistance = Infinity;
    var closestColor = 'RGB(' + r + ',' + g + ',' + b + ')';

    for (var i = 0; i < colors.length; i++) {
      var color = colors[i];
      var distance = Math.sqrt(
        Math.pow(r - color.rgb[0], 2) +
        Math.pow(g - color.rgb[1], 2) +
        Math.pow(b - color.rgb[2], 2)
      );
      if (distance < 30 && distance < minDistance) {
        minDistance = distance;
        closestColor = color.name;
      }
    }

    return closestColor;
  }

  /**
   * 归一化图片 URL
   */
  function normalizeImageUrl(url) {
    if (!url) return '';
    // Remove thumbnail suffixes
    url = url.replace(/_\d+x\d+\.(jpg|png|webp|jpeg)/i, '.$1');
    url = url.replace(/_(80x80|50x50|100x100|350x350)\.(jpg|png|webp|jpeg)/i, '.$2');
    // Handle relative URLs
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('/') === 0) return 'https://www.alibaba.com' + url;
    return url;
  }

  /**
   * 确定变体类型
   */
  function getVariationType(name) {
    var lower = (name || '').toLowerCase();
    if (lower.indexOf('color') !== -1 || lower.indexOf('colour') !== -1) return 'color';
    if (lower.indexOf('size') !== -1 || lower.indexOf('sizing') !== -1 ||
        lower.indexOf('eur') !== -1 || lower.indexOf('us size') !== -1 ||
        lower.indexOf('uk size') !== -1) return 'size';
    return 'text';
  }

  /**
   * 从 background-color CSS 样式提取颜色名称
   */
  function extractColorFromStyle(element) {
    var style = element.getAttribute('style') || '';
    var bgColorMatch = style.match(/background-color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/i) ||
      style.match(/background-color:\s*#([0-9a-fA-F]{3,6})/i);

    if (bgColorMatch) {
      var colorName;
      if (bgColorMatch[1] && bgColorMatch[2] && bgColorMatch[3]) {
        // RGB format
        colorName = rgbToColorName(
          parseInt(bgColorMatch[1], 10),
          parseInt(bgColorMatch[2], 10),
          parseInt(bgColorMatch[3], 10)
        );
      } else if (bgColorMatch[1]) {
        // Hex format
        var hex = bgColorMatch[1];
        var rgb = hexToRgb(hex);
        if (rgb) {
          colorName = rgbToColorName(rgb.r, rgb.g, rgb.b);
        } else {
          colorName = '#' + hex;
        }
      } else {
        colorName = 'Unknown';
      }

      // Check for title/aria-label override
      var title = element.getAttribute('title') || '';
      var ariaLabel = element.getAttribute('aria-label') || '';
      var attrName = title || ariaLabel;
      if (attrName && attrName.trim().length > 0) {
        colorName = attrName.trim();
      }

      return colorName;
    }

    return null;
  }

  /**
   * 主入口：从 DOM 提取变体数据
   * 返回: [{ name, type, options: [{ value, imageUrl, selected }] }]
   */
  function extractVariants() {
    var variations = [];

    try {
      // === 策略 1: [data-testid="sku-list"] (现代阿里变体结构) ===
      var skuLists = document.querySelectorAll('[data-testid="sku-list"]');

      skuLists.forEach(function (skuListEl) {
        // Extract variation name from title
        var titleEl = skuListEl.querySelector('[data-testid="sku-list-title"]');
        if (!titleEl) return; // Skip if no title

        var variationName = '';
        // Try to get from span if title has nested structure
        var spanInTitle = titleEl.querySelector('span');
        if (spanInTitle && spanInTitle.textContent.trim().length > 0) {
          variationName = spanInTitle.textContent.trim();
        } else {
          variationName = titleEl.textContent.trim();
        }

        // Extract the actual variation name (before colon if present)
        var nameMatch = variationName.match(/^([^:]+)/);
        if (nameMatch) {
          variationName = nameMatch[1].trim();
        }

        if (!variationName || variationName.length === 0) return;

        var variationType = getVariationType(variationName);

        // Find the items container
        var itemsContainer = skuListEl.querySelector('[data-testid="sku-list-item"]');
        if (!itemsContainer) return;

        var options = [];

        // Find all option items
        var optionElements = itemsContainer.querySelectorAll('[data-testid="non-last-sku-item"]');

        optionElements.forEach(function (item) {
          // Check if this option is selected
          var isSelected = item.querySelector('[data-testid="double-bordered-box"].selected') !== null ||
            item.querySelector('[class*="double-bordered-box"].selected') !== null;

          // Try to extract image (for color variations)
          var imageUrl = null;
          var img = item.querySelector('img');
          if (img) {
            var src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy');
            if (src) {
              imageUrl = normalizeImageUrl(src);
            }

            // Get value from alt text or title attribute
            var altText = img.getAttribute('alt') || img.getAttribute('title') || '';
            if (altText && altText.trim().length > 0) {
              options.push({
                value: altText.trim(),
                imageUrl: imageUrl,
                selected: isSelected,
              });
              return; // Skip remaining extraction for this item
            }
          }

          // Check for color variations using background-color CSS style
          var colorBox = item.querySelector('[data-testid="double-bordered-box"], [class*="double-bordered-box"]');
          if (colorBox) {
            var colorName = extractColorFromStyle(colorBox);
            if (colorName) {
              options.push({
                value: colorName,
                imageUrl: null,
                selected: isSelected,
              });
              return;
            }
          }

          // For text-based variations (sizes), extract from span
          var valueSpan = null;
          var spans = item.querySelectorAll('span');
          for (var i = 0; i < spans.length; i++) {
            var span = spans[i];
            var text = span.textContent.trim();
            if (text.length > 0 && span.querySelectorAll('span').length === 0) {
              valueSpan = span;
              break;
            }
          }

          var value = valueSpan ? valueSpan.textContent.trim() : item.textContent.trim();

          // Allow numeric values (sizes like "39", "40") and other text values
          if (value && value.length > 0 && value.length < 100) {
            // Avoid duplicates
            var isDuplicate = options.some(function (opt) { return opt.value === value; });
            if (!isDuplicate) {
              options.push({
                value: value,
                imageUrl: null,
                selected: isSelected,
              });
            }
          }
        });

        if (options.length > 0 && variationName.length > 0) {
          variations.push({
            name: variationName,
            type: variationType,
            options: options,
          });
        }
      });

      // === 策略 2: 兜底 — .module_sku 旧式结构 ===
      if (variations.length === 0) {
        var skuModule = document.querySelector('.module_sku, [data-module-name="module_sku"]');
        if (skuModule) {
          var headings = skuModule.querySelectorAll('h3, h4');
          headings.forEach(function (titleEl) {
            var titleText = titleEl.textContent.trim();

            // Check if this looks like a variation title
            if (titleText.match(/^(Color|Size|Colour|EUR Size|US Size|UK Size|Style|Material)/i)) {
              var varName = titleText.replace(/^[^:]*:\s*/, '').trim() || titleText;
              var varType = getVariationType(varName);
              var varOptions = [];

              // Find options in the next sibling or parent container
              var container = titleEl.nextElementSibling;
              if (container) {
                var optionEls = container.querySelectorAll('img, span, div[class*="box"]');
                optionEls.forEach(function (optionEl) {
                  var img = optionEl.tagName === 'IMG' ? optionEl : optionEl.querySelector('img');
                  if (img) {
                    var src = img.getAttribute('src') || img.getAttribute('data-src');
                    var alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                    if (alt) {
                      varOptions.push({
                        value: alt.trim(),
                        imageUrl: src ? normalizeImageUrl(src) : null,
                        selected: false,
                      });
                    }
                  } else {
                    var text = optionEl.textContent.trim();
                    if (text && text.length > 0 && text.length < 50) {
                      varOptions.push({
                        value: text,
                        imageUrl: null,
                        selected: false,
                      });
                    }
                  }
                });
              }

              if (varOptions.length > 0) {
                variations.push({
                  name: varName,
                  type: varType,
                  options: varOptions,
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.error('[VariantParser] Error extracting variations:', e);
    }

    return variations.length > 0 ? variations : null;
  }

  /**
   * 快速估算变体总数
   */
  function estimateVariantCount() {
    var variantContainers = document.querySelectorAll(
      '.sku-selector li, .sku-option, .variant-item, [class*="sku"] li, ' +
      '[class*="variant"] li, .spec-item, .prop-item'
    );
    if (variantContainers.length > 1) return variantContainers.length;
    return 0;
  }

  parsers.VariantParser = {
    extract: extractVariants,
    estimateCount: estimateVariantCount,
  };
})();
