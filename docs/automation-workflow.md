# Trade ERP 自动化测试流程

**文档版本:** v1.0  
**创建时间:** 2026-03-06  
**维护者:** QA Team

---

## 📋 目录

1. [自动化测试架构](#自动化测试架构)
2. [测试环境配置](#测试环境配置)
3. [测试执行流程](#测试执行流程)
4. [CI/CD 集成](#cicd-集成)
5. [测试报告生成](#测试报告生成)
6. [故障排查](#故障排查)

---

## 🏗️ 自动化测试架构

### 测试金字塔

```
                    /\
                   /  \
                  / E2E \       ← Playwright (10%)
                 /--------\
                /    API   \    ← Jest + Supertest (30%)
               /------------\
              /    Unit      \   ← Jest (60%)
             /----------------\
```

### 技术栈

```yaml
测试框架:
  - Jest: 单元测试和 API 测试
  - Playwright: E2E 测试
  - Supertest: API 请求测试

数据库:
  - PostgreSQL: 测试数据库
  - Prisma: ORM 和测试数据管理

CI/CD:
  - GitHub Actions: 持续集成
  - Docker: 容器化测试环境

报告:
  - Jest HTML Reporter: 测试报告
  - Allure: 测试可视化
```

---

## ⚙️ 测试环境配置

### 1. 安装依赖

```bash
cd /Users/apple/clawd/trade-erp

# 安装测试依赖
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev supertest @types/supertest
npm install --save-dev playwright @playwright/test
npm install --save-dev jest-html-reporter
```

### 2. 配置 Jest

创建 `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/components/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 30000,
  verbose: true
};
```

### 3. 配置 Playwright

创建 `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }]
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
```

### 4. 测试环境配置文件

创建 `tests/setup.js`:

```javascript
// 设置测试环境变量
process.env.TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/trade_erp_test';

// 设置全局超时
jest.setTimeout(30000);

// 全局 beforeAll 和 afterAll
beforeAll(async () => {
  console.log('🚀 开始测试套件');
});

afterAll(async () => {
  console.log('✅ 测试套件完成');
});
```

### 5. 测试数据库配置

创建 `prisma/test.seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种测试数据...');

  // 清理现有测试数据
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // 创建测试用户
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: '测试用户',
      passwordHash: 'hashed_password',
      role: 'USER'
    }
  });

  // 创建测试客户
  const testCustomer = await prisma.customer.create({
    data: {
      companyName: 'TEST_CUSTOMER_001',
      contactName: '测试联系人',
      email: 'test@customer.com',
      phone: '13800138000',
      country: '中国',
      status: 'ACTIVE'
    }
  });

  // 创建测试供应商
  const testSupplier = await prisma.supplier.create({
    data: {
      companyName: 'TEST_SUPPLIER_001',
      contactName: '供应商联系人',
      email: 'test@supplier.com',
      phone: '13900139000',
      country: '中国',
      status: 'ACTIVE'
    }
  });

  // 创建测试产品
  const testProduct = await prisma.product.create({
    data: {
      sku: 'TEST_PRODUCT_001',
      name: '测试产品',
      nameEn: 'Test Product',
      unit: 'PCS',
      costPrice: '5.00',
      salePrice: '10.00',
      currency: 'USD',
      status: 'ACTIVE'
    }
  });

  console.log('✅ 测试数据播种完成');
  console.log(`   - 用户：${testUser.id}`);
  console.log(`   - 客户：${testCustomer.id}`);
  console.log(`   - 供应商：${testSupplier.id}`);
  console.log(`   - 产品：${testProduct.id}`);
}

main()
  .catch((e) => {
    console.error('❌ 播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 🔄 测试执行流程

### 1. 本地测试流程

```bash
# 1. 准备测试环境
npm run db:test:setup

# 2. 运行单元测试
npm run test:unit

# 3. 运行 API 测试
npm run test:api

# 4. 运行 E2E 测试
npm run test:e2e

# 5. 生成测试报告
npm run test:report
```

### 2. package.json 脚本

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:api": "jest --testPathPattern=api",
    "test:e2e": "playwright test",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:report": "jest --coverage && open coverage/index.html",
    "db:test:setup": "npx prisma migrate reset --force && npx ts-node prisma/test.seed.ts",
    "db:test:clean": "npx ts-node prisma/test.clean.ts"
  }
}
```

### 3. 完整测试脚本

创建 `scripts/run-tests.sh`:

```bash
#!/bin/bash

set -e

echo "🚀 Trade ERP 自动化测试流程"
echo "=========================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查测试环境
echo -e "\n${YELLOW}1️⃣  检查测试环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL 已安装${NC}"

# 检查服务是否运行
echo -e "\n${YELLOW}2️⃣  检查服务状态...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 应用服务运行中${NC}"
else
    echo -e "${YELLOW}⚠️  应用服务未运行，启动开发服务器...${NC}"
    npm run dev &
    sleep 5
fi

# 准备测试数据库
echo -e "\n${YELLOW}3️⃣  准备测试数据库...${NC}"
export TEST_DATABASE_URL="postgresql://test:test@localhost:5432/trade_erp_test"
npx prisma migrate reset --force
npx ts-node prisma/test.seed.ts

# 运行单元测试
echo -e "\n${YELLOW}4️⃣  运行单元测试...${NC}"
npm run test:unit -- --passWithNoTests

# 运行 API 测试
echo -e "\n${YELLOW}5️⃣  运行 API 测试...${NC}"
npm run test:api

# 运行 E2E 测试
echo -e "\n${YELLOW}6️⃣  运行 E2E 测试...${NC}"
npm run test:e2e -- --reporter=html

# 生成测试报告
echo -e "\n${YELLOW}7️⃣  生成测试报告...${NC}"
npm run test:coverage

echo -e "\n${GREEN}✅ 所有测试完成！${NC}"
echo -e "📊 查看报告：open coverage/index.html"
echo -e "📊 查看 E2E 报告：npx playwright show-report"
```

### 4. 测试清理脚本

创建 `prisma/test.clean.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestData() {
  console.log('🧹 开始清理测试数据...');

  // 删除所有测试数据（按依赖关系倒序）
  await prisma.stockMovement.deleteMany({ where: { productId: { startsWith: 'TEST_' } } });
  await prisma.inventoryItem.deleteMany({ where: { productId: { startsWith: 'TEST_' } } });
  await prisma.payment.deleteMany({ where: { order: { customerId: { startsWith: 'TEST_' } } } });
  await prisma.shipment.deleteMany({ where: { order: { customerId: { startsWith: 'TEST_' } } } });
  await prisma.orderItem.deleteMany({ where: { order: { customerId: { startsWith: 'TEST_' } } } });
  await prisma.order.deleteMany({ where: { customerId: { startsWith: 'TEST_' } } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { supplierId: { startsWith: 'TEST_' } } } });
  await prisma.purchaseOrder.deleteMany({ where: { supplierId: { startsWith: 'TEST_' } } });
  await prisma.quotationItem.deleteMany({ where: { quotation: { customerId: { startsWith: 'TEST_' } } } });
  await prisma.quotation.deleteMany({ where: { customerId: { startsWith: 'TEST_' } } });
  await prisma.followUp.deleteMany({ where: { inquiry: { customerId: { startsWith: 'TEST_' } } } });
  await prisma.inquiry.deleteMany({ where: { customerId: { startsWith: 'TEST_' } } });
  await prisma.customerContact.deleteMany({ where: { customerId: { startsWith: 'TEST_' } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: 'TEST_' } } });
  await prisma.supplier.deleteMany({ where: { id: { startsWith: 'TEST_' } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: 'TEST_' } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'test_' } } });

  console.log('✅ 测试数据清理完成');
}

cleanTestData()
  .catch((e) => {
    console.error('❌ 清理失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 🔗 CI/CD 集成

### GitHub Actions 配置

创建 `.github/workflows/test.yml`:

```yaml
name: Trade ERP Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: trade_erp_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup database
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/trade_erp_test
      run: |
        npx prisma generate
        npx prisma migrate deploy
        npx ts-node prisma/test.seed.ts

    - name: Run unit tests
      run: npm run test:unit -- --coverage

    - name: Start application
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/trade_erp_test
      run: |
        npm run build &
        sleep 10

    - name: Run API tests
      env:
        TEST_BASE_URL: http://localhost:3000
        DATABASE_URL: postgresql://test:test@localhost:5432/trade_erp_test
      run: npm run test:api

    - name: Install Playwright browsers
      run: npx playwright install --with-deps

    - name: Run E2E tests
      env:
        TEST_BASE_URL: http://localhost:3000
      run: npm run test:e2e -- --reporter=list

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results-${{ matrix.node-version }}
        path: |
          coverage/
          playwright-report/
          test-results.json
```

### Docker 测试配置

创建 `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: trade_erp_test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 10s
      timeout: 5s
      retries: 5

  test-app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://test:test@test-db:5432/trade_erp_test
      TEST_BASE_URL: http://localhost:3000
    ports:
      - "3000:3000"
    depends_on:
      test-db:
        condition: service_healthy
    command: >
      sh -c "npx prisma migrate deploy && 
             npm run build && 
             npm start"

  test-runner:
    image: node:22-alpine
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      DATABASE_URL: postgresql://test:test@test-db:5432/trade_erp_test
      TEST_BASE_URL: http://test-app:3000
    depends_on:
      - test-app
    command: >
      sh -c "npm ci && 
             npm run test:api && 
             npm run test:e2e"
```

---

## 📊 测试报告生成

### 1. Jest HTML 报告配置

在 `jest.config.js` 中添加:

```javascript
module.exports = {
  // ... 其他配置
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'Trade ERP Test Report',
      outputPath: 'test-report/index.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      dateFormat: 'YYYY-MM-DD HH:mm:ss'
    }]
  ]
};
```

### 2. 自定义报告生成器

创建 `scripts/generate-report.js`:

```javascript
const fs = require('fs');
const path = require('path');

function generateReport(testResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.numTotalTestSuites,
      passed: testResults.numPassedTestSuites,
      failed: testResults.numFailedTestSuites,
      skipped: testResults.numPendingTestSuites
    },
    tests: []
  };

  testResults.testResults.forEach(suite => {
    suite.testResults.forEach(test => {
      report.tests.push({
        name: test.title,
        status: test.status,
        duration: test.duration,
        failureMessages: test.failureMessages
      });
    });
  });

  // 计算通过率
  const totalTests = testResults.numTotalTests;
  const passedTests = testResults.numPassedTests;
  report.summary.passRate = ((passedTests / totalTests) * 100).toFixed(2) + '%';

  // 保存报告
  const reportPath = path.join(__dirname, '../test-report/results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('✅ 测试报告已生成:', reportPath);
  console.log(`📊 通过率：${report.summary.passRate}`);
}

module.exports = { generateReport };
```

### 3. Markdown 报告模板

创建 `test-report/template.md`:

```markdown
# Trade ERP 测试报告

**测试时间:** {{timestamp}}
**测试版本:** {{version}}

## 📊 测试概览

| 指标 | 数值 |
|------|------|
| 总测试数 | {{total}} |
| 通过 | {{passed}} ✅ |
| 失败 | {{failed}} ❌ |
| 跳过 | {{skipped}} ⏭️ |
| 通过率 | {{passRate}} |

## 📋 详细结果

{{#tests}}
### {{name}}
- 状态：{{status}}
- 耗时：{{duration}}ms
{{#failureMessages}}
- 错误：{{.}}
{{/failureMessages}}

{{/tests}}

---
报告生成时间：{{generatedAt}}
```

---

## 🐛 故障排查

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查数据库服务
docker ps | grep postgres

# 检查数据库连接
psql -h localhost -U test -d trade_erp_test

# 重置数据库
npx prisma migrate reset --force
```

#### 2. 测试超时

```javascript
// 增加单个测试超时时间
jest.setTimeout(60000);

// 或在测试中指定
it('should complete within 60s', async () => {
  // ...
}, 60000);
```

#### 3. API 返回 404

```bash
# 检查服务是否运行
curl http://localhost:3000/api/health

# 检查 API 路由
ls -la src/app/api/

# 查看 Next.js 路由
npx next info
```

#### 4. E2E 测试失败

```bash
# 安装 Playwright 浏览器
npx playwright install

# 以有头模式运行（查看浏览器）
npm run test:e2e -- --headed

# 生成调试报告
npm run test:e2e -- --debug
```

### 日志收集

创建 `tests/logger.js`:

```javascript
const fs = require('fs');
const path = require('path');

class TestLogger {
  constructor(logFile = 'test.log') {
    this.logFile = path.join(__dirname, '..', logFile);
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(this.logFile, logLine);
    console.log(logLine.trim());
  }

  info(message) {
    this.log(message, 'INFO');
  }

  error(message) {
    this.log(message, 'ERROR');
  }

  warn(message) {
    this.log(message, 'WARN');
  }

  debug(message) {
    this.log(message, 'DEBUG');
  }
}

module.exports = new TestLogger();
```

---

## 📈 持续改进

### 测试指标跟踪

| 指标 | 当前值 | 目标值 | 频率 |
|------|--------|--------|------|
| 测试覆盖率 | 35% | 80% | 每周 |
| 测试通过率 | 60% | 95% | 每日 |
| 平均测试时间 | 5min | 3min | 每次提交 |
| Bug 逃逸率 | 未知 | <5% | 每月 |

### 改进计划

1. **第 1 周**: 完成订单和采购 API 测试
2. **第 2 周**: 添加 E2E 测试用例
3. **第 3 周**: 集成 CI/CD 流程
4. **第 4 周**: 达到 80% 测试覆盖率

---

**文档维护:** QA Team  
**最后更新:** 2026-03-06
