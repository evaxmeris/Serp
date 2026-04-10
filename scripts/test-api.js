#!/usr/bin/env node
/**
 * API 测试脚本 - 测试所有核心 API
 */

const https = require('http');

const BASE_URL = 'http://localhost:3000';

// 测试 API 列表
const apis = [
  '/api/health',
  '/api/products',
  '/api/customers',
  '/api/suppliers',
  '/api/orders',
  '/api/inventory',
];

async function testApi(endpoint) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            endpoint,
            status: res.statusCode,
            data: json,
            isArray: Array.isArray(json),
            length: Array.isArray(json) ? json.length : 0,
          });
        } catch (e) {
          resolve({
            endpoint,
            status: res.statusCode,
            error: '解析失败',
            raw: data.substring(0, 100),
          });
        }
      });
    }).on('error', (err) => {
      resolve({
        endpoint,
        error: err.message,
      });
    });
  });
}

async function main() {
  console.log('🧪 开始 API 测试...\n');
  
  const results = [];
  for (const api of apis) {
    const result = await testApi(api);
    results.push(result);
    
    const status = result.error ? '❌ 错误' : 
                   result.isArray ? `✅ 正常 (${result.length}条)` :
                   result.status === 200 ? '✅ 正常' : 
                   `⚠️ ${result.status}`;
    
    console.log(`${status.padEnd(20)} ${api}`);
    if (result.error && !result.isArray) {
      console.log(`   ${JSON.stringify(result.data || result.raw).substring(0, 80)}`);
    }
  }
  
  console.log('\n📊 测试完成');
  console.log(`总计：${results.length} 个 API`);
  console.log(`成功：${results.filter(r => r.isArray || r.status === 200).length}`);
  console.log(`失败：${results.filter(r => r.error).length}`);
}

main();
