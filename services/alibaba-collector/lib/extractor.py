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

    # Specifications
    specs = await _extract_specs(page)
    if specs:
        product["specifications"] = specs

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
