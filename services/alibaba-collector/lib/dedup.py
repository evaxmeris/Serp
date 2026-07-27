"""
去重检查器 — 在采集前检查产品是否已在 ERP 中存在

两种模式:
1. API 查询模式: 调用 GET /api/external/collect/check?sourceUrl=xxx
2. 本地缓存模式: 内存字典，避免重复请求同一 URL

用法:
    checker = DedupChecker()
    result = await checker.check("https://...")
    if result["exists"]:
        logger.info(f"已存在: {result['title']} ({result['pipelineStatus']})")
"""
import json
import logging
from typing import Optional
from config import ERP_URL, API_TOKEN

logger = logging.getLogger(__name__)

# httpx 延迟导入
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class DedupChecker:
    """
    去重检查器

    API 查询 + 本地缓存双模式。
    本地缓存避免重复请求同一 URL。
    """

    def __init__(self, enable_api: bool = True, enable_cache: bool = True):
        """
        参数:
            enable_api: 是否启用 API 查询模式（需要 ERP_URL 和 API_TOKEN）
            enable_cache: 是否启用本地缓存
        """
        self._cache: dict[str, dict] = {}  # sourceUrl -> check result
        self._enable_api = enable_api and bool(API_TOKEN)
        self._enable_cache = enable_cache
        self._stats = {"api_calls": 0, "cache_hits": 0, "errors": 0}

    @property
    def stats(self) -> dict:
        return dict(self._stats)

    async def check(self, source_url: str) -> dict:
        """
        检查产品是否已采集过

        返回:
            {
                "exists": bool,
                "id": str | None,
                "title": str | None,
                "pipelineStatus": str | None,
                "source": "cache" | "api" | "unknown",
            }
        """
        normalized_url = source_url.split("?")[0].split("#")[0]

        # 1. 本地缓存查询
        if self._enable_cache and normalized_url in self._cache:
            self._stats["cache_hits"] += 1
            result = self._cache[normalized_url]
            result["source"] = "cache"
            return result

        # 2. API 查询
        if self._enable_api:
            result = await self._api_check(normalized_url)
        else:
            result = {"exists": False}

        # 3. 缓存结果
        if self._enable_cache:
            result["source"] = "api"
            self._cache[normalized_url] = result

        return result

    async def _api_check(self, source_url: str) -> dict:
        """调用 ERP API 查询"""
        self._stats["api_calls"] += 1

        if not API_TOKEN:
            return {"exists": False}

        url = f"{ERP_URL}/api/external/collect/check?sourceUrl={__import__('urllib.parse').quote(source_url)}"
        headers = {
            "X-API-Token": API_TOKEN,
            "Content-Type": "application/json",
        }

        try:
            if HAS_HTTPX:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(url, headers=headers)
            else:
                import urllib.request
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = json.loads(r.read().decode("utf-8"))
                    data = body.get("data", body)
                    exists = data.get("exists", False)
                    result = {
                        "exists": exists,
                        "id": data.get("id") if exists else None,
                        "title": data.get("title") if exists else None,
                        "pipelineStatus": data.get("pipelineStatus") if exists else None,
                    }
                    return result

            if resp.status_code == 200:
                body = resp.json()
                data = body.get("data", body)
                exists = data.get("exists", False)
                return {
                    "exists": exists,
                    "id": data.get("id") if exists else None,
                    "title": data.get("title") if exists else None,
                    "pipelineStatus": data.get("pipelineStatus") if exists else None,
                }
            else:
                logger.warning(f"去重查询失败 HTTP {resp.status_code}: {resp.text[:200]}")
                self._stats["errors"] += 1
                return {"exists": False}

        except Exception as e:
            logger.warning(f"去重查询异常: {e}")
            self._stats["errors"] += 1
            return {"exists": False}

    def mark_collected(self, source_url: str):
        """在采集成功后更新缓存状态（避免重复采集）"""
        normalized_url = source_url.split("?")[0].split("#")[0]
        self._cache[normalized_url] = {
            "exists": True,
            "id": "__just_collected__",
            "title": None,
            "pipelineStatus": "collected",
        }

    def clear_cache(self):
        """清空本地缓存"""
        self._cache.clear()
        self._stats = {"api_calls": 0, "cache_hits": 0, "errors": 0}

    def get_cache_size(self) -> int:
        return len(self._cache)
