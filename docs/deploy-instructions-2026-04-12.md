# Trade ERP 生产部署说明

**日期：** 2026-04-12  
**版本：** v0.9.4  
**状态：** ⚠️ 需要手动启动 Docker

---

## ⚠️ 当前状态

### 检查结果

| 项目 | 状态 | 说明 |
|------|------|------|
| Docker | ❌ 未运行 | 需要手动启动 |
| PostgreSQL | ❌ 未运行 | 需要手动启动 |
| 端口 3000 | ✅ 可用 | 开发服务器已停止 |
| 必要文件 | ✅ 齐全 | Dockerfile 等都在 |
| 磁盘空间 | ✅ 充足 | 497Gi 可用 |

---

## 🚀 部署步骤

### 第 1 步：启动 Docker

**方式 A：使用 OrbStack（推荐）**
```bash
# 打开 OrbStack
open -a OrbStack

# 等待 30 秒直到完全启动
sleep 30

# 验证 Docker 运行
docker info
```

**方式 B：使用 Docker Desktop**
```bash
# 打开 Docker Desktop
open -a Docker

# 等待 30 秒直到完全启动
sleep 30

# 验证 Docker 运行
docker info
```

---

### 第 2 步：启动 PostgreSQL

```bash
# 启动 PostgreSQL 15
brew services start postgresql@15

# 验证运行状态
brew services list | grep postgresql

# 创建数据库（如不存在）
createdb -h localhost -p 5432 -U postgres trade_erp

# 运行数据库迁移
cd /Users/apple/clawd/trade-erp
npx prisma migrate deploy
npx prisma generate
```

---

### 第 3 步：停止开发服务器

```bash
# 查找开发服务器进程
lsof -ti:3001

# 停止开发服务器
kill $(lsof -ti:3001) 2>/dev/null || true

# 验证端口已释放
lsof -ti:3001
```

---

### 第 4 步：运行部署脚本

```bash
cd /Users/apple/clawd/trade-erp

# 运行自动部署脚本
./scripts/deploy-production.sh
```

**或手动部署：**
```bash
# 停止旧容器
docker stop trade-erp-v0.9.2 2>/dev/null || true
docker rm trade-erp-v0.9.2 2>/dev/null || true

# 构建镜像
docker build -t trade-erp:v0.9.4 .

# 启动容器
docker-compose up -d

# 查看日志
docker logs -f trade-erp-v0.9.2
```

---

### 第 5 步：验证部署

```bash
# 检查容器状态
docker ps | grep trade-erp

# 访问健康检查
curl http://localhost:3000/api/health

# 访问应用
open http://localhost:3000
```

---

## 📋 快速部署命令（一键执行）

**复制以下命令到终端执行：**

```bash
# 1. 启动 Docker
open -a OrbStack && sleep 30

# 2. 启动 PostgreSQL
brew services start postgresql@15 && sleep 5

# 3. 停止开发服务器
kill $(lsof -ti:3001) 2>/dev/null || true

# 4. 运行数据库迁移
cd /Users/apple/clawd/trade-erp
npx prisma migrate deploy && npx prisma generate

# 5. 部署 Docker 容器
docker stop trade-erp-v0.9.2 2>/dev/null || true
docker rm trade-erp-v0.9.2 2>/dev/null || true
docker build -t trade-erp:v0.9.4 .
docker-compose up -d

# 6. 验证部署
sleep 10
docker ps | grep trade-erp
curl http://localhost:3000/api/health
open http://localhost:3000
```

---

## 🎯 部署后验证

### 1. 容器状态
```bash
docker ps | grep trade-erp
```

**预期输出：**
```
CONTAINER ID   IMAGE            STATUS          PORTS                    NAMES
xxxxx          trade-erp:v0.9.4 Up 1 minute     0.0.0.0:3000->3000/tcp   trade-erp-v0.9.2
```

### 2. 健康检查
```bash
curl http://localhost:3000/api/health
```

**预期输出：**
```json
{"status":"ok","timestamp":"2026-04-12T..."}
```

### 3. 访问应用
```bash
open http://localhost:3000/login
```

**预期：** 打开登录页面

---

## 🔧 故障排查

### 问题：Docker 启动失败

**解决方案：**
```bash
# 重启 OrbStack
killall OrbStack
open -a OrbStack

# 等待 60 秒
sleep 60

# 验证
docker info
```

---

### 问题：PostgreSQL 启动失败

**解决方案：**
```bash
# 检查 PostgreSQL 是否安装
brew list | grep postgresql

# 安装 PostgreSQL 15
brew install postgresql@15

# 启动服务
brew services start postgresql@15
```

---

### 问题：数据库迁移失败

**解决方案：**
```bash
# 检查数据库连接
psql -h localhost -p 5432 -U postgres -c "\l" | grep trade_erp

# 创建数据库
createdb -h localhost -p 5432 -U postgres trade_erp

# 重新运行迁移
cd /Users/apple/clawd/trade-erp
npx prisma migrate deploy
```

---

### 问题：容器启动失败

**查看日志：**
```bash
docker logs trade-erp-v0.9.2
```

**常见错误：**
- 端口被占用：`lsof -ti:3000` 然后 `kill <PID>`
- 数据库连接失败：检查 PostgreSQL 是否运行
- 环境变量缺失：检查 `.env.docker` 文件

---

## 📞 需要帮助？

**执行以下命令生成诊断报告：**
```bash
cd /Users/apple/clawd/trade-erp

echo "=== Docker 状态 ==="
docker info

echo "=== PostgreSQL 状态 ==="
brew services list | grep postgresql

echo "=== 端口状态 ==="
lsof -ti:3000
lsof -ti:3001

echo "=== 容器状态 ==="
docker ps -a | grep trade-erp

echo "=== 最近日志 ==="
docker logs --tail 50 trade-erp-v0.9.2 2>/dev/null || echo "无容器"
```

---

## ✅ 部署完成检查清单

- [ ] Docker 运行正常
- [ ] PostgreSQL 运行正常
- [ ] 数据库迁移完成
- [ ] 容器启动成功
- [ ] 健康检查通过
- [ ] 可以访问登录页面
- [ ] 可以登录系统

**全部勾选后，部署完成！** 🎉

---

*文档创建时间：2026-04-12 14:30*  
*部署版本：v0.9.4*  
*状态：⚠️ 需要手动启动 Docker 和 PostgreSQL*
