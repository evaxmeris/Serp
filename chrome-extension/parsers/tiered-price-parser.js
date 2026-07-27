/**
 * 阶梯定价解析器 — 基于 YrayPixels/alibaba-scraper 验证的提取逻辑
 *
 * 提取策略（按优先级）:
 *   1. [data-testid="ladder-price"] .price-item → 现代阿里阶梯定价
 *   2. [data-testid="product-price"] → 产品价格容器
 *   3. [class*="ladder"] / [class*="price-item"] / .price-row → 通用阶梯结构
 *   4. table[class*="price"] / table[class*="ladder"] / .price-table → 表格格式
 *   5. meta[property="product:price:amount"] → meta 标签兜底
 *   6. [class*="price"] / .product-price → 通用价格兜底
 *
 * 支持:
 *   - 数量范围解析（>= X, X - Y, X+ 三种模式）
 *   - 货币检测（NGN/CNY/USD/EUR/GBP）
 *   - 价格提取和清洗
 */
(function () {
  'use strict';
  var parsers = window.__ERP_PARSERS__ = window.__ERP_PARSERS__ || {};

  /**
   * 检测文本中的货币符号/代码
   */
  function detectCurrency(text) {
    if (!text) return 'USD';
    if (text.indexOf('NGN') !== -1 || text.indexOf('₦') !== -1) return 'NGN';
    if (text.indexOf('CNY') !== -1 || text.indexOf('¥') !== -1) return 'CNY';
    if (text.indexOf('USD') !== -1 || text.indexOf('US$') !== -1) return 'USD';
    if (text.indexOf('EUR') !== -1 || text.indexOf('€') !== -1) return 'EUR';
    if (text.indexOf('GBP') !== -1 || text.indexOf('£') !== -1) return 'GBP';
    return 'USD';
  }

  /**
   * 从文本中提取数量范围
   * 支持: >= X, > X, X - Y, X-Y, X~Y, X–Y, X—Y, X+
   */
  function parseQuantityRange(text) {
    if (!text) return null;

    // Handle >= X or > X format
    var greaterThanMatch = text.match(/>\s*=\s*(\d+)/i) || text.match(/>\s*(\d+)/i);
    if (greaterThanMatch) {
      return {
        minQuantity: parseInt(greaterThanMatch[1], 10),
        maxQuantity: null, // No upper limit
      };
    }

    // Handle X - Y or X-Y or X~Y or X–Y or X—Y format
    var rangeMatch = text.match(/(\d+)\s*[-~–—]\s*(\d+)/);
    if (rangeMatch) {
      return {
        minQuantity: parseInt(rangeMatch[1], 10),
        maxQuantity: parseInt(rangeMatch[2], 10),
      };
    }

    // Handle X+ format
    var plusMatch = text.match(/(\d+)\s*\+/);
    if (plusMatch) {
      return {
        minQuantity: parseInt(plusMatch[1], 10),
        maxQuantity: null,
      };
    }

    // Try single number
    var singleMatch = text.match(/(\d+)/);
    if (singleMatch) {
      return {
        minQuantity: parseInt(singleMatch[1], 10),
        maxQuantity: null,
      };
    }

    return null;
  }

  /**
   * 从文本中提取价格数值
   */
  function extractPriceNumber(text) {
    if (!text) return null;
    // Match price pattern with optional currency prefix
    var priceMatch = text.match(/(?:USD|CNY|EUR|GBP|NGN|US\$|¥|€|£|₦)?\s*([\d,]+\\.?\d*)/);
    if (priceMatch) {
      var price = parseFloat(priceMatch[1].replace(/,/g, '').replace(/\s/g, ''));
      if (!isNaN(price) && price > 0) return price;
    }
    return null;
  }

  /**
   * 主入口：从 DOM 提取阶梯定价
   * 返回: [{ minQty, maxQty, price, unit }] 或 null
   */
  function extractTieredPricing() {
    var tiers = [];
    var prices = [];
    var currency = 'USD';

    try {
      // === 策略 1: data-testid="ladder-price" (现代阿里阶梯定价) ===
      var ladderContainer = document.querySelector('[data-testid="ladder-price"]');
      if (ladderContainer) {
        var priceItems = ladderContainer.querySelectorAll('.price-item');

        priceItems.forEach(function (item) {
          // Get quantity range from first div
          var firstDiv = item.querySelector('div');
          var quantityText = firstDiv ? firstDiv.textContent.trim() : '';

          // Get price from span or div
          var priceEl = item.querySelector('span') || item.querySelectorAll('div')[1];
          var priceText = priceEl ? priceEl.textContent.trim() : '';

          if (!priceText) {
            // Try last div
            var allDivs = item.querySelectorAll('div');
            if (allDivs.length > 0) {
              priceText = allDivs[allDivs.length - 1].textContent.trim();
            }
          }

          // Detect currency
          if (priceText) {
            var detected = detectCurrency(priceText);
            if (detected) currency = detected;
          }

          // Parse quantity range
          var qtyRange = parseQuantityRange(quantityText);
          if (!qtyRange) qtyRange = { minQuantity: 1, maxQuantity: null };

          // Extract price number
          var priceNum = extractPriceNumber(priceText);
          if (priceNum !== null && priceNum > 0) {
            tiers.push({
              minQty: qtyRange.minQuantity,
              maxQty: qtyRange.maxQuantity,
              price: priceNum,
              unit: currency,
            });
            prices.push(priceNum);
          }
        });
      }

      // === 策略 2: data-testid="product-price" (产品价格容器) ===
      if (tiers.length === 0) {
        var priceContainer = document.querySelector('[data-testid="product-price"], .module_price');
        if (priceContainer) {
          var ladderItems = priceContainer.querySelectorAll(
            '[class*="ladder"], [class*="price-item"], .price-row, tr'
          );

          ladderItems.forEach(function (el) {
            var text = el.textContent.trim();

            // Detect currency
            var detectedCur = detectCurrency(text);
            if (detectedCur) currency = detectedCur;

            // Pattern: "1-99 pieces" or "100-499 pieces" or "500+ pieces"
            var quantityMatch = text.match(
              /(\d+)\s*[-~–—]\s*(\d+|\+)\s*(?:pieces?|units?|pairs?|sets?|pcs?)/i
            );
            var priceMatches = text.match(
              /(?:USD|CNY|EUR|GBP|NGN|US\$|¥|€|£|₦)?\s*([\d,]+\\.?\d*)/g
            );

            if (quantityMatch && priceMatches) {
              var minQty = parseInt(quantityMatch[1], 10);
              var maxQtyStr = quantityMatch[2];
              var maxQty = maxQtyStr === '+' ? null : parseInt(maxQtyStr, 10);

              // Extract prices from matches
              var priceNumbers = [];
              priceMatches.forEach(function (m) {
                var num = parseFloat(m.replace(/[^\d.,]/g, '').replace(/,/g, ''));
                if (!isNaN(num) && num > 0) priceNumbers.push(num);
              });

              if (priceNumbers.length > 0) {
                var price = priceNumbers[priceNumbers.length - 1]; // Usually the last one
                tiers.push({
                  minQty: minQty,
                  maxQty: maxQty,
                  price: price,
                  unit: currency,
                });
                prices.push(price);
              }
            } else {
              // Fallback: Extract any price numbers
              var numbers = text.match(/[\d,]+\\.?\d*/g);
              if (numbers) {
                numbers.forEach(function (num) {
                  var p = parseFloat(num.replace(/,/g, '').replace(/\s/g, ''));
                  if (!isNaN(p) && p > 0 && p < 1000000) {
                    prices.push(p);
                  }
                });
              }
            }
          });
        }
      }

      // === 策略 3: 表格格式 (table[class*="price"] 等) ===
      if (tiers.length === 0) {
        var priceTable = document.querySelector(
          'table[class*="price"], table[class*="ladder"], .price-table'
        );
        if (priceTable) {
          var rows = priceTable.querySelectorAll('tr');
          rows.forEach(function (row) {
            var cells = row.querySelectorAll('td, th');
            if (cells.length < 2) return;

            var cellTexts = [];
            cells.forEach(function (cell) {
              cellTexts.push(cell.textContent.trim());
            });

            var quantityText = cellTexts[0] || '';
            var priceText = cellTexts[1] || cellTexts[cellTexts.length - 1] || '';

            // Extract quantity range
            var qtyMatch = quantityText.match(/(\d+)\s*[-~–—]\s*(\d+|\+)/);
            if (qtyMatch) {
              var minQty = parseInt(qtyMatch[1], 10);
              var maxQtyStr = qtyMatch[2];
              var maxQty = maxQtyStr === '+' ? null : parseInt(maxQtyStr, 10);
              var detectedCur2 = detectCurrency(priceText);
              if (detectedCur2) currency = detectedCur2;

              var priceMatch = priceText.match(
                /(?:USD|CNY|EUR|GBP|NGN|US\$|¥|€|£|₦)?\s*([\d,]+\\.?\d*)/
              );
              if (priceMatch) {
                var p = parseFloat(priceMatch[1].replace(/,/g, ''));
                if (!isNaN(p) && p > 0) {
                  tiers.push({
                    minQty: minQty,
                    maxQty: maxQty,
                    price: p,
                    unit: currency,
                  });
                  prices.push(p);
                }
              }
            }
          });
        }
      }

      // === 策略 4: meta 标签兜底 ===
      if (prices.length === 0) {
        var metaPrice = document.querySelector('meta[property="product:price:amount"]');
        var metaCurrency = document.querySelector('meta[property="product:price:currency"]');
        if (metaPrice) {
          var p = parseFloat(metaPrice.getAttribute('content') || '');
          if (!isNaN(p)) {
            prices.push(p);
            currency = metaCurrency ? (metaCurrency.getAttribute('content') || 'USD') : 'USD';
          }
        }
      }

      // === 策略 5: 通用价格选择器兜底 ===
      if (prices.length === 0) {
        var priceSelectors = ['.price-text', '[class*="price"]', '.product-price', '[data-pl="price"]'];
        for (var s = 0; s < priceSelectors.length; s++) {
          var elements = document.querySelectorAll(priceSelectors[s]);
          if (elements.length > 0) {
            elements.forEach(function (el) {
              var text = el.textContent.trim();
              var detectedCur3 = detectCurrency(text);
              if (detectedCur3 !== 'USD') currency = detectedCur3;

              var numbers = text.match(/[\d,]+\\.?\d*/g);
              if (numbers) {
                numbers.forEach(function (num) {
                  var p = parseFloat(num.replace(/,/g, ''));
                  if (!isNaN(p) && p > 0 && p < 1000000) {
                    prices.push(p);
                  }
                });
              }
            });
            if (prices.length > 0) break;
          }
        }
      }

      // Filter outliers and sort
      if (prices.length > 0) {
        prices = prices.filter(function (p) { return p > 0; }).sort(function (a, b) { return a - b; });
      }

      // Sort tiers by min quantity
      if (tiers.length > 0) {
        tiers.sort(function (a, b) { return a.minQty - b.minQty; });
      } else if (prices.length > 0) {
        // If no tiers found but we have prices, create a single tier
        tiers.push({
          minQty: 1,
          maxQty: null,
          price: prices[0],
          unit: currency,
        });
      }
    } catch (e) {
      console.error('[TieredPriceParser] Error extracting pricing:', e);
    }

    return tiers.length > 0 ? tiers : null;
  }

  /**
   * 估算变体数（基于选择器匹配到的元素数量）
   */
  function estimateVariantCount() {
    var selectors = [
      '.sku-selector li, .sku-selector option',
      '[class*="sku"] li, [class*="sku"] option',
      '.variant-item',
      '.sku-option',
      '.spec-item',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      if (els.length > 1) return els.length;
    }
    return 0;
  }

  parsers.TieredPriceParser = {
    extract: extractTieredPricing,
    estimateVariantCount: estimateVariantCount,
  };
})();
