# Trade ERP - OrbStack Docker 部署文档

## 📊 系统架构

### 架构模式
```
┌─────────────────────────────────────────┐
│         本地浏览器 (localhost:3000)      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   OrbStack Docker 容器                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Trade ERP v0.4.0               │   │
│  │  - Next.js 16.1.6               │   │
│  │  - Node.js 20                   │   │
│  │  - 端口：3000                   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  PostgreSQL 16                  │   │
│  │  - 端口：5432                   │   │
│  │  - 数据持久化                   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 技术栈
- **前端/后端**: Next.js 16.1.6 (App Router)
- **运行时**: Node.js 20 (Alpine)
- **数据库**: PostgreSQL 16
- **ORM**: Prisma 6.19.2
- **容器**: OrbStack Docker

---

## 🚀 部署流程

### 前置条件
1. 已安装 OrbStack
2. Docker 服务已启动
3. PostgreSQL 容器已运行（端口 5432）

### 一键部署

```bash
cd /Users/apple/clawd/trade-erp

# 1. 构建 Docker 镜像
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 停止服务
docker-compose down

# 5. 重启服务
docker-compose restart
```

### 访问地址

| 环境 | 地址 | 说明 |
|------|------|------|
| **生产** | http://localhost:3000 | Docker 容器部署 |
| **开发** | http://localhost:3001 | `npm run dev` |
| **健康检查** | http://localhost:3000/api/health | 容器健康检查 |
| **数据库** | localhost:5432 | OrbStack PostgreSQL |

---

## 📁 项目结构

```
trade-erp/
├── Dockerfile              # Docker 构建配置
├── docker-compose.yml      # Docker 编排配置
├── .env                    # 环境变量配置
├── .env.docker            # Docker 环境变量模板
├── prisma/
│   └── schema.prisma      # 数据库 Schema
├── src/
│   └── app/
│       ├── api/           # API 路由
│       ├── orders/        # 订单管理
│       ├── quotations/    # 报价管理
│       ├── customers/     # 客户管理
│       ├── suppliers/     # 供应商管理
│       ├── products/      # 产品管理
│       └── purchases/     # 采购管理
└── docs/                  # 项目文档
```

---

## 🔧 配置文件

### Dockerfile
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
services:
  trade-erp:
    build: .
    container_name: trade-erp-v0.4.0
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://trade_erp:trade_erp_password@host.docker.internal:5432/trade_erp?schema=public
    restart: unless-stopped
    networks:
      - trade-erp-network

networks:
  trade-erp-network:
    driver: bridge
```

### 环境变量 (.env)
```env
# 数据库配置
DATABASE_URL=postgresql://trade_erp:trade_erp_password@localhost:5432/trade_erp?schema=public

# 应用配置
NODE_ENV=production
PORT=3000

# JWT 配置
JWT_SECRET=your-secret-key-here

# NextAuth 配置
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## 📊 容器管理

### 查看运行状态
```bash
# 查看所有容器
docker ps -a

# 查看 Trade ERP 容器
docker ps -f name=trade-erp

# 查看数据库容器
docker ps -f name=postgres
```

### 日志管理
```bash
# 实时查看日志
docker-compose logs -f

# 查看最近 100 行
docker-compose logs --tail=100

# 导出日志
docker-compose logs > erp-logs.txt
```

### 进入容器
```bash
# 进入 Trade ERP 容器
docker exec -it trade-erp-v0.4.0 sh

# 进入数据库容器
docker exec -it trade-erp-db psql -U trade_erp -d trade_erp
```

### 数据库操作
```bash
# 推送数据库结构
docker exec -it trade-erp-v0.4.0 npx prisma db push

# 生成 Prisma 客户端
docker exec -it trade-erp-v0.4.0 npx prisma generate

# 查看数据库表
docker exec -it trade-erp-db psql -U trade_erp -d trade_erp -c "\dt"
```

---

## 🔍 故障排查

### 容器无法启动
```bash
# 检查容器日志
docker-compose logs trade-erp

# 检查端口占用
lsof -i :3000
lsof -i :5432

# 重启容器
docker-compose restart
```

### 数据库连接失败
```bash
# 检查数据库容器状态
docker ps -f name=postgres

# 测试数据库连接
docker exec trade-erp-db pg_isready -U trade_erp

# 查看数据库日志
docker logs trade-erp-db
```

### 应用无法访问
```bash
# 检查容器健康状态
docker inspect trade-erp-v0.4.0 | grep Health

# 测试健康检查端点
curl http://localhost:3000/api/health

# 检查网络配置
docker network inspect trade-erp_trade-erp-network
```

---

## 📈 性能优化

### 构建优化
- 使用多阶段构建减少镜像大小
- 利用 Docker 缓存层加速构建
- 生产模式构建已优化

### 运行优化
- 使用 Alpine 基础镜像（体积小）
- 启用 Next.js 静态生成
- 数据库连接池优化

---

## 🔐 安全建议

### 生产环境配置
1. **修改默认密码**: 更新 PostgreSQL 密码
2. **JWT 密钥**: 使用强随机密钥
3. **HTTPS**: 配置 SSL/TLS
4. **防火墙**: 限制外部访问
5. **备份**: 定期备份数据库

### 环境变量安全
```bash
# 不要将 .env 提交到 Git
# .env 已添加到 .gitignore

# 生产环境使用单独的配置
cp .env.docker .env.production
# 编辑 .env.production 使用生产配置
```

---

## 📝 更新流程

### 应用更新
```bash
cd /Users/apple/clawd/trade-erp

# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 停止旧容器
docker-compose down

# 4. 启动新容器
docker-compose up -d

# 5. 查看日志确认
docker-compose logs -f
```

### 数据库迁移
```bash
# 推送新的数据库结构
docker exec -it trade-erp-v0.4.0 npx prisma db push

# 或者使用迁移（如果有）
docker exec -it trade-erp-v0.4.0 npx prisma migrate deploy
```

---

## 🎯 与旧系统对比

| 特性 | 旧系统 | 新系统 |
|------|--------|--------|
| 运行环境 | OrbStack 容器 | OrbStack 容器 ✅ |
| 端口 | 3000 | 3000 ✅ |
| Web 服务器 | 直接运行 | 直接运行 ✅ |
| Nginx | 无 | 无 ✅ |
| 数据库 | PostgreSQL | PostgreSQL ✅ |
| 部署方式 | Docker Compose | Docker Compose ✅ |
| 版本管理 | 手动 | Git + Docker ✅ |
| 架构 | Next.js | Next.js 16 ✅ |

---

## 📞 技术支持

- **项目文档**: `/Users/apple/clawd/trade-erp/docs/`
- **API 文档**: http://localhost:3000/api/health
- **GitHub**: https://github.com/evaxmeris/Serp

---

*最后更新：2026-03-09*
*版本：Trade ERP v0.4.0*
