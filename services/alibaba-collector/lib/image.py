"""
图片下载 — 用 Playwright 下载阿里 CDN 图片，转为 base64
"""
import io
import base64
import logging
from typing import Optional
from playwright.async_api import Page
from PIL import Image
from config import IMAGE_MAX_WIDTH, IMAGE_QUALITY, MAX_IMAGES_PER_PRODUCT

logger = logging.getLogger(__name__)


async def download_image(page: Page, image_url: str, max_width: int = IMAGE_MAX_WIDTH,
                         quality: int = IMAGE_QUALITY) -> Optional[dict]:
    """
    用 Playwright 页面下载单张图片并转为 base64
    返回: {data(base64), mimeType, fileName, width, height, originalUrl}
    """
    try:
        # 转到图片 URL，Playwright 会下载它
        resp = await page.goto(image_url, wait_until="domcontentloaded", timeout=30000)
        if not resp or not resp.ok:
            logger.warning(f"图片下载失败: {image_url} (HTTP {resp.status if resp else 'no response'})")
            return None

        body = await resp.body()
        if not body or len(body) < 100:
            return None

        # 用 Pillow 处理大小和质量
        try:
            img = Image.open(io.BytesIO(body))
            original_w, original_h = img.size

            # 等比缩放
            if original_w > max_width:
                ratio = max_width / original_w
                new_w = max_width
                new_h = int(original_h * ratio)
                img = img.resize((new_w, new_h), Image.LANCZOS)

            new_w, new_h = img.size

            # 转 JPEG base64（RGBA → RGB）
            if img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")

            # 从 URL 推断文件名
            file_name = image_url.split("/")[-1].split("?")[0]
            if not file_name.endswith((".jpg", ".jpeg", ".png", ".webp")):
                file_name = "image.jpg"

            return {
                "data": b64,
                "mimeType": "image/jpeg",
                "fileName": file_name,
                "width": new_w,
                "height": new_h,
                "originalUrl": image_url,
            }
        except Exception as e:
            logger.warning(f"图片处理失败 {image_url}: {e}")
            # 降级：直接 base64 原始数据
            b64 = base64.b64encode(body).decode("ascii")
            return {
                "data": b64,
                "mimeType": "image/jpeg",
                "fileName": "image.jpg",
                "width": None,
                "height": None,
                "originalUrl": image_url,
            }
    except Exception as e:
        logger.warning(f"图片下载异常 {image_url}: {e}")
        return None


async def download_product_images(page: Page, image_urls: list[str]) -> list[dict]:
    """
    批量下载产品图片
    使用一个隔离的 page 访问每张图片 URL
    返回: [各图片的 dict, 含 base64 data]
    """
    results = []
    for i, url in enumerate(image_urls):
        if i >= MAX_IMAGES_PER_PRODUCT:
            break
        # 跳过后缀图、logo 图标
        if any(x in url.lower() for x in ["logo", "icon", "placeholder", "tps-", "tb1"]):
            continue
        img = await download_image(page, url)
        if img:
            img["type"] = "main" if i == 0 else "gallery"
            results.append(img)
            logger.info(f"  图片 {i+1}/{min(len(image_urls), MAX_IMAGES_PER_PRODUCT)}: OK")
        else:
            logger.warning(f"  图片 {i+1}: 失败 ({url[:60]}...)")

    return results
