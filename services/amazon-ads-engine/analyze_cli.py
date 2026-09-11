#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
analyze_cli.py — 亚马逊广告 v20 决策引擎适配层（Trade ERP 调用入口）

职责（架构 v2 契约）：纯字段搬运/改名 + 行级引用(rowIndex) + degraded 标记，
**不做任何判定逻辑**（层级约束/双标准计算全在 v20 引擎内完成）。

用法:
  python3 analyze_cli.py --search <搜索词报告> [--targeting <投放报告>] \\
      [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] --out <输出.json>

输出契约（UTF-8）:
  { ok, account, families, closeMatrix, negateList, expandTable,
    layerCheck, summary, version, degraded }
错误: { ok: false, error: "..." }（exit code 非 0）
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from typing import Optional

from modules.report_analyzer import analyze_report, parse_xlsx, parse_csv  # noqa: E402


def _read_rows(path: str) -> list[dict]:
    """读原始报告行（xlsx/csv 通用），表头转列名键，保持原始行序（rowIndex 精确下钻）"""
    ext = os.path.splitext(path)[1].lower()
    raw = parse_xlsx(path) if ext in ('.xlsx', '.xls') else parse_csv(path)
    if not raw:
        return []
    header_cells = raw[0]
    header = [header_cells.get(i, '') for i in range(len(header_cells))]
    out = []
    for r in raw[1:]:
        row = {}
        for i, name in enumerate(header):
            if name:
                row[name] = r.get(i, '')
        out.append(row)
    return out


def _find_row_index(rows: list[dict], matcher) -> Optional[int]:
    """按 matcher 返回首个匹配行的下标（0-based），无匹配返回 None"""
    for i, r in enumerate(rows):
        if matcher(r):
            return i
    return None


def _norm_col(row: dict) -> str:
    """从原始行提取投放词列（兼容新旧列名/中英文）"""
    for k, v in row.items():
        if k in ('投放', 'targeting', 'Targeting', 'target', '投放方案', 'keywordText', 'Keyword Text'):
            if v:
                return str(v)
    return ''


def _match_col(row: dict) -> str:
    """从原始行提取匹配类型列（兼容 '投放匹配类型-Targeting match type' 等长表头）"""
    for k, v in row.items():
        if '匹配' in str(k) or 'match' in str(k).lower():
            if v:
                return str(v).upper()
    return ''


def _term_col(row: dict) -> str:
    for k in ('客户搜索词', 'customerSearchTerm', 'searchTerm'):
        if k in row and row[k]:
            return str(row[k])
    return ''


def _bulk_ids(row: dict) -> dict:
    """从 Targeting 原始行提取 Bulk 三件套（Campaign ID / Ad Group ID / Keyword|Product Targeting ID）"""
    campaign_id, adgroup_id, target_id = None, None, None
    for k, v in row.items():
        ks = str(k)
        if v in (None, ''):
            continue
        if '活动编号' in ks or 'ampaign' in ks:
            campaign_id = str(v)
        elif '广告组编号' in ks or 'd Group' in ks:
            adgroup_id = str(v)
        elif ('关键词' in ks and 'ID' in ks) or '商品定向' in ks or '投放方案编号' in ks or '方案编号' in ks or 'arget ID' in ks or 'argeting ID' in ks:
            target_id = str(v)
    return {
        'amazonCampaignId': campaign_id,
        'adGroupId': adgroup_id,
        'externalId': target_id,
    }


def _ctr(impr, clicks) -> Optional[float]:
    if impr:
        return round(clicks / impr * 100, 2)
    return None


def _cpa(spend, orders) -> Optional[float]:
    if orders:
        return round(spend / orders, 2)
    return None


def _family_verdict(fam: dict) -> str:
    """族级处置结论派生（I-8：固定映射表，缺中间字段输出 ''，不自行推导）"""
    if fam.get('duplicates', {}).get('risk'):
        return '风险族：整族关闭'
    if fam.get('acos') is None:
        return '待观察'
    ac = fam['acos']
    if ac <= 40:
        return '加投'
    if ac <= 60:
        return '收缩'
    return '重度收缩：只留主词'


def build_output(R: dict, search_path: str, targeting_path: str | None,
                 start_date: str | None, end_date: str | None) -> dict:
    """把 v20 引擎输出映射为契约 JSON（纯搬运 + rowIndex，零判定）"""
    degraded = targeting_path is None

    # ── 原始行（rowIndex 精确下钻用）──
    search_rows = _read_rows(search_path) if search_path else []
    targeting_rows = _read_rows(targeting_path) if targeting_path else []

    # ── closeMatrix：combos（投放词×匹配）──
    close_matrix = []
    for c in R.get('combos', []):
        tgt, mt = c.get('target', ''), c.get('match', '')
        # 行级引用：Targeting 原始行中匹配 (投放, 匹配类型) 的首行
        row_idx = None
        bulk = {}
        if targeting_rows:
            row_idx = _find_row_index(
                targeting_rows,
                lambda r, t=tgt, m=mt: _norm_col(r) == t and _match_col(r) == m,
            )
            if row_idx is not None:
                bulk = _bulk_ids(targeting_rows[row_idx])
        action = c.get('action', '')
        # 依据文字（R2：每条建议必须有可读依据）
        basis = action
        extra = []
        if c.get('clicks') is not None:
            extra.append(f'点击{c["clicks"]}')
        if c.get('spend') is not None:
            extra.append(f'花费${c["spend"]:.2f}')
        if c.get('acos') is not None:
            extra.append(f'ACoS {c["acos"]}%')
        if c.get('orders') is not None:
            extra.append(f'{c["orders"]}单')
        if extra:
            basis = f'{action}（{"，".join(extra)}）'
        # PAUSE/关闭类动作不携带 actionBid（批量表禁止 paused+Bid 并存）
        is_pause = '暂停' in action or '关闭' in action or '否定' in action
        close_matrix.append({
            'keywordText': tgt,
            'matchType': mt,
            'clicks': c.get('clicks'),
            'spend': c.get('spend'),
            'sales': c.get('sales'),
            'orders': c.get('orders'),
            'impr': c.get('impr'),
            'ctr': _ctr(c.get('impr'), c.get('clicks')),
            'cpa': _cpa(c.get('spend'), c.get('orders')),
            'acos': c.get('acos'),
            'bid': c.get('bid'),
            'state': c.get('status'),
            'action': action,
            'actionBid': None,   # 层级约束计算在 Node 侧 bulk-table（有完整 bid 数据）
            'actionReason': basis or '待补充',
            'rowIndex': row_idx,
            'amazonCampaignId': bulk.get('amazonCampaignId'),
            'adGroupId': bulk.get('adGroupId'),
            'externalId': bulk.get('externalId'),
        })

    # ── negateList：搜索词维度 ──
    negate_list = []
    for n in R.get('neg_list', []):
        term = n.get('term', '')
        row_idx = None
        if search_rows:
            row_idx = _find_row_index(search_rows, lambda r, t=term: _term_col(r) == t)
        negate_list.append({
            'term': term,
            'reason': n.get('reason', '待补充'),
            'spend': n.get('spend'),
            'clicks': n.get('clicks'),
            'orders': n.get('orders'),
            'acos': n.get('acos'),
            'rowIndex': row_idx,
        })

    # ── expandTable：族级拓词结论（v20 引擎 expansion_space）──
    expand_table = []
    # 运营思路（用户纠正 2026-08-29）：拓词 ≠ 只新建精准。
    #   生命周期：主词出单 → 开 BROAD 探测（捕获增量长尾）→ 探测出单 → 收割提炼精准。
    #   actionType：
    #     OPEN_BROAD          族无 BROAD 层 → 新建广泛探测词（bid=主词×0.5）
    #     REVISE_BROAD        族有 BROAD 但 0 单 → 换变体词策略（BROAD 播变体不播原词根）
    #     HARVEST_EXACT       增量搜索词已出单 → 提炼精准收割（bid=主词×0.85）
    #     可组合：'OPEN_BROAD|HARVEST_EXACT'
    MODIFIERS = {
        'breast': ['firming', 'lifting', 'for women', 'natural', 'tightening', 'volume'],
        'butt': ['firming', 'lifting', 'tightening', 'for women', 'hip'],
        'batana': ['for hair growth', 'hair oil', 'natural'],
    }

    def _probe_terms(family: str, main: str) -> list:
        """生成 BROAD 探测变体词（带修饰词，不重复主词本身）"""
        mods = []
        low = family.lower()
        for key, ms in MODIFIERS.items():
            if key in low:
                mods = ms
                break
        if not mods:
            mods = ['for women', 'natural', 'firming']
        out = []
        for m in mods:
            t = f'{main} {m}'.strip()
            if t.lower() != main.lower():
                out.append(t)
        return out[:4]

    for fam, d in (R.get('expansion_space') or {}).items():
        main = d.get('main') or {}
        main_target = main.get('target') or fam
        verdict = d.get('verdict', '')
        inc = d.get('incremental', []) or []
        worth = '值得拓' in str(verdict)

        # 族内匹配层（members 的 match 集合）→ 判断是否已有 BROAD 探测
        fam_data = (R.get('families') or {}).get(fam) or {}
        members = fam_data.get('members', []) or []
        has_broad = any(str(m.get('match', '')).upper() == 'BROAD' for m in members)
        broad_orders = sum(int(m.get('orders') or 0) for m in members if str(m.get('match', '')).upper() == 'BROAD')

        # 出单的增量搜索词（收割候选）——⚠️ 排除合规风险词（grow/enlarg 等增长宣称不得收割引导违规投放）
        from modules.report_analyzer import is_risk_term, AnalyzerConfig
        _risk_cfg = AnalyzerConfig()
        harvest = [c for c in inc if int(c.get('orders') or 0) > 0 and not is_risk_term(str(c.get('term', '')), _risk_cfg)]

        action_types = []
        # ★ 铁律九：主词已验证（≥3单）且族无 BROAD → 必开探测（不依赖 verdict，独立触发）
        #   风险词族（verdict 含"风险"）一律不开探测
        main_orders = int(main.get('orders') or 0)
        is_risk_family = '风险' in str(verdict)
        if main_orders >= 3 and not is_risk_family:
            if not has_broad:
                action_types.append('OPEN_BROAD')
            elif broad_orders == 0:
                action_types.append('REVISE_BROAD')
        if harvest:
            action_types.append('HARVEST_EXACT')
        action_type = '|'.join(action_types) if action_types else 'NONE'

        expand_table.append({
            'family': fam,
            'mainTarget': main_target,
            'mainOrders': main.get('orders'),
            'mainAcos': main.get('acos'),
            'incrementalClicks': d.get('incremental_clicks'),
            'incrementalOrders': d.get('incremental_orders'),
            'incrementalSpend': d.get('incremental_spend'),
            'verdict': verdict,
            'incremental': inc,
            # 拓词动作（用户纠正：按亚马逊运营思路，开探测→收割，不只新建精准）
            'actionType': action_type,
            'probeTerms': _probe_terms(fam, main_target) if ('OPEN_BROAD' in action_type or 'REVISE_BROAD' in action_type) else [],
            'harvestTerms': [{'term': c.get('term'), 'orders': c.get('orders'), 'clicks': c.get('clicks')} for c in harvest],
        })

    # ── families：族级总览 ──
    families = []
    for fam, d in (R.get('families') or {}).items():
        families.append({
            'family': fam,
            'spend': d.get('spend'),
            'orders': d.get('orders'),
            'acos': d.get('acos'),
            'verdict': _family_verdict(d),
            'members': d.get('members', []),
            'duplicates': d.get('duplicates', {}),
        })

    # ── layerCheck：层级核对 ──
    layer_check = {
        'ladderWarnings': R.get('bid_ladder_warnings', []),
        'coefficientAudit': [],
        'bidUnavailable': degraded,
    }

    # ── summary ──
    summary = {
        'stop_spend': R.get('stop_spend'),
        'negate_clicks': R.get('negate_clicks'),
        'break_even_acos': R.get('break_even_acos'),
        'closeCount': sum(1 for c in close_matrix if '暂停' in (c['action'] or '') or '关闭' in (c['action'] or '')),
        'closeSpendPct': None,
        'projectedAcos': None,
    }
    acct = R.get('account') or {}
    total_spend = acct.get('spend') or 0
    if total_spend:
        close_spend = sum(c['spend'] or 0 for c in close_matrix
                          if '暂停' in (c['action'] or '') or '关闭' in (c['action'] or ''))
        summary['closeSpendPct'] = round(close_spend / total_spend * 100, 1)

    return {
        'ok': True,
        'account': acct,
        'families': families,
        'closeMatrix': close_matrix,
        'negateList': negate_list,
        'expandTable': expand_table,
        'layerCheck': layer_check,
        'summary': summary,
        'version': 'v20',
        'degraded': degraded,
        'meta': {
            'searchFile': os.path.basename(search_path) if search_path else None,
            'targetingFile': os.path.basename(targeting_path) if targeting_path else None,
            'startDate': start_date,
            'endDate': end_date,
            'dateMismatch': None,  # 由 Node 侧比对用户窗口 vs 报告窗口
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description='亚马逊广告 v20 决策引擎适配层')
    ap.add_argument('--search', required=True, help='搜索词报告路径（xlsx/csv）')
    ap.add_argument('--targeting', default=None, help='投放报告路径（csv/xlsx，可选=degraded 模式）')
    ap.add_argument('--start-date', default=None, help='用户填写的报告开始日期 YYYY-MM-DD')
    ap.add_argument('--end-date', default=None, help='用户填写的报告结束日期 YYYY-MM-DD')
    ap.add_argument('--out', required=True, help='输出 JSON 路径')
    args = ap.parse_args()

    try:
        for p in (args.search, args.targeting):
            if p and not os.path.exists(p):
                raise FileNotFoundError(f'报告文件不存在: {p}')
        R = analyze_report(args.search, args.targeting)
        out = build_output(R, args.search, args.targeting,
                           args.start_date, args.end_date)
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, default=str)
        return 0
    except Exception as e:  # noqa: BLE001
        err = {'ok': False, 'error': f'{type(e).__name__}: {e}'}
        try:
            with open(args.out, 'w', encoding='utf-8') as f:
                json.dump(err, f, ensure_ascii=False)
        except Exception:
            pass
        print(json.dumps(err, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
