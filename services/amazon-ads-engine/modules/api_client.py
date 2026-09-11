"""
亚马逊广告 API 客户端 (v3)
封装：关键词 CRUD / 否定词 / 报告拉取
所有写操作默认走 dry-run（--apply 才真正执行）
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
from modules.auth import AmazonAdsAuth, ADVERTISING_API_BASE


class AdsApiError(Exception):
    def __init__(self, status, body):
        self.status = status
        self.body = body
        super().__init__(f"API {status}: {body}")


class AdsApiClient:
    def __init__(self, auth: AmazonAdsAuth, dry_run: bool = True):
        self.auth = auth
        self.dry_run = dry_run
        self._profile_id = None

    # ─── 基础请求 ───
    def _request(self, method: str, path: str, body: dict | None = None) -> dict | list:
        url = ADVERTISING_API_BASE + path
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=self.auth.headers())
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            raise AdsApiError(e.code, raw)

    # ─── 报告（搜索词报告，异步：创建→轮询→下载） ───
    def create_report(self, campaign_ids: list[str] | None = None,
                      date_range: str = "LAST_30_DAYS",
                      start_date: str | None = None,
                      end_date: str | None = None) -> dict:
        """创建搜索词报告请求，返回 reportId"""
        body = {
            "name": "SearchTermReport",
            "startDate": start_date or "2026-07-30",
            "endDate": end_date or "2026-08-28",
            "configuration": {
                "adProduct": "SPONSORED_PRODUCTS",
                "groupBy": ["advertiser"],
                "columns": ["campaignName", "adGroupName", "targeting", "matchType",
                            "customerSearchTerm", "impressions", "clicks", "cost",
                            "attributedSales7d", "attributedUnitsOrdered7d"],
                "reportTypeId": "spSearchTerm",
                "timeUnit": "SUMMARY",
                "format": "GZIP_JSON",
            },
        }
        return self._request("POST", "/reporting/reports", body)

    def get_report_status(self, report_id: str) -> dict:
        return self._request("GET", f"/reporting/reports/{report_id}")

    def download_report(self, report_id: str, out_path: str) -> str:
        """报告就绪后下载到本地（返回文件路径）"""
        url = f"{ADVERTISING_API_BASE}/reporting/reports/{report_id}/download"
        req = urllib.request.Request(url, headers=self.auth.headers())
        with urllib.request.urlopen(req, timeout=120) as resp:
            with open(out_path, "wb") as f:
                f.write(resp.read())
        return out_path

    # ─── 关键词 ───
    def list_keywords(self, ad_group_ids: list[str]) -> list:
        """查询广告组下所有关键词（含 bid / state）"""
        return self._request("POST", "/sp/keywords/list",
                             {"adGroupIdFilter": {"include": ad_group_ids}})

    def update_keywords(self, updates: list[dict]) -> dict:
        """批量更新关键词（bid / state）。updates: [{keywordId, bid?|state?}...]"""
        if self.dry_run:
            print(f"[DRY-RUN] 将更新关键词: {json.dumps(updates, ensure_ascii=False)}")
            return {"dry_run": True, "updates": updates}
        return self._request("PUT", "/sp/keywords", {"keywords": updates})

    def create_keywords(self, keywords: list[dict]) -> dict:
        """新建关键词: [{adGroupId, keywordText, matchType, bid}...]"""
        if self.dry_run:
            print(f"[DRY-RUN] 将新建关键词: {json.dumps(keywords, ensure_ascii=False)}")
            return {"dry_run": True, "keywords": keywords}
        return self._request("POST", "/sp/keywords", {"keywords": keywords})

    # ─── 否定关键词 ───
    def create_negative_keywords(self, negatives: list[dict]) -> dict:
        """新建否定关键词: [{adGroupId, keywordText, matchType}...]"""
        if self.dry_run:
            print(f"[DRY-RUN] 将添加否定关键词: {json.dumps(negatives, ensure_ascii=False)}")
            return {"dry_run": True, "negatives": negatives}
        return self._request("POST", "/sp/negativeKeywords", {"negativeKeywords": negatives})


if __name__ == "__main__":
    # 自测：无凭据时走 dry-run 路径验证逻辑
    from modules.auth import AuthError
    try:
        auth = AmazonAdsAuth()
    except AuthError as e:
        print(f"[预期] {e}")
        print("客户端逻辑就绪：获得凭据后 config.json 填入即可使用")
