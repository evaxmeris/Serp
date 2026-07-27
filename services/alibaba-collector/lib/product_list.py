"""
产品列表爬虫 — 从店铺产品列表页提取所有产品链接

策略：
1. 多重选择器回退（适应不同版本阿里店铺页面）
2. 滚动懒加载
3. 翻页（支持多种翻页模式）
4. URL 去重
"""
import re
import logging
from typing import Optional
from playwright.async_api import Page

logger = logging.getLogger(__name__)


# 页面 product-detail 链接的选择器链
PRODUCT_LINK_SELECTORS = [
    "a[href*='/product-detail/']",
    "a[href*='/product/']",
    "a[href*='/pd/']",
    "a[class*='product'][href]",
    "a[class*='detail'][href]",
    ".product-card a[href]",
    ".product-item a[href]",
    ".item-card a[href]",
    "[class*='product'] a[href]",
    "a[href*='detail']",
]

# 翻页选择器链
NEXT_PAGE_SELECTORS = [
    ".next a[rel='next']",
    "a[rel='next']",
    ".pagination .next",
    ".pagination a:has-text('Next')",
    "a:has-text('Next')",
    ".page-next",
    "[class*='pagination'] [class*='next']",
    "a[aria-label='Next']",
    "button[aria-label='Next']",
    ".page-item.next a",
]

# 翻页后等待使用的选择器（用于判断页面已加载）
PAGE_LOAD_INDICATORS = [
    ".fy26-product-card-wrapper",
    ".product-card",
    ".product-item",
    "[class*='product']",
]


class ProductListCrawler:
    """
    产品列表爬虫

    用法:
        crawler = ProductListCrawler(page)
        links = await crawler.get_product_links(url, max_products=100)
    """

    def __init__(self, page: Page):
        self.page = page
        self.seen_urls: set = set()
        self.all_links: list[dict] = []

    async def get_product_links(
        self,
        list_url: str,
        max_products: int = 500,
        max_pages: int = 20,
        scroll_count: int = 5,
    ) -> list[dict]:
        """
        从产品列表页获取所有产品链接

        参数:
            list_url: 店铺产品列表 URL (如 https://store.en.alibaba.com/productlist)
            max_products: 最多采集产品数
            max_pages: 最多翻页数
            scroll_count: 懒加载滚动次数

        返回:
            [{url, title, price, imageUrl, seller, productId, ...}]
        """
        logger.info(f"🔄 开始采集产品列表: {list_url}")
        logger.info(f"   上限: {max_products} 个产品, {max_pages} 页")

        await self.page.goto(list_url, wait_until="domcontentloaded", timeout=60000)
        await self.page.wait_for_timeout(3000)

        for page_num in range(1, max_pages + 1):
            if len(self.all_links) >= max_products:
                logger.info(f"  达到采集上限 ({max_products})，停止")
                break

            logger.info(f"  📄 第 {page_num} 页 (已找到 {len(self.all_links)} 个链接)")

            # 滚动懒加载
            await self._scroll_for_lazy_load(scroll_count)

            # 提取当前页链接
            page_links = await self._extract_current_links()
            new_count = len(self.all_links)
            logger.info(f"    当前页提取: {len(page_links)} 个 (累计 {new_count} 个)")

            # 尝试翻页
            if page_num < max_pages:
                has_next = await self._go_next_page()
                if not has_next:
                    logger.info("    没有更多页，停止翻页")
                    break
                await self.page.wait_for_timeout(2000)

        logger.info(f"  ✅ 共采集到 {len(self.all_links)} 个产品链接")
        return self.all_links[:max_products]

    async def _scroll_for_lazy_load(self, scroll_count: int = 5):
        """滚动页面触发懒加载"""
        for i in range(scroll_count):
            await self.page.evaluate(
                f"window.scrollBy(0, document.body.scrollHeight / {scroll_count})"
            )
            await self.page.wait_for_timeout(800)

        # 回到底部确保全部加载
        await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await self.page.wait_for_timeout(1000)

    async def _extract_current_links(self) -> list[dict]:
        """提取当前页面的所有产品链接（含基本信息）"""
        js_code = """
        () => {
            // 第一步：收集所有符合条件的 <a> 标签 href
            const candidates = new Map();  // href -> {url, title, price, ...}

            const selectors = [
                "a[href*='/product-detail/']",
                "a[href*='/product/']",
                "a[href*='/pd/']",
                "a[class*='product'][href]",
                "a[class*='detail'][href]",
                ".product-card a[href]",
                ".product-item a[href]",
                "[class*='product'] a[href]",
            ];

            for (const sel of selectors) {
                document.querySelectorAll(sel).forEach(a => {
                    const href = a.href || '';
                    if (!href || href.includes('#') || href.includes('javascript:')) return;
                    // 归一化：去掉查询参数
                    const cleanUrl = href.split('?')[0].split('#')[0];
                    if (!candidates.has(cleanUrl)) {
                        // 尝试获取所在卡片上的更多信息
                        const card = a.closest('.fy26-product-card-wrapper, .product-card, .product-item, [class*="product"], li, div[class]');
                        let title = '', price = '', imageUrl = '', seller = '';
                        if (card) {
                            // 标题
                            const t = card.querySelector('h2, [class*="title"], [class*="name"]');
                            if (t) title = t.textContent.trim();
                            // 价格
                            const p = card.querySelector('[class*="price"]');
                            if (p) price = p.textContent.trim();
                            // 图片
                            const img = card.querySelector('img');
                            if (img) imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || '';
                            // 卖家
                            const s = card.querySelector('[class*="company"], [class*="seller"], [class*="supplier"]');
                            if (s) seller = s.textContent.trim();
                        }
                        candidates.set(cleanUrl, {url: cleanUrl, title, price, imageUrl, seller});
                    }
                });
            }

            // 第二步：提取 productId
            const result = [];
            candidates.forEach((v, k) => {
                const m = k.match(/_(\\d{10,})\\.html/);
                if (m) v.productId = m[1];
                result.push(v);
            });
            return result;
        }
        """
        try:
            raw_links = await self.page.evaluate(js_code)
        except Exception as e:
            logger.warning(f"JS 提取链接失败: {e}")
            raw_links = []

        # 去重
        new_links = []
        for link in raw_links:
            url = link.get("url", "")
            if url and url not in self.seen_urls:
                self.seen_urls.add(url)
                self.all_links.append(link)
                new_links.append(link)

        return new_links

    async def _go_next_page(self) -> bool:
        """尝试翻到下一页"""
        js_code = """
        () => {
            const selectors = [
                ".next a[rel='next']",
                "a[rel='next']",
                ".pagination .next",
                ".pagination a:has-text('Next')",
                "a:has-text('Next')",
                ".page-next",
                "[class*='pagination'] [class*='next']",
                "a[aria-label='Next']",
                "button[aria-label='Next']",
                ".page-item.next a",
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && !el.disabled && !el.classList.contains('disabled')) {
                    el.click();
                    return true;
                }
            }
            return false;
        }
        """
        try:
            clicked = await self.page.evaluate(js_code)
            if clicked:
                await self.page.wait_for_timeout(3000)
                # 等待页面加载指示器出现
                for indicator in PAGE_LOAD_INDICATORS:
                    try:
                        await self.page.wait_for_selector(indicator, timeout=8000)
                        break
                    except Exception:
                        continue
                return True
            return False
        except Exception as e:
            logger.warning(f"翻页失败: {e}")
            return False

    async def extract_product_links_playwright(self) -> list[dict]:
        """Playwright selectors 兜底方案（当 JS evaluate 失败时）"""
        links = []
        for sel in PRODUCT_LINK_SELECTORS:
            try:
                elements = self.page.locator(sel)
                count = await elements.count()
                for i in range(count):
                    href = await elements.nth(i).get_attribute("href")
                    if href and href not in self.seen_urls:
                        # 规范化 URL
                        if href.startswith("//"):
                            href = "https:" + href
                        elif href.startswith("/"):
                            href = f"https://www.alibaba.com{href}"
                        full_url = href.split("?")[0].split("#")[0]
                        if full_url not in self.seen_urls and "/product-detail/" in full_url:
                            self.seen_urls.add(full_url)
                            links.append({"url": full_url})
                if links:
                    break
            except Exception:
                continue
        self.all_links.extend(links)
        return links
