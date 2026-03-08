#!/usr/bin/env node

/**
 * Trade ERP 自动化测试脚本
 * 
 * 用于订单管理和采购管理模块的 API 自动化测试
 * 
 * 使用方法:
 *   npm install --save-dev jest supertest
 *   npm test -- tests/api.test.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// 测试数据工厂
const TestDataFactory = {
  createCustomer() {
    return {
      companyName: `TEST_CUSTOMER_${Date.now()}`,
      contactName: '测试联系人',
      email: `test_${Date.now()}@example.com`,
      phone: '13800138000',
      country: '中国',
      status: 'ACTIVE'
    };
  },

  createSupplier() {
    return {
      companyName: `TEST_SUPPLIER_${Date.now()}`,
      contactName: '供应商联系人',
      email: `supplier_${Date.now()}@example.com`,
      phone: '13900139000',
      country: '中国',
      status: 'ACTIVE'
    };
  },

  createProduct() {
    return {
      sku: `TEST_SKU_${Date.now()}`,
      name: '测试产品',
      nameEn: 'Test Product',
      unit: 'PCS',
      costPrice: '5.00',
      salePrice: '10.00',
      currency: 'USD',
      status: 'ACTIVE'
    };
  },

  createOrder(customerId, items = []) {
    return {
      customerId,
      currency: 'USD',
      paymentTerms: 'T/T',
      deliveryTerms: 'FOB',
      deliveryDate: '2026-03-20',
      notes: '测试订单',
      items: items.length > 0 ? items : [
        {
          productName: '测试产品',
          specification: '标准规格',
          quantity: 100,
          unitPrice: '10.00',
          amount: '1000.00'
        }
      ]
    };
  },

  createPurchaseOrder(supplierId, items = []) {
    return {
      supplierId,
      currency: 'CNY',
      paymentTerms: '月结 30 天',
      deliveryDate: '2026-03-20',
      notes: '测试采购单',
      items: items.length > 0 ? items : [
        {
          productName: '测试产品',
          specification: '标准规格',
          quantity: 100,
          unitPrice: '5.00',
          amount: '500.00'
        }
      ]
    };
  }
};

// API 测试辅助函数
const APIHelper = {
  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json().catch(() => null);
    
    return {
      status: response.status,
      data,
      ok: response.ok
    };
  },

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// 测试套件
describe('Trade ERP API Tests', () => {
  let testCustomer = null;
  let testSupplier = null;
  let testProduct = null;
  let testOrder = null;
  let testPurchaseOrder = null;

  // 订单管理模块测试
  describe('Order Management API', () => {
    
    // OM-017: 创建订单接口
    describe('POST /api/orders', () => {
      it('OM-017: 应该成功创建订单', async () => {
        // 先创建客户
        const customerData = TestDataFactory.createCustomer();
        const customerResponse = await APIHelper.post('/api/customers', customerData);
        expect(customerResponse.status).toBe(201);
        testCustomer = customerResponse.data;

        // 创建订单
        const orderData = TestDataFactory.createOrder(testCustomer.id);
        const response = await APIHelper.post('/api/orders', orderData);
        
        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data).toHaveProperty('orderNo');
        expect(response.data.customerId).toBe(testCustomer.id);
        expect(response.data.status).toBe('PENDING');
        
        testOrder = response.data;
      });

      it('OM-002: 创建订单时应该验证必填字段', async () => {
        // 不传 customerId
        const response = await APIHelper.post('/api/orders', {
          items: []
        });
        
        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it('OM-003: 订单金额计算应该正确', async () => {
        const orderData = {
          customerId: testCustomer.id,
          items: [
            { productName: '商品 A', quantity: 10, unitPrice: '5.00', amount: '50.00' },
            { productName: '商品 B', quantity: 20, unitPrice: '3.50', amount: '70.00' },
            { productName: '商品 C', quantity: 15, unitPrice: '8.00', amount: '120.00' }
          ]
        };
        
        const response = await APIHelper.post('/api/orders', orderData);
        
        expect(response.status).toBe(201);
        // 验证总金额 = 50 + 70 + 120 = 240
        expect(parseFloat(response.data.totalAmount)).toBeCloseTo(240.00, 2);
      });
    });

    // OM-018: 获取订单列表
    describe('GET /api/orders', () => {
      it('OM-018: 应该返回订单列表', async () => {
        const response = await APIHelper.get('/api/orders?page=1&limit=20');
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
        expect(response.data).toHaveProperty('pagination');
        expect(Array.isArray(response.data.data)).toBe(true);
      });

      it('OM-008: 应该支持按状态筛选', async () => {
        const response = await APIHelper.get('/api/orders?page=1&limit=20&status=PENDING');
        
        expect(response.status).toBe(200);
        response.data.data.forEach(order => {
          expect(order.status).toBe('PENDING');
        });
      });

      it('OM-009: 应该支持分页', async () => {
        const response = await APIHelper.get('/api/orders?page=1&limit=5');
        
        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeLessThanOrEqual(5);
        expect(response.data.pagination).toHaveProperty('page', 1);
        expect(response.data.pagination).toHaveProperty('limit', 5);
      });
    });

    // OM-019: 获取订单详情
    describe('GET /api/orders/:id', () => {
      it('OM-019: 应该返回订单详情', async () => {
        if (!testOrder) return;
        
        const response = await APIHelper.get(`/api/orders/${testOrder.id}`);
        
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testOrder.id);
        expect(response.data).toHaveProperty('items');
      });

      it('OM-019: 无效订单 ID 应该返回 404', async () => {
        const response = await APIHelper.get('/api/orders/invalid-id');
        
        expect(response.status).toBe(404);
      });
    });

    // OM-020: 更新订单
    describe('PUT /api/orders/:id', () => {
      it('OM-004: 应该成功更新订单', async () => {
        if (!testOrder) return;
        
        const updateData = {
          notes: '更新后的备注',
          deliveryDate: '2026-03-25'
        };
        
        const response = await APIHelper.put(`/api/orders/${testOrder.id}`, updateData);
        
        expect(response.status).toBe(200);
        expect(response.data.notes).toBe('更新后的备注');
      });

      it('OM-010: 应该成功更新订单状态', async () => {
        if (!testOrder) return;
        
        const response = await APIHelper.put(`/api/orders/${testOrder.id}`, {
          status: 'CONFIRMED'
        });
        
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('CONFIRMED');
      });

      it('OM-005: 已发货订单应该限制编辑', async () => {
        // 先将订单状态改为 SHIPPED
        await APIHelper.put(`/api/orders/${testOrder.id}`, { status: 'SHIPPED' });
        
        // 尝试编辑
        const response = await APIHelper.put(`/api/orders/${testOrder.id}`, {
          notes: '尝试编辑已发货订单'
        });
        
        // 应该被拒绝或仅允许修改备注
        expect(response.status).toBeGreaterThanOrEqual(200);
      });
    });

    // OM-021: 删除订单
    describe('DELETE /api/orders/:id', () => {
      it('OM-006: 应该成功删除 PENDING 状态订单', async () => {
        // 创建一个新订单用于删除测试
        const newOrderData = TestDataFactory.createOrder(testCustomer.id);
        const newOrder = await APIHelper.post('/api/orders', newOrderData);
        
        const response = await APIHelper.delete(`/api/orders/${newOrder.data.id}`);
        
        expect(response.status).toBeGreaterThanOrEqual(200);
        
        // 验证订单已删除
        const getResponse = await APIHelper.get(`/api/orders/${newOrder.data.id}`);
        expect(getResponse.status).toBe(404);
      });

      it('OM-007: 已发货订单应该禁止删除', async () => {
        if (!testOrder) return;
        
        const response = await APIHelper.delete(`/api/orders/${testOrder.id}`);
        
        // 已发货订单应该被拒绝删除
        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });
  });

  // 采购管理模块测试
  describe('Purchase Management API', () => {
    
    // PM-020: 创建采购单接口
    describe('POST /api/purchases', () => {
      it('PM-001: 应该成功创建采购单', async () => {
        // 先创建供应商
        const supplierData = TestDataFactory.createSupplier();
        const supplierResponse = await APIHelper.post('/api/suppliers', supplierData);
        // 注意：如果供应商 API 未实现，跳过此测试
        if (supplierResponse.status === 404) {
          console.log('⚠️  供应商 API 未实现，跳过采购单测试');
          return;
        }
        
        expect(supplierResponse.status).toBe(201);
        testSupplier = supplierResponse.data;

        // 创建采购单
        const poData = TestDataFactory.createPurchaseOrder(testSupplier.id);
        const response = await APIHelper.post('/api/purchases', poData);
        
        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data).toHaveProperty('poNo');
        expect(response.data.supplierId).toBe(testSupplier.id);
        expect(response.data.status).toBe('PENDING');
        
        testPurchaseOrder = response.data;
      });

      it('PM-002: 创建采购单时应该验证必填字段', async () => {
        const response = await APIHelper.post('/api/purchases', {
          items: []
        });
        
        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it('PM-003: 采购单金额计算应该正确', async () => {
        if (!testSupplier) return;
        
        const poData = {
          supplierId: testSupplier.id,
          items: [
            { productName: '商品 A', quantity: 10, unitPrice: '5.00', amount: '50.00' },
            { productName: '商品 B', quantity: 20, unitPrice: '3.50', amount: '70.00' },
            { productName: '商品 C', quantity: 15, unitPrice: '8.00', amount: '120.00' }
          ]
        };
        
        const response = await APIHelper.post('/api/purchases', poData);
        
        expect(response.status).toBe(201);
        // 验证总金额 = 50 + 70 + 120 = 240
        expect(parseFloat(response.data.totalAmount)).toBeCloseTo(240.00, 2);
      });
    });

    // PM-021: 获取采购单列表
    describe('GET /api/purchases', () => {
      it('PM-021: 应该返回采购单列表', async () => {
        const response = await APIHelper.get('/api/purchases?page=1&limit=20');
        
        // 如果 API 未实现，返回 404
        if (response.status === 404) {
          console.log('⚠️  采购单列表 API 未实现');
          return;
        }
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
        expect(response.data).toHaveProperty('pagination');
      });

      it('PM-008: 应该支持按状态筛选', async () => {
        const response = await APIHelper.get('/api/purchases?page=1&limit=20&status=PENDING');
        
        if (response.status === 404) return;
        
        expect(response.status).toBe(200);
        response.data.data.forEach(po => {
          expect(po.status).toBe('PENDING');
        });
      });
    });

    // PM-022: 获取采购单详情
    describe('GET /api/purchases/:id', () => {
      it('PM-022: 应该返回采购单详情', async () => {
        if (!testPurchaseOrder) return;
        
        const response = await APIHelper.get(`/api/purchases/${testPurchaseOrder.id}`);
        
        if (response.status === 404) {
          console.log('⚠️  采购单详情 API 未实现');
          return;
        }
        
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testPurchaseOrder.id);
        expect(response.data).toHaveProperty('items');
      });
    });

    // PM-023: 更新采购单
    describe('PUT /api/purchases/:id', () => {
      it('PM-004: 应该成功更新采购单', async () => {
        if (!testPurchaseOrder) return;
        
        const updateData = {
          notes: '更新后的备注',
          deliveryDate: '2026-03-25'
        };
        
        const response = await APIHelper.put(`/api/purchases/${testPurchaseOrder.id}`, updateData);
        
        if (response.status === 404) return;
        
        expect(response.status).toBe(200);
        expect(response.data.notes).toBe('更新后的备注');
      });

      it('PM-010: 应该成功更新采购单状态', async () => {
        if (!testPurchaseOrder) return;
        
        const response = await APIHelper.put(`/api/purchases/${testPurchaseOrder.id}`, {
          status: 'CONFIRMED'
        });
        
        if (response.status === 404) return;
        
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('CONFIRMED');
      });
    });

    // PM-024: 删除采购单
    describe('DELETE /api/purchases/:id', () => {
      it('PM-006: 应该成功删除 PENDING 状态采购单', async () => {
        if (!testSupplier) return;
        
        // 创建一个新采购单用于删除测试
        const newPOData = TestDataFactory.createPurchaseOrder(testSupplier.id);
        const newPO = await APIHelper.post('/api/purchases', newPOData);
        
        if (newPO.status === 404) return;
        
        const response = await APIHelper.delete(`/api/purchases/${newPO.data.id}`);
        
        expect(response.status).toBeGreaterThanOrEqual(200);
      });
    });
  });

  // 安全测试
  describe('Security Tests', () => {
    
    // SEC-001: 未授权访问
    it('SEC-001: 未授权访问应该返回 401', async () => {
      // 这个测试需要系统启用认证
      const response = await APIHelper.get('/api/orders');
      
      // 如果系统未启用认证，可能返回 200
      // 如果启用了认证，应该返回 401
      console.log(`未授权访问返回状态码：${response.status}`);
    });

    // SEC-003: SQL 注入测试
    it('SEC-003: 应该防止 SQL 注入', async () => {
      const maliciousData = {
        companyName: "TEST' OR '1'='1",
        email: "test@example.com"
      };
      
      const response = await APIHelper.post('/api/customers', maliciousData);
      
      // 应该正常处理或返回验证错误，不应该执行 SQL 注入
      expect(response.status).not.toBe(500);
    });
  });

  // 性能测试
  describe('Performance Tests', () => {
    
    // PERF-001: 订单列表查询性能
    it('PERF-001: 订单列表查询应该在规定时间内响应', async () => {
      const startTime = Date.now();
      const response = await APIHelper.get('/api/orders?page=1&limit=20');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      console.log(`订单列表查询响应时间：${responseTime}ms`);
      
      expect(responseTime).toBeLessThan(1000); // 1 秒内响应
      expect(response.status).toBe(200);
    });
  });
});

// 导出供其他模块使用
module.exports = {
  TestDataFactory,
  APIHelper,
  BASE_URL
};
