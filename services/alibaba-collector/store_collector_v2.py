"""
阿里国际站店铺产品采集器 v2 (重写版)
======================================
使用 ProductListCrawler + DedupChecker + v2 提取引擎

主要改进:
1. ProductListCrawler: 多选择器回退 + 翻页 + 懒加载
2. DedupChecker: 采集前 API 去重查询
3. v2 提取引擎: 变体/阶梯定价/全规格/物流/Supplier/MOQ
4. build_erp_payload_v2: 全字段映射
"""
import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Optional

from playwright.async_api import async_playwright

from config import ERP_URL, API_TOKEN, HEADLESS
from lib.product_list import ProductListCrawler
from lib.dedup import DedupChecker
from lib.extractor import extract_product_detail
from lib.image import download_product_images
from lib.export import post_to_erp, build_erp_payload_v2

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("store-collector-v2")

# 防检测 - 直接注入 JS 覆盖 navigator.webdriver
STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
"""

STORE_URL = os.environ.get("STORE_URL", "https://intellirise.en.alibaba.com")
MAX_PRODUCTS = int(os.environ.get("MAX_PRODUCTS", "500"))
MAX_PAGES = int(os.environ.get("MAX_PAGES", "20"))
DELAY = float(os.environ.get("COLLECT_DELAY", "2.0"))
SKIP_DEDUP = os.environ.get("SKIP_DEDUP", "").lower() in ("1", "true", "yes")


async def run():
    logger.info(f"店铺: {STORE_URL}")
    logger.info(f"上限: {MAX_PRODUCTS} 个产品 / {MAX_PAGES} 页")
    logger.info(f"去重: {'跳过' if SKIP_DEDUP else '启用'}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=HEADLESS,
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

        # 初始化组件
        crawler = ProductListCrawler(page)
        checker = DedupChecker(enable_api=not SKIP_DEDUP)
        stats = {"total_links": 0, "dedup_skipped": 0, "success": 0, "failed": 0}

        # 1. 采集产品列表
        product_list_url = f"{STORE_URL}/productlist"
        logger.info(f"\n{'='*60}")
        logger.info(f"1. 采集产品列表: {product_list_url}")
        logger.info(f"{'='*60}")

        product_links = await crawler.get_product_links(
            list_url=product_list_url,
            max_products=MAX_PRODUCTS,
            max_pages=MAX_PAGES,
            scroll_count=5,
        )

        stats["total_links"] = len(product_links)
        logger.info(f"\n找到 {len(product_links)} 个产品链接")

        if not product_links:
            await browser.close()
            return

        # 2. 逐个采集详情
        logger.info(f"\n{'='*60}")
        logger.info(f"2. 逐个采集产品详情")
        logger.info(f"{'='*60}")

        for idx, link in enumerate(product_links, 1):
            url = link.get("url", "")
            title = link.get("title", "") or url[:60]
            logger.info(f"\n[{idx}/{len(product_links)}] {title[:50]}")

            # Step 2a: 去重检查
            if not SKIP_DEDUP:
                try:
                    dup = await checker.check(url)
                    if dup.get("exists"):
                        status = dup.get("pipelineStatus", "unknown")
                        logger.info(f"  ⏭️ 已存在 (status={status}), 跳过")
                        stats["dedup_skipped"] += 1
                        if dup.get("id") != "__just_collected__":
                            continue
                except Exception as e:
                    logger.warning(f"  去重查询失败 ({e}), 继续采集")

            # Step 2b: 访问详情页
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)
            except Exception as e:
                logger.error(f"  ❌ 访问详情页失败: {e}")
                stats["failed"] += 1
                continue

            # Step 2c: v2 提取
            try:
                detail = await extract_product_detail(page)
                if not detail.get("name"):
                    # 兜底使用列表页已有的标题
                    if link.get("title"):
                        detail["name"] = link["title"]
                if not detail.get("url"):
                    detail["url"] = url
                if not detail.get("price"):
                    detail["price"] = link.get("price")
                if not detail.get("productId"):
                    detail["productId"] = link.get("productId", "")
            except Exception as e:
                logger.error(f"  ❌ 提取失败: {e}")
                stats["failed"] += 1
                continue

            if not detail.get("name"):
                logger.warning("  ⚠️ 提取数据为空，跳过")
                stats["failed"] += 1
                continue

            logger.info(f"  标题: {detail['name'][:50]}")
            logger.info(f"  价格: {detail.get('price', '?')}")
            if detail.get("variants"):
                logger.info(f"  变体: {len(detail['variants'])} 个")
            if detail.get("tieredPricing"):
                logger.info(f"  阶梯价: {len(detail['tieredPricing'])} 档")

            # Step 2d: 下载图片
            image_urls = [img["url"] for img in detail.get("images", [])]
            logger.info(f"  图片: {len(image_urls)} 张")
            images = []
            if image_urls:
                try:
                    images = await download_product_images(page, image_urls)
                    logger.info(f"  已下载: {len(images)} 张")
                except Exception as e:
                    logger.warning(f"  图片下载失败: {e}")

            # Step 2e: 构建 v2 payload 并投递
            try:
                payload = build_erp_payload_v2(detail, images)
                result = await post_to_erp(payload)

                if result:
                    logger.info(f"  ✅ 投递成功 (ID: {result.get('id', '?')})")
                    stats["success"] += 1
                    # 更新去重缓存
                    checker.mark_collected(url)
                else:
                    logger.error(f"  ❌ 投递失败")
                    stats["failed"] += 1
            except Exception as e:
                logger.error(f"  ❌ 投递异常: {e}")
                stats["failed"] += 1

            # Step 2f: 间隔
            await asyncio.sleep(DELAY)

        # 3. 报告
        logger.info(f"\n{'='*60}")
        logger.info(f"📊 采集报告")
        logger.info(f"{'='*60}")
        logger.info(f"  产品列表: {stats['total_links']} 个")
        logger.info(f"  去重跳过: {stats['dedup_skipped']} 个")
        logger.info(f"  采集成功: {stats['success']} 个")
        logger.info(f"  采集失败: {stats['failed']} 个")
        logger.info(f"  去重缓存: {checker.get_cache_size()} 条")
        logger.info(f"{'='*60}")

        # 保存报告
        report = {
            "timestamp": datetime.now().isoformat(),
            "store": STORE_URL,
            "stats": stats,
            "dedup_stats": checker.stats,
        }
        output_dir = os.path.join(os.path.dirname(__file__), "output")
        os.makedirs(output_dir, exist_ok=True)
        report_path = os.path.join(
            output_dir,
            f"v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        logger.info(f"报告已保存: {report_path}")

        await browser.close()


if __name__ == "__main__":
    if not API_TOKEN:
        print("请设置 COLLECT_API_TOKEN")
        sys.exit(1)
    asyncio.run(run())
