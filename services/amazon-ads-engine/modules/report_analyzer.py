"""
报告分析器（report_analyzer）：搜索词报告 → 双维度聚合 → 决策建议
固化 2026-08-29 v8 方法论（经用户逐条核对修正）：

铁律：
1. 双维度：加价/降价/暂停看【投放词×匹配】；否定/新建精准看【客户搜索词】
2. 竞价层级/倒挂分析必须用 bid（外部传入），禁止用实际 CPC 判断（报告无 bid 列）
3. 只依据报告真实列：花费/销售/订单/点击/ACoS/CPC；不推断报告没有的数据
4. 用户可操作变量：每个投放词竞价高低、暂停/启用、否定、新建精准

用法：
    from modules.report_analyzer import analyze_report
    result = analyze_report('商品推广_搜索词_报告.xlsx', bids={...})
"""
from __future__ import annotations

import zipfile
import re
from xml.etree import ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

NSURI = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
def _q(tag: str) -> str:
    return f'{{{NSURI}}}{tag}'


# ─── 配置（可被 analyze_report 覆盖） ───
@dataclass
class AnalyzerConfig:
    break_even_acos: float = 40.0      # 盈亏平衡 ACoS ≈ 毛利率
    stop_spend_ratio: float = 1.5      # 止损线 = 客单价 × 比例
    negate_clicks: int = 82            # 统计否定阈值（账户 CVR 3.6%, P<0.05 时）
    watch_spend: float = 10.0          # 未达双标准但花费≥此值 → 降竞价观察
    risk_body_roots: tuple = ('breast', 'boob', 'bust', 'chest', 'butt',
                              'hip', 'glute', 'senos', 'bumbum')
    risk_growth_roots: tuple = ('enlarg', 'growth', 'bigger', 'grow',
                                'crecer', 'plumper')
    risk_spanish: tuple = ('crecer los senos',)
    irrelevant_terms: tuple = ('kikookikoo', 'palmers', 'silicone breastplate')


# ─── xlsx 解析（亚马逊导出 inlineStr 格式） ───
def _col_index(letter: str) -> int:
    n = 0
    for ch in letter:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def parse_xlsx(path: str) -> list[dict]:
    """解析亚马逊搜索词报告 xlsx，返回 [{列索引: 值}]，仅 sheet1。"""
    with zipfile.ZipFile(path) as z:
        xml = z.read('xl/worksheets/sheet1.xml')
        root = ET.fromstring(xml)
        rows = []
        for row in root.iter(_q('row')):
            cells = {}
            for c in row.iter(_q('c')):
                ref = c.get('r', '')
                m = re.match(r'([A-Z]+)', ref)
                idx = _col_index(m.group(1)) if m else len(cells)
                t = c.get('t')
                if t == 'inlineStr':
                    is_el = c.find(_q('is'))
                    texts = [x.text or '' for x in is_el.iter(_q('t'))] if is_el is not None else ['']
                    v = ''.join(texts)
                else:
                    vnode = c.find(_q('v'))
                    v = vnode.text if vnode is not None else ''
                cells[idx] = v
            if cells:
                rows.append(cells)
    return rows


def parse_csv(path: str) -> list[dict]:
    """解析亚马逊导出的 CSV 报告（Targeting/Advertised product 等），返回 [{列索引: 值}]。
    亚马逊 CSV 特点：UTF-8 BOM、ID 列包成 ="123"、百分比带 % 号。
    """
    import csv as _csv
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        for rec in _csv.reader(f):
            if not any(v.strip() for v in rec):
                continue
            cells = {}
            for i, v in enumerate(rec):
                v = (v or '').strip()
                if v.startswith('="') and v.endswith('"'):
                    v = v[2:-1]
                cells[i] = v
            rows.append(cells)
    return rows


def parse_table(path: str) -> list[dict]:
    """按扩展名分发解析（.csv → parse_csv，其余 → parse_xlsx）。"""
    return parse_csv(path) if path.lower().endswith('.csv') else parse_xlsx(path)


def _f(x, default: float = 0.0) -> float:
    try:
        if isinstance(x, str):
            x = x.strip().replace(',', '').replace('$', '').rstrip('%')
        return float(x)
    except (ValueError, TypeError):
        return default


# ─── 双维度聚合 ───
def aggregate(rows: list[dict], header: list[str]) -> dict:
    """返回 {account, campaigns, combos, terms} 两套聚合结果。"""
    def find_col(name_kw: str) -> Optional[int]:
        for i, h in enumerate(header):
            if name_kw in h:
                return i
        return None

    COLS = {
        'campaign': find_col('广告活动名称'), 'target': find_col('投放'),
        'match': find_col('匹配类型'), 'term': find_col('客户搜索词'),
        'impr': find_col('展示量'), 'clicks': find_col('点击量'),
        'cpc': find_col('单次点击成本'), 'spend': find_col('花费'),
        'sales': find_col('7天总销售额'), 'orders': find_col('7天总订单数'),
    }
    if any(v is None for v in COLS.values()):
        raise ValueError(f'报告列缺失: {COLS}')

    def g(r, name):
        return r.get(COLS[name], '')

    acc: dict = {'spend': 0.0, 'sales': 0.0, 'orders': 0, 'clicks': 0}
    camps: dict[str, dict] = defaultdict(lambda: {'spend': 0.0, 'sales': 0.0, 'orders': 0, 'clicks': 0})
    combos: dict[tuple, dict] = defaultdict(lambda: {'spend': 0.0, 'sales': 0.0, 'orders': 0, 'clicks': 0, 'impr': 0})
    terms: dict[str, dict] = defaultdict(lambda: {'spend': 0.0, 'sales': 0.0, 'orders': 0, 'clicks': 0, 'sources': set()})

    for r in rows:
        spend = _f(g(r, 'spend')); sales = _f(g(r, 'sales'))
        orders = int(_f(g(r, 'orders'))); clicks = int(_f(g(r, 'clicks')))
        impr = int(_f(g(r, 'impr')))
        acc['spend'] += spend; acc['sales'] += sales
        acc['orders'] += orders; acc['clicks'] += clicks

        camp = g(r, 'campaign')
        camps[camp]['spend'] += spend; camps[camp]['sales'] += sales
        camps[camp]['orders'] += orders; camps[camp]['clicks'] += clicks

        key = (g(r, 'target'), g(r, 'match'))
        d = combos[key]
        d['spend'] += spend; d['sales'] += sales
        d['orders'] += orders; d['clicks'] += clicks; d['impr'] += impr

        term = g(r, 'term')
        if term:
            t = terms[term]
            t['spend'] += spend; t['sales'] += sales
            t['orders'] += orders; t['clicks'] += clicks
            t['sources'].add(f"{g(r, 'target')}({g(r, 'match')})")

    aov = acc['sales'] / acc['orders'] if acc['orders'] else 0.0
    account = {
        'spend': round(acc['spend'], 2), 'sales': round(acc['sales'], 2),
        'orders': acc['orders'], 'clicks': acc['clicks'],
        'acos': round(acc['spend'] / acc['sales'] * 100, 1) if acc['sales'] else None,
        'cvr': round(acc['orders'] / acc['clicks'] * 100, 2) if acc['clicks'] else None,
        'aov': round(aov, 2),
    }
    combo_list = []
    for (tgt, mt), d in combos.items():
        acos = (d['spend'] / d['sales'] * 100) if d['sales'] else None
        combo_list.append({
            'target': tgt, 'match': mt, 'clicks': d['clicks'],
            'spend': round(d['spend'], 2), 'sales': round(d['sales'], 2),
            'orders': d['orders'], 'impr': d['impr'],
            'acos': round(acos, 1) if acos is not None else None,
            'cpc': round(d['spend'] / d['clicks'], 3) if d['clicks'] else 0,
        })
    term_list = []
    for term, t in terms.items():
        acos = (t['spend'] / t['sales'] * 100) if t['sales'] else None
        term_list.append({
            'term': term, 'clicks': t['clicks'], 'spend': round(t['spend'], 2),
            'sales': round(t['sales'], 2), 'orders': t['orders'],
            'acos': round(acos, 1) if acos is not None else None,
            'sources': sorted(t['sources']),
        })
    return {
        'account': account,
        'campaigns': {c: dict(v) for c, v in camps.items()},
        'combos': sorted(combo_list, key=lambda x: -x['spend']),
        'terms': sorted(term_list, key=lambda x: -x['spend']),
    }


# ─── 合规风险判断（胸/臀类目 × 增长宣称） ───
def is_risk_term(term: str, cfg: AnalyzerConfig) -> bool:
    t = term.lower()
    if any(s in t for s in cfg.risk_spanish):
        return True
    has_body = any(b in t for b in cfg.risk_body_roots)
    has_growth = any(g in t for g in cfg.risk_growth_roots)
    return has_body and has_growth


# ─── 词根族分析（v9：族内统筹 + 重复识别 + 出价层级规划） ───
# 单复数归一：cream/creams、enhancement/enhancements 等 → 基础形
_PLURAL_MAP = {
    'creams': 'cream', 'enhancements': 'enhancement', 'boobs': 'boob',
    'breasts': 'breast', 'butts': 'butt', 'busts': 'bust',
}
# 词干归一：同义词根变体 → 同一词干（enhance/enhancement/enhancing → enhanc）
_STEM_MAP = {
    'enhancement': 'enhanc', 'enhancing': 'enhanc', 'enhances': 'enhanc', 'enhance': 'enhanc',
    'firming': 'firm', 'firms': 'firm', 'firm': 'firm',
    'lifting': 'lift', 'lifts': 'lift', 'lift': 'lift',
    'tightening': 'tighten', 'tighten': 'tighten',
    'plumping': 'plump', 'plump': 'plump',
    'growing': 'grow', 'growth': 'grow', 'grows': 'grow', 'grow': 'grow',
    'enlargement': 'enlarg', 'enlarging': 'enlarg', 'enlarges': 'enlarg', 'enlarge': 'enlarg',
    'bigger': 'big', 'big': 'big',
    'busts': 'bust',
}
_STOP_WORDS = {'for', 'the', 'a', 'with', 'of', 'and', 'to', 'in', 'fast',
               'natural', 'women', 'women\'s'}

def normalize_target(tgt: str) -> str:
    """归一化投放词 → 词根族 key：小写、去停用词、单复数+词干归一、词序无关。
    例: 'enhancement creams women' → 'cream enhanc woman'
        'enhance breast cream'     → 'breast cream enhanc'  （enhance/enhancement 同族）
    同族 → 识别为重复投放（预算自我竞争）。
    """
    t = tgt.lower().replace('-', ' ').replace('"', '').strip()
    if t.startswith('asin='):
        return '[ASIN]'
    words = []
    for w in t.split():
        w = _PLURAL_MAP.get(w, w)
        w = _STEM_MAP.get(w, w)
        if w in _STOP_WORDS:
            continue
        words.append(w)
    return ' '.join(sorted(words))


def analyze_families(combos: list[dict]) -> dict:
    """族维度分析：按归一化词根聚类 → 族内结构 → 重复识别。
    返回 {family: {members: [combo...], spend, orders, acos, duplicates: [...]}}
    """
    families: dict[str, dict] = {}
    by_key: dict[str, str] = {}   # key -> 族名（用族内花费最高的词命名）
    for c in combos:
        key = normalize_target(c['target'])
        if key in by_key:
            fam = by_key[key]
        else:
            fam = c['target']
            by_key[key] = fam
        fam_d = families.setdefault(fam, {'members': [], 'spend': 0.0, 'sales': 0.0,
                                          'orders': 0, 'clicks': 0, 'targets': set()})
        fam_d['members'].append(c)
        fam_d['spend'] += c['spend']; fam_d['sales'] += c['sales']
        fam_d['orders'] += c['orders']; fam_d['clicks'] += c['clicks']
        fam_d['targets'].add(c['target'])

    # 族内重复识别：多个不同投放词（词序/单复数变体）或同一词多个匹配
    for fam, d in families.items():
        d['acos'] = round(d['spend'] / d['sales'] * 100, 1) if d['sales'] else None
        d['targets'] = sorted(d['targets'])
        dup_targets = [t for t in d['targets'] if t != fam]
        multi_match = any(len({m['match'] for m in [c for c in d['members'] if c['target'] == t]}) > 1
                          for t in d['targets'])
        d['duplicates'] = {
            'same_family_targets': dup_targets,          # 同族其他投放词（重复风险）
            'multi_match': multi_match,                  # 同一词开了多个匹配
        }
    return dict(sorted(families.items(), key=lambda x: -x[1]['spend']))


# ─── 拓词空间分析（v11：增量判断） ───
# 增量定义：搜索词有量（出单>0 或 点击≥阈值），但其来源不含所属族的 EXACT 投放
#           = 该搜索词的流量是主词 EXACT 覆盖不到的 → 拓 BROAD/提炼精准的增量空间
# 反例（非增量）：来源含本族 EXACT → 主词已捕获 → 提炼会重叠，不拓

def analyze_expansion_space(terms: list[dict], combos: list[dict],
                            min_clicks: int = 5, cfg: AnalyzerConfig | None = None) -> dict:
    """拓词空间：{族名: {candidates: [...], orders, clicks, spend, verdict}}"""
    cfg = cfg or AnalyzerConfig()
    # 族归属：投放词 → 族（用 normalize 聚类，族名取族内花费最高的词）
    families = analyze_families(combos)
    target2fam = {}
    for fam, d in families.items():
        for t in d['targets']:
            target2fam[t] = fam
    # 每族已有 EXACT 投放词
    fam_exact_targets: dict[str, set] = {}
    for c in combos:
        if c['match'] == 'EXACT':
            fam = target2fam.get(c['target'], c['target'])
            fam_exact_targets.setdefault(fam, set()).add(c['target'])

    # 每族主词（族内花费最高的出单 EXACT；无出单则花费最高的组合）
    fam_main: dict[str, dict] = {}
    for fam, d in families.items():
        winners = [c for c in d['members'] if c['orders'] > 0]
        pool = winners or d['members']
        fam_main[fam] = max(pool, key=lambda c: (c['orders'], c['spend']))

    # 搜索词增量判断
    result: dict[str, dict] = {}
    for t in terms:
        if t['orders'] == 0 and t['clicks'] < min_clicks:
            continue  # 无量的搜索词不构成拓词空间
        # 来源族：优先"来源中含EXACT的族"（EXACT捕获即归属明确）；否则取出现最多的族
        src_fams = []
        for src in t['sources']:
            tgt = src.rsplit('(', 1)[0].strip()
            fam = target2fam.get(tgt)
            if fam:
                src_fams.append((fam, src))
        if not src_fams:
            continue
        exact_fams = [fam for fam, src in src_fams if 'EXACT' in src]
        if exact_fams:
            fam = exact_fams[0]
        else:
            fam_counts: dict[str, int] = defaultdict(int)
            for fam, _ in src_fams:
                fam_counts[fam] += 1
            fam = max(fam_counts, key=lambda k: fam_counts[k])
        if fam == '[ASIN]' or fam.lower().startswith('asin='):
            continue  # ASIN 定向捕获的是商品搜索词，不是关键词拓词空间
        # 增量判断：来源是否含该族的 EXACT 匹配？（看匹配类型，不是只看投放词名）
        covered = any(('EXACT' in s) and (s.rsplit('(', 1)[0].strip() in fam_exact_targets.get(fam, set()))
                      for s in t['sources'])
        fam_d = result.setdefault(fam, {'candidates': [], 'orders': 0, 'clicks': 0, 'spend': 0.0})
        fam_d['orders'] += t['orders']; fam_d['clicks'] += t['clicks']; fam_d['spend'] += t['spend']
        fam_d['candidates'].append({
            'term': t['term'], 'orders': t['orders'], 'clicks': t['clicks'],
            'spend': round(t['spend'], 2), 'acos': t['acos'],
            'sources': t['sources'],
            'covered_by_exact': covered,
            'incremental': not covered,
        })

    # 族级结论
    for fam, d in result.items():
        inc = [c for c in d['candidates'] if c['incremental']]
        covered = [c for c in d['candidates'] if not c['incremental']]
        main = fam_main.get(fam, {})
        d['incremental_orders'] = sum(c['orders'] for c in inc)
        d['incremental_clicks'] = sum(c['clicks'] for c in inc)
        d['incremental_spend'] = round(sum(c['spend'] for c in inc), 2)
        main_orders = main.get('orders', 0)
        d['main'] = {'target': main.get('target'), 'orders': main_orders,
                     'acos': main.get('acos')}
        # 判断是否值得拓：风险词族不拓；主词出单≥3 且 增量空间有点击 → 拓
        if main.get('target') and is_risk_term(str(main['target']), cfg):
            d['verdict'] = '风险词族：不拓，关闭+否定'
            d['expand'] = False
        elif main_orders >= 3 and d['incremental_clicks'] >= min_clicks:
            d['verdict'] = '值得拓词（主词已验证 + 增量长尾有量）'
            d['expand'] = True
        elif d['incremental_clicks'] >= min_clicks:
            d['verdict'] = '有增量空间但主词样本不足：先治主词再拓'
            d['expand'] = False
        else:
            d['verdict'] = '增量空间小：不拓，专注主词'
            d['expand'] = False
        d['covered'] = covered
        d['incremental'] = inc
    return dict(sorted(result.items(), key=lambda x: -x[1]['incremental_clicks']))


# ─── 决策引擎（v8 分层，以盈亏平衡 ACoS 为锚） ───
def decide_combo(c: dict, cfg: AnalyzerConfig, stop_spend: float) -> str:
    o, s, ac, cl = c['orders'], c['spend'], c['acos'], c['clicks']
    if is_risk_term(c['target'], cfg):
        return '暂停+否定（合规风险词）'
    if o == 0:
        if s >= stop_spend:
            return f'暂停（花费${s:.0f}≥止损线${stop_spend:.0f}仍0单）'
        if cl >= cfg.negate_clicks:
            return f'暂停+否定（点击{cl}≥阈值{cfg.negate_clicks}仍0单）'
        if s >= cfg.watch_spend:
            return f'降竞价30%观察（花费${s:.1f}，未达止损线）'
        if c['match'] == 'PHRASE':
            return '暂停短语（全账户短语零转化）'
        return f'继续观察（花费${s:.2f}，未达双阈值）'
    if ac is None:
        return '保留'
    # 主力词保护：订单占比高且 ACoS 在亏损边缘 → 分步降
    if ac <= 45 and c.get('share_of_orders', 0) >= 0.3:
        return '降竞价10%（主力词分步降，保护量）'
    if ac <= 30:
        return '加价20%（健康，ACoS≤30%）'
    if ac <= cfg.break_even_acos:
        return '保持/小幅加价10%（盈利，ACoS≤40%）'
    if ac <= 60:
        return '降竞价15%（亏损边缘，ACoS 40-60%）'
    if ac <= 100:
        return '降竞价30%或暂停（明显亏损）'
    return '暂停（严重亏损，ACoS>100%）'


# ─── 投放报告解析（v15：bid + 状态自动读取） ───
def parse_targeting_report(path: str) -> dict:
    """解析投放/关键词报告（含竞价列+状态列）。
    返回 {'bids': {投放词: {匹配: bid}}, 'status': {投放词: {匹配: 状态}},
          'combos': [{target, match, bid, status, spend, sales, orders, clicks}]}
    投放报告列（中文导出）：投放、匹配类型、状态、竞价、展示量、点击量、花费、7天总销售额、7天总订单数等
    v16 兼容新版 Targeting CSV 列名：投放方案／投放匹配类型／投放状态／目标竞价／总成本／购买量
    """
    rows = parse_table(path)
    header = [rows[0].get(i, '') for i in sorted(rows[0])]
    def find_col(*kws):
        for kw in kws:
            for i, h in enumerate(header):
                if kw in h:
                    return i
        return None
    C = {
        'target': find_col('投放方案', '投放', '关键词'),
        'match': find_col('匹配类型'),
        'status': find_col('投放状态', '状态'),
        'bid': find_col('目标竞价', '竞价', 'Bid'),
        'spend': find_col('花费', '总成本', 'Cost'),
        'sales': find_col('7天总销售额', '销售额'),
        'orders': find_col('7天总订单数', '订单', '购买量'),
        'clicks': find_col('点击量', 'Clicks'),
    }
    if C['target'] is None or C['bid'] is None:
        raise ValueError(f'投放报告缺列(需含投放/竞价列)，实际列: {header}')
    bids: dict[str, dict] = {}
    status: dict[str, dict] = {}
    combos = []
    for r in rows[1:]:
        tgt = (r.get(C['target'], '') or '').strip()
        if not tgt:
            continue
        mt = (r.get(C['match'], '') or '').strip() or '-'
        bid = _f(r.get(C['bid']))
        st = (r.get(C['status'], '') or '').strip() or '未知'
        bids.setdefault(tgt, {})[mt] = bid
        status.setdefault(tgt, {})[mt] = st
        combos.append({
            'target': tgt, 'match': mt, 'bid': round(bid, 3), 'status': st,
            'spend': round(_f(r.get(C['spend'])), 2),
            'sales': round(_f(r.get(C['sales'])), 2),
            'orders': int(_f(r.get(C['orders']))),
            'clicks': int(_f(r.get(C['clicks']))),
        })
    return {'bids': bids, 'status': status, 'combos': combos}


def analyze_report(search_report_path: str, targeting_report_path: str | None = None,
                   bids: dict | None = None, cfg: AnalyzerConfig | None = None) -> dict:
    """主入口：双报告分析（v15）。
    search_report_path: 搜索词报告 xlsx（否定/提炼/增量）
    targeting_report_path: 投放报告 xlsx（bid/状态，可选但强烈推荐）
    bids: 手动传入竞价（优先于投放报告；用于无投放报告时）
    """
    cfg = cfg or AnalyzerConfig()
    rows = parse_xlsx(search_report_path)
    header = [rows[0].get(i, '') for i in sorted(rows[0])]
    agg = aggregate(rows[1:], header)

    # v15：投放报告 → 自动读 bid + 状态（手动 bids 优先）
    targeting = None
    if targeting_report_path:
        targeting = parse_targeting_report(targeting_report_path)
        if bids is None:
            bids = targeting['bids']

    A = agg['account']
    stop_spend = round(A['aov'] * cfg.stop_spend_ratio, 2)
    total_orders = max(A['orders'], 1)

    # 维度1：组合决策
    combos = agg['combos']
    for c in combos:
        c['share_of_orders'] = c['orders'] / total_orders
        c['action'] = decide_combo(c, cfg, stop_spend)

    # 维度2：否定 / 新建精准 / 观察
    neg_list, new_exact, watch_list = [], [], []
    for t in agg['terms']:
        if t['orders'] == 0:
            if is_risk_term(t['term'], cfg):
                neg_list.append({**t, 'reason': '合规风险词（胸/臀增长类宣称，受限商品政策）'})
            elif t['clicks'] >= cfg.negate_clicks or t['spend'] >= stop_spend:
                neg_list.append({**t, 'reason': f'达双标准（点击{t["clicks"]}≥{cfg.negate_clicks} 或 花费${t["spend"]:.1f}≥${stop_spend:.0f}）仍0单'})
            elif t['spend'] >= cfg.watch_spend:
                watch_list.append({**t, 'reason': f'花费${t["spend"]:.1f}偏高仍0单，未达双标准 → 降竞价观察'})
            elif any(k in t['term'].lower() for k in cfg.irrelevant_terms):
                neg_list.append({**t, 'reason': '不相关商品/竞品词'})
        else:
            has_exact = any('EXACT' in s for s in t['sources'])
            if not has_exact and (t['acos'] is None or t['acos'] <= 60):
                new_exact.append({**t, 'reason': f'{t["orders"]}单/ACoS {t["acos"]}% 来自非精准 → 提炼精准'})

    # 竞价层级核对（用 bid，不用 CPC）
    combo_stats = {f"{c['target']}|{c['match']}": c for c in combos}
    from .decisions import check_bid_ladder
    if bids is None:
        ladder = check_bid_ladder(combo_stats)   # 无 bid → 返回需核对清单
    else:
        ladder = check_bid_ladder(combo_stats, bids)

    # 词根族分析（v9）
    families = analyze_families(combos)

    # 拓词空间分析（v11：增量判断）
    expansion = analyze_expansion_space(agg['terms'], combos)

    # v15：投放状态/竞价合并进组合（标注暂停词 + bid 数值）
    tgt_status = {}
    if targeting:
        tgt_status = targeting['status']
        tgt_bids = targeting['bids']
        for c in combos:
            st = tgt_status.get(c['target'], {}).get(c['match'])
            if st:
                c['status'] = st
            b = tgt_bids.get(c['target'], {}).get(c['match'])
            if b:
                c['bid'] = b
        paused = [f"{c['target']}({c['match']})" for c in combos
                  if str(c.get('status', '')).lower() in ('paused', '暂停')]
    else:
        paused = []

    return {
        'account': A,
        'campaigns': agg['campaigns'],
        'stop_spend': stop_spend,
        'negate_clicks': cfg.negate_clicks,
        'break_even_acos': cfg.break_even_acos,
        'combos': combos,
        'neg_list': neg_list,
        'new_exact': new_exact,
        'watch_list': watch_list,
        'bid_ladder_warnings': ladder,
        'families': families,
        'expansion_space': expansion,
        'targeting': {
            'bids': bids or {},
            'status': tgt_status,
            'paused_combos': paused,
        } if targeting or bids else None,
        'config': {
            'break_even_acos': cfg.break_even_acos,
            'stop_spend': stop_spend,
            'negate_clicks': cfg.negate_clicks,
        },
    }
