"""
阿里国际站店铺产品采集器 v2
=============================
直接从店铺公开页面采集产品，不需要登录。
访问 intellirise.en.alibaba.com/productlist 获取所有产品链接，
然后逐个访问产品详情页提取数据。
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Optional

from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("store-collector-v2")

# 防检测 - 直接注入 JS 覆盖 navigator.webdriver
STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
"""

STORE_URL = os.environ.get("STORE_URL", "https://intellirise.en.alibaba.com")
ERP_URL = os.environ.get("ERP_URL", "http://localhost:3001")
API_TOKEN = os.environ.get("COLLECT_API_TOKEN", "")
MAX_PRODUCTS = int(os.environ.get("MAX_PRODUCTS", "500"))


async def run():
    logger.info(f"店铺: {STORE_URL}")
    logger.info(f"上限: {MAX_PRODUCTS}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="America/New_York",
        )
        page = await context.new_page()
        # 注入防检测 JS
        await page.add_init_script(STEALTH_JS)
        logger.info("✅ 防检测脚本已注入")

        # 1. 访问所有产品页面
        product_list_url = f"{STORE_URL}/productlist"
        logger.info(f"\n1. 访问产品列表: {product_list_url}")
        await page.goto(product_list_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

        # 提取所有产品链接
        product_links = await page.evaluate('''() => {
            const links = new Set();
            document.querySelectorAll('a').forEach(a => {
                const href = a.href;
                if (href && href.includes('/product-detail/')) links.add(href);
            });
            return [...links];
        }''')

        if not product_links:
            logger.warning("❌ 未找到产品链接，尝试翻页后重试...")
            # 可能页面需要滚动加载
            for _ in range(5):
                await page.evaluate('window.scrollBy(0, 1000)')
                await page.wait_for_timeout(1000)
            product_links = await page.evaluate('''() => {
                const links = new Set();
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    if (href && href.includes('/product-detail/')) links.add(href);
                });
                return [...links];
            }''')

        product_links = list(set(product_links))[:MAX_PRODUCTS]
        logger.info(f"找到 {len(product_links)} 个产品链接")

        if not product_links:
            await browser.close()
            return

        # 2. 逐个访问详情页
        stats = {"success": 0, "failed": 0}
        for idx, url in enumerate(product_links, 1):
            logger.info(f"\n[{idx}/{len(product_links)}] {url[:80]}...")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)

                # 提取数据
                data = await page.evaluate('''() => {
                    function qs(sels) {
                        for (const s of sels) {
                            const el = document.querySelector(s);
                            if (el) return el;
                        }
                        return null;
                    }

                    const title = qs(['.title-main', '[data-testid="product-title"]', 'h1', '.product-title'])?.textContent?.trim() || '';

                    const priceEl = qs(['.price-range', '[data-testid="price"]', '.product-price', '.price']);
                    const priceText = priceEl?.textContent?.trim() || '';
                    const price = (priceText.match(/[\\d.]+/) || [null])[0];

                    const desc = qs(['.detail-description', '[data-testid="description"]', '.product-description', '#description'])?.innerHTML?.trim() || '';

                    const images = [];
                    const seen = new Set();
                    document.querySelectorAll('.product-gallery img, [data-testid="gallery"] img, .gallery img, [class*="preview"] img, img[class*="product"]').forEach(img => {
                        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                        if (!src || seen.has(src) || src.includes('logo') || src.includes('icon') || src.includes('placeholder')) return;
                        if (src.startsWith('data:') && src.length < 500) return;
                        seen.add(src);
                        images.push({type: images.length === 0 ? 'main' : 'gallery', originalUrl: src.startsWith('//') ? 'https:' + src : src});
                    });

                    const attrs = [];
                    const attrSels = ['.attributes-table tr', '[data-testid="attributes"] tr', '.product-attributes tr',
                        '.props-table tr', '[class*="attr"] tr', '[class*="spec"] tr'];
                    for (const sel of attrSels) {
                        document.querySelectorAll(sel).forEach(row => {
                            const tds = row.querySelectorAll('td, th');
                            if (tds.length >= 2) {
                                const n = tds[0].textContent?.replace(/[：:]/g,'').trim();
                                const v = tds[1].textContent?.trim();
                                if (n && v && !attrs.find(a => a.name === n)) attrs.push({name: n, value: v});
                            }
                        });
                        if (attrs.length > 0) break;
                    }

                    const pid = (window.location.href.match(/_(\\d+)\\.html/) || [])[1] || '';

                    return {title, price, description: desc, images, attributes: attrs, productId: pid, url: window.location.href};
                }''')

                if not data.get("title"):
                    logger.warning("  ⚠️ 提取数据为空，跳过")
                    stats["failed"] += 1
                    continue

                logger.info(f"  标题: {data['title'][:50]}")
                logger.info(f"  价格: {data.get('price', '?')}")
                logger.info(f"  图片: {len(data.get('images', []))} 张")

                # 下载图片
                if data.get("images"):
                    from lib.image import download_product_images
                    images = await download_product_images(page, [img["originalUrl"] for img in data["images"]])
                    logger.info(f"  已下载: {len(images)} 张")
                else:
                    images = []

                # 投递到 ERP
                payload = {
                    "source": "alibaba",
                    "sourceUrl": data["url"],
                    "sourceId": data.get("productId", ""),
                    "title": data["title"],
                    "price": float(data["price"]) if data.get("price") else None,
                    "currency": "USD",
                    "description": data.get("description", ""),
                    "images": images,
                    "attributes": data.get("attributes", []),
                }

                import httpx
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        f"{ERP_URL}/api/external/collect",
                        json=payload,
                        headers={"X-API-Token": API_TOKEN, "Content-Type": "application/json"},
                    )
                if resp.status_code in (200, 201):
                    logger.info(f"  ✅ 投递成功")
                    stats["success"] += 1
                else:
                    logger.error(f"  ❌ HTTP {resp.status_code}: {resp.text[:100]}")
                    stats["failed"] += 1

                await asyncio.sleep(1.5)  # 间隔

            except Exception as e:
                logger.error(f"  ❌ 异常: {e}")
                stats["failed"] += 1

        # 报告
        logger.info(f"\n{'='*40}")
        logger.info(f"完成! 成功: {stats['success']}, 失败: {stats['failed']}")
        report = {"timestamp": datetime.now().isoformat(), "store": STORE_URL, "stats": stats}
        report_path = f"/Users/apple/clawd/trade-erp/services/alibaba-collector/output/v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        logger.info(f"报告: {report_path}")
        await browser.close()


if __name__ == "__main__":
    if not API_TOKEN:
        print("请设置 COLLECT_API_TOKEN")
        sys.exit(1)
    asyncio.run(run())
