# Trade ERP - 开发发布部署强制流程

**🔴 强制执行，禁止跳过任何步骤**

---

## 📊 流程图

```
开发 → 测试 → 构建 → 提交 → 发布检查 → 部署 → 验证
        ↓              ↓                    ↓
      失败停止       失败停止              失败回滚
```

---

## 🔒 强制流程规则

### 规则 1: 禁止直接在生产环境开发

❌ **禁止**在 production 容器运行开发代码  
✅ **必须**在开发环境（3001 端口）完成开发和测试

### 规则 2: 禁止未测试就发布

❌ **禁止**跳过测试直接部署  
✅ **必须**通过所有检查：
- `npm test` — 单元测试
- `npx tsc --noEmit` — TypeScript 检查
- `npm run build` — 生产构建

### 规则 3: 禁止手动部署

❌ **禁止**直接运行 `docker-compose up`  
✅ **必须**使用 `./scripts/release-deploy.sh <版本号>`

### 规则 4: 禁止未验证就上线

❌ **禁止**部署后不验证  
✅ **必须**执行健康检查：
```bash
curl http://localhost:3000/api/health
```

---

## 📋 开发流程检查清单

### 阶段 1: 开发（端口 3001）

```
□ 1. 启动开发服务器：npm run dev
□ 2. 本地功能开发和测试
□ 3. 运行单元测试：npm test
□ 4. TypeScript 检查：npx tsc --noEmit
□ 5. 构建检查：npm run build
```

### 阶段 2: 提交

```
□ 1. Git 提交：git add . && git commit -m "feat: xxx"
□ 2. Git 推送：git push
□ 3. 确认 GitHub 已收到代码
```

### 阶段 3: 发布部署

```
□ 1. 执行发布脚本：./scripts/release-deploy.sh v0.x.0
□ 2. 自动检查（脚本执行）
   □ Git 工作区干净
   □ 在 main 分支
   □ 代码已同步
   □ 测试通过
   □ TypeScript 通过
   □ 构建成功
   □ Docker 就绪
   □ 数据库连接正常
□ 3. 确认发布（手动确认）
□ 4. 创建 Git 标签
□ 5. 推送标签
□ 6. 部署到容器
□ 7. 健康检查验证
```

### 阶段 4: 发布后

```
□ 1. 创建 GitHub Release（手动）
□ 2. 填写发布说明
□ 3. 通知团队
□ 4. 监控容器日志：docker-compose logs -f
```

---

## 🛠️ 工具脚本

### 发布部署脚本

```bash
# 完整发布流程（含强制检查）
./scripts/release-deploy.sh v0.4.0
```

### 快速部署脚本

```bash
# 仅用于开发/测试环境
./deploy.sh
```

### 安全编辑脚本

```bash
# 编辑文件前强制检查
./scripts/edit-safe.sh path/to/file.md "目标文本"
```

---

## ⚠️ 违规处理

**违反强制流程：**
1. 立即停止当前操作
2. 记录到 `~/.learnings/ERRORS.md`（priority: critical）
3. 回滚错误修改
4. 重新按正确流程执行

**常见违规：**
- ❌ 直接 edit 不 read → 用 edit-safe.sh
- ❌ 直接部署不测试 → 用 release-deploy.sh
- ❌ 未验证就上线 → 执行健康检查

---

## 📊 决策树

```
需要修改代码？
    │
    ├─ 是 → 开发环境（3001 端口）
    │         │
    │         ├─ 功能完成？
    │         │   ├─ 是 → 运行测试
    │         │   │       │
    │         │   │       ├─ 通过？ → Git 提交 → 发布流程
    │         │   │       └─ 失败 → 修复 → 重新测试
    │         │   └─ 否 → 继续开发
    │         └─ 开发中
    │
    └─ 否 → 仅部署？
              │
              └─ 是 → ./scripts/release-deploy.sh <版本>
```

---

## 🎯 关键指标

| 指标 | 目标 | 检查方式 |
|------|------|----------|
| 测试覆盖率 | 100% | `npm test --coverage` |
| TypeScript 错误 | 0 | `npx tsc --noEmit` |
| 构建失败 | 0 | `npm run build` |
| 部署失败 | 0 | 健康检查 |
| 回滚次数 | 0 | Git 标签历史 |

---

## 📝 发布记录模板

```markdown
## Release v0.x.0 - YYYY-MM-DD

### 新增功能
- 

### Bug 修复
- 

### 技术改进
- 

### 检查结果
- [ ] 测试通过
- [ ] TypeScript 通过
- [ ] 构建成功
- [ ] 健康检查通过

### 部署状态
- [ ] Git 标签已创建
- [ ] GitHub Release 已发布
- [ ] 生产容器已更新
- [ ] 团队已通知
```

---

**创建日期**: 2026-03-09  
**强制级别**: 🔴 必须执行  
**违规后果**: 立即停止 + 记录 critical + 回滚
