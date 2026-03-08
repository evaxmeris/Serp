/**
 * Jest 测试环境设置
 * Trade ERP 测试配置
 */

// 设置测试超时时间
jest.setTimeout(30000);

// 全局测试变量
global.TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
};

// 测试前清理函数
beforeAll(async () => {
  console.log('🧪 Trade ERP 测试环境初始化...');
  console.log(`   Base URL: ${global.TEST_CONFIG.baseUrl}`);
  console.log(`   Database: ${global.TEST_CONFIG.databaseUrl ? '已配置' : '未配置'}`);
});

// 测试后清理函数
afterAll(async () => {
  console.log('🧪 测试完成，清理资源...');
});

// 辅助函数：等待指定时间
global.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 辅助函数：生成唯一标识
global.uniqueId = (prefix = 'TEST') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
