"""
阿里国际站店铺产品采集器
==========================
使用阿里 Open API 获取卖家自己店铺的产品，无需浏览器。
不走 Playwright，不会被验证码拦截。

数据流:
  Alibaba Open API → 本脚本 → Trade ERP (POST /api/external/collect)
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Optional

import httpx

# ===== 配置 =====
APP_KEY = os.environ.get("ALIBABA_APP_KEY", "")
APP_SECRET = os.environ.get("ALIBABA_APP_SECRET", "")
ACCESS_TOKEN = os.environ.get("ALIBABA_ACCESS_TOKEN", "")
ERP_URL = os.environ.get("ERP_URL", "http://localhost:3001")
API_TOKEN = os.environ.get("COLLECT_API_TOKEN", "")

# 筛选条件
FILTER_TYPE = os.environ.get("FILTER_TYPE", "onSelling")  # onSelling/approved/auditing/editingRequired/expired
MAX_PRODUCTS = int(os.environ.get("MAX_PRODUCTS", "200"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("alibaba-seller-collector")


# ===== 阿里 Open API 客户端 =====

class AlibabaAPIClient:
    """阿里国际站 Open API 客户端（卖家自有产品）"""

    API_BASE = "https://openapi-api.alibaba.com/rest"

    def __init__(self, app_key: str, app_secret: str, access_token: str):
        self.app_key = app_key
        self.app_secret = app_secret
        self.access_token = access_token

    def _sign(self, params: dict, api_operation: str) -> str:
        """HMAC-SHA256 签名"""
        import hashlib, hmac
        sorted_params = sorted(params.items())
        concat_str = api_operation + "".join(f"{k}{v}" for k, v in sorted_params)
        return hmac.new(
            self.app_secret.encode("utf-8"), concat_str.encode("utf-8"),
            hashlib.sha256
        ).hexdigest().upper()

    async def call(self, api_operation: str, biz_params: dict = None) -> dict:
        """调用 API"""
        params = {
            "app_key": self.app_key,
            "access_token": self.access_token,
            "sign_method": "sha256",
            "timestamp": str(int(time.time() * 1000)),
            "format": "json",
            "method": api_operation,
        }
        if biz_params:
            params.update(biz_params)
        params["sign"] = self._sign(params, api_operation)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.API_BASE}{api_operation}",
                data=params,
                headers={"X-Protocol": "GOP", "Content-Type": "application/x-www-form-urlencoded"},
            )
            return resp.json()

    async def list_products(self, page: int = 1, page_size: int = 50,
                            filter_type: str = "onSelling") -> dict:
        """获取产品列表"""
        params = {
            "filter_type": filter_type,
            "current_page": str(page),
            "page_size": str(min(page_size, 50)),
        }
        return await self.call("/alibaba/icbu/product/list", params)

    async def get_product_detail(self, product_id: int) -> dict:
        """获取产品详情"""
        import json as _json
        biz_params = {
            "product_get_request": _json.dumps({
                "productId": product_id,
                "webSite": "ICBU",
            })
        }
        return await self.call("/icbu/product/get", biz_params)

    async def list_all_products(self, filter_type: str = "onSelling") -> list:
        """自动分页获取所有产品"""
        all_products = []
        page = 1
        while True:
            logger.info(f"  查询第 {page} 页...")
            result = await self.list_products(page=page, filter_type=filter_type)
            if "result" not in result:
                logger.warning(f"  API 返回异常: {result.get('error_message', result.get('message', '未知'))}")
                break
            products = result["result"].get("products", [])
            total = result["result"].get("total", 0)
            if not products:
                break
            all_products.extend(products)
            logger.info(f"  第 {page} 页: {len(products)} 条 (累计 {len(all_products)}/{total})")
            if len(all_products) >= total:
                break
            page += 1
            await asyncio.sleep(0.3)  # 限速
        return all_products


# ===== 采集与投递 =====

async def collect_and_ship(api_client: AlibabaAPIClient, filter_type: str = "onSelling",
                           max_products: int = 200) -> list:
    """采集店内产品并投递到 ERP"""
    logger.info(f"开始采集店内产品 (filter={filter_type}, max={max_products})")

    # 1. 获取产品列表
    products = await api_client.list_all_products(filter_type=filter_type)
    if not products:
        logger.warning("店铺内没有产品")
        return []

    products = products[:max_products]
    logger.info(f"共 {len(products)} 个产品，开始逐个获取详情...")

    # 2. 逐个获取详情并投递
    results = []
    for idx, p in enumerate(products, 1):
        pid = p.get("productId") or p.get("id", "")
        subject = (p.get("subject") or "")[:60]
        logger.info(f"[{idx}/{len(products)}] #{pid}: {subject}")

        detail = await api_client.get_product_detail(pid)
        if "product" not in detail:
            logger.warning(f"  获取详情失败")
            continue

        product = detail["product"]

        # 构建 ERP payload
        payload = {
            "source": "alibaba_api",
            "sourceUrl": f"https://www.alibaba.com/product-detail/{pid}.html",
            "sourceId": str(pid),
            "title": product.get("subject", subject),
            "description": product.get("description", ""),
            "price": _extract_price(product),
            "currency": "USD",
            "images": _extract_images(product),
            "attributes": _extract_attributes(product),
            "rawData": {
                "url": f"https://www.alibaba.com/product-detail/{pid}.html",
                "capturedAt": datetime.now().isoformat(),
                "apiResponse": {k: v for k, v in product.items() if k in ("categoryId", "status", "groupId")},
            },
        }

        # 投递到 ERP
        erp_result = await post_to_erp(payload)
        if erp_result:
            results.append(erp_result)
            logger.info(f"  ✅ 投递成功 (ID: {erp_result.get('id', '?')})")
        else:
            logger.error(f"  ❌ 投递失败")

        await asyncio.sleep(0.2)  # 限速

    logger.info(f"\n采集完成: {len(results)}/{len(products)} 个成功")
    return results


def _extract_price(product: dict) -> Optional[float]:
    """从价格结构中提取售价"""
    price = product.get("price")
    if isinstance(price, dict):
        return price.get("price") or price.get("priceFrom")
    if isinstance(price, (int, float)):
        return price
    return None


def _extract_images(product: dict) -> list:
    """提取图片"""
    images = product.get("images", [])
    if not images:
        return []
    result = []
    for i, img in enumerate(images):
        url = img.get("url", "") if isinstance(img, dict) else str(img)
        if url:
            result.append({
                "type": "main" if i == 0 else "gallery",
                "originalUrl": url,
                "mimeType": "image/jpeg",
                "fileName": f"image_{i+1}.jpg",
            })
    return result


def _extract_attributes(product: dict) -> list:
    """提取属性"""
    attrs = product.get("attributes", [])
    if not attrs:
        return []
    return [
        {"name": a.get("attributeName", ""), "value": a.get("valueName", "")}
        for a in attrs if a.get("attributeName") and a.get("valueName")
    ]


async def post_to_erp(payload: dict) -> Optional[dict]:
    """POST 到 Trade ERP"""
    if not API_TOKEN:
        logger.error("COLLECT_API_TOKEN 未设置")
        return None

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{ERP_URL}/api/external/collect",
                json=payload,
                headers={"X-API-Token": API_TOKEN, "Content-Type": "application/json"},
            )
        if resp.status_code in (200, 201):
            data = resp.json().get("data", resp.json())
            return data
        else:
            logger.error(f"  HTTP {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"  投递异常: {e}")
        return None


# ===== CLI 入口 =====

async def main():
    if not all([APP_KEY, APP_SECRET, ACCESS_TOKEN]):
        print("错误：缺少阿里 API 凭证")
        print("请设置环境变量:")
        print("  ALIBABA_APP_KEY, ALIBABA_APP_SECRET, ALIBABA_ACCESS_TOKEN")
        print("  COLLECT_API_TOKEN (ERP Token)")
        print("\n可选:")
        print("  FILTER_TYPE=onSelling|approved|expired")
        print("  MAX_PRODUCTS=200")
        sys.exit(1)

    if not API_TOKEN:
        print("错误：COLLECT_API_TOKEN 未设置")
        sys.exit(1)

    logger.info(f"阿里 Open API: APP_KEY={APP_KEY[:8]}...")
    logger.info(f"ERP: {ERP_URL}")
    logger.info(f"筛选: {FILTER_TYPE}, 上限: {MAX_PRODUCTS}")

    client = AlibabaAPIClient(APP_KEY, APP_SECRET, ACCESS_TOKEN)
    results = await collect_and_ship(client, filter_type=FILTER_TYPE, max_products=MAX_PRODUCTS)

    # 保存报告
    report = {
        "timestamp": datetime.now().isoformat(),
        "filter_type": FILTER_TYPE,
        "total": len(results),
        "products": results,
    }
    safe_name = f"alibaba_store_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    report_path = f"/Users/apple/clawd/trade-erp/services/alibaba-collector/output/{safe_name}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    logger.info(f"报告已保存: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
