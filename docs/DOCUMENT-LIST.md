# Trade ERP 认证模块文档清单

**生成日期**: 2026-03-23
**项目版本**: v0.6.0

---

## 已完成文档

| 序号 | 文件名 | 文档类型 | 大小 | 说明 |
|------|--------|----------|------|------|
| 1 | `README.md` | 目录索引 | 742 字节 | 文档总目录 |
| 2 | `authentication-dev-process.md` | 开发过程记录 | 9.3 KB | 认证方案选型、问题分析、决策记录 |
| 3 | `authentication-technical.md` | 技术文档 | 7.9 KB | 架构、API 参考、部署说明 |
| 4 | `authentication-user-guide.md` | 用户手册 | 2.7 KB | 登录、使用说明，面向最终用户 |
| 5 | `DOCUMENT-LIST.md` | 文档清单 | 当前文件 | 本文件，归档清单 |

---

## 源代码文件清单

认证模块涉及的源代码文件：

| 序号 | 文件路径 | 说明 |
|------|----------|------|
| 1 | `src/lib/auth-simple.ts` | 简化认证核心实现 |
| 2 | `src/lib/auth.ts` | 兼容层，保持向后兼容 |
| 3 | `src/app/api/auth/login/route.ts` | 登录 API |
| 4 | `src/app/api/auth/me/route.ts` | 获取用户信息 API |
| 5 | `src/app/api/auth/logout/route.ts` | 登出 API |
| 6 | `src/app/api/auth/register/route.ts` | 注册 API |
| 7 | `src/app/login/page.tsx` | 登录页面 |
| 8 | `prisma/schema.prisma` | User 模型定义 |

---

## 环境变量配置

必需环境变量：

```bash
# JWT 签名密钥（必须 >= 32 字符）
NEXTAUTH_SECRET=your-secret-key-here

# 站点 URL（必须与实际访问地址一致）
NEXTAUTH_URL=https://your-domain.com
```

---

## 验收完成

- ✅ 认证方案开发过程已记录
- ✅ 技术文档已整理
- ✅ 用户手册已编写
- ✅ 文档清单已生成

**文档负责人**: Trade ERP 信息员
**完成时间**: 2026-03-23
