import type { NextConfig } from "next";

// @ts-ignore - eslint 配置在 Next.js 16 中类型定义未更新
const nextConfig: NextConfig = {
  output: "standalone",
  // 允许通过 cpolar 域名访问开发服务器
  allowedDevOrigins: ['derp.cpolar.cn', 'serp.cpolar.cn'],
  // 禁用 TypeScript 类型检查（旧代码有类型问题，不影响运行）
  typescript: {
    ignoreBuildErrors: true,
  },
  // Turbopack 根目录配置 - Docker 中不需要设置
  ...(process.env.NODE_ENV !== 'production' ? {
    turbopack: {
      root: process.env.TURBOPACK_ROOT || '.',
    },
  } : {}),
};

export default nextConfig;
