/**
 * Jest 测试环境变量加载
 * 在测试设置之前加载 .env.test 文件
 */

const fs = require('fs');
const path = require('path');

// 加载 .env.test 文件
const envTestPath = path.join(__dirname, '..', '.env.test');
if (fs.existsSync(envTestPath)) {
  const dotenv = require('dotenv');
  dotenv.config({ path: envTestPath });
  console.log('✅ 已加载 .env.test 配置');
} else {
  console.warn('⚠️  .env.test 文件不存在，使用当前环境变量');
}

// 验证必要的环境变量
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 未配置');
  process.exit(1);
}

console.log(`📦 DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);
