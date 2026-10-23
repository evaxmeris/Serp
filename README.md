# Trade ERP - 外贸 ERP 管理系统

一个现代化的外贸行业 ERP 系统，基于 Next.js 14 + TypeScript + PostgreSQL 构建。

## 🚀 技术栈

- **前端**: Next.js 14 (App Router) + React + TypeScript
- **样式**: TailwindCSS v4 + shadcn/ui 组件库
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL + Prisma ORM
- **部署**: Vercel / Docker

## 📦 核心模块

| 模块 | 功能 |
|------|------|
| 👥 **用户管理** | 多角色权限（Admin/Manager/User/Viewer） |
| 🏢 **客户管理** | 客户档案、联系人、信用评级 |
| 📦 **产品管理** | SKU、多规格、成本价、图片 |
| 📧 **询盘管理** | 询盘录入、跟进记录、转化追踪 |
| 💰 **报价管理** | 报价单生成、版本管理、审批流 |
| 📋 **订单管理** | 销售订单、生产跟踪、出货安排 |
| 💳 **收款管理** | 收款记录、核销、账龄分析 |
| 🚢 **发货管理** | 货代、跟踪号、船运信息 |
| 🏭 **采购管理** | 供应商、采购单、入库验收 |
| 📊 **库存管理** | 出入库、调拨、盘点 |

## 🛠️ 开发指南

### 环境准备

```bash
# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 配置数据库连接
# 编辑 .env 中的 DATABASE_URL
```

### 数据库

```bash
# 生成 Prisma 客户端
npx prisma generate

# 推送 schema 到数据库
npx prisma db push

# 或者创建迁移
npx prisma migrate dev
```

### 开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 生产构建

```bash
npm run build
npm start
```

### 🐳 Docker 部署（推荐）

```bash
# 一键部署（OrbStack/Docker）
./deploy.sh

# 或手动执行
docker-compose up -d
```

访问 http://localhost:3000

## 📁 项目结构

```
trade-erp/
├── prisma/
│   └── schema.prisma      # 数据库模型
├── src/
│   ├── app/               # Next.js App Router 页面
│   ├── components/        # React 组件
│   │   └── ui/           # shadcn/ui 组件
│   ├── hooks/            # 自定义 Hooks
│   └── lib/              # 工具函数
├── .env.example          # 环境变量模板
└── package.json
```

## 🔄 同步调度（订单镜像 / 平台快照）

平台同步分三类资源，统一入口 `POST /api/sync`：

```bash
# 订单（一期，写入 PlatformOrder 镜像表）
curl -X POST http://127.0.0.1:3001/api/sync -b cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"platformCode":"amazon","marketplaceId":"ATVPDKIKX0DER","resource":"orders"}'

# FBA 库存快照（写入 platform_inventory_snapshots）
# Listing 快照（写入 platform_listing_snapshots）
# all = orders + fbaInventory + listings
```

- 资源：`orders` | `fbaInventory` | `listings` | `all`（缺省 `orders`，兼容一期调用）
- 失败不抛 500：无凭证 / 平台未配置 → `results[].status = "failed"`，`/api/sync` 仍返回 200
- tiktok / shopify 的快照资源为占位实现，返回 `results[].status = "not_supported"`
- 多站点共用一套 LWA 凭证，快照按 `(platformCode, marketplaceId, sku)` 唯一定位，站点之间互不覆盖

### 定时执行（外部 cron 驱动）

Next.js 进程内的 `setInterval` 在 dev 热更新 / 多实例下不可靠，调度改为**外部 cron 打 tick**：

```bash
# 1. 环境变量里配一个随机长串（≥8 位）
#    SYNC_TICK_TOKEN=<openssl rand -hex 24>
# 2. 宿主机 crontab 每 5 分钟打一次（服务在 3001）
*/5 * * * * curl -s -X POST -H "x-sync-token: $SYNC_TICK_TOKEN" http://127.0.0.1:3001/api/sync/tick
```

- 任务表：`sync_jobs`（platformCode / marketplaceId / resource / cronExpr 或 intervalMin / enabled / nextRunAt）
- `runDueSyncJobs` 每轮只领 `nextRunAt <= now` 的任务，`isRunning` 原子领取 + 领取时先推进 `nextRunAt`，
  保证同一任务不会被并发或崩溃重跑；超过 30 分钟的执行锁会被自动回收
- `GET /api/sync/tick` 可查看任务清单与下次执行时间（需登录）
- 未配 `cronExpr` 且未配 `intervalMin` 的任务不会自动执行

### 海外仓对账

```bash
# 台账 vs 平台快照（MATCH / DIFF / LOCAL_ONLY / PLATFORM_ONLY）
GET /api/v1/overseas/reconcile?warehouseId=DEMO-LAX01&platformCode=amazon&marketplaceId=ATVPDKIKX0DER
# 差异拉平（写差异调整单：stock_movements type=ADJUSTMENT, referenceType=OVERSEAS_ADJUST_PLATFORM_DIFF）
POST /api/v1/overseas/reconcile/resolve  {warehouseId, sku, platformCode, marketplaceId?}
```

- 阈值：`RECONCILE_DIFF_THRESHOLD`（默认 5），超阈值行标 `alert=true` 并计入 `summary.alertCount`

## 🔐 环境变量

```env
DATABASE_URL="postgresql://user:***@localhost:5432/trade_erp?schema=public"
SYNC_TICK_TOKEN="外部 cron 调用 /api/sync/tick 的令牌（≥8 位随机串）"
RECONCILE_DIFF_THRESHOLD="5"
```

## 📝 License

MIT

---

**Built with ❤️ for Foreign Trade Industry**
