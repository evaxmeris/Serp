"""
执行模块：把决策转换为 API 调用批次
安全机制：dry-run 默认；apply 前打印完整清单；限额保护
"""
import json
from modules.api_client import AdsApiClient
from modules.decisions import Decision


class Executor:
    def __init__(self, client: AdsApiClient, max_batch: int = 50):
        self.client = client
        self.max_batch = max_batch  # 单次执行上限，防误伤

    def _check_limit(self, items: list) -> list:
        if len(items) > self.max_batch:
            print(f"⚠️ 批次 {len(items)} 条超过限额 {self.max_batch}，仅取前 {self.max_batch} 条")
            return items[:self.max_batch]
        return items

    def build_batches(self, decisions: list[Decision]) -> dict:
        """决策 → 操作批次（含 keywordId 映射说明，实际 id 需从 list_keywords 获取）"""
        batches = {
            "raise_bid": [],    # [{keywordId, bid}]
            "reduce_bid": [],
            "pause": [],        # [{keywordId, state: "PAUSED"}]
            "negate": [],       # [{adGroupId, keywordText, matchType}]
            "new_exact": [],    # [{adGroupId, keywordText, matchType, bid}]
        }
        for d in decisions:
            if d.kind == "KEEP_RAISE":
                batches["raise_bid"].append({"term": d.term, "action": "bid+20%"})
            elif d.kind == "KEEP_REDUCE":
                batches["reduce_bid"].append({"term": d.term, "action": "bid-15%"})
            elif d.kind == "KEEP_STOP":
                batches["pause"].append({"term": d.term, "action": "pause"})
            elif d.kind == "NEGATE":
                batches["negate"].append({"term": d.term, "action": "negative exact"})
            elif d.kind == "NEW_EXACT":
                batches["new_exact"].append({"term": d.term, "action": "new exact"})
        return batches

    def preview(self, batches: dict) -> str:
        lines = ["\n===== 操作预览 ====="]
        for kind, items in batches.items():
            if items:
                lines.append(f"[{kind}] {len(items)} 条:")
                for it in items[:10]:
                    lines.append(f"  - {it['term']} → {it['action']}")
                if len(items) > 10:
                    lines.append(f"  ... 其余 {len(items)-10} 条省略")
        return "\n".join(lines)

    def apply(self, batches: dict) -> dict:
        """真正执行（仅在 --apply 时调用）"""
        results = {}
        if batches["negate"]:
            negs = [{"adGroupId": "", "keywordText": it["term"], "matchType": "EXACT"}
                    for it in self._check_limit(batches["negate"])]
            results["negate"] = self.client.create_negative_keywords(negs)
        if batches["new_exact"]:
            keys = [{"adGroupId": "", "keywordText": it["term"], "matchType": "EXACT", "bid": 0.30}
                    for it in self._check_limit(batches["new_exact"])]
            results["new_exact"] = self.client.create_keywords(keys)
        # raise/reduce/pause 需要 keywordId（从 list_keywords 获得后填充）
        return results
