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

## 🔐 环境变量

```env
DATABASE_URL="postgresql://user:password@localhost:5432/trade_erp?schema=public"
```

## 📝 License

MIT

---

**Built with ❤️ for Foreign Trade Industry**
