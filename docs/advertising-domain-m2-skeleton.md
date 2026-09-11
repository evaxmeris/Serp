# 广告域 M2 骨架（Ads API 自动化）— 开发状态

> 日期：2026-08-29 | 方案 C：M2 骨架先行（不阻塞 M1 验收部署）
> 依赖：Ads API 审批（用户申请中，2-4 周）+ AdAccount 三凭据（站点管理填写）

## 已完成（骨架，mock/dry-run 验证通过）

### 1. Python 侧（services/amazon-ads-engine/）
| 文件 | 内容 |
|---|---|
| `modules/auth.py` | LWA OAuth 认证（refresh_token→access_token，自动续期）【自研，ADR-001】|
| `modules/api_client.py` | Ads API v3 客户端：list_keywords / update_keywords / create_keywords / create_negative_keywords / create_report(支持日期) / get_report_status / download_report |
| `modules/executor.py` | 限额保护（单批 ≤50）+ 决策→批次构建 |
| `api_fetcher.py` | **ApiFetcher 编排层**：status / fetch_keyword_settings / fetch_report / apply_recommendations；**mock 模式**（无凭据→演示数据+dry-run）+ **real 模式**（凭据齐全→真实调用）；CLI 入口 `fetch_cli` |

### 2. Node 侧（Trade ERP）
| 文件 | 内容 |
|---|---|
| `src/lib/ads/api-fetcher.ts` | 从 AdAccount 解密凭据（crypto-utils）→ 临时 config（600 权限，用完即删）→ 子进程调 fetch_cli → 契约 JSON |
| `src/app/api/v1/ads/api/route.ts` | GET status（接入状态）+ POST apply（自动执行，**dry-run 默认，confirm=true 才真实修改**，审计留痕）|
| 前端 | 投流优化中心 API 状态提示条（未配置→黄条 / 已配置→绿条）|

## 验证结果（mock 模式全通过）
- `--action status`：configured=false 正确提示 ✓
- `--action keywords`：mock 演示数据 ✓
- `--action report`：未配置提示 ✓
- `--action apply`：dry-run 批次构建正确（PAUSE/LOWER_BID/NEGATE/CREATE 拆分）✓
- GET /api/v1/ads/api?accountId=xxx：200 mock 状态 ✓
- 前端提示条渲染 ✓ | tsc 0 错误 ✓

## 审批通过后的启用步骤（M2 收尾）
1. 用户填写 Ads API 审批通过后的三凭据到 站点管理 → 广告账户（client_id/client_secret/refresh_token + profile_id）
2. 无需改代码：api_fetcher 自动从 mock 切 real（configured 判定）
3. 联调验证：fetch_keywords（读真实 bid）→ fetch_report（拉真实报告）→ apply（dry-run → confirm 真实执行）
4. 建议增强（可选）：定时任务每日自动拉报告 + 决策自动执行提醒

## 安全设计（已内置）
- dry-run 默认，真实执行需 `confirm=true`（二次确认）
- 单批上限 50（executor）
- 凭据仅进 600 权限临时文件，用完即删；DB 内 AES 加密存储
- 审计日志（dry-run 也留痕）
