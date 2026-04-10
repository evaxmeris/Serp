#!/usr/bin/env node
/**
 * Trade ERP 系统全链路检验脚本
 * 检查所有路由页面的可访问性
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 所有已知路由
const allRoutes = [
  // 认证
  { path: '/login', expect: 200, label: '登录页' },
  { path: '/register', expect: 200, label: '注册页' },
  
  // 主页面
  { path: '/', expect: 307, label: '首页(重定向到dashboard)' },
  { path: '/dashboard', expect: 200, label: '仪表盘' },
  { path: '/test', expect: 200, label: '测试页' },
  
  // 基础资料
  { path: '/customers', expect: 200, label: '客户管理' },
  { path: '/products', expect: 200, label: '产品管理' },
  { path: '/suppliers', expect: 200, label: '供应商管理' },
  { path: '/inquiries', expect: 200, label: '询盘管理' },
  
  // 销售订单
  { path: '/orders', expect: 200, label: '订单管理' },
  { path: '/quotations', expect: 200, label: '报价管理' },
  { path: '/shipments', expect: 200, label: '发货管理' },
  
  // 采购供应链
  { path: '/purchases', expect: 200, label: '采购管理' },
  { path: '/purchase-orders', expect: 200, label: '采购订单' },
  { path: '/inbound-orders', expect: 200, label: '采购入库' },
  
  // 仓储物流
  { path: '/inventory', expect: 200, label: '库存管理' },
  { path: '/outbound-orders', expect: 200, label: '出库管理' },
  
  // 报表分析
  { path: '/reports', expect: 200, label: '报表中心' },
  { path: '/reports/dashboard', expect: 200, label: '报表仪表盘' },
  { path: '/reports/sales', expect: 200, label: '销售报表' },
  { path: '/reports/purchase', expect: 200, label: '采购报表' },
  { path: '/reports/inventory', expect: 200, label: '库存报表' },
  { path: '/reports/profit', expect: 200, label: '利润报表' },
  { path: '/reports/cashflow', expect: 200, label: '现金流报表' },
  { path: '/reports/subscriptions', expect: 200, label: '订阅报表' },
  { path: '/reports/custom', expect: 200, label: '自定义报表' },
  
  // 产品开发
  { path: '/product-research', expect: 200, label: '产品调研' },
  { path: '/product-research/dashboard', expect: 200, label: '调研仪表盘' },
  { path: '/product-research/products', expect: 200, label: '调研产品' },
  { path: '/product-research/categories', expect: 200, label: '调研分类' },
  { path: '/product-research/comparisons', expect: 200, label: '产品对比' },
  { path: '/product-research/templates', expect: 200, label: '调研模板' },
  { path: '/product-research/import', expect: 200, label: '调研导入' },
  
  // 系统管理
  { path: '/settings', expect: 200, label: '系统设置' },
  { path: '/settings/company', expect: 200, label: '公司设置' },
  { path: '/settings/system', expect: 200, label: '系统配置' },
  { path: '/settings/theme', expect: 200, label: '主题设置' },
  { path: '/settings/language', expect: 200, label: '语言设置' },
  { path: '/settings/login', expect: 200, label: '登录设置' },
  { path: '/settings/password', expect: 200, label: '密码设置' },
  { path: '/settings/push', expect: 200, label: '推送设置' },
  { path: '/settings/roles', expect: 200, label: '角色设置' },
  { path: '/settings/backup', expect: 200, label: '备份设置' },
  { path: '/settings/export', expect: 200, label: '导出设置' },
  { path: '/users', expect: 200, label: '用户管理' },
  { path: '/pending-approval', expect: 200, label: '待审批' },
  { path: '/profile', expect: 200, label: '个人资料' },
];

// API 端点
const apiEndpoints = [
  { path: '/api/health', expect: 200, label: '健康检查' },
  { path: '/api/auth/login', expect: 405, label: '登录API(GET)' },
  { path: '/api/customers', expect: 200, label: '客户API' },
  { path: '/api/products', expect: 200, label: '产品API' },
  { path: '/api/suppliers', expect: 200, label: '供应商API' },
  { path: '/api/orders', expect: 200, label: '订单API' },
  { path: '/api/inquiries', expect: 200, label: '询盘API' },
  { path: '/api/purchases', expect: 200, label: '采购API' },
  { path: '/api/inventory', expect: 200, label: '库存API' },
];

function checkUrl(route) {
  return new Promise((resolve) => {
    const timeout = 5000;
    const timer = setTimeout(() => resolve({ ...route, status: 'TIMEOUT', code: -1 }), timeout);
    
    http.get(`${BASE_URL}${route.path}`, { headers: { 'Cookie': '' } }, (res) => {
      clearTimeout(timer);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ...route,
          status: res.statusCode === route.expect ? '✅ OK' : '⚠️ WARN',
          code: res.statusCode,
          size: data.length,
        });
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      resolve({ ...route, status: '❌ FAIL', code: -1, error: err.message });
    });
  });
}

async function runChecks() {
  console.log('🔍 Trade ERP 系统全链路检验');
  console.log(`📍 目标: ${BASE_URL}`);
  console.log(`📋 路由: ${allRoutes.length} 个 | API: ${apiEndpoints.length} 个\n`);
  
  const allChecks = [...allRoutes, ...apiEndpoints];
  const results = await Promise.all(allChecks.map(checkUrl));
  
  const ok = results.filter(r => r.status === '✅ OK');
  const warn = results.filter(r => r.status === '⚠️ WARN');
  const fail = results.filter(r => r.status === '❌ FAIL');
  
  console.log('📊 检验结果:\n');
  console.log('─'.repeat(80));
  console.log(`类别         | 状态   | 路径                              | 期望 | 实际`);
  console.log('─'.repeat(80));
  
  for (const r of results) {
    const type = r.path.startsWith('/api/') ? 'API        ' : '页面        ';
    console.log(`${type} | ${r.status} | ${r.path.padEnd(35)} | ${r.expect.toString().padStart(3)} | ${r.code}`);
  }
  
  console.log('─'.repeat(80));
  console.log(`\n✅ 通过: ${ok.length} | ⚠️ 警告: ${warn.length} | ❌ 失败: ${fail.length}`);
  
  if (fail.length > 0) {
    console.log('\n❌ 失败列表:');
    fail.forEach(r => console.log(`  - ${r.path}: ${r.error || '连接失败'}`));
  }
  
  if (warn.length > 0) {
    console.log('\n⚠️ 警告列表:');
    warn.forEach(r => console.log(`  - ${r.path}: 期望 ${r.expect}, 实际 ${r.code}`));
  }
  
  // 输出 JSON 报告
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: ok.length,
    warnings: warn.length,
    failed: fail.length,
    details: results.map(r => ({
      path: r.path,
      label: r.label,
      status: r.status,
      expected: r.expect,
      actual: r.code,
      error: r.error || null,
    })),
  };
  
  require('fs').writeFileSync(
    '/Users/apple/clawd/workspace/reports/link-check-report.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n📝 详细报告已保存: workspace/reports/link-check-report.json');
  
  return report;
}

runChecks().then(report => {
  process.exit(report.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('检验脚本执行失败:', err.message);
  process.exit(1);
});
