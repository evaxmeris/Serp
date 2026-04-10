#!/usr/bin/env node

/**
 * 创建 ERP 开发测试用户
 * 用于测试导航和页面功能
 */

const fs = require('fs');
const path = require('path');

const TEST_USER = {
  id: 'test-user-001',
  email: 'dev@trade-erp.com',
  name: '开发测试',
  role: 'ADMIN',
  avatarUrl: null,
};

console.log('👤 创建测试用户信息');
console.log('====================\n');
console.log('邮箱：dev@trade-erp.com');
console.log('姓名：开发测试');
console.log('角色：ADMIN');
console.log('密码：Dev@123456\n');
console.log('📝 请在浏览器中访问 http://localhost:3001/login 并登录\n');

// 保存用户信息到文件（用于参考）
const userInfoPath = path.join(__dirname, 'test-user-info.json');
fs.writeFileSync(userInfoPath, JSON.stringify(TEST_USER, null, 2));
console.log(`✅ 用户信息已保存到：${userInfoPath}`);
console.log('\n🌐 登录步骤：');
console.log('1. 访问 http://localhost:3001/login');
console.log('2. 输入邮箱：dev@trade-erp.com');
console.log('3. 输入密码：Dev@123456');
console.log('4. 点击登录');
console.log('5. 访问 http://localhost:3001/dashboard 查看导航\n');
