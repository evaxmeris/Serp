"""
Playwright 浏览器管理 — 带 stealth 防检测
"""
import asyncio
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from playwright_stealth import Stealth
from config import HEADLESS, VIEWPORT, USER_AGENT, CONCURRENCY, TIMEOUT


class BrowserPool:
    """浏览器池：管理多个 Playwright 实例"""

    def __init__(self, count: int = CONCURRENCY):
        self._count = count
        self._playwright = None
        self._browsers: list[Browser] = []
        self._semaphore = asyncio.Semaphore(count)

    async def start(self):
        self._playwright = await async_playwright().start()
        for _ in range(self._count):
            browser = await self._playwright.chromium.launch(
                headless=HEADLESS,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--no-first-run",
                    "--no-zygote",
                ],
            )
            self._browsers.append(browser)

    async def stop(self):
        for b in self._browsers:
            await b.close()
        if self._playwright:
            await self._playwright.stop()

    @property
    def semaphore(self) -> asyncio.Semaphore:
        return self._semaphore

    async def create_page(self, browser_idx: int = 0) -> tuple[BrowserContext, Page]:
        """创建一个隔离的页面上下文（带 stealth 防检测）"""
        browser = self._browsers[browser_idx % len(self._browsers)]
        context = await browser.new_context(
            ignore_https_errors=True,
            viewport=VIEWPORT,
            user_agent=USER_AGENT,
            locale="en-US",
        )
        page = await context.new_page()
        # 应用 stealth 脚本
        stealth = Stealth()
        await stealth.apply_stealth_async(page)
        return context, page

    async def close_page(self, context: BrowserContext, page: Page):
        await page.close()
        await context.close()


async def wait_for_page(page: Page, timeout: int = TIMEOUT) -> bool:
    """等待页面 domcontentloaded，返回是否成功"""
    try:
        await page.goto(page.url, wait_until="domcontentloaded", timeout=timeout)
        await page.wait_for_timeout(2000)
        return True
    except Exception:
        return False
