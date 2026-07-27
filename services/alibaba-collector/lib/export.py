"""
ERP API 投递 — POST 产品数据到 Trade ERP 外部采集接口
"""
import json
import logging
from typing import Optional
from config import ERP_URL, API_TOKEN

logger = logging.getLogger(__name__)

# httpx 延迟导入（可能不在 venv 中时降级到 urllib）
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    import urllib.request as urllib  # type: ignore
    HAS_HTTPX = False


async def post_to_erp(product: dict) -> Optional[dict]:
    """
    POST 产品到 ERP 的 /api/external/collect 接口
    返回: {id, title, pipelineStatus} 或 None
    """
    if not API_TOKEN:
        logger.error("COLLECT_API_TOKEN 未设置，无法投递到 ERP")
        return None

    url = f"{ERP_URL}/api/external/collect"
    headers = {
        "X-API-Token": API_TOKEN,
        "Content-Type": "application/json",
    }

    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, json=product, headers=headers)
        else:
            # 同步降级（httpx 未安装时）
            import urllib.request
            data = json.dumps(product).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))

        if resp.status_code in (200, 201):
            result = resp.json()
            data = result.get("data", result)
            logger.info(f"投递成功: {data.get('title', '?')} (ID: {data.get('id', '?')}, status: {data.get('pipelineStatus', '?')})")
            return data
        else:
            body = resp.text if hasattr(resp, 'text') else (await resp.aread()).decode()
            logger.error(f"投递失败 HTTP {resp.status_code}: {body[:300]}")
            return None
    except Exception as e:
        logger.error(f"投递异常: {e}")
        return None


def build_erp_payload(product_detail: dict, images: list[dict]) -> dict:
    """
    将提取的产品数据映射为 ERP API 接收的格式
    """
    payload = {
        "source": "alibaba",
        "sourceUrl": product_detail.get("url", ""),
        "sourceId": product_detail.get("productId", ""),
        "title": product_detail.get("name", ""),
        "description": product_detail.get("description", ""),
        "price": product_detail.get("price"),
        "currency": product_detail.get("currency", "USD"),
        "images": images,
        "attributes": [],
        "rawData": {
            "url": product_detail.get("url", ""),
            "capturedAt": __import__("datetime").datetime.now().isoformat(),
            "sourceData": {
                "brand": product_detail.get("brand"),
                "category": product_detail.get("category"),
                "seller": product_detail.get("seller"),
                "rating": product_detail.get("aggregateRating"),
                "features": product_detail.get("features", []),
            },
        },
    }

    # 映射 specifications → attributes
    specs = product_detail.get("specifications", [])
    if specs:
        payload["attributes"] = [
            {"name": s.get("key", ""), "value": s.get("value", "")}
            for s in specs if s.get("key") and s.get("value")
        ]

    return payload


def build_erp_payload_v2(product_detail: dict, images: list[dict]) -> dict:
    """
    v2 全字段映射 — 将提取的产品数据映射为 ERP API 接收的完整格式

    支持字段:
    - 基本信息: titleEn, shortDescription, brand, sku
    - 价格: price, compareAtPrice, currency, stockQuantity
    - 物流: weight, length, width, height, shippingClass, hsCode
    - 子表: images, variants, attributes
    - rawData: tieredPricing, supplier, aggregateRating, moq
    """
    payload = {
        "source": "alibaba",
        "sourceUrl": product_detail.get("url", ""),
        "sourceId": product_detail.get("productId", ""),
        "title": product_detail.get("name", ""),
        "titleEn": product_detail.get("nameEn") or product_detail.get("titleEn") or None,
        "shortDescription": product_detail.get("shortDescription") or None,
        "description": product_detail.get("description", ""),
        "descriptionEn": product_detail.get("descriptionEn") or None,
        "brand": product_detail.get("brand") or None,
        "sku": product_detail.get("sku") or product_detail.get("productId") or None,
        "price": product_detail.get("price"),
        "compareAtPrice": product_detail.get("compareAtPrice") or product_detail.get("compareAt"),
        "currency": product_detail.get("currency", "USD"),
        "stockQuantity": product_detail.get("stockQuantity") or None,
        # 物流信息
        "weight": product_detail.get("weight") or None,
        "length": product_detail.get("length") or None,
        "width": product_detail.get("width") or None,
        "height": product_detail.get("height") or None,
        "shippingClass": product_detail.get("shippingClass") or None,
        "hsCode": product_detail.get("hsCode") or None,
        "images": images,
        "variants": [],
        "attributes": [],
    }

    # 映射 variants
    variants = product_detail.get("variants", [])
    if variants:
        payload["variants"] = [
            {
                "sku": v.get("sku"),
                "price": v.get("price"),
                "stock": v.get("stock"),
                "options": v.get("options"),
            }
            for v in variants
            if isinstance(v, dict)
        ]

    # 映射 attributes (含 unit 分离)
    specs = product_detail.get("specifications", [])
    if specs:
        payload["attributes"] = [
            {
                "name": s.get("key") or s.get("name", ""),
                "value": s.get("value", ""),
                "unit": s.get("unit") or None,
            }
            for s in specs
            if s.get("key") or s.get("name")
        ]

    # 映射 attributes 变体写法（当 specifications 为空时）
    if not payload["attributes"]:
        attrs = product_detail.get("attributes", [])
        if attrs:
            payload["attributes"] = [
                {
                    "name": a.get("name", a.get("key", "")),
                    "value": a.get("value", ""),
                    "unit": a.get("unit") or None,
                }
                for a in attrs
                if a.get("name") or a.get("key")
            ]

    # 构建 rawData
    raw_data = {
        "url": product_detail.get("url", ""),
        "capturedAt": __import__("datetime").datetime.now().isoformat(),
    }

    # tieredPricing
    tiered = product_detail.get("tieredPricing")
    if tiered:
        raw_data["tieredPricing"] = tiered

    # supplier
    seller = product_detail.get("seller")
    if seller:
        raw_data["supplier"] = {
            "name": seller.get("name", ""),
            "url": seller.get("url", ""),
            "verified": seller.get("verified", False),
            "rating": seller.get("rating"),
            "responseRate": seller.get("responseRate"),
        }

    # aggregateRating
    rating = product_detail.get("aggregateRating")
    if rating:
        raw_data["aggregateRating"] = {
            "ratingValue": rating.get("ratingValue"),
            "reviewCount": rating.get("reviewCount"),
        }

    # moq
    moq = product_detail.get("moq")
    if moq is not None:
        raw_data["moq"] = int(moq)

    payload["rawData"] = raw_data

    return payload
