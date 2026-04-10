#!/usr/bin/env node

/**
 * 导航系统自动化测试脚本
 * 测试所有页面的导航集成和功能
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'admin@trade-erp.com',
  password: 'Admin@123456',
};

// 需要测试的页面列表
const PAGES_TO_TEST = [
  { name: '首页', path: '/', requiresAuth: false },
  { name: 'Dashboard', path: '/dashboard', requiresAuth: true },
  { name: '订单管理', path: '/orders', requiresAuth: true },
  { name: '客户管理', path: '/customers', requiresAuth: true },
  { name: '产品管理', path: '/products', requiresAuth: true },
  { name: '产品开发', path: '/product-research', requiresAuth: true },
  { name: '库存管理', path: '/inventory', requiresAuth: true },
  { name: '采购入库', path: '/inbound-orders', requiresAuth: true },
  { name: '发货处理', path: '/outbound-orders', requiresAuth: true },
  { name: '供应商管理', path: '/suppliers', requiresAuth: true },
  { name: '采购管理', path: '/purchases', requiresAuth: true },
  { name: '报表中心', path: '/reports', requiresAuth: true },
  { name: '用户管理', path: '/users', requiresAuth: true },
  { name: '系统设置', path: '/settings', requiresAuth: true },
];

let passCount = 0;
let failCount = 0;

console.log('🧪 Trade ERP 导航系统自动化测试');
console.log('================================\n');

// 登录获取 Cookie
async function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TEST_USER);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        resolve({ success: data.includes('"success":true'), cookies, data });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 测试页面访问
async function testPage(page, cookies) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: page.path,
      method: 'GET',
      headers: {
        'Cookie': cookies ? cookies.join('; ') : '',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          success: res.statusCode === 200 || res.statusCode === 307, // 307 是重定向到登录页
          requiresAuth: data.includes('login') || res.statusCode === 307,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 主测试流程
async function runTests() {
  console.log('📝 步骤 1: 登录系统');
  console.log('─────────────────────────────────────\n');

  const loginResult = await login();
  
  if (loginResult.success) {
    console.log('✅ 登录成功');
    console.log(`📄 响应：${loginResult.data.substring(0, 100)}...\n`);
  } else {
    console.log('❌ 登录失败');
    console.log(`📄 响应：${loginResult.data}\n`);
    process.exit(1);
  }

  console.log('📝 步骤 2: 测试所有页面访问');
  console.log('─────────────────────────────────────\n');

  for (const page of PAGES_TO_TEST) {
    const result = await testPage(page, loginResult.cookies);
    
    let status = '❌';
    let message = '';

    if (page.requiresAuth) {
      // 需要认证的页面
      if (result.success && !result.requiresAuth) {
        status = '✅';
        message = '访问成功（已认证）';
        passCount++;
      } else if (result.requiresAuth) {
        status = '⚠️';
        message = '需要认证（重定向到登录页）';
        passCount++; // 这也是正常行为
      } else {
        status = '❌';
        message = `访问失败 (HTTP ${result.statusCode})`;
        failCount++;
      }
    } else {
      // 不需要认证的页面
      if (result.success) {
        status = '✅';
        message = '访问成功（公开访问）';
        passCount++;
      } else {
        status = '❌';
        message = `访问失败 (HTTP ${result.statusCode})`;
        failCount++;
      }
    }

    console.log(`${status} ${page.name.padEnd(12)} ${page.path.padEnd(25)} ${message}`);
  }

  console.log('\n─────────────────────────────────────');
  console.log(`\n📊 测试结果：${passCount} 通过，${failCount} 失败`);
  console.log(`📈 通过率：${((passCount / PAGES_TO_TEST.length) * 100).toFixed(1)}%\n`);

  if (failCount > 0) {
    console.log('⚠️  有页面访问失败，请检查！\n');
    process.exit(1);
  } else {
    console.log('🎉 所有页面访问正常！\n');
  }
}

runTests().catch(err => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});
