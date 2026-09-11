#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
api_fetcher.py — M2 ApiFetcher 骨架（REQ-ADS-007 数据获取层抽象的真实实现）

模式：
  - mock（默认）：凭据未配置时用模拟数据演示，dry-run 安全
  - real：凭据配置后真实调 Ads API v3（自研客户端 modules/auth.py + api_client.py，ADR-001）

功能：
  1. fetch_keyword_settings：读投放词 bid/状态（POST /sp/keywords/list）
  2. fetch_report：创建+轮询+下载报告（POST /reporting/reports → GET /download）
  3. apply_recommendations：自动执行决策（PUT /sp/keywords、POST /sp/negativeKeywords）
     ★ 安全设计：dry_run 默认 True；单批上限 50（executor）；二次确认才 apply

用法（CLI 入口 fetch_cli.py 调用本模块）：
  fetch_keyword_settings(config, ad_group_ids)
  fetch_report(config, start_date, end_date, campaign_ids, out_path)
  apply_recommendations(config, decisions, dry_run=True)
"""
from __future__ import annotations

import json
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

from modules.auth import AmazonAdsAuth
from modules.api_client import AdsApiClient


def _is_configured(cfg: dict) -> bool:
    """凭据是否齐全（client_id/client_secret/refresh_token 三件套 + profile_id）"""
    return bool(
        cfg.get("client_id") and cfg.get("client_secret")
        and cfg.get("refresh_token") and cfg.get("profile_id")
    )


class ApiFetcher:
    def __init__(self, config: dict | None = None):
        self.config = config or {}
        self.dry_run = bool(self.config.get("dry_run", True))
        self.configured = _is_configured(self.config)
        self._client: AdsApiClient | None = None
        if self.configured:
            auth = AmazonAdsAuth({
                "client_id": self.config["client_id"],
                "client_secret": self.config["client_secret"],
                "refresh_token": self.config["refresh_token"],
                "marketplace": self.config.get("marketplace", "US"),
            })
            self._client = AdsApiClient(auth, dry_run=self.dry_run)

    # ─── 1. 读投放词设置（bid/状态） ───
    def fetch_keyword_settings(self, ad_group_ids: list[str]) -> dict:
        """拉取投放词当前 bid/状态（层级核对数据源）。
        真实：POST /sp/keywords/list；mock：返回演示数据。"""
        if not self.configured:
            return self._mock_keywords(ad_group_ids)
        assert self._client is not None
        keywords = self._client.list_keywords(ad_group_ids)
        return {
            "ok": True,
            "mode": "real",
            "keywords": keywords,
        }

    def _mock_keywords(self, ad_group_ids: list[str]) -> dict:
        """mock：构造演示关键词列表（无凭据时验证流程用）"""
        demo = [
            {"keywordId": "kw-demo-001", "keywordText": "breast enhancement cream",
             "matchType": "EXACT", "bid": 0.36, "state": "ENABLED"},
            {"keywordId": "kw-demo-002", "keywordText": "butt enhancement cream",
             "matchType": "EXACT", "bid": 0.47, "state": "ENABLED"},
            {"keywordId": "kw-demo-003", "keywordText": "bigger breast",
             "matchType": "EXACT", "bid": 0.30, "state": "ENABLED"},
        ]
        return {"ok": True, "mode": "mock", "keywords": demo}

    # ─── 2. 拉报告（创建→轮询→下载） ───
    def fetch_report(self, report_type: str = "SP_TARGETING",
                     start_date: str = "", end_date: str = "",
                     campaign_ids: list[str] | None = None,
                     out_path: str = "") -> dict:
        """拉取广告报告。真实：POST /reporting/reports 异步创建→轮询→下载。
        mock：提示无凭据，不产生文件。"""
        if not self.configured:
            return {
                "ok": False,
                "mode": "mock",
                "error": "Ads API 凭据未配置（M2 待审批），无法拉取报告；请先在后台手动导出",
            }
        assert self._client is not None
        resp = self._client.create_report(campaign_ids, start_date, end_date)
        report_id = resp.get("reportId") or (resp.get("data") or {}).get("reportId")
        if not report_id:
            return {"ok": False, "mode": "real", "error": f"创建报告失败: {resp}"}
        # 轮询（最多 12 次 × 10s = 2 分钟）
        for _ in range(12):
            time.sleep(10)
            status = self._client.get_report_status(report_id)
            st = status.get("status") or (status.get("data") or {}).get("status")
            if st == "COMPLETED":
                path = self._client.download_report(report_id, out_path or f"/tmp/ads-report-{report_id}.csv")
                return {"ok": True, "mode": "real", "reportId": report_id, "path": path}
            if st in ("FAILED", "CANCELLED"):
                return {"ok": False, "mode": "real", "error": f"报告生成失败: {st}"}
        return {"ok": False, "mode": "real", "error": "报告生成超时（2 分钟）"}

    # ─── 3. 自动执行决策（★ dry-run 默认） ───
    def apply_recommendations(self, decisions: list[dict], dry_run: bool | None = None) -> dict:
        """把决策转换为 API 执行。
        decisions: [{action: PAUSE|RAISE_BID|LOWER_BID|NEGATE|CREATE,
                     keywordId/externalId, keywordText, matchType, bid, amazonCampaignId}]
        安全：dry_run 默认 True；真实执行前必须二次确认（confirm 参数由上层控制）。
        """
        dry = self.dry_run if dry_run is None else dry_run
        if not self.configured:
            return {
                "ok": False,
                "mode": "mock",
                "dryRun": True,
                "error": "Ads API 凭据未配置（M2 待审批）；当前为 dry-run 演示，不会真实修改后台",
                "batches": self._build_batches(decisions),
            }
        assert self._client is not None
        batches = self._build_batches(decisions)
        if dry:
            return {"ok": True, "mode": "real", "dryRun": True, "batches": batches,
                    "message": "dry-run：以下为将执行的批次，确认后以 apply 模式执行"}
        # 真实执行（单批上限 50）
        results = {"updated": [], "negated": [], "created": []}
        for up in batches.get("update", [])[:50]:
            results["updated"].append(self._client.update_keywords([up]))
        for neg in batches.get("negate", [])[:50]:
            results["negated"].append(self._client.create_negative_keywords([neg]))
        for kw in batches.get("create", [])[:50]:
            results["created"].append(self._client.create_keywords([kw]))
        return {"ok": True, "mode": "real", "dryRun": False, "results": results}

    @staticmethod
    def _build_batches(decisions: list[dict]) -> dict:
        """决策 → API 批次（含层级约束后的 bid）"""
        update, negate, create = [], [], []
        for d in decisions:
            action = (d.get("action") or "").upper()
            keyword_id = d.get("keywordId") or d.get("externalId")
            if action == "PAUSE":
                if keyword_id:
                    update.append({"keywordId": keyword_id, "state": "paused"})
            elif action in ("RAISE_BID", "LOWER_BID"):
                if keyword_id and d.get("bid") is not None:
                    update.append({"keywordId": keyword_id, "bid": d["bid"], "state": "enabled"})
            elif action == "NEGATE":
                negate.append({"campaignId": d.get("amazonCampaignId"),
                               "keywordText": d.get("keywordText"),
                               "matchType": "negativeExact"})
            elif action == "CREATE":
                create.append({"adGroupId": d.get("adGroupId"),
                               "keywordText": d.get("keywordText"),
                               "matchType": (d.get("matchType") or "EXACT").lower(),
                               "bid": d.get("bid")})
        return {"update": update, "negate": negate, "create": create}

    # ─── 4. 接入状态（供前端展示） ───
    def status(self) -> dict:
        if self.configured:
            return {
                "configured": True,
                "mode": "real",
                "dryRun": self.dry_run,
                "marketplace": self.config.get("marketplace", "US"),
                "profileId": self.config.get("profile_id", ""),
                "message": "Ads API 已配置，可自动拉取与执行",
            }
        return {
            "configured": False,
            "mode": "mock",
            "dryRun": True,
            "marketplace": self.config.get("marketplace", "US"),
            "profileId": "",
            "message": "Ads API 凭据未配置（M2 待审批）：当前为手动上传模式；审批通过后在站点管理填写凭据即启用",
        }


# ─── CLI 入口（Node 侧 engine-client 子进程调用） ───
def main() -> None:
    import argparse
    import sys
    import os

    p = argparse.ArgumentParser(description="M2 ApiFetcher CLI")
    p.add_argument("--action", required=True, choices=["status", "keywords", "report", "apply"])
    p.add_argument("--config", default="", help="凭据 JSON 路径（从 AdAccount 解密后写入临时文件）")
    p.add_argument("--ad-group-ids", default="", help="逗号分隔 adGroupId 列表")
    p.add_argument("--campaign-ids", default="", help="逗号分隔 campaignId 列表")
    p.add_argument("--start-date", default="")
    p.add_argument("--end-date", default="")
    p.add_argument("--out", default="", help="报告输出路径")
    p.add_argument("--decisions", default="", help="决策 JSON 路径（apply 用）")
    p.add_argument("--dry-run", action="store_true", default=True, help="默认 dry-run")
    p.add_argument("--apply", action="store_true", help="真实执行（需二次确认）")
    args = p.parse_args()

    cfg: dict = {}
    if args.config and os.path.exists(args.config):
        cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    cfg.setdefault("dry_run", not args.apply)

    f = ApiFetcher(cfg)
    result = {}
    try:
        if args.action == "status":
            result = f.status()
        elif args.action == "keywords":
            ids = [x for x in args.ad_group_ids.split(",") if x]
            result = f.fetch_keyword_settings(ids)
        elif args.action == "report":
            ids = [x for x in args.campaign_ids.split(",") if x]
            result = f.fetch_report(start_date=args.start_date, end_date=args.end_date,
                                    campaign_ids=ids or None, out_path=args.out)
        elif args.action == "apply":
            decisions = json.loads(Path(args.decisions).read_text(encoding="utf-8")) if args.decisions else []
            result = f.apply_recommendations(decisions, dry_run=not args.apply)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:  # 契约：失败输出 {ok:false, error}
        print(json.dumps({"ok": False, "mode": "mock" if not f.configured else "real",
                          "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
