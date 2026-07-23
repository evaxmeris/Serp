"""
阿里国际站店铺产品采集器（Playwright 版）
=========================================
采集自己店铺 (intellirise.en.alibaba.com) 的所有产品。

流程:
  店铺产品列表 → 提取所有产品链接 → 逐个访问详情页 → 提取数据 → POST 到 ERP

首次运行需要扫描二维码登录阿里账号。
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from playwright.async_api import async_playwright, Page

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("store-collector")

# ===== 配置 =====
STORE_URL = os.environ.get("STORE_URL", "https://intellirise.en.alibaba.com")
ERP_URL = os.environ.get("ERP_URL", "http://localhost:3001")
API_TOKEN = os.environ.get("COLLECT_API_TOKEN", "")
MAX_PRODUCTS = int(os.environ.get("MAX_PRODUCTS", "500"))
HEADLESS = os.environ.get("HEADLESS", "false").lower() == "true"

# Cookie 持久化路径
COOKIE_DIR = Path(__file__).parent / ".cookies"
COOKIE_DIR.mkdir(exist_ok=True)
COOKIE_FILE = COOKIE_DIR / "alibaba_cookies.json"


# ===== 页面工具 =====

async def wait_and_click(page: Page, selector: str, timeout: int = 10000):
    """等待元素出现后点击"""
    await page.wait_for_selector(selector, timeout=timeout)
    await page.click(selector)


async def safe_goto(page: Page, url: str, timeout: int = 60000):
    """安全导航，带重试"""
    for attempt in range(3):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            await page.wait_for_timeout(2000)
            return True
        except Exception as e:
            logger.warning(f"  导航失败 (尝试 {attempt+1}/3): {e}")
            await page.wait_for_timeout(3000)
    return False


async def ensure_logged_in(page: Page) -> bool:
    """检查登录状态，如未登录则引导用户扫码"""
    await safe_goto(page, "https://www.alibaba.com/")

    # 检查是否有登录标识
    try:
        await page.wait_for_selector('[data-testid="account-menu"], .account-name, .my-account', timeout=5000)
        logger.info("✅ 已登录阿里国际站")
        return True
    except:
        pass

    logger.info("⚠️ 未检测到登录状态，尝试加载已保存的 Cookie...")
    if COOKIE_FILE.exists():
        cookies = json.loads(COOKIE_FILE.read_text())
        await page.context.add_cookies(cookies)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        try:
            await page.wait_for_selector('[data-testid="account-menu"], .account-name, .my-account', timeout=5000)
            logger.info("✅ Cookie 登录成功")
            return True
        except:
            logger.info("⚠️ Cookie 已过期")

    # 引导用户手动登录
    logger.info("\n⚠️ 需要登录阿里国际站")
    logger.info("浏览器将打开，请在 120 秒内完成扫码登录...")
    await page.goto("https://login.alibaba.com/", wait_until="domcontentloaded")

    try:
        await page.wait_for_selector('[data-testid="account-menu"], .account-name, .my-account', timeout=120000)
        logger.info("✅ 登录成功！保存 Cookie...")
        cookies = await page.context.cookies()
        COOKIE_FILE.write_text(json.dumps(cookies, indent=2))
        logger.info(f"Cookie 已保存到 {COOKIE_FILE}")
        return True
    except:
        logger.error("❌ 登录超时")
        return False


# ===== 店铺产品列表提取 =====

async def collect_store_products(page: Page) -> list[dict]:
    """从店铺页面提取所有产品链接"""
    logger.info(f"\n访问店铺: {STORE_URL}")
    if not await safe_goto(page, STORE_URL):
        logger.error("店铺页面加载失败")
        return []

    products = []
    seen_urls = set()
    page_num = 0

    while True:
        page_num += 1
        logger.info(f"  列表页 {page_num}...")
        await page.wait_for_timeout(2000)

        # 提取当前页的产品链接
        items = await extract_product_links(page)
        if not items:
            logger.info("  没有更多产品")
            break

        for item in items:
            url = item.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                products.append(item)

        logger.info(f"  找到 {len(items)} 个产品 (累计 {len(products)})")

        if len(products) >= MAX_PRODUCTS:
            break

        # 翻页
        if not await go_next_page(page, page_num):
            break

    return products[:MAX_PRODUCTS]


async def extract_product_links(page: Page) -> list[dict]:
    """从当前页面提取产品链接"""
    items = []

    # 多种选择器匹配店铺产品列表
    selectors = [
        'a[class*="product"]', 'a[href*="/product"]', '.item-main a',
        '[class*="product-card"] a', '[class*="item"] a[href*="product"]',
        '.offer-list a', '.product-list a',
    ]

    links = set()
    for sel in selectors:
        for el in await page.query_selector_all(sel):
            href = await el.get_attribute("href")
            if href and ("/product" in href or "/offer" in href) and href not in links:
                links.add(href)

    # 取图片和标题
    for href in links:
        full_url = href if href.startswith("http") else f"https://{STORE_URL.split('//')[1].split('/')[0]}{href}"
        items.append({"url": full_url})

    return items


async def go_next_page(page: Page, current: int) -> bool:
    """翻到下一页"""
    try:
        next_btn = await page.query_selector('[class*="next"], [class*="pagination"] a:has-text("下一页"), a[class*="page-next"], button:has-text("下一页")')
        if next_btn:
            is_disabled = await next_btn.get_attribute("disabled")
            if is_disabled is not None:
                return False
            await next_btn.click()
            await page.wait_for_timeout(3000)
            return True
        # 尝试 URL 翻页
        current_url = page.url
        if f"page={current}" in current_url:
            next_url = current_url.replace(f"page={current}", f"page={current+1}")
        elif "?" in current_url:
            next_url = f"{current_url}&page={current+1}"
        else:
            next_url = f"{current_url}?page={current+1}"
        await safe_goto(page, next_url)
        return True
    except:
        return False


# ===== 产品详情提取 =====

async def extract_product_detail(page: Page, url: str) -> Optional[dict]:
    """提取单个产品详情"""
    logger.info(f"\n  → {url[:80]}")

    if not await safe_goto(page, url):
        logger.warning("  页面加载失败")
        return None

    await page.wait_for_timeout(2000)

    try:
        # 标题
        title = await page.evaluate('''() => {
            const s = '.title-main, [data-testid="product-title"], h1, .product-title';
            const el = document.querySelector(s);
            return el?.textContent?.trim() || '';
        }''')

        # 价格
        price = await page.evaluate('''() => {
            const s = '.price-range, [data-testid="price"], .product-price, .price';
            const el = document.querySelector(s);
            const m = el?.textContent?.match(/[\\d.]+/);
            return m ? parseFloat(m[0]) : null;
        }''')

        # 描述 HTML
        description = await page.evaluate('''() => {
            const s = '.detail-description, [data-testid="description"], .product-description, #description';
            const el = document.querySelector(s);
            return el?.innerHTML?.trim() || '';
        }''')

        # 图片
        images = await page.evaluate('''() => {
            const seen = new Set();
            const results = [];
            document.querySelectorAll('.product-gallery img, [data-testid="gallery"] img, .gallery img, [class*="preview"] img, img[class*="product"]').forEach((img, i) => {
                const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                if (!src || seen.has(src) || src.includes('logo') || src.includes('icon') || src.includes('placeholder')) return;
                if (src.startsWith('data:') && src.length < 500) return;
                seen.add(src);
                results.push({
                    type: results.length === 0 ? 'main' : 'gallery',
                    originalUrl: src.startsWith('//') ? 'https:' + src : src
                });
            });
            return results;
        }''')

        # 属性
        attributes = await page.evaluate('''() => {
            const results = [];
            const sels = ['.attributes-table tr', '[data-testid="attributes"] tr', '.product-attributes tr',
                '[class*="attr"] tr', '[class*="spec"] tr', '[class*="prop"] tr',
                '[data-testid="product-attributes"] tr'];
            for (const sel of sels) {
                document.querySelectorAll(sel).forEach(row => {
                    const tds = row.querySelectorAll('td, th');
                    if (tds.length >= 2) {
                        const name = tds[0].textContent?.replace(/[：:]/g,'').trim();
                        const value = tds[1].textContent?.trim();
                        if (name && value && !results.find(a => a.name === name)) results.push({name, value});
                    }
                });
                if (results.length > 0) break;
            }
            return results;
        }''')

        # 产品 ID
        product_id = await page.evaluate('''() => {
            const m = window.location.href.match(/_(\\d+)\\.html/);
            return m ? m[1] : null;
        }''')

        return {
            "title": title or "(无标题)",
            "price": price,
            "currency": "USD",
            "description": description,
            "images": images,
            "attributes": attributes,
            "productId": product_id,
            "url": url,
        }
    except Exception as e:
        logger.error(f"  提取异常: {e}")
        return None


# ===== 图片下载 =====

async def download_images(page: Page, images: list) -> list:
    """下载图片并转为 base64"""
    result = []
    for i, img_info in enumerate(images):
        if i >= 10:
            break
        url = img_info.get("originalUrl", "")
        if not url:
            continue
        try:
            resp = await page.evaluate(f'''async () => {{
                const resp = await fetch("{url}", {{ signal: AbortSignal.timeout(8000) }});
                const blob = await resp.blob();
                const reader = new FileReader();
                return await new Promise(r => {{ reader.onload = () => r(reader.result); reader.readAsDataURL(blob); }});
            }}''')
            if resp and len(resp) > 1000:
                base64 = resp.split(",")[1]
                result.append({
                    "type": "main" if i == 0 else "gallery",
                    "data": base64,
                    "mimeType": "image/jpeg",
                    "originalUrl": url,
                    "fileName": f"image_{i+1}.jpg",
                })
        except Exception as e:
            logger.warning(f"    图片下载失败: {url[:60]}... {e}")
    return result


# ===== ERP 投递 =====

async def post_to_erp(payload: dict) -> Optional[dict]:
    if not API_TOKEN:
        logger.error("COLLECT_API_TOKEN 未设置")
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{ERP_URL}/api/external/collect",
                json=payload,
                headers={"X-API-Token": API_TOKEN, "Content-Type": "application/json"},
            )
        if resp.status_code in (200, 201):
            return resp.json().get("data", resp.json())
        else:
            logger.error(f"  HTTP {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"  投递异常: {e}")
        return None


# ===== 主流程 =====

async def run():
    logger.info("=" * 60)
    logger.info("阿里国际站店铺产品采集器")
    logger.info(f"店铺: {STORE_URL}")
    logger.info(f"上限: {MAX_PRODUCTS} 个产品")
    logger.info(f"无头模式: {HEADLESS}")
    logger.info("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        # 1. 登录
        if not await ensure_logged_in(page):
            logger.error("登录失败，退出")
            await browser.close()
            return

        # 2. 采集产品列表
        products = await collect_store_products(page)
        if not products:
            logger.warning("未找到产品")
            await browser.close()
            return

        logger.info(f"\n共找到 {len(products)} 个产品，开始采集详情...")

        # 3. 逐个采集详情
        stats = {"success": 0, "failed": 0}
        for idx, p in enumerate(products, 1):
            logger.info(f"\n[{idx}/{len(products)}]")
            detail = await extract_product_detail(page, p["url"])
            if not detail:
                stats["failed"] += 1
                continue

            # 下载图片
            if detail["images"]:
                logger.info(f"  下载 {len(detail['images'])} 张图片...")
                detail["images"] = await download_images(page, detail["images"])
                logger.info(f"  已下载 {len(detail['images'])} 张")

            # 投递到 ERP
            payload = {
                "source": "alibaba",
                "sourceUrl": detail["url"],
                "sourceId": detail.get("productId", ""),
                "title": detail["title"],
                "price": detail["price"],
                "currency": "USD",
                "description": detail.get("description", ""),
                "images": detail["images"],
                "attributes": detail.get("attributes", []),
            }
            result = await post_to_erp(payload)
            if result:
                stats["success"] += 1
                logger.info(f"  ✅ 投递成功")
            else:
                stats["failed"] += 1

            await asyncio.sleep(1)  # 间隔

        # 4. 报告
        logger.info(f"\n{'='*60}")
        logger.info(f"采集完成!")
        logger.info(f"  成功: {stats['success']}")
        logger.info(f"  失败: {stats['failed']}")
        logger.info(f"{'='*60}")

        # 保存报告
        report = {
            "timestamp": datetime.now().isoformat(),
            "store": STORE_URL,
            "stats": stats,
        }
        report_path = f"/Users/apple/clawd/trade-erp/services/alibaba-collector/output/store_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        logger.info(f"报告: {report_path}")

        await browser.close()


def main():
    if not API_TOKEN:
        print("请设置 COLLECT_API_TOKEN 环境变量")
        sys.exit(1)
    asyncio.run(run())


if __name__ == "__main__":
    main()
