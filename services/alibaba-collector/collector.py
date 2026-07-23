"""
Alibaba 批量采集引擎 — 主入口

两种模式:
1. keyword_search: 按关键词搜索，分页采集所有结果
2. category_scan: 按类目扫描（TODO）

输出: POST 到 Trade ERP /api/external/collect
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from config import (
    MAX_PAGES, MAX_PRODUCTS, CONCURRENCY, TIMEOUT,
    OUTPUT_DIR, HEADLESS,
)
from lib.browser import BrowserPool, wait_for_page
from lib.extractor import extract_search_results, extract_product_detail
from lib.image import download_product_images
from lib.export import post_to_erp, build_erp_payload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


class AlibabaCollector:
    """阿里国际站批量采集器"""

    def __init__(self):
        self.browser_pool: Optional[BrowserPool] = None
        self._stats = {"searched": 0, "collected": 0, "posted": 0, "errors": 0}

    async def start(self):
        self.browser_pool = BrowserPool(CONCURRENCY)
        await self.browser_pool.start()
        logger.info(f"浏览器池启动 ({CONCURRENCY} 个实例)")

    async def stop(self):
        if self.browser_pool:
            await self.browser_pool.stop()
            logger.info("浏览器池关闭")

    # ===== 关键词搜索采集 =====

    async def collect_by_keyword(self, keyword: str, max_pages: int = MAX_PAGES,
                                  max_products: int = MAX_PRODUCTS) -> list[dict]:
        """
        按关键词搜索阿里国际站，采集搜索结果中的所有产品
        返回: 成功投递到 ERP 的产品列表
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"开始采集: [{keyword}]")
        logger.info(f"最多 {max_pages} 页 / {max_products} 个产品")
        logger.info(f"{'='*60}")

        # 1. 搜索分页，收集产品链接
        product_links = await self._search_pages(keyword, max_pages, max_products)
        logger.info(f"搜索完成，共发现 {len(product_links)} 个产品链接")

        if not product_links:
            logger.warning(f"关键词 [{keyword}] 未搜索到产品")
            return []

        # 2. 并发采集每个产品的详情
        successful = await self._collect_products(product_links)
        logger.info(f"\n采集完成: {len(successful)}/{len(product_links)} 个产品投递成功")

        # 3. 保存结果到本地
        report = {
            "keyword": keyword,
            "timestamp": datetime.now().isoformat(),
            "total_found": len(product_links),
            "total_posted": len(successful),
            "products": successful,
        }
        safe_name = keyword.replace("/", "_").replace(" ", "_")[:30]
        report_path = f"{OUTPUT_DIR}/{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        logger.info(f"报告已保存: {report_path}")

        return successful

    async def _search_pages(self, keyword: str, max_pages: int,
                            max_products: int) -> list[dict]:
        """分页搜索，收集所有产品的基本信息和链接"""
        all_products = []
        seen_urls = set()

        for page_num in range(1, max_pages + 1):
            if len(all_products) >= max_products:
                break

            search_url = (
                f"https://www.alibaba.com/trade/search?"
                f"SearchText={keyword}&page={page_num}"
            )

            logger.info(f"\n--- 搜索页 {page_num}/{max_pages} ---")

            context, page = await self.browser_pool.create_page()
            try:
                await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(2000)

                results = await extract_search_results(page)
                logger.info(f"  页 {page_num}: 找到 {len(results)} 个产品")

                for p in results:
                    url = p.get("url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        all_products.append(p)

                if len(results) == 0:
                    logger.info("  无更多结果，停止翻页")
                    break

            except Exception as e:
                logger.error(f"  搜索页 {page_num} 异常: {e}")
            finally:
                await self.browser_pool.close_page(context, page)

        return all_products[:max_products]

    async def _collect_products(self, product_links: list[dict]) -> list[dict]:
        """并发采集每个产品的详情并投递到 ERP"""
        sem = asyncio.Semaphore(CONCURRENCY)

        async def _collect_one(product_info: dict) -> Optional[dict]:
            async with sem:
                return await self._collect_single(product_info)

        tasks = [_collect_one(p) for p in product_links]
        results = await asyncio.gather(*tasks)
        return [r for r in results if r]

    async def _collect_single(self, product_info: dict) -> Optional[dict]:
        """采集单个产品：详情页提取 + 图片下载 + 投递 ERP"""
        url = product_info.get("url", "")
        name = product_info.get("name", "")
        logger.info(f"\n  → [{self._stats['collected']+1}] {name[:50]}")

        context, page = await self.browser_pool.create_page()
        try:
            # 导航到详情页
            page.goto(url)
            if not await wait_for_page(page):
                logger.warning(f"    详情页加载失败")
                self._stats["errors"] += 1
                return None

            # 提取详情
            detail = await extract_product_detail(page)
            if not detail.get("name"):
                detail["name"] = name
            if not detail.get("url"):
                detail["url"] = url
            if not detail.get("price"):
                detail["price"] = product_info.get("price")
            if not detail.get("productId"):
                detail["productId"] = product_info.get("productId", "")

            self._stats["collected"] += 1
            logger.info(f"    详情: {detail.get('name', '?')[:50]}...")

            # 下载图片
            image_urls = [img["url"] for img in detail.get("images", [])]
            logger.info(f"    图片: {len(image_urls)} 张")

            # 用同一个 page 导航到图片 URL 下载
            images = await download_product_images(page, image_urls)
            logger.info(f"    已下载: {len(images)} 张")

            # 构建 ERP payload
            payload = build_erp_payload(detail, images)

            # 投递
            result = await post_to_erp(payload)
            if result:
                self._stats["posted"] += 1
                return result
            else:
                self._stats["errors"] += 1
                return None

        except Exception as e:
            logger.error(f"    采集异常: {e}")
            self._stats["errors"] += 1
            return None
        finally:
            await self.browser_pool.close_page(context, page)


# ===== CLI 入口 =====

async def main():
    import sys
    if len(sys.argv) < 2:
        print("用法: python collector.py <关键词> [最大页数] [最大产品数]")
        print("示例: python collector.py 'solar panel' 3 20")
        print("       python collector.py 'patio furniture' 5 30")
        sys.exit(1)

    keyword = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else MAX_PAGES
    max_products = int(sys.argv[3]) if len(sys.argv) > 3 else MAX_PRODUCTS

    collector = AlibabaCollector()
    try:
        await collector.start()
        results = await collector.collect_by_keyword(keyword, max_pages, max_products)
        logger.info(f"\n{'='*60}")
        logger.info(f"最终统计:")
        logger.info(f"  搜索到: {collector._stats['searched']}")
        logger.info(f"  已采集: {collector._stats['collected']}")
        logger.info(f"  已投递: {collector._stats['posted']}")
        logger.info(f"  错误:   {collector._stats['errors']}")
        logger.info(f"{'='*60}")
    finally:
        await collector.stop()


if __name__ == "__main__":
    asyncio.run(main())
