# 外贸中台：亚马逊业务域规划 v1.0

> 状态：规划草案（待确认） | 日期：2026-08-29
> 定位：Trade ERP 作为外贸中台，承载 亚马逊 / TikTok / 阿里国际 / 独立站(Shopify) 多平台业务。
> 原则：**先规划后行动，目录为将来而生，现在只落地广告域。**

---

## 一、现状盘点（代码地图确认）

Trade ERP 已有**平台抽象骨架**（src/lib/sync/）：

| 组件 | 现状 | 说明 |
|------|------|------|
| `PlatformAdapter` 接口 | ✅ 已定义 | platformCode + authenticate + fetchOrders + fetchOrderDetail + webhook + updateOrderStatus |
| `AlibabaAdapter` | ✅ 完整实现（749行） | 订单同步、签名、重试、限流 |
| `AmazonAdapter` / `TikTokAdapter` / `ShopifyAdapter` | ⚠️ 占位 | 只有 authenticate 骨架，等待实现 |
| `PlatformRegistry` | ✅ 已实现 | 平台注册/查询/可用平台 |
| `PlatformSyncConfig` 表 | ✅ 已存在 | platformCode 唯一 + credentials(Json) + settings(Json) |
| `PlatformAccount` 表 | ✅ 已存在 | 平台类型 + clientId/secret/token/region + 站点级账号 |
| 订单同步服务 | ✅ 已实现 | executePlatformSync + 定时调度 + 重试 + 日志 |

**结论：中台底座已具备。缺的是「业务域」扩展——现有骨架只覆盖「订单域」，需要新增「广告域」「库存域」「补货域」。**

---

## 二、核心抽象：三维坐标（平台 × 站点 × 业务域）

未来所有业务实体挂在这三个维度上：

```
维度一：平台 Platform     amazon | tiktok | alibaba | shopify
维度二：站点 Marketplace  amazon: US/CA/BR/EU(DE,FR,ES,IT...)/UK/JP
                         tiktok: US/UK/SEA...
                         独立站: 单一站点
维度三：业务域 Domain     订单 | 广告 | 库存 | 补货 | 财务
```

**目录设计总原则**：
1. 所有业务表带 `platformCode` + `marketplaceId`（可空=平台无关）
2. 所有平台外部 ID 存 `externalId`（亚马逊 campaignId、TikTok adGroupId...）
3. 平台差异靠适配器隔离，业务层只认统一模型
4. 决策引擎（广告/补货）平台无关，仅输入输出结构化数据

---

## 三、广告域设计（当前落地）

### 3.1 统一广告模型（跨平台）

```
AdAccount     广告账户（= PlatformAccount 扩展：站点级）
  └─ AdCampaign    广告活动（externalId + marketplaceId + 预算 + 状态）
      └─ AdKeyword  关键词/投放词决策（本系统的核心资产）
      └─ AdReport   报告快照（每次导入/同步的原始数据落库）
```

### 3.2 亚马逊广告决策引擎（已验证 v7 专业版逻辑）

| 模块 | 规则 | 状态 |
|------|------|------|
| 分析粒度 | 投放词×匹配类型组合 | ✅ 已验证 |
| 否定阈值 | 统计显著(82点击) + 止损线($24) 双标准 | ✅ 已验证 |
| 竞价矩阵 | 匹配(1.0/0.75/0.5) × 词长(1.0/1.2/1.4) | ✅ 已验证 |
| 拓词引擎 | 出单词根 → 宽泛播种 → 变体生成 → 收割提炼 | ✅ 已验证 |
| 合规红线 | enlargement/growth 类词黑名单 | ✅ 已内置 |

### 3.3 页面结构（「亚马逊运营」一级模块）

```
亚马逊运营
├─ 📊 投流优化中心（报告导入/分析/决策/执行预览）
├─ 🌍 站点管理（marketplace 配置 + 广告账户绑定）
├─ 📦 库存对接（FBA 库存同步）
├─ 🔄 补货计划（预测→建议→转采购单）
└─ 📈 数据看板（跨站点汇总）
```

**M1 只做「投流优化中心」+「站点管理」骨架**，库存/补货先留菜单占位（与现有"数据导入"占位模式一致）。

---

## 四、库存域（规划，M2+）

```
FbaInventory      库存快照（linkId + warehouse + available + reserved + inbound + 抓取时间）
FbaInventoryLog   库存变化日志（差异追踪）
AmazonShipment    补货在途（shipmentId + status + quantity + eta）
```

- 同步方式：SP-API 库存报告（每日快照）或 FBA 库存 API（实时）
- 视图：ERP 本地仓库存 vs FBA 各站点库存 vs 在途 → **可售库存总览**
- 低库存预警：与广告域联动（低库存时暂停广告，防止断货烧钱——**广告-库存联动**是中台的核心价值）

---

## 五、补货域（规划，M3+）

```
ReplenishmentPlan   补货建议（linkId + forecast + reorderPoint + recommendedQty + status）
```

- 数据：历史销量（亚马逊订单域）+ 广告引流数据（广告域）+ 现有库存（库存域）
- 输出：补货建议 → 一键转采购单（对接现有采购模块）→ 头程 → FBA 入库
- **三域联动闭环**：广告推量 → 销量预测 → 库存预警 → 补货建议 → 采购 → 入库 → 广告续投

---

## 六、多站点接入设计（亚马逊为例）

| 站点 | marketplaceId | 货币 | 广告端点 | 适配器实例 |
|------|--------------|------|---------|-----------|
| 美国 | ATVPDKIKX0DER | USD | advertising-api.amazon.com | AmazonAdapter(marketplace='US') |
| 加拿大 | A2EUQ1WTGCTBG2 | CAD | 同上 | 同上 |
| 巴西 | A2Q3Y263D00KWC | BRL | 同上 | 同上 |
| 英国 | A1F83G8C2ARO7P | GBP | advertising-api-eu.amazon.com | 同上 |
| 德国 | A1PA6795UKMFR9 | EUR | advertising-api-eu.amazon.com | 同上 |

**机制**：PlatformAccount 表已有 `region` 字段；扩展 `marketplaceId` 列，凭据按站点独立存储。AmazonAdapter 实例化时注入 marketplace → 所有 API 调用带对应 header。

---

## 七、TikTok/独立站扩展（规划，M4+）

- **TikTok 广告**：TikTok Marketing API 提供 campaign/adgroup/ad 管理——与亚马逊广告**同一套决策引擎**（ACoS 换成 ROAS/CPA 口径），复用 AdCampaign/AdKeyword 表，只加 `platformCode`
- **独立站（Shopify）**：Shopify 无原生广告 API，但可用 Shopify Audiences + 站内搜索数据做投放辅助；订单域适配器已占位
- **统一看板**：跨平台广告花费/销售/利润对比（中台的终极价值——"哪条渠道赚钱"一目了然）

---

## 八、落地路线图

```
M1（当前） 广告域：投流优化中心 + 站点管理骨架（亚马逊单站点起步，目录已多站点就绪）
M2         广告域完善：多站点切换 + 数据看板 + API 审批后自动拉报告
M3         库存域：FBA 库存同步 + 低库存预警 + 广告-库存联动
M4         补货域：预测 + 补货建议 + 转采购单
M5         平台扩展：TikTok 广告接入（复用决策引擎）
M6         财务域：广告花费 vs 销售额 vs 利润全景
```

---

## 九、需要确认的决策点

1. **菜单归属**：「亚马逊运营」作为一级模块（与产品中心/业务中心平级）还是挂在现有「报表中心」下？→ 建议一级模块，为 TikTok/独立站留空间
2. **数据模型**：统一广告模型（AdCampaign/AdKeyword/AdReport）跨平台复用，OK 吗？
3. **M1 范围**：投流优化中心（报告导入→分析→决策表）+ 站点管理骨架，OK 吗？
4. **广告-库存联动**：是否纳入本轮设计（低库存自动暂停广告）？建议规划中预留，M3 实现
