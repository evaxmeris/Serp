# Trade ERP - 开发工作流

## 📝 代码注释规范（2026-03-12 起强制执行）

**原则：** 所有源代码文件必须包含清晰的中文注释，方便人类阅读理解

### 注释标准

#### 1. 文件头注释（每个文件必须）
```typescript
/**
 * @文件说明 简短描述文件用途
 * @作者 应亮
 * @创建日期 2026-03-12
 * @最后更新 2026-03-12
 */
```

#### 2. 函数/组件注释（每个函数必须）
```typescript
/**
 * @函数说明 功能描述
 * @param 参数名 参数说明
 * @returns 返回值说明
 * @example 使用示例
 */
```

#### 3. 关键逻辑注释（复杂代码块必须）
```typescript
// 业务逻辑说明：解释为什么这样做，而不仅仅是做什么
// 例如：// 使用事务确保订单和库存同时更新，避免数据不一致
```

#### 4. 类型定义注释
```typescript
/** 订单状态枚举 */
type OrderStatus = 'pending' | 'confirmed' | 'shipped';
```

### 注释质量要求

✅ **好的注释：**
- 解释**为什么**（业务原因、技术决策）
- 说明**边界条件**和**注意事项**
- 使用**清晰的中文**
- 保持**与代码同步更新**

❌ **避免的注释：**
- 重复代码本身（`i++ // i 加 1`）
- 过时或错误的信息
- 模糊不清的描述（`// 处理一些事情`）

### 检查清单

**提交代码前必须确认：**
```
□ 新增文件已添加文件头注释
□ 新增函数已添加函数注释
□ 复杂逻辑已添加行内注释
□ 注释使用中文
□ 注释与代码同步
```

---

## 端口分配

| 环境 | 端口 | 说明 |
|------|------|------|
| **开发** | 3001 | `npm run dev` - 本地开发服务器 |
| **生产** | 3000 | Docker 容器 - 稳定版本部署 |

## 开发流程

### 1. 启动开发服务器

```bash
cd /Users/apple/clawd/trade-erp

# 确保 .env 文件存在（PORT=3001）
cp .env.example .env

# 启动开发服务器（热重载）
npm run dev
```

访问：http://localhost:3001

### 2. 开发与测试

```bash
# 运行测试
npm test

# 运行单次测试
npm test -- tests/api.test.js

# TypeScript 检查
npx tsc --noEmit

# 构建检查（验证是否能成功构建）
npm run build
```

### 3. 数据库操作

```bash
# 推送 schema 变更
npx prisma db push

# 开发迁移
npx prisma migrate dev

# 打开 Prisma Studio
npx prisma studio
```

### 4. 稳定后发布部署

```bash
# 1. 提交代码
git add .
git commit -m "feat: xxx"
git push

# 2. 创建 GitHub Release
# https://github.com/evaxmeris/Serp/releases/new

# 3. 部署到生产容器
./deploy.sh
```

访问：http://localhost:3000

## 环境对比

| 特性 | 开发环境 | 生产容器 |
|------|----------|----------|
| 端口 | 3001 | 3000 |
| 启动命令 | `npm run dev` | `npm start` |
| 热重载 | ✅ | ❌ |
| Source Maps | ✅ | ❌ |
| 日志详细度 | 详细 | 简洁 |
| 构建优化 | 无 | 完整 |

## 同时运行开发和生产

```bash
# 终端 1: 开发服务器
npm run dev
# → http://localhost:3001

# 终端 2: 查看生产容器
docker-compose logs -f
# → http://localhost:3000
```

两者互不影响，可以同时运行！

## 调试技巧

### 查看开发服务器日志

```bash
# Next.js 开发服务器直接输出到终端
```

### 查看生产容器日志

```bash
docker-compose logs -f trade-erp
```

### 进入生产容器调试

```bash
docker-compose exec trade-erp sh
```

### 数据库调试

```bash
# 开发环境
npx prisma studio

# 生产容器内
docker-compose exec trade-erp npx prisma studio --port 5555
```

## 常见问题

### Q: 开发时能访问生产数据吗？
A: 可以，开发和生产共用同一个 OrbStack PostgreSQL 数据库（localhost:5432），但通过不同端口访问应用。

### Q: 如何测试生产构建？
A: 
```bash
npm run build
npm start
# 临时在 3000 端口测试，记得停止后重新部署容器
```

### Q: 端口冲突怎么办？
A: 
```bash
# 检查端口占用
lsof -i :3000
lsof -i :3001

# 停止占用进程
kill -9 <PID>

# 或停止生产容器
docker-compose down
```

---

**最后更新**: 2026-03-09  
**版本**: v0.4.0
