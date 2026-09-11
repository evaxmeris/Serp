"""
决策引擎：把搜索词报告数据按规则分类，输出操作建议
规则（可配置，config.json 的 rules 字段）：
  - 出单且 ACoS <= keep_bid_acos      → 加价 (bid_up_pct)
  - 出单且 ACoS <= reduce_bid_acos    → 降竞价 (bid_down_pct)
  - 出单且 ACoS >  stop_acos           → 暂停/大幅降价
  - 烧钱无单且花费 >= negate_spend     → 否定 + 暂停
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Decision:
    term: str
    kind: str            # KEEP_RAISE / KEEP_REDUCE / KEEP_STOP / NEGATE / NEW_EXACT
    orders: int
    spend: float
    sales: float
    acos: float | None
    action_text: str


@dataclass
class Rules:
    keep_bid_acos: float = 30.0     # ACoS <= 30% 加价
    bid_up_pct: float = 20.0
    reduce_bid_acos: float = 60.0   # ACoS <= 60% 降竞价
    bid_down_pct: float = 15.0
    stop_acos: float = 100.0        # ACoS > 100% 暂停
    negate_clicks: float = 26.0     # 否定阈值：点击 >= N 且 0 单才否定（基于出单词点击/单中位数×2）
    new_exact_acos: float = 60.0    # 出单且 ACoS <= 60% 建议新建精准
    exact_terms: set = field(default_factory=set)  # 已有精准投放的词
    # 竞价层级维度一：匹配类型梯度（同一词根内）
    match_level: dict = field(default_factory=lambda: {'EXACT': 1.0, 'PHRASE': 0.75, 'BROAD': 0.5})
    # 竞价层级维度二：词长梯度（长尾词更精准 → 更高竞价系数）
    length_level: dict = field(default_factory=lambda: {'short': 1.00, 'mid': 1.20, 'long': 1.40})


def word_bucket(term: str) -> str:
    """词长分桶：short(1-2词) / mid(3-4词) / long(5+词)"""
    words = [w for w in term.lower().replace('-', ' ').split() if any(c.isalpha() for c in w)]
    n = len(words)
    if n <= 2:
        return 'short'
    if n <= 4:
        return 'mid'
    return 'long'


def decide(term_stats: dict, rules: Rules | None = None) -> list[Decision]:
    """term_stats: {term: {spend, sales, orders, clicks, sources}}
    返回按 term 排序的决策列表"""
    rules = rules or Rules()
    decisions = []

    for term, d in term_stats.items():
        acos = (d["spend"] / d["sales"] * 100) if d["sales"] else None

        if d["orders"] > 0:
            if acos is not None and acos <= rules.keep_bid_acos:
                kind, act = "KEEP_RAISE", f"出单{acos:.1f}% → 加价{rules.bid_up_pct:.0f}%"
            elif acos is not None and acos <= rules.reduce_bid_acos:
                kind, act = "KEEP_REDUCE", f"出单{acos:.1f}% → 降竞价{rules.bid_down_pct:.0f}%"
            elif acos is not None and acos <= rules.stop_acos:
                kind, act = "KEEP_REDUCE", f"出单{acos:.1f}% → 大幅降竞价或暂停"
            else:
                kind, act = "KEEP_STOP", f"出单但ACoS {acos:.1f}% → 暂停/停止"
            decisions.append(Decision(term, kind, d["orders"], d["spend"], d["sales"], acos, act))

            # 广泛/短语出单且健康 → 建议新建精准（若当前无精准）
            if acos is not None and acos <= rules.new_exact_acos and term not in rules.exact_terms:
                decisions.append(Decision(term, "NEW_EXACT", d["orders"], d["spend"], d["sales"],
                                          acos, "建议新建精准匹配"))
        else:
            if d["clicks"] >= rules.negate_clicks:
                decisions.append(Decision(term, "NEGATE", 0, d["spend"], 0.0, None,
                                          f"点击{int(d['clicks'])}≥阈值{rules.negate_clicks:.0f}仍无单 → 否定"))
            else:
                decisions.append(Decision(term, "MONITOR", 0, d["spend"], 0.0, None,
                                          f"点击{int(d['clicks'])}<阈值{rules.negate_clicks:.0f} → 继续观察（数据不足）"))

    return decisions


def decide_combos(combo_stats: dict, rules: Rules | None = None) -> list[Decision]:
    """按 (投放词×匹配类型) 组合粒度决策——后台可独立操作的最小单位。
    combo_stats: {"投放词|匹配类型": {spend, sales, orders, clicks, impr}}
    """
    rules = rules or Rules()
    decisions = []
    for combo, d in combo_stats.items():
        acos = (d["spend"] / d["sales"] * 100) if d["sales"] else None
        if d["orders"] > 0:
            if acos is not None and acos <= rules.keep_bid_acos:
                kind, act = "KEEP_RAISE", f"出单{acos:.1f}% → 加价{rules.bid_up_pct:.0f}%"
            elif acos is not None and acos <= rules.reduce_bid_acos:
                kind, act = "KEEP_REDUCE", f"出单{acos:.1f}% → 降竞价{rules.bid_down_pct:.0f}%"
            elif acos is not None and acos <= rules.stop_acos:
                kind, act = "KEEP_REDUCE", f"出单{acos:.1f}% → 大幅降竞价或暂停"
            else:
                kind, act = "KEEP_STOP", f"出单但ACoS {acos:.1f}% → 暂停/停止"
            decisions.append(Decision(combo, kind, d["orders"], d["spend"], d["sales"], acos, act))
        else:
            if d["clicks"] >= rules.negate_clicks:
                decisions.append(Decision(combo, "NEGATE", 0, d["spend"], 0.0, None,
                                          f"点击{int(d['clicks'])}≥阈值{rules.negate_clicks:.0f}仍无单 → 否定/暂停该投放"))
            else:
                decisions.append(Decision(combo, "MONITOR", 0, d["spend"], 0.0, None,
                                          f"点击{int(d['clicks'])}<阈值{rules.negate_clicks:.0f} → 继续观察"))
    return decisions


def check_bid_ladder(combo_stats: dict, bids: dict | None = None,
                     rules: Rules | None = None) -> list[str]:
    """竞价层级检查：同一词根族内 EXACT > PHRASE > BROAD 的竞价(bid)梯度
    ⚠️ 铁律（2026-08-29 用户纠正）：必须用【竞价设置 bid】判断，不能用实际 CPC！
       - 搜索词报告不含 bid 列，只有实际 CPC；CPC 受第二价格拍卖影响会低于 bid，
         CPC "倒挂" 不代表 bid 倒挂（v7 曾因此误判 butt enhancement cream）
       - bids 参数从广告后台导出（投放/关键词报告含 bid 列）或 Ads API
         GET /sp/keywords 获取；无 bid 数据时返回提示，不得用 CPC 冒充
       - CPC 仅作参考：可评估拍卖效率（CPC 明显低于 bid = 竞争压力小、划算）
    返回冲突警告列表。
    combo_stats: {"投放词|匹配类型": {cpc,...}}
    bids: {投放词: {匹配类型: bid值}}（如 {"butt enhancement cream": {"EXACT": 0.47, "BROAD": 0.45}}）
    """
    rules = rules or Rules()
    warnings = []
    families: dict[str, dict] = {}
    for combo, d in combo_stats.items():
        target, match = combo.rsplit("|", 1)
        families.setdefault(target, {})[match] = d

    if not bids:
        # 无 bid 数据：列出需要用户核对 bid 的词根清单，不输出倒挂结论
        multi = [t for t, ms in families.items() if len(ms) >= 2]
        if multi:
            warnings.append(
                f"⚠️ 无 bid 数据：以下 {len(multi)} 个词根存在多种匹配类型，"
                f"需从广告后台导出竞价设置后核对层级（精准>短语>广泛）：{', '.join(sorted(multi))}")
        return warnings

    for target, matches in families.items():
        if len(matches) < 2:
            continue
        t_bids = bids.get(target, {})
        if not t_bids:
            warnings.append(f"⚠️ 词根 {target} 缺 bid 数据，无法核对层级")
            continue
        for hi, lo in [("EXACT", "PHRASE"), ("PHRASE", "BROAD"), ("EXACT", "BROAD")]:
            if hi in t_bids and lo in t_bids and t_bids[hi] is not None and t_bids[lo] is not None:
                # 理论上 hi 的 bid 应 >= lo；若倒挂（hi 明显低于 lo），警告
                if t_bids[hi] < t_bids[lo] * 0.9:
                    warnings.append(
                        f"竞价倒挂: {target} 的 {hi}(bid ${t_bids[hi]:.2f}) < {lo}(bid ${t_bids[lo]:.2f})，"
                        f"层级应为 {hi} > {lo}")
    return warnings


# ─── 拓词探索模块（EXPAND）───
@dataclass
class ExpansionSuggestion:
    """拓词建议：围绕出单词根播种宽泛探索"""
    root_term: str          # 出单的搜索词/词根
    orders: int
    acos: float | None
    reason: str             # 拓词理由
    broad_seed: str         # 建议开宽泛的种子词
    variants: list          # 生成的探索变体


# 常见修饰词（生成变体用）
MODIFIER_POOL = {
    '功效': ['firming', 'lifting', 'tightening', 'plumping', 'enhancing', 'volume'],
    '人群': ['for women', 'for sagging breasts', 'for bust', 'for older women'],
    '质地': ['cream', 'serum', 'lotion', 'oil', 'balm'],
    '场景': ['natural', 'fast acting', 'daily', 'best', 'organic'],
}


def generate_variants(root_term: str, max_per_cat: int = 2) -> list[str]:
    """从出单词根生成探索变体（功效/人群/质地/场景 组合）"""
    words = root_term.lower().split()
    core = ' '.join(words[-2:]) if len(words) >= 2 else root_term
    variants = []
    for cat, mods in MODIFIER_POOL.items():
        for m in mods[:max_per_cat]:
            if m in root_term:
                continue
            if cat in ('功效', '场景'):
                variants.append(f"{m} {core}".strip())
            else:
                variants.append(f"{core} {m}".strip())
    return variants[:10]


def find_expansion_opportunities(term_sources: dict, combo_stats: dict,
                                 rules: Rules | None = None) -> list[ExpansionSuggestion]:
    """拓词机会识别：
    term_sources: {搜索词: {orders, spend, sales, sources:set("投放词(匹配)")}}
    规则：
      1) 出单且 ACoS 健康，但只有精准无宽泛 → 开宽泛探索
      2) 出单但完全无精准投放（靠广泛偶然命中）→ 先提炼精准
    """
    suggestions = []
    for term, s in term_sources.items():
        if s['orders'] <= 0:
            continue
        acos = (s['spend'] / s['sales'] * 100) if s['sales'] else None
        if acos is not None and acos > rules.reduce_bid_acos if rules else False:
            continue  # ACoS 太差的词根不值得拓词
        has_exact = any('EXACT' in src for src in s['sources'])
        has_broad = any('BROAD' in src for src in s['sources'])
        if has_exact and not has_broad:
            suggestions.append(ExpansionSuggestion(
                root_term=term, orders=s['orders'], acos=acos,
                reason=f"有精准无宽泛（{s['orders']}单, ACoS {acos:.1f}%）→ 开宽泛探索播种",
                broad_seed=term, variants=generate_variants(term)))
        elif not has_exact:
            suggestions.append(ExpansionSuggestion(
                root_term=term, orders=s['orders'], acos=acos,
                reason=f"出单但无精准投放（{s['orders']}单, ACoS {acos:.1f}%）→ 优先提炼为精准",
                broad_seed=term, variants=generate_variants(term)))
    return suggestions


def summarize(decisions: list[Decision]) -> dict:
    s = {"KEEP_RAISE": 0, "KEEP_REDUCE": 0, "KEEP_STOP": 0, "NEGATE": 0, "NEW_EXACT": 0, "MONITOR": 0}
    spend = {"KEEP_RAISE": 0.0, "KEEP_REDUCE": 0.0, "KEEP_STOP": 0.0, "NEGATE": 0.0, "NEW_EXACT": 0.0, "MONITOR": 0.0}
    for d in decisions:
        s[d.kind] += 1
        spend[d.kind] += d.spend
    return {"count": s, "spend": spend}
