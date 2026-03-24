# 报表功能使用说明

## 📋 功能概述

报表中心提供三个核心功能：
1. **导出报表** - 支持 Excel、CSV、PDF 格式导出
2. **设置订阅** - 定时自动推送报表到邮箱
3. **定时任务** - 配置报表自动生成计划

---

## 🚀 快速开始

### 访问报表中心

- **开发环境**: http://localhost:3001/reports
- **生产环境**: http://localhost:3000/reports

---

## 📥 导出报表

### 功能说明
- 支持单个报表导出或全部报表导出
- 支持三种格式：Excel (.xlsx)、CSV (.csv)、PDF (.pdf)
- 异步处理，导出完成后通知

### 使用步骤
1. 点击"📥 导出报表"按钮
2. 选择导出格式
3. 点击"确认导出"
4. 系统提示导出任务已创建

### API 端点
```
POST /api/v1/reports/export
```

### 请求参数
```json
{
  "reportId": "profit",  // 报表 ID，"all" 表示全部
  "format": "excel",     // excel | csv | pdf
  "filters": {}          // 筛选条件
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "export-123",
    "status": "pending",
    "format": "excel"
  },
  "message": "导出任务已创建，请稍后查询状态"
}
```

---

## 📧 设置订阅

### 功能说明
- 支持每日、每周、每月自动推送
- 支持 PDF、Excel、CSV 格式
- 可配置接收邮箱

### 使用步骤
1. 点击"📧 设置订阅"按钮
2. 选择订阅频率（每日/每周/每月）
3. 输入接收邮箱（可选）
4. 选择报表格式
5. 点击"确认订阅"

### API 端点
```
POST /api/v1/reports/subscribe
```

### 请求参数
```json
{
  "reportId": "profit",
  "userId": "user-123",
  "frequency": "WEEKLY",  // DAILY | WEEKLY | MONTHLY
  "format": "pdf",
  "email": "user@example.com",
  "isActive": true
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "sub-123",
    "frequency": "WEEKLY",
    "nextSendAt": "2026-03-24T08:00:00.000Z"
  },
  "message": "订阅成功！系统将按时推送报表"
}
```

---

## ⏰ 定时任务

### 功能说明
- 使用 Cron 表达式配置执行时间
- 支持自定义时区
- 提供快速选择模板

### 使用步骤
1. 点击"⏰ 定时任务"按钮
2. 输入任务名称
3. 配置 Cron 表达式（或使用快速选择）
4. 选择时区
5. 点击"创建任务"

### Cron 表达式格式
```
分 时 日 月 星期
```

### 快速选择示例
| 描述 | Cron 表达式 |
|------|------------|
| 每天 8:00 | `0 8 * * *` |
| 每周一 9:00 | `0 9 * * 1` |
| 每月 1 号 10:00 | `0 10 1 * *` |
| 每小时 | `0 * * * *` |

### API 端点
```
POST /api/v1/reports/schedule
```

### 请求参数
```json
{
  "reportId": "profit",
  "name": "每日利润报表",
  "cronExpression": "0 8 * * *",
  "timezone": "Asia/Shanghai",
  "config": {}
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "schedule-123",
    "name": "每日利润报表",
    "cronExpression": "0 8 * * *",
    "isActive": true
  },
  "message": "定时任务创建成功"
}
```

---

## 🔧 技术实现

### 前端组件
- `ExportDialog.tsx` - 导出对话框
- `SubscribeDialog.tsx` - 订阅对话框
- `ScheduleDialog.tsx` - 定时任务对话框

### 后端 API
- `/api/v1/reports/export` - 导出 API
- `/api/v1/reports/subscribe` - 订阅 API
- `/api/v1/reports/schedule` - 定时任务 API

### 数据库表
- `ReportExportLog` - 导出日志
- `ReportSubscription` - 订阅配置
- `ReportSchedule` - 定时任务配置

---

## 📝 注意事项

1. **权限要求**
   - 导出报表：所有用户
   - 设置订阅：所有用户
   - 定时任务：需要管理员权限

2. **异步处理**
   - 导出任务为异步执行
   - 可通过导出日志查询状态

3. **订阅推送**
   - 需要配置邮件服务
   - 默认使用系统配置邮箱

4. **定时任务**
   - Cron 表达式需要正确格式
   - 时区配置影响执行时间

---

## 🐛 常见问题

### Q: 导出任务一直处于 pending 状态？
A: 检查后台任务执行器是否正常运行，查看服务器日志。

### Q: 订阅邮件没有收到？
A: 检查邮箱配置是否正确，查看垃圾邮件文件夹。

### Q: 定时任务没有执行？
A: 检查 Cron 表达式是否正确，时区配置是否匹配。

---

## 📞 技术支持

如有问题，请联系：
- **ERP 开发群**: 钉钉群
- **GitHub Issues**: https://github.com/evaxmeris/Serp/issues

---

*最后更新：2026-03-17*
