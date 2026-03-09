# Trade ERP - OrbStack 部署指南

## 架构说明

```
┌─────────────────────────────────────────────────────────┐
│                    宿主机 (macOS)                        │
│                                                         │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │   PostgreSQL    │    │   OrbStack Docker Engine  │  │
│  │   (OrbStack)    │    │                           │  │
│  │   localhost:5432│    │  ┌─────────────────────┐  │  │
│  └────────┬────────┘    │  │  trade-erp 容器     │  │  │
│           │             │  │  localhost:3000     │  │  │
│           │             │  │                     │  │  │
│           └─────────────┼──│ host.docker.internal│  │  │
│                         │  └─────────────────────┘  │  │
│                         └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 快速部署

### 方式一：一键部署（推荐）

```bash
cd /Users/apple/clawd/trade-erp
./deploy.sh
```

### 方式二：手动部署

```bash
# 1. 确保 .env 文件存在
cp .env.docker .env

# 2. 构建镜像
docker-compose build

# 3. 启动容器
docker-compose up -d

# 4. 推送数据库结构
docker-compose exec -T trade-erp npx prisma db push

# 5. 查看日志
docker-compose logs -f
```

## 配置说明

### 环境变量 (.env)

```bash
# 数据库连接（容器访问宿主机数据库）
DATABASE_URL="postgresql://trade_erp:trade_erp_password@host.docker.internal:5432/trade_erp?schema=public"

# 生产配置
NODE_ENV=production
PORT=3000
```

### Docker 配置

**docker-compose.yml:**
- 容器名：`trade-erp-v0.4.0`
- 端口映射：`3000:3000`
- 网络：`trade-erp-network`
- 重启策略：`unless-stopped`

**Dockerfile:**
- 基础镜像：`node:20-alpine`
- 构建方式：生产构建 (`npm run build`)
- 启动命令：`npm start`

## 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启容器
docker-compose restart

# 停止服务
docker-compose down

# 删除容器和镜像
docker-compose down --rmi all

# 进入容器
docker-compose exec trade-erp sh

# 数据库操作
docker-compose exec trade-erp npx prisma studio
docker-compose exec trade-erp npx prisma db push
```

## 访问地址

- **应用**: http://localhost:3000
- **数据库**: localhost:5432
- **Prisma Studio**: http://localhost:5555 (需单独启动)

## 版本管理

### 发布新版本

```bash
# 1. 更新版本号
npm version patch  # 或 minor/major

# 2. 提交到 Git
git add .
git commit -m "release: v0.x.0"
git push

# 3. 创建 GitHub Release
# https://github.com/evaxmeris/Serp/releases/new

# 4. 部署新版本
docker-compose down
docker-compose build
docker-compose up -d
```

### 回滚到旧版本

```bash
# 1. 切换 Git 分支/标签
git checkout v0.3.0

# 2. 重新构建部署
docker-compose down
docker-compose build
docker-compose up -d
```

## 故障排查

### 容器无法启动

```bash
# 查看日志
docker-compose logs trade-erp

# 检查端口占用
lsof -i :3000

# 检查 Docker 状态
docker ps
```

### 数据库连接失败

```bash
# 测试数据库连接
docker-compose exec trade-erp ping host.docker.internal

# 检查 OrbStack PostgreSQL 是否运行
# OrbStack UI → Containers → PostgreSQL

# 验证数据库凭据
docker-compose exec trade-erp npx prisma db pull
```

### 构建失败

```bash
# 清理缓存
docker-compose build --no-cache

# 检查 TypeScript 错误
npm run build

# 检查依赖
npm install
```

## 性能优化

### 生产构建优化

```dockerfile
# 多阶段构建（可选）
FROM node:20-alpine AS builder
# ... 构建步骤

FROM node:20-alpine AS runner
# ... 运行步骤
```

### 数据库连接池

在 Prisma schema 中添加：
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // 可选
}
```

## 安全建议

1. **生产环境**：使用强密码和加密的 `NEXTAUTH_SECRET`
2. **数据库**：限制外部访问，仅允许容器连接
3. **日志**：定期清理，避免敏感信息泄露
4. **备份**：定期备份 PostgreSQL 数据

---

**最后更新**: 2026-03-09  
**版本**: v0.4.0
