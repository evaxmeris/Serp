// Simple API performance tester
// Tests each API endpoint and measures response time

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const CONCURRENCY = 10;
const DURATION = 5; // seconds

const TEST_CREDENTIALS = {
  email: 'admin@trade-erp.com',
  password: 'Admin123!'
};

// Original requested core endpoints
const endpoints = [
  '/api/products',
  '/api/customers',
  '/api/suppliers',
  '/api/orders',
  '/api/v1/inventory',
  '/api/dashboard/overview'
];

let authCookie = null;

function login() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const body = JSON.stringify(TEST_CREDENTIALS);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        // Extract cookie from headers
        let cookies = res.headers['set-cookie'];
        if (cookies) {
          // Handle the case where it's a single string (not array)
          if (!Array.isArray(cookies)) {
            cookies = [cookies];
          }
          // Get the auth-token cookie
          const authCookieStr = cookies.find(c => c.startsWith('auth-token='));
          if (authCookieStr) {
            // Send the full cookie string including attributes
            // Because we just need the name=value part, but keeping full string works too
            authCookie = authCookieStr.split(';')[0];
            console.log(`  Extracted cookie: ${authCookie.substring(0, 50)}...`);
          }
        }
        
        try {
          const json = JSON.parse(data);
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300 && json.success,
            statusCode: res.statusCode,
            responseTime: endTime - startTime,
            data: json
          });
        } catch (e) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            responseTime: endTime - startTime,
            error: 'Invalid JSON response'
          });
        }
      });
    });
    
    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });
    
    req.write(body);
    req.end();
  });
}

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': authCookie,
        'Host': 'localhost:3000'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        resolve({
          path,
          statusCode: res.statusCode,
          responseTime,
          contentLength: data.length,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        path,
        error: err.message,
        success: false
      });
    });
    
    req.end();
  });
}

async function runBenchmark(path, iterations = 10) {
  console.log(`Testing ${path}...`);
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const result = await testEndpoint(path);
    if (result.success) {
      results.push(result.responseTime);
    } else {
      console.log(`  Failed: ${result.error || `Status ${result.statusCode}`}`);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (results.length === 0) {
    return {
      path,
      success: false,
      error: 'All requests failed'
    };
  }
  
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  const p95 = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];
  
  return {
    path,
    success: true,
    iterations: results.length,
    average: Math.round(avg),
    min,
    max,
    p95: p95 || max
  };
}

async function main() {
  console.log('=' .repeat(60));
  console.log(`Trade ERP API Performance Test v0.7.0`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('=' .repeat(60));
  console.log();
  
  // Login first to get auth cookie
  console.log('🔐 Logging in as test user...');
  const loginResult = await login();
  if (!loginResult.success) {
    console.log(`✗ Login failed: ${loginResult.error || `Status ${loginResult.statusCode}`}`);
    console.log();
  } else {
    console.log(`✓ Login successful in ${loginResult.responseTime}ms`);
    console.log();
  }
  
  const allResults = [];
  
  for (const endpoint of endpoints) {
    const result = await runBenchmark(endpoint, 10);
    allResults.push(result);
    if (result.success) {
      console.log(`  ✓ ${result.path}: avg=${result.average}ms min=${result.min}ms max=${result.max}ms p95=${result.p95}ms`);
    } else {
      console.log(`  ✗ ${result.path}: FAILED - ${result.error}`);
    }
    console.log();
  }
  
  console.log('=' .repeat(60));
  console.log('SUMMARY');
  console.log('=' .repeat(60));
  
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  const slow = successful.filter(r => r.average > 500);
  
  console.log(`Total endpoints tested: ${allResults.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Slow endpoints (>500ms avg): ${slow.length}`);
  console.log();
  
  if (slow.length > 0) {
    console.log('Slow endpoints:');
    slow.forEach(r => console.log(`  - ${r.path}: ${r.average}ms`));
  }
  
  // Output markdown for report
  const report = generateMarkdownReport(allResults, {
    baseUrl: BASE_URL,
    date: new Date().toISOString(),
    version: 'v0.7.0'
  });
  
  require('fs').writeFileSync('/Users/apple/clawd/trade-erp/docs/performance-test-v0.7.0.md', report);
  console.log(`\nReport saved to: /Users/apple/clawd/trade-erp/docs/performance-test-v0.7.0.md`);
}

function generateMarkdownReport(results, metadata) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const slow = successful.filter(r => r.average > 500);
  
  let md = `# Trade ERP API Performance Test Report\n\n`;
  md += `**Version:** ${metadata.version}  \n`;
  md += `**Test Date:** ${new Date(metadata.date).toLocaleString('zh-CN')}  \n`;
  md += `**Base URL:** ${metadata.baseUrl}  \n\n`;
  
  md += `## Summary\n\n`;
  md += `- **Total endpoints tested:** ${results.length}  \n`;
  md += `- **Successful:** ${successful.length}  \n`;
  md += `- **Failed:** ${failed.length}  \n`;
  md += `- **Slow endpoints (>500ms avg):** ${slow.length}  \n\n`;
  
  if (successful.length > 0) {
    md += `## Results by Endpoint\n\n`;
    md += `| Endpoint | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Status |\n`;
    md += `|----------|----------|----------|----------|----------|--------|\n`;
    
    results.forEach(r => {
      if (r.success) {
        const status = r.average > 500 ? '⚠️ Slow' : '✅ OK';
        md += `| ${r.path} | ${r.average} | ${r.min} | ${r.max} | ${r.p95} | ${status} |\n`;
      } else {
        md += `| ${r.path} | - | - | - | - | ❌ Failed: ${r.error} |\n`;
      }
    });
    md += '\n';
  }
  
  if (failed.length > 0) {
    md += `## Failed Endpoints\n\n`;
    failed.forEach(r => {
      md += `- **${r.path}**: ${r.error}\n`;
    });
    md += '\n';
  }
  
  if (slow.length > 0) {
    md += `## Slow Endpoints (>500ms)\n\n`;
    slow.forEach(r => {
      md += `- **${r.path}**: Average ${r.average}ms (P95 ${r.p95}ms)\n`;
    });
    md += '\n';
  }
  
  md += `## Optimization Recommendations\n\n`;
  
  if (slow.length === 0) {
    md += `✅ All endpoints respond in under 500ms. No immediate optimization needed.\n\n`;
  } else {
    slow.forEach(r => {
      md += `### ${r.path} (${r.average}ms avg)\n\n`;
      
      if (r.path.includes('dashboard')) {
        md += `- Dashboard typically aggregates data from multiple tables\n`;
        md += `- **Recommendations:**\n`;
        md += `  1. Add database indexes for common aggregations\n`;
        md += `  2. Implement caching for frequently accessed dashboard data\n`;
        md += `  3. Consider pre-calculating and storing aggregates\n`;
        md += `  4. Add pagination or limit data if returning too many records\n\n`;
      } else if (r.path.includes('orders')) {
        md += `- Orders table can grow large quickly\n`;
        md += `- **Recommendations:**\n`;
        md += `  1. Add composite indexes on commonly queried fields (status, date, customerId)\n`;
        md += `  2. Implement pagination to reduce data transfer\n`;
        md += `  3. Consider adding server-side filtering to reduce result set size\n\n`;
      } else if (r.path.includes('inventory')) {
        md += `- Inventory queries often involve joins with products\n`;
        md += `- **Recommendations:**\n`;
        md += `  1. Add foreign key indexes\n`;
        md += `  2. Consider denormalizing frequently accessed product data\n`;
        md += `  3. Add caching for stock level queries that don't change constantly\n\n`;
      } else if (r.path.includes('products')) {
        md += `- Products may have large images or many related records\n`;
        md += `- **Recommendations:**\n`;
        md += `  1. Implement pagination\n`;
        md += `  2. Consider using selective field queries to avoid fetching large text fields\n`;
        md += `  3. Add full-text search indexes if searching by name/description\n\n`;
      } else {
        md += `- **General Recommendations:**\n`;
        md += `  1. Check for missing database indexes\n`;
        md += `  2. Consider adding response caching\n`;
        md += `  3. Check for N+1 query problems with ORM\n`;
        md += `  4. Enable query logging to identify slow database queries\n\n`;
      }
    });
  }
  
  md += `## General Recommendations\n\n`;
  md += `1. **Database Optimization:**\n`;
  md += `   - Enable query logging in Prisma to identify slow queries\n`;
  md += `   - Add missing indexes based on query patterns\n`;
  md += `   - Consider connection pooling optimization\n\n`;
  md += `2. **Caching:**\n`;
  md += `   - Add Redis or in-memory caching for read-heavy endpoints\n`;
  md += `   - Cache static data like product categories, suppliers\n\n`;
  md += `3. **Infrastructure:**\n`;
  md += `   - Ensure database is on the same network/region as the app\n`;
  md += `   - Consider connection pooling tuning in Prisma\n`;
  md += `   - For production, use a reverse proxy like Nginx in front of the app\n\n`;
  
  md += `---\n`;
  md += `*Generated automatically by performance tester*\n`;
  
  return md;
}

main().catch(console.error);
