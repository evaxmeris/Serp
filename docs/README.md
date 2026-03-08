# Trade ERP 技术文档索引

**更新日期:** 2026-03-06  
**版本:** v1.0

---

## 📚 文档列表

本文档集包含 Trade ERP 项目的完整技术设计文档，供开发团队参考使用。

| 文档 | 说明 | 目标读者 |
|------|------|----------|
| [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md) | 系统架构审阅报告 | 架构师、技术负责人 |
| [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) | 数据库设计文档 | 后端开发、DBA |
| [API_SPECIFICATION.md](./API_SPECIFICATION.md) | API 接口规范 | 前后端开发 |
| [TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md) | 开发技术指导 | 全体开发人员 |

---

## 🎯 快速开始

### 新成员入职

1. **阅读顺序:**
   ```
   README.md (本文档)
   → ARCHITECTURE_REVIEW.md (了解系统全貌)
   → TECHNICAL_GUIDE.md (开发规范)
   → API_SPECIFICATION.md (接口文档)
   → DATABASE_DESIGN.md (数据模型)
   ```

2. **环境搭建:**
   - 参考 `TECHNICAL_GUIDE.md` 第 1 章
   - 预计耗时：30 分钟

3. **第一个任务:**
   - 阅读 `ARCHITECTURE_REVIEW.md` 了解系统架构
   - 在本地运行项目
   - 尝试创建一个简单的 API 端点

### 开发新功能

1. **数据库变更:**
   - 查阅 `DATABASE_DESIGN.md`
   - 更新 `prisma/schema.prisma`
   - 创建迁移：`npx prisma migrate dev`

2. **API 开发:**
   - 查阅 `API_SPECIFICATION.md`
   - 遵循 RESTful 规范
   - 使用统一的响应格式

3. **前端开发:**
   - 查阅 `TECHNICAL_GUIDE.md` 第 3 章
   - 使用 shadcn/ui 组件
   - 遵循组件开发规范

---

## 📋 当前任务清单

### 高优先级 🔴

- [ ] 更新 Prisma Schema，添加订单和采购增强字段
- [ ] 创建数据库迁移
- [ ] 实现订单管理 API（列表、详情、创建、更新）
- [ ] 实现供应商管理 API
- [ ] 实现采购订单 API
- [ ] 添加请求验证（Zod）
- [ ] 实现 RBAC 权限中间件

### 中优先级 🟡

- [ ] 创建生产记录模块
- [ ] 创建质检记录模块
- [ ] 实现采购入库功能
- [ ] 实现供应商付款功能
- [ ] 添加操作日志记录
- [ ] 实现文件上传功能

### 低优先级 🟢

- [ ] 实现供应商评估模块
- [ ] 添加数据导出功能
- [ ] 实现审批流程
- [ ] 添加消息通知
- [ ] 实现数据仪表盘

---

## 🔧 开发资源

### 代码仓库

```bash
git clone <repo-url>
cd trade-erp
```

### 环境配置

```bash
# 复制环境变量
cp .env.example .env

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 数据库操作

```bash
# 生成 Prisma 客户端
npx prisma generate

# 推送 Schema 到数据库
npx prisma db push

# 创建迁移
npx prisma migrate dev --name <migration_name>

# 查看数据库
npx prisma studio
```

### 测试

```bash
# 运行单元测试
npm run test

# 运行集成测试
npm run test:integration
```

---

## 📞 技术支持

遇到问题时：

1. **查阅文档:** 先检查相关技术文档
2. **搜索代码:** 使用 `grep` 或 IDE 搜索类似实现
3. **提问:** 在团队频道提问，附上错误信息和已尝试的解决方案

---

## 📝 文档维护

### 更新流程

1. 修改文档内容
2. 更新文档顶部的版本号和日期
3. 提交时注明 `[docs]` 前缀

### 文档规范

- 使用 Markdown 格式
- 代码示例使用语法高亮
- 表格对齐
- 中文为主，技术术语保留英文

---

## 🚀 下一步

1. **开发团队:** 开始实施高优先级任务
2. **测试团队:** 编写测试用例
3. **产品团队:** 确认需求细节
4. **架构师:** 进行代码审查和技术指导

---

**Good luck with your development! 🎉**
