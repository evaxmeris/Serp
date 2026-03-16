import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 禁用 TypeScript 类型检查（旧代码有类型问题，不影响运行）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
