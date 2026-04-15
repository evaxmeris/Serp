# Trade ERP 生产环境部署指南

**版本：** v0.9.4  
**日期：** 2026-04-12  
**状态：** ✅ 准备就绪

---

## 📋 部署前检查清单

### 1. 系统要求

- [ ] Docker Desktop 或 OrbStack 已安装并运行
- [ ] PostgreSQL 数据库运行在 localhost:5432
- [ ] Node.js 20+（本地开发）
- [ ] 至少 2GB 可用内存
- [ ] 至少 5GB 可用磁盘空间

### 2. 数据库准备

**数据库信息：**
- **主机：** localhost:5432
- **数据库：** trade_erp
- **用户：** trade_erp
- **密码：** trade_erp_password

**检查命令：**
```bash
psql -h localhost -p 5432 -U trade_erp -d trade_erp -c "SELECT 1"
```

### 3. 环境变量配置

**文件：** `.env.docker`

```bash
# 数据库连接
DATABASE_URL=postgresql://trade_erp:trade_erp_password@host.docker.internal:5432/trade_erp?schema=public

# 应用配置
NODE_ENV=production
PORT=3000

# JWT 配置（生产环境请修改）
JWT_SECRET=your-production-jwt-secret-change-me

# 其他配置
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 🚀 部署步骤

### 方式一：自动部署脚本（推荐）

**1. 启动 Docker**
```bash
# macOS - 打开 Docker Desktop
open -a Docker

# 或 OrbStack
open -a OrbStack

# 等待 Docker 完全启动（约 30 秒）
```

**2. 运行部署脚本**
```bash
chmod +x /Users/apple/clawd/trade-erp/scripts/deploy-production.sh
/Users/apple/clawd/trade-erp/scripts/deploy-production.sh
```

**3. 验证部署**
```bash
# 检查容器状态
docker ps | grep trade-erp

# 访问健康检查端点
curl http://localhost:3000/api/health

# 查看日志
docker logs -f trade-erp-v0.9.2
```

---

### 方式二：手动部署

**1. 启动 Docker**
```bash
# 确保 Docker 运行
docker info
```

**2. 停止旧容器**
```bash
docker stop trade-erp-v0.9.2 2>/dev/null || true
docker rm trade-erp-v0.9.2 2>/dev/null || true
```

**3. 构建镜像**
```bash
cd /Users/apple/clawd/trade-erp
docker build -t trade-erp:v0.9.4 .
```

**4. 启动容器**
```bash
docker-compose up -d
```

**5. 验证部署**
```bash
# 查看容器状态
docker ps | grep trade-erp

# 查看日志
docker logs -f trade-erp-v0.9.2

# 访问应用
open http://localhost:3000
```

---

## 🔧 故障排查

### 问题 1：Docker 未运行

**错误信息：**
```
Cannot connect to the Docker daemon
```

**解决方案：**
```bash
# macOS - 启动 Docker Desktop
open -a Docker

# 等待 30 秒后重试
sleep 30
docker info
```

---

### 问题 2：数据库连接失败

**错误信息：**
```
Can't reach database server at `localhost:5432`
```

**解决方案：**

1. **检查 PostgreSQL 是否运行：**
```bash
# macOS
brew services list | grep postgresql

# 启动 PostgreSQL
brew services start postgresql@15
```

2. **检查数据库是否存在：**
```bash
psql -h localhost -p 5432 -U postgres -c "\l" | grep trade_erp
```

3. **创建数据库（如不存在）：**
```bash
createdb -h localhost -p 5432 -U postgres trade_erp
```

4. **运行数据库迁移：**
```bash
cd /Users/apple/clawd/trade-erp
npx prisma migrate deploy
npx prisma generate
```

---

### 问题 3：容器启动失败

**查看日志：**
```bash
docker logs trade-erp-v0.9.2
```

**常见错误：**

**错误 A：端口被占用**
```bash
# 查找占用端口的进程
lsof -ti:3000

# 停止开发服务器
kill <PID>

# 重启容器
docker restart trade-erp-v0.9.2
```

**错误 B：环境变量缺失**
```bash
# 检查 .env.docker 文件
cat .env.docker

# 确保包含必要变量
# DATABASE_URL=...
# NODE_ENV=production
# PORT=3000
```

---

### 问题 4：健康检查失败

**等待更长时间：**
```bash
# 容器启动需要 30-60 秒
sleep 60
curl http://localhost:3000/api/health
```

**查看容器状态：**
```bash
docker inspect trade-erp-v0.9.2 | grep -A 10 Health
```

**重启容器：**
```bash
docker restart trade-erp-v0.9.2
docker logs -f trade-erp-v0.9.2
```

---

## 📊 部署验证

### 1. 容器状态检查

```bash
# 查看运行状态
docker ps | grep trade-erp

# 预期输出：
# CONTAINER ID   IMAGE            STATUS          PORTS                    NAMES
# xxxxx          trade-erp:v0.9.4 Up 1 minute     0.0.0.0:3000->3000/tcp   trade-erp-v0.9.2
```

### 2. 健康检查

```bash
# API 健康检查
curl http://localhost:3000/api/health

# 预期输出：
# {"status":"ok","timestamp":"2026-04-12T..."}
```

### 3. 功能测试

```bash
# 访问登录页面
open http://localhost:3000/login

# 测试 API
curl http://localhost:3000/api/products
```

### 4. 日志检查

```bash
# 查看最近日志
docker logs --tail 100 trade-erp-v0.9.2

# 持续查看日志
docker logs -f trade-erp-v0.9.2
```

---

## 🔧 运维命令

### 常用 Docker 命令

```bash
# 查看容器状态
docker ps | grep trade-erp

# 重启容器
docker restart trade-erp-v0.9.2

# 停止容器
docker stop trade-erp-v0.9.2

# 启动容器
docker start trade-erp-v0.9.2

# 查看日志
docker logs -f trade-erp-v0.9.2

# 进入容器
docker exec -it trade-erp-v0.9.2 sh

# 删除容器
docker rm -f trade-erp-v0.9.2

# 删除镜像
docker rmi trade-erp:v0.9.4
```

### 数据库命令

```bash
# 运行数据库迁移
docker exec -it trade-erp-v0.9.2 npx prisma migrate deploy

# 生成 Prisma 客户端
docker exec -it trade-erp-v0.9.2 npx prisma generate

# 查看数据库
docker exec -it trade-erp-v0.9.2 psql -h host.docker.internal -U trade_erp -d trade_erp
```

### 备份命令

```bash
# 备份数据库
docker exec trade-erp-v0.9.2 pg_dump -h host.docker.internal -U trade_erp trade_erp > backup-$(date +%Y%m%d).sql

# 恢复数据库
cat backup-20260412.sql | docker exec -i trade-erp-v0.9.2 psql -h host.docker.internal -U trade_erp trade_erp
```

---

## 📈 性能优化

### 1. 内存优化

**限制容器内存：**
```yaml
# docker-compose.yml
services:
  trade-erp:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### 2. 重启策略

**自动重启：**
```yaml
# docker-compose.yml
services:
  trade-erp:
    restart: unless-stopped
```

### 3. 日志轮转

**限制日志大小：**
```yaml
# docker-compose.yml
services:
  trade-erp:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 🎯 部署后任务

### 1. 创建管理员账号

```bash
# 访问注册页面
open http://localhost:3000/register

# 创建第一个管理员账号
```

### 2. 配置系统设置

- 配置公司信息
- 配置邮件服务
- 配置钉钉集成
- 配置定时任务

### 3. 导入基础数据

- 导入产品数据
- 导入客户数据
- 导入供应商数据
- 配置仓库信息

### 4. 用户培训

- 编写用户手册
- 录制操作视频
- 组织培训活动

---

## 📞 技术支持

**问题反馈：**
- GitHub Issues: https://github.com/evaxmeris/Serp/issues
- 钉钉群：ERP 开发群

**紧急联系：**
- 技术支持：AI 开发团队
- 响应时间：工作日 9:00-18:00

---

## 📝 版本信息

| 项目 | 信息 |
|------|------|
| 应用版本 | v0.9.4 |
| Docker 镜像 | trade-erp:v0.9.4 |
| 容器名称 | trade-erp-v0.9.2 |
| 端口映射 | 3000:3000 |
| 部署日期 | 2026-04-12 |
| 部署状态 | ✅ 准备就绪 |

---

*文档创建时间：2026-04-12 14:30*  
*最后更新：2026-04-12 14:30*  
*状态：✅ 可立即部署*
