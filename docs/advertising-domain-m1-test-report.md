# Trade ERP 亚马逊广告优化管理 M1 — QA 测试报告

> 日期：2026-08-29 | 测试人：测试工程师（QA 子代理）+ 主代理复核
> 环境：dev 端口 3001，DB trade-erp-db，admin 账号，真实 v20 报告（Ads Amazon 文件夹）
> 基准：需求规格 AC-1~10 + BE §17 字段契约

---

## 一、总体结论

**✅ 可交付（CONDITIONAL PASS）** — 核心闭环（上传→分析→结果→勾选→批量表）全流程走通，AC-1/AC-5 等关键验收通过。2 个阻断级问题已在测试中发现并修复（见 §四），1 项未覆盖（viewer 403 端到端）。

---

## 二、测试结果明细

### AC-1 引擎一致性（核心验收）— ✅ PASS
系统 result vs Python CLI（/tmp/engine-full.json）逐字段比对：

| 项 | 系统 | CLI | 结果 |
|---|---|---|---|
| account（spend/sales/orders/acos/cvr/aov）| 659.71/791.49/51/83.4/3.1/15.52 | 同 | ✅ |
| closeMatrix 行数 | 70 | 70 | ✅ |
| negateList 行数 | 39 | 39 | ✅ |
| families 数 | 51 | 51 | ✅ |
| expandTable 数 | 22 | 22 | ✅ |
| degraded | false | false | ✅ |

决策行完整（bid/state/rowIndex/actionReason 依据文字），行级可追溯。

### API 功能 — ✅ PASS
| 端点 | 结果 |
|---|---|
| POST /accounts（凭据加密+脱敏）| ✅ 201，clientId 返回 `****MTIz`（脱敏后4位）|
| GET /marketplaces | ✅ 200，9 站点（播种后）|
| POST /reports/upload（双文件）| ✅ 201，SEARCH_TERM 251 行 + TARGETING 127 行，batchId 配对，日期警告正常 |
| POST /reports/:id/analyze | ✅ 200（0.7s），degraded=false，pairing=batch |
| GET /reports/:id/result | ✅ 200，顶层键齐全（§17-4）|
| GET /reports/:id/result?rawRow=N | ✅ 200，返回原始报告行（AC-10）|
| GET /keywords（source 分区）| ✅ 200，CLOSE_MATRIX 70 条 total |
| PUT /keywords/:id（勾选）| ✅ 200，isSelected=true 持久化 |
| POST /bulk-table | ✅ 200，生成 xlsx |

### 批量表（AC-5）— ✅ PASS
读回验证（exceljs）：
- Sheet 名 = `Sponsored Products Campaigns` ✅
- 33 列英文模板 ✅
- PAUSE 行：State=paused，Bid 空（不并存）✅
- 改价行：State=enabled，Bid=0.61（RAISE_BID 层级约束值）✅
- Match Type=exact 小写 ✅
- Bulk 三件套（Campaign ID=222462999176405 等）落库正确 ✅

### 异常路径 — ✅ PASS
| 场景 | 结果 |
|---|---|
| E1 坏文件/缺列（旧列名 Targeting）| ✅ 422 PARSE_FAILED 明确列名错误（修复后重传成功）|
| 只传搜索词报告 | ✅ 跨批 fallback 配对旧 Targeting → 完整分析（degraded=false）|
| rawRow 超范围 | ✅ 400 |
| 空清单无 confirmEmpty | ✅ 400 EMPTY_LIST「执行清单为空，确认生成空表？」|
| 未登录访问 | ✅ 401 |

### 权限 — ✅ PASS（部分）
- 未登录 → 401 ✅
- admin（super-admin '*'）全权限 ✅
- viewer 403 端到端：未单独验证（无可用 viewer 密码）——**未覆盖项**

---

## 三、全流程验证（一次走通）
```
创建账户(201) → 上传双报告(201, 251+127行) → analyze(200, 0.7s)
→ result(200, AC-1 全一致) → rawRow 下钻(200) → 勾选3行(200)
→ bulk-table(200, xlsx 读回正确) → 空清单(400 EMPTY_LIST) → 全链路 ✅
```

---

## 四、测试中发现并修复的问题（QA 价值）

### BLOCKER-1（项目级潜伏 bug）：`hasPermission()` 引用已删除的 `user.role` 字段
- 症状：ads 域全部 API 500（全项目首个调用 hasPermission 的模块引爆）
- 根因：项目已迁移 UserRole 体系（User.role 已删），但 hasPermission cold-cache 路径仍 `prisma.user.findUnique({ select: { role: true } })`
- 修复：改走 `getUserPermissions(userId)`（UserRole → super-admin '*' + 空角色无权限）+ `permissions.includes('*')` 快速路径
- 验证：修复后 accounts/marketplaces 200 ✅

### BLOCKER-2：9 个默认站点未播种
- 症状：ad_marketplaces 0 行，需求 REQ-ADS-006-1「P0 提供默认集」缺口
- 修复：新增 `scripts/seed-ads.js`（9 站点 upsert，幂等），播种成功（含 .env.local DATABASE_URL 引号剥离坑）
- 验证：GET /marketplaces 返回 9 站点 ✅

### BUG-3：Targeting 新版列名未适配（Node 侧 parse）
- 症状：上传 Targeting CSV 报「缺少必要列：花费/7天总销售额/7天总订单数」
- 根因：engine-client.ts 必需列校验只认旧列名，新版列名（总成本/购买量/销售额）不认
- 修复：必需列校验 + NORM_COLUMNS 兼容新旧两套列名
- 验证：上传 201 ✅

### BUG-4：Bulk 三件套丢失链路
- 症状：批量表自检「缺 Campaign ID/Ad Group ID/Keyword ID」
- 根因（三层）：① analyze_cli.py 适配层未输出三件套 → ② engine-schema.ts Zod 默认 strip 未知字段 → ③ analyze 路由 9a 落库未映射
- 修复：适配层 `_bulk_ids()`（从 Targeting 原始行提取）+ engine-schema 加字段 + 落库映射
- 验证：三件套 65/70 落库 ✅，批量表自检通过 ✅

### BUG-5：PAUSE 行 Bid 并存误报
- 修复：端点构造 inputs 时 PAUSE/NEGATE 强制 actionBid=null + selfCheck 只查显式 actionBid
- 验证：批量表生成 200 ✅

---

## 五、未覆盖场景（后续补测）
1. viewer 角色 403 端到端（需 viewer 账号密码重置后测）
2. degraded 真路径（全新账户只传搜索词报告 → degraded=true）
3. E2 引擎失败（构造引擎异常/超时）
4. E4 口径不一致阻断（双报告偏差 >15%）
5. 批量表中文列名模板核对（用户后台模板）

---

## 六、建议
1. viewer 403 补测：重置 viewer 账号密码后快速验证
2. 正式部署前：`node scripts/seed-ads.js` 加入部署清单（9 站点必需）
3. BLOCKER-1 修复建议 code review（getDefaultPermissionsForRole 已成未使用函数可清理）
4. 前端 browser 实测（本报告以 API 层验证为主，页面渲染需浏览器走一遍）
