"""
Alibaba 产品提取器 — 从搜索列表页和详情页提取结构化数据

策略：
1. 详情页：优先 Playwright locator（Python侧），JSON-LD 用 page.evaluate()
2. 搜索页：Playwright locator 全量提取
"""
import re
import json
import logging
from typing import Optional
from playwright.async_api import Page

logger = logging.getLogger(__name__)


# ===== 通用工具 =====

def make_absolute_url(url_str: str) -> str:
    if not url_str:
        return ""
    if url_str.startswith(("http://", "https://")):
        return url_str
    if url_str.startswith("//"):
        return f"https:{url_str}"
    if url_str.startswith("/"):
        return f"https://www.alibaba.com{url_str}"
    return f"https://www.alibaba.com/{url_str}"


def detect_currency(price_text: str) -> str:
    price_text = price_text.upper()
    currency_map = {
        "USD": "USD", "US$": "USD", "US $": "USD", "$": "USD",
        "EUR": "EUR", "€": "EUR",
        "GBP": "GBP", "£": "GBP",
        "JPY": "JPY", "¥": "JPY",
        "CNY": "CNY", "CN¥": "CNY", "RMB": "CNY",
    }
    for code, currency in currency_map.items():
        if code in price_text:
            return currency
    return "USD"


def parse_price(price_str: str) -> Optional[float]:
    if not price_str:
        return None
    match = re.search(r'[\d,]+\s*\.?\d*', price_str.replace(",", ""))
    if match:
        try:
            return float(match.group(0).replace(",", ""))
        except ValueError:
            return None
    return None


def clean_image_url(src: str) -> Optional[str]:
    """清理阿里 CDN URL，去掉尺寸限定，返回原始大图 URL"""
    if not src:
        return None
    url = src if not src.startswith("//") else f"https:{src}"
    url = url.split("?")[0]
    # 去掉尺寸/Q后缀
    url = re.sub(r'_\d+x\d+\.', '.', url)
    url = re.sub(r'_q\d+\.', '.', url)
    url = re.sub(r'_\.', '.', url)
    # 必须是阿里 kf/ CDN 或明显是产品图
    if '/kf/' in url or re.search(r'\.(jpg|jpeg|png|webp)(\?|$)', url, re.I):
        return url
    return None


# ===== 搜索列表页 =====

async def extract_search_results(page: Page) -> list[dict]:
    """从搜索列表页提取产品卡片"""
    try:
        await page.wait_for_selector(".fy26-product-card-wrapper", timeout=15000)
    except Exception:
        logger.warning("搜索页产品卡片未出现，继续...")

    cards = page.locator(".fy26-product-card-wrapper")
    count = await cards.count()
    logger.info(f"搜索页找到 {count} 个产品卡片")

    results = []
    for i in range(count):
        card = cards.nth(i)
        p = await _extract_card(card)
        if p and p.get("name"):
            results.append(p)
    return results


async def _extract_card(card) -> dict:
    """提取单个搜索结果卡片"""
    p = {}

    # 名称
    try:
        name_el = card.locator("h2 span, .searchx-product-e-title span, [data-role='title-area']").first
        if await name_el.count() > 0:
            p["name"] = (await name_el.inner_text()).strip()
    except Exception:
        pass
    if not p.get("name"):
        return {}

    # URL + Product ID
    try:
        for sel in ["a.searchx-product-e-slider__link", "h2 a", "a[href*='product-detail']"]:
            link = card.locator(sel).first
            if await link.count() > 0:
                href = await link.get_attribute("href")
                if href:
                    p["url"] = make_absolute_url(href)
                    m = re.search(r'_(\d{10,})\.html', href)
                    if m:
                        p["productId"] = m.group(1)
                    break
    except Exception:
        pass

    # 价格
    try:
        price_el = card.locator(".searchx-product-price-price-main").first
        if await price_el.count() > 0:
            text = (await price_el.inner_text()).strip()
            p["currency"] = detect_currency(text)
            p["price"] = parse_price(text)
    except Exception:
        p["currency"] = "USD"

    # 图片
    try:
        img_el = card.locator("img.searchx-product-e-slider__img").first
        if await img_el.count() > 0:
            src = await img_el.get_attribute("src") or ""
            cleaned = clean_image_url(src)
            if cleaned:
                p["imageUrl"] = cleaned
    except Exception:
        pass

    # 卖家
    try:
        seller_el = card.locator(".searchx-product-e-company").first
        if await seller_el.count() > 0:
            p["seller"] = {
                "name": (await seller_el.inner_text()).strip(),
                "url": make_absolute_url(await seller_el.get_attribute("href") or ""),
            }
    except Exception:
        pass

    # 评分
    try:
        rating_el = card.locator(".searchx-review-score").first
        if await rating_el.count() > 0:
            p["rating"] = parse_price(await rating_el.inner_text())
        review_el = card.locator(".searchx-product-e-review").first
        if await review_el.count() > 0:
            m = re.search(r'\((\d+)\)', await review_el.inner_text())
            if m:
                p["reviewCount"] = int(m.group(1))
    except Exception:
        pass

    return p


# ===== 详情页 =====

async def extract_product_detail(page: Page) -> dict:
    """从产品详情页提取完整信息"""
    # 1. JSON-LD 提取（浏览器上下文）
    jsonld = await _extract_jsonld(page)

    # 2. 用更健壮的方式从 DOM 补充
    product = dict(jsonld) if jsonld else {}

    # 确保基础字段
    if not product.get("name"):
        try:
            h1 = page.locator("h1").first
            if await h1.count() > 0:
                product["name"] = (await h1.inner_text()).strip()
        except Exception:
            product["name"] = ""

    if not product.get("url"):
        product["url"] = page.url

    # Product ID
    if not product.get("productId"):
        m = re.search(r'_(\d{10,})\.html', page.url)
        if m:
            product["productId"] = m.group(1)

    # Brand
    if not product.get("brand"):
        try:
            brand_cell = page.locator("#key-attributes div:has-text('Brand') + div, #key-attributes .id-grid div:has-text('brand')")
            if await brand_cell.count() > 0:
                product["brand"] = (await brand_cell.first.inner_text()).strip()
        except Exception:
            pass

    # Category (面包屑)
    if not product.get("category"):
        try:
            crumbs = page.locator("ol.breadcrumb li:last-child a, ol li:last-child a")
            if await crumbs.count() > 0:
                product["category"] = (await crumbs.first.inner_text()).strip()
        except Exception:
            pass

    # Price fallback
    if not product.get("price"):
        for sel in [".id-font-bold", ".product-price", "[data-testid='price']",
                     ".price-range", "[class*='price']"]:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    text = (await el.inner_text()).strip()
                    product["price"] = parse_price(text)
                    product["currency"] = detect_currency(text)
                    if product["price"]:
                        break
            except Exception:
                continue

    # Description
    if not product.get("description"):
        for sel in [".detail-description", ".product-description",
                     "[data-testid='description']", ".description-content"]:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    product["description"] = await el.inner_html()
                    if product["description"]:
                        break
            except Exception:
                continue

    # Meta description fallback
    if not product.get("description"):
        try:
            meta_desc = await page.get_attribute("meta[name='description']", "content")
            if meta_desc:
                product["description"] = meta_desc
        except Exception:
            pass

    # Images
    images = await _extract_images(page)
    if images:
        product["images"] = images

    # Variants (v2 enhancement)
    variants = await _extract_variants(page)
    if variants:
        product["variants"] = variants

    # Tiered pricing (v2 enhancement)
    tiered_pricing = await _extract_tiered_pricing(page)
    if tiered_pricing:
        product["tieredPricing"] = tiered_pricing

    # Specifications (v2 enhancement: full specs with unit separation)
    specs = await _extract_specs_full(page)
    if not specs:
        specs = await _extract_specs(page)
    if specs:
        product["specifications"] = specs

    # Shipping / logistics info (v2 enhancement)
    shipping = await _extract_shipping_info(page)
    if shipping:
        product.update(shipping)

    # MOQ (v2 enhancement)
    moq = await _extract_moq(page)
    if moq:
        product["moq"] = moq

    # Seller
    if not product.get("seller"):
        try:
            seller_a = page.locator(".company-name a, .supplier-name a, [data-companyname] a").first
            if await seller_a.count() > 0:
                product["seller"] = {
                    "name": (await seller_a.inner_text()).strip(),
                    "url": make_absolute_url(await seller_a.get_attribute("href") or ""),
                }
        except Exception:
            pass

    return product


async def _extract_jsonld(page) -> Optional[dict]:
    """从 JSON-LD script 标签 + window.detailData 双路径提取产品数据"""
    # 路径 A: JSON-LD script tag
    result = await _extract_jsonld_from_scripts(page)
    if result:
        return result

    # 路径 B: window.detailData (兜底)
    result = await _extract_window_data(page)
    if result:
        return result

    return None


async def _extract_jsonld_from_scripts(page) -> Optional[dict]:
    """从 JSON-LD script 标签提取产品数据"""
    js_code = """
    () => {
        try {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const s of scripts) {
                try {
                    const parsed = JSON.parse(s.textContent);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of items) {
                        if (item["@type"] === "Product") {
                            return item;
                        }
                    }
                } catch(e) {}
            }
        } catch(e) {}
        return null;
    }
    """
    try:
        result = await page.evaluate(js_code)
        if not result:
            return None

        product = {}
        product["name"] = result.get("name", "")
        product["productId"] = result.get("sku", "")

        # Images
        images = []
        raw_images = result.get("image", [])
        if isinstance(raw_images, str):
            raw_images = [raw_images]
        for url in raw_images:
            cleaned = clean_image_url(url)
            if cleaned:
                images.append({"url": cleaned, "altText": product["name"]})
        if images:
            product["images"] = images

        # Price
        offers = result.get("offers", {})
        if offers:
            product["currency"] = offers.get("priceCurrency", "USD")
            try:
                product["price"] = float(offers.get("price", 0))
            except (ValueError, TypeError):
                pass
            if offers.get("availability", "").find("InStock") >= 0:
                product["availability"] = "in_stock"

        # Description
        raw_desc = result.get("description", "")
        if raw_desc:
            product["description"] = raw_desc

        # Brand
        brand = result.get("brand", {})
        if isinstance(brand, dict):
            product["brand"] = brand.get("name", "")
        elif isinstance(brand, str):
            product["brand"] = brand

        # Category
        product["category"] = result.get("category", "")

        # Rating
        ar = result.get("aggregateRating", {})
        if ar:
            try:
                product["aggregateRating"] = {
                    "ratingValue": float(ar.get("ratingValue", 0)) if ar.get("ratingValue") else None,
                    "reviewCount": int(ar.get("reviewCount", 0)) if ar.get("reviewCount") else None,
                }
            except (ValueError, TypeError):
                pass

        product["url"] = offers.get("url", "") if offers else ""

        return product
    except Exception as e:
        logger.warning(f"JSON-LD 提取失败: {e}")
        return {}


async def _extract_images(page) -> list[dict]:
    """提取产品图片（从 gallery / main image 区域）"""
    seen = set()
    results = []

    selectors = [
        "#ProductImageMain img",
        ".current-main-image img",
        ".main-index img",
        "[data-role='gallery'] img",
        ".product-gallery img",
        "[data-testid='gallery'] img",
    ]

    for sel in selectors:
        try:
            imgs = page.locator(sel)
            count = await imgs.count()
            for i in range(min(count, 20)):
                src = await imgs.nth(i).get_attribute("src") or ""
                data_src = await imgs.nth(i).get_attribute("data-src") or ""
                final = data_src or src
                cleaned = clean_image_url(final)
                if cleaned and cleaned not in seen:
                    seen.add(cleaned)
                    results.append({
                        "url": cleaned,
                        "altText": await imgs.nth(i).get_attribute("alt") or "",
                    })
                    if len(results) >= 15:
                        return results
        except Exception:
            continue

    return results


async def _extract_specs(page) -> list[dict]:
    """提取产品规格/属性"""
    specs = []
    # 尝试 JSON-LD 内嵌的 specs（但上面已经取了），这里从 DOM 提取
    try:
        rows = page.locator("#key-attributes .id-grid-cols-\\[2fr_3fr\\], .id-grid-cols-\\[2fr_3fr\\]")
        count = await rows.count()
        for i in range(count):
            cells = rows.nth(i).locator("div")
            if await cells.count() >= 2:
                k = (await cells.nth(0).inner_text()).strip()
                v = (await cells.nth(1).inner_text()).strip()
                if k and v and k != v:
                    specs.append({"key": k, "value": v})
    except Exception:
        pass

    # 兜底: 属性表格
    if not specs:
        try:
            table = page.locator("table.attributes-table tr, [data-testid='attributes'] tr, .product-attributes tr")
            count = await table.count()
            for i in range(count):
                cells = table.nth(i).locator("td, th")
                if await cells.count() >= 2:
                    k = (await cells.nth(0).inner_text()).strip()
                    v = (await cells.nth(1).inner_text()).strip()
                    if k and v:
                        specs.append({"key": k, "value": v})
        except Exception:
            pass

    return specs


# ===== v2 Enhanced Extractors =====

UNIT_PATTERN = re.compile(
    r'^(.*?)\s+('
    r'cm|mm|m|inch|inches|in|'
    r'kg|g|mg|lb|lbs|oz|'
    r'ml|l|cl|fl\.oz|gal|'
    r'%|ppm|'
    r'pieces|pcs|sets|pair|boxes|cases|cartons|'
    r'v|w|a|hz|'
    r'mm\b|cm\b|m\b|km\b'
    r')\s*$',
    re.I
)


async def _extract_window_data(page) -> Optional[dict]:
    """从 window.detailData 全局变量提取产品数据（兜底路径）"""
    js_code = """
    () => {
        try {
            // 尝试多种已知全局变量名
            const candidates = [
                window.detailData,
                window.__NUXT__,
                window.__INITIAL_STATE__,
                window.pageData,
                window.productData,
            ];
            for (const data of candidates) {
                if (!data) continue;

                // detailData 可能是数组
                const items = Array.isArray(data) ? data : [data];

                // 尝试找到产品信息
                for (const item of items) {
                    // 标准 detailData 结构
                    if (item.productInfo || item.product) {
                        const p = item.productInfo || item.product;
                        return {
                            title: p.title || p.name || p.subject || '',
                            price: p.price || p.minPrice || null,
                            currency: p.currencyCode || p.currency || 'USD',
                            sku: p.sku || p.productId || '',
                            brand: p.brand || '',
                            description: p.description || '',
                            shortDescription: p.shortDescription || p.summary || '',
                        };
                    }
                    // 扁平结构
                    if (item.title || item.name) {
                        return {
                            title: item.title || item.name || '',
                            price: item.price || item.minPrice || null,
                            currency: item.currencyCode || item.currency || 'USD',
                            sku: item.sku || item.productId || '',
                            brand: item.brand || '',
                            description: item.description || '',
                            shortDescription: item.shortDescription || item.summary || '',
                        };
                    }
                }
            }
        } catch(e) {}
        return null;
    }
    """
    try:
        return await page.evaluate(js_code)
    except Exception as e:
        logger.warning(f"window.detailData 提取失败: {e}")
        return None


async def _extract_variants(page) -> list[dict]:
    """从 DOM 或 window.detailData 提取变体信息"""
    js_code = """
    () => {
        const variants = [];

        // 路径 A: 从 window.detailData 提取变体
        try {
            const data = window.detailData;
            if (data) {
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    // skuList / skuItems / variants
                    const skuLists = [item.skuList, item.skuItems, item.variants, item.productSKUList];
                    for (const sl of skuLists) {
                        if (Array.isArray(sl) && sl.length > 0) {
                            for (const sku of sl) {
                                const options = [];
                                // 解析规格选项
                                const specs = sku.specAttrs || sku.attributes || sku.specs || [];
                                // 也可能是 {颜色: "红色", 尺寸: "M"} 格式
                                for (const [key, val] of Object.entries(sku)) {
                                    if (['specId', 'skuId', 'price', 'stock', 'inventory', 'image'].includes(key)) continue;
                                    if (typeof val === 'string' && val.length < 50) {
                                        options.push({name: key, value: val});
                                    }
                                }
                                // 数组格式
                                if (Array.isArray(specs)) {
                                    for (const spec of specs) {
                                        if (typeof spec === 'object' && spec.name && spec.value) {
                                            options.push({name: spec.name, value: spec.value});
                                        }
                                    }
                                }
                                variants.push({
                                    sku: sku.skuCode || sku.sku || sku.specId || null,
                                    price: parseFloat(sku.price || sku.salePrice || sku.discountPrice) || null,
                                    stock: parseInt(sku.stock || sku.inventory || sku.quantity) || null,
                                    options: options.length > 0 ? options : null,
                                });
                            }
                            if (variants.length > 0) return JSON.parse(JSON.stringify(variants));
                        }
                    }
                }
            }
        } catch(e) {}

        // 路径 B: DOM 选择器 — 变体选择器按钮
        try {
            const selContainer = document.querySelector('[data-role="sku-selector"], .sku-selector, [class*="sku"], [class*="spec-select"]');
            if (selContainer) {
                const btnGroups = selContainer.querySelectorAll('[class*="attr-group"], [data-role="group"], [class*="prop-group"]');
                // 如果 DOM 太复杂无法解析，标记为 presence 即可
                if (btnGroups.length > 0) {
                    variants.push({sku: null, price: null, stock: null, options: null, _hasVariants: true});
                }
            }
        } catch(e) {}

        return variants.length > 0 ? variants : [];
    }
    """
    try:
        result = await page.evaluate(js_code)
        return result if isinstance(result, list) else []
    except Exception as e:
        logger.warning(f"变体提取失败: {e}")
        return []


async def _extract_tiered_pricing(page) -> list[dict]:
    """从 DOM 提取阶梯定价信息"""
    js_code = """
    () => {
        const tiers = [];

        // 路径 A: window.detailData 的 priceList
        try {
            const data = window.detailData;
            if (data) {
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    const priceLists = [item.priceList, item.tieredPriceList, item.tierPriceInfo, item.priceRange];
                    for (const pl of priceLists) {
                        if (Array.isArray(pl) && pl.length > 0) {
                            for (const tier of pl) {
                                const minQty = parseInt(tier.minQuantity || tier.minQty || tier.from || tier.min || 0);
                                const maxQty = tier.maxQuantity || tier.maxQty || tier.to || null;
                                let price = parseFloat(tier.price || tier.unitPrice || tier.discountPrice || tier.value);
                                if (!price) price = parseFloat(tier.priceValue);
                                tiers.push({
                                    minQty: minQty,
                                    maxQty: maxQty ? parseInt(maxQty) : null,
                                    price: price || 0,
                                    unit: 'USD'
                                });
                            }
                            if (tiers.length > 0) return tiers;
                        }
                    }
                }
            }
        } catch(e) {}

        // 路径 B: DOM 中的阶梯价格表格
        try {
            const tables = document.querySelectorAll('.price-range-table, [data-testid="tiered-price"], table[class*="price"], .price-table, [class*="tier"] table');
            for (const table of tables) {
                const rows = table.querySelectorAll('tr');
                for (let i = 1; i < rows.length; i++) {  // 跳过表头
                    const cells = rows[i].querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        // 第一列: 数量范围 (如 "1-99" "100+")
                        const qtyText = cells[0].textContent.trim();
                        const qtyMatch = qtyText.match(/(\\d+)\\s*-\\s*(\\d+)/);
                        const singleMatch = qtyText.match(/^(\\d+)\\+?$/);
                        let minQty = 0, maxQty = null;
                        if (qtyMatch) {
                            minQty = parseInt(qtyMatch[1]);
                            maxQty = parseInt(qtyMatch[2]);
                        } else if (singleMatch) {
                            minQty = parseInt(singleMatch[1]);
                        }
                        // 第二列: 价格
                        const priceText = cells[1].textContent.trim();
                        const price = parseFloat(priceText.replace(/[^\\d.]/g, '')) || 0;
                        tiers.push({minQty, maxQty, price, unit: 'USD'});
                    }
                }
                if (tiers.length > 0) break;
            }
        } catch(e) {}

        // 简单去重
        const seen = new Set();
        return tiers.filter(t => {
            const key = `${t.minQty}-${t.maxQty}-${t.price}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    """
    try:
        result = await page.evaluate(js_code)
        return result if isinstance(result, list) else []
    except Exception as e:
        logger.warning(f"阶梯定价提取失败: {e}")
        return []


async def _extract_specs_full(page) -> list[dict]:
    """全量规格提取，含单位分离"""
    js_code = """
    () => {
        const specs = [];

        // 常用单位正则
        const unitRegex = /^(.*?)\\s+(cm|mm|m|inch|inches|in|kg|g|mg|lb|lbs|oz|ml|l|cl|%|ppm|pieces|pcs|sets|pair|pairs|boxes|cases|carton|v|w|a|hz)\\s*$/i;

        // 路径 A: #key-attributes 标准属性行 (阿里国际站)
        try {
            // 尝试多种选择器
            const selectors = [
                '#key-attributes .id-grid-cols-\\\\[2fr_3fr\\\\]',
                '#key-attributes [class*=\"grid\"] > div',
                '#key-attributes .attr-row',
                '#key-attributes tr',
                '[data-testid=\"attributes\"] tr',
                '.product-attributes tr',
                '.props-table tr',
                '[class*=\"spec\"] tr',
                '[class*=\"attr\"] tr',
            ];
            for (const sel of selectors) {
                const elements = document.querySelectorAll(sel);
                if (elements.length > 0) {
                    for (const el of elements) {
                        let name = '', value = '';
                        const cells = el.querySelectorAll('div, td, th, span');
                        if (cells.length >= 2) {
                            name = cells[0].textContent.replace(/[：:]/g, '').trim();
                            value = cells[1].textContent.trim();
                        } else {
                            // 可能是扁平结构
                            const text = el.textContent.trim();
                            const sep = text.match(/[：:]/);
                            if (sep) {
                                name = text.substring(0, sep.index).trim();
                                value = text.substring(sep.index + 1).trim();
                            }
                        }
                        if (name && value && name !== value) {
                            // 尝试分离单位和数值
                            let unit = null;
                            const uMatch = value.match(unitRegex);
                            if (uMatch) {
                                value = uMatch[1].trim();
                                unit = uMatch[2].toLowerCase();
                            }
                            if (!specs.find(s => s.name === name)) {
                                specs.push({name, value, unit});
                            }
                        }
                    }
                    if (specs.length > 0) break;
                }
            }
        } catch(e) {}

        // 路径 B: 属性表格中查找特定行 (Brand, Model Number, etc.)
        if (specs.length === 0) {
            try {
                const rows = document.querySelectorAll('#key-attributes .id-grid-cols-\\\\[2fr_3fr\\\\] > div, #key-attributes .attr-list > div');
                for (const row of rows) {
                    const children = row.querySelectorAll('div');
                    if (children.length >= 2) {
                        const name = children[0].textContent.replace(/[：:]/g, '').trim();
                        const value = children[1].textContent.trim();
                        if (name && value && name !== value) {
                            let unit = null;
                            const uMatch = value.match(unitRegex);
                            if (uMatch) {
                                // value = uMatch[1].trim();
                                // unit = uMatch[2].toLowerCase();
                            }
                            specs.push({name, value, unit});
                        }
                    }
                }
            } catch(e) {}
        }

        return specs;
    }
    """
    try:
        result = await page.evaluate(js_code)
        return result if isinstance(result, list) else []
    except Exception as e:
        logger.warning(f"全量规格提取失败: {e}")
        return []


async def _extract_shipping_info(page) -> dict:
    """提取物流信息 (weight/length/width/height/shippingClass/hsCode)"""
    js_code = """
    () => {
        const info = {};

        // 从 #key-attributes 中查找物流相关行
        try {
            const attrContainer = document.querySelector('#key-attributes');
            if (attrContainer) {
                const rows = attrContainer.querySelectorAll('.id-grid-cols-\\\\[2fr_3fr\\\\], .attr-row, [class*=\"grid\"] > div, tr');
                for (const row of rows) {
                    const cells = row.querySelectorAll('div, td, th');
                    if (cells.length >= 2) {
                        const name = cells[0].textContent.trim().toLowerCase();
                        const value = cells[1].textContent.trim();
                        const num = parseFloat(value.replace(/[^\\d.]/g, ''));
                        if (name.includes('weight') && !isNaN(num)) info.weight = num;
                        if (name.includes('length') && !isNaN(num)) info.length = num;
                        if (name.includes('width') && !isNaN(num)) info.width = num;
                        if (name.includes('height') && !isNaN(num)) info.height = num;
                        if (name.includes('shipping') || name.includes('freight')) info.shippingClass = value;
                        if (name.includes('hs code') || name.includes('customs') || name.includes('harmonized')) info.hsCode = value;
                    }
                }
            }
        } catch(e) {}

        // 从 package-dimensions 区域提取
        try {
            const dimEl = document.querySelector('.package-dimensions, [data-testid=\"dimension\"], [class*=\"dimension\"]');
            if (dimEl) {
                const text = dimEl.textContent.trim();
                const dims = text.match(/([\\d.]+)\\s*[x×*]\\s*([\\d.]+)\\s*[x×*]\\s*([\\d.]+)/);
                if (dims) {
                    if (!info.length) info.length = parseFloat(dims[1]);
                    if (!info.width) info.width = parseFloat(dims[2]);
                    if (!info.height) info.height = parseFloat(dims[3]);
                }
                const wMatch = text.match(/([\\d.]+)\\s*(kg|g|lb)/i);
                if (wMatch && !info.weight) info.weight = parseFloat(wMatch[1]);
            }
        } catch(e) {}

        return info;
    }
    """
    try:
        result = await page.evaluate(js_code)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        logger.warning(f"物流信息提取失败: {e}")
        return {}


async def _extract_moq(page) -> Optional[int]:
    """提取最小起订量 (MOQ)"""
    js_code = """
    () => {
        try {
            const selectors = ['.min-order', '.moq', '[data-testid=\"moq\"]', '[class*=\"moq\"]',
                '[class*=\"min-order\"]', '[class*=\"min-quantity\"]', '.min-quantity'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const text = el.textContent.trim();
                    const m = text.match(/(\\d+)/);
                    if (m) return parseInt(m[1]);
                }
            }
            // 从 detailData 提取
            const data = window.detailData;
            if (data) {
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    const moq = item.moq || item.minOrderQuantity || item.minQuantity || item.minOrder;
                    if (moq) return parseInt(moq);
                }
            }
        } catch(e) {}
        return null;
    }
    """
    try:
        result = await page.evaluate(js_code)
        return result if isinstance(result, int) else None
    except Exception as e:
        logger.warning(f"MOQ 提取失败: {e}")
        return None

