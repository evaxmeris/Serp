// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用静态导出优化
  output: 'standalone',
  
  // Turbopack 配置（Next.js 16 默认）
  turbopack: {
    // 空配置，使用默认设置
  },
}

module.exports = nextConfig
