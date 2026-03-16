/**
 * 财务报表模块自动化测试
 * Sprint 6 - Financial Reports Module Tests
 * 
 * 测试覆盖：
 * - 10 个 API 端点
 * - 30 个 API 测试用例
 * - 5 个集成测试场景
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

// 测试配置
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// 测试数据
let authToken: string;
let testUserId: string;

/**
 * Financial Reports API 测试套件
 */
describe('Financial Reports API', () => {
  
  // 获取认证 Token（在所有测试之前）
  beforeAll(async () => {
    // TODO: 实现登录逻辑获取 token
    // const response = await request(BASE_URL)
    //   .post('/api/v1/auth/login')
    //   .send({ email: 'test@example.com', password: 'test123' });
    // authToken = response.body.token;
    authToken = 'test-token-placeholder';
  });

  /**
   * 利润报表 API 测试
   */
  describe('GET /api/v1/reports/profit', () => {
    
    it('应该成功获取利润报表数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/profit`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          period: 'month'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('costOfGoodsSold');
      expect(response.body.data).toHaveProperty('grossProfit');
      expect(response.body.data).toHaveProperty('netProfit');
    });

    it('应该验证必需的日期参数', async () => {
      // 测试缺少日期参数
      const response1 = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/profit`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(400);
      expect(response1.body.error).toContain('日期参数');

      // 测试只传开始日期
      const response2 = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/profit`)
        .query({ startDate: '2026-01-01' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain('日期参数');
    });

    it('应该正确计算毛利润和净利润', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/profit`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          period: 'month'
        })
        .set('Authorization', `Bearer ${authToken}`);

      const data = response.body.data;
      
      // 验证毛利润 = 收入 - 成本
      const expectedGrossProfit = data.revenue - data.costOfGoodsSold;
      expect(Math.abs(data.grossProfit - expectedGrossProfit)).toBeLessThan(0.01);

      // 验证净利润计算
      const expectedNetProfit = data.grossProfit - data.operatingExpenses.total - data.taxes;
      expect(Math.abs(data.netProfit - expectedNetProfit)).toBeLessThan(0.01);
    });
  });

  /**
   * 销售报表 API 测试
   */
  describe('GET /api/v1/reports/sales', () => {
    
    it('应该成功获取销售报表数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/sales`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          period: 'month',
          groupBy: 'category'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('totalRevenue');
      expect(response.body.data.summary).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('groupedData');
    });

    it('应该验证日期范围参数', async () => {
      // 测试 endDate 早于 startDate
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/sales`)
        .query({
          startDate: '2026-01-31',
          endDate: '2026-01-01'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('日期');
    });

    it('应该支持按不同维度分组', async () => {
      const groupByOptions = ['customer', 'product', 'category', 'salesRep'];
      
      for (const groupBy of groupByOptions) {
        const response = await request(BASE_URL)
          .get(`${API_PREFIX}/reports/sales`)
          .query({
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            groupBy: groupBy
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.groupedData).toBeDefined();
      }
    });
  });

  /**
   * 库存报表 API 测试
   */
  describe('GET /api/v1/reports/inventory', () => {
    
    it('应该成功获取库存报表数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/inventory`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('totalItems');
      expect(response.body.data.summary).toHaveProperty('totalQuantity');
      expect(response.body.data.summary).toHaveProperty('totalValue');
    });

    it('应该支持低库存筛选', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/inventory`)
        .query({ lowStock: true })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // 所有返回的库存项都应该是低库存
      response.body.data.items.forEach((item: any) => {
        expect(item.quantity).toBeLessThanOrEqual(item.safetyStock);
      });
    });

    it('应该包含库龄分析数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/inventory`)
        .query({ includeAging: true })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('aging');
      expect(response.body.data.aging).toHaveProperty('0-30');
      expect(response.body.data.aging).toHaveProperty('31-60');
      expect(response.body.data.aging).toHaveProperty('61-90');
      expect(response.body.data.aging).toHaveProperty('90+');
    });
  });

  /**
   * 现金流量报表 API 测试
   */
  describe('GET /api/v1/reports/cashflow', () => {
    
    it('应该成功获取现金流量报表数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/cashflow`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('operatingActivities');
      expect(response.body.data).toHaveProperty('investingActivities');
      expect(response.body.data).toHaveProperty('financingActivities');
    });

    it('应该验证现金流量计算', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/cashflow`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      const data = response.body.data;
      const netCashFlow = data.operatingActivities.net + 
                         data.investingActivities.net + 
                         data.financingActivities.net;
      
      expect(Math.abs(data.netCashFlow - netCashFlow)).toBeLessThan(0.01);
    });

    it('应该支持按期间筛选', async () => {
      const periods = [
        { start: '2026-01-01', end: '2026-01-31' },
        { start: '2026-01-01', end: '2026-03-31' },
        { start: '2026-01-01', end: '2026-12-31' }
      ];

      for (const period of periods) {
        const response = await request(BASE_URL)
          .get(`${API_PREFIX}/reports/cashflow`)
          .query(period)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.period.start).toBe(period.start);
        expect(response.body.data.period.end).toBe(period.end);
      }
    });
  });

  /**
   * 采购报表 API 测试
   */
  describe('GET /api/v1/reports/purchase', () => {
    
    it('应该成功获取采购报表数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/purchase`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('totalAmount');
      expect(response.body.data.summary).toHaveProperty('totalOrders');
    });

    it('应该支持按供应商分组', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/purchase`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          groupBy: 'supplier'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bySupplier).toBeDefined();
    });

    it('应该验证权限控制', async () => {
      // 使用无权限 token 测试
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/purchase`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });

  /**
   * 仪表盘 API 测试
   */
  describe('GET /api/v1/reports/dashboard', () => {
    
    it('应该成功获取仪表盘数据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/dashboard`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('charts');
      expect(response.body.data).toHaveProperty('alerts');
    });

    it('应该包含关键业务指标', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/dashboard`)
        .set('Authorization', `Bearer ${authToken}`);

      const metrics = response.body.data.metrics;
      expect(metrics).toHaveProperty('revenue');
      expect(metrics).toHaveProperty('profit');
      expect(metrics).toHaveProperty('orders');
      expect(metrics).toHaveProperty('customers');
    });

    it('应该在规定时间内响应', async () => {
      const startTime = Date.now();
      
      await request(BASE_URL)
        .get(`${API_PREFIX}/reports/dashboard`)
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 1 秒内响应
    });
  });

  /**
   * 报表导出 API 测试
   */
  describe('POST /api/v1/reports/export', () => {
    
    it('应该成功导出 Excel 报表', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/export`)
        .send({
          reportType: 'sales',
          format: 'excel',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('downloadUrl');
      // 验证 URL 格式
      expect(response.body.downloadUrl).toMatch(/^\/downloads\//);
    });

    it('应该支持 PDF 格式导出', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/export`)
        .send({
          reportType: 'profit',
          format: 'pdf',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('downloadUrl');
    });

    it('应该验证报表类型参数', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/export`)
        .send({
          reportType: 'invalid-type',
          format: 'excel'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('报表类型');
    });
  });

  /**
   * 报表订阅 API 测试
   */
  describe('报表订阅管理', () => {
    
    it('应该成功创建报表订阅', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/subscribe`)
        .send({
          reportType: 'sales',
          frequency: 'weekly',
          email: 'test@example.com',
          dayOfWeek: 1,
          hour: 8
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.reportType).toBe('sales');
      expect(response.body.data.frequency).toBe('weekly');
    });

    it('应该获取订阅列表', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/subscribe`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('应该成功取消订阅', async () => {
      // 先创建订阅
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/subscribe`)
        .send({
          reportType: 'profit',
          frequency: 'monthly',
          email: 'test@example.com'
        })
        .set('Authorization', `Bearer ${authToken}`);

      const subscriptionId = createResponse.body.data.id;

      // 删除订阅
      const deleteResponse = await request(BASE_URL)
        .delete(`${API_PREFIX}/reports/subscribe/${subscriptionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);
    });
  });

  /**
   * 报表定时任务 API 测试
   */
  describe('报表定时任务管理', () => {
    
    it('应该成功创建定时任务', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/schedule`)
        .send({
          reportType: 'sales',
          cron: '0 8 * * 1',
          action: 'email',
          recipients: ['test@example.com']
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.cron).toBe('0 8 * * 1');
    });

    it('应该验证 cron 表达式', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/schedule`)
        .send({
          reportType: 'sales',
          cron: 'invalid-cron',
          action: 'email'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('cron');
    });

    it('应该获取定时任务列表', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/schedule`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  /**
   * 自定义报表 API 测试
   */
  describe('自定义报表管理', () => {
    
    it('应该成功创建自定义报表', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/custom`)
        .send({
          name: '我的自定义报表',
          description: '测试自定义报表',
          metrics: ['revenue', 'profit', 'orders'],
          dimensions: ['category', 'date'],
          filters: []
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('我的自定义报表');
    });

    it('应该获取自定义报表数据', async () => {
      // 先创建
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/custom`)
        .send({
          name: '测试报表',
          metrics: ['revenue'],
          dimensions: ['category']
        })
        .set('Authorization', `Bearer ${authToken}`);

      const reportId = createResponse.body.data.id;

      // 获取数据
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/custom/${reportId}`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('应该更新自定义报表配置', async () => {
      // 先创建
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/custom`)
        .send({
          name: '待更新报表',
          metrics: ['revenue'],
          dimensions: ['category']
        })
        .set('Authorization', `Bearer ${authToken}`);

      const reportId = createResponse.body.data.id;

      // 更新
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/reports/custom/${reportId}`)
        .send({
          name: '已更新报表',
          metrics: ['revenue', 'profit']
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('已更新报表');
    });
  });
});

/**
 * 集成测试套件
 */
describe('Financial Reports Integration Tests', () => {
  
  /**
   * 利润报表数据准确性集成测试
   */
  describe('利润报表数据准确性', () => {
    
    it('应该正确计算毛利润', async () => {
      // 获取报表数据
      const reportResponse = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/profit`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      const reportData = reportResponse.body.data;
      
      // 验证毛利润计算
      const expectedGrossProfit = reportData.revenue - reportData.costOfGoodsSold;
      expect(Math.abs(reportData.grossProfit - expectedGrossProfit)).toBeLessThan(0.01);
    });

    it('应该正确计算净利润', async () => {
      const reportResponse = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/profit`)
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      const data = reportResponse.body.data;
      
      // 净利润 = 毛利润 - 运营费用 - 税费
      const expectedNetProfit = data.grossProfit - data.operatingExpenses.total - data.taxes;
      expect(Math.abs(data.netProfit - expectedNetProfit)).toBeLessThan(0.01);
    });
  });

  /**
   * 销售报表同比环比计算集成测试
   */
  describe('销售报表同比环比计算', () => {
    
    it('应该正确计算同比增长率', async () => {
      // 获取本期数据
      const currentResponse = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/sales`)
        .query({
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          compare: true
        })
        .set('Authorization', `Bearer ${authToken}`);

      const currentData = currentResponse.body.data;
      
      // 验证同比增长率计算
      if (currentData.compare && currentData.compare.previousYear) {
        const expectedGrowth = (currentData.summary.totalRevenue - currentData.compare.previousYear.totalRevenue) / 
                               currentData.compare.previousYear.totalRevenue * 100;
        expect(Math.abs(currentData.growth.yoy - expectedGrowth)).toBeLessThan(0.01);
      }
    });

    it('应该正确计算环比增长率', async () => {
      const currentResponse = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/sales`)
        .query({
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          compare: true
        })
        .set('Authorization', `Bearer ${authToken}`);

      const currentData = currentResponse.body.data;
      
      // 验证环比增长率计算
      if (currentData.compare && currentData.compare.previousPeriod) {
        const expectedGrowth = (currentData.summary.totalRevenue - currentData.compare.previousPeriod.totalRevenue) / 
                               currentData.compare.previousPeriod.totalRevenue * 100;
        expect(Math.abs(currentData.growth.mom - expectedGrowth)).toBeLessThan(0.01);
      }
    });
  });

  /**
   * 库存报表库龄分析集成测试
   */
  describe('库存报表库龄分析', () => {
    
    it('应该正确计算库龄分布', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/inventory`)
        .query({ includeAging: true })
        .set('Authorization', `Bearer ${authToken}`);

      const aging = response.body.data.aging;
      
      // 验证各库龄段之和等于总库存
      const totalFromAging = aging['0-30'] + aging['31-60'] + aging['61-90'] + aging['90+'];
      expect(Math.abs(totalFromAging - response.body.data.summary.totalQuantity)).toBeLessThan(1);
    });
  });

  /**
   * 报表导出功能集成测试
   */
  describe('报表导出功能', () => {
    
    it('应该导出完整的 Excel 文件', async () => {
      const exportResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/export`)
        .send({
          reportType: 'sales',
          format: 'excel',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body.downloadUrl).toBeDefined();

      // 验证下载 URL 可访问
      const downloadResponse = await request(BASE_URL)
        .get(exportResponse.body.downloadUrl)
        .set('Authorization', `Bearer ${authToken}`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.type).toContain('excel');
    });
  });

  /**
   * 报表订阅功能集成测试
   */
  describe('报表订阅功能', () => {
    
    it('应该创建并执行订阅任务', async () => {
      // 创建订阅
      const subscribeResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/reports/subscribe`)
        .send({
          reportType: 'sales',
          frequency: 'daily',
          email: 'test@example.com',
          hour: 8
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(subscribeResponse.status).toBe(201);
      const subscriptionId = subscribeResponse.body.data.id;

      // 验证订阅已创建
      const listResponse = await request(BASE_URL)
        .get(`${API_PREFIX}/reports/subscribe`)
        .set('Authorization', `Bearer ${authToken}`);

      const subscriptions = listResponse.body.data;
      const found = subscriptions.find((s: any) => s.id === subscriptionId);
      expect(found).toBeDefined();

      // 清理：删除订阅
      await request(BASE_URL)
        .delete(`${API_PREFIX}/reports/subscribe/${subscriptionId}`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });
});
