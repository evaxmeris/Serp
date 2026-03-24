# Trade ERP 文档目录

本文档是 Trade ERP 认证模块的完整文档集。

## 文档列表

| 文档 | 说明 | 受众 |
|------|------|------|
| [开发过程记录](./authentication-dev-process.md) | 认证方案选型、问题排查、决策记录 | 开发人员 |
| [技术文档](./authentication-technical.md) | 架构、API、部署说明 | 开发人员、运维人员 |
| [用户手册](./authentication-user-guide.md) | 登录、登出、权限说明 | 最终用户 |

## 快速导航

### 如果你是开发人员
- 先看 [技术文档](./authentication-technical.md) 了解整体架构
- 再看 [开发过程记录](./authentication-dev-process.md) 了解背景和决策

### 如果你是运维人员
- 重点看 [技术文档](#环境变量) 中的环境变量配置和部署注意事项
- 参见 [故障排查](#故障排查) 常见问题处理

### 如果你是最终用户
- 直接看 [用户手册](./authentication-user-guide.md)

## 概述

Trade ERP 认证模块采用**简化 JWT + HttpOnly Cookie**方案，完全兼容 Next.js 16。

**核心特性**:
- 邮箱密码登录
- 7 天会话保持
- 基于角色的权限控制
- HttpOnly Cookie 防 XSS
- 登录失败速率限制防暴力破解

---

*文档更新日期: 2026-03-23*
