/**
 * 订单管理 API 单元测试
 * 
 * 测试覆盖:
 * - GET /api/orders - 获取订单列表
 * - POST /api/orders - 创建订单
 * - GET /api/orders/[id] - 获取订单详情
 * - PUT /api/orders/[id] - 更新订单
 * - DELETE /api/orders/[id] - 删除订单
 * - POST /api/orders/[id]/confirm - 确认订单
 * - POST /api/orders/[id]/cancel - 取消订单
 * - 订单状态流转
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/orders/route';
import { GET as GET_BY_ID, PUT, DELETE as DELETE_BY_ID, POST as POST_ACTION } from '@/app/api/orders/[id]/route';

// Mock NextRequest
function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const urlObj = new URL(fullUrl);
  const searchParams = urlObj.searchParams;
  
  return {
    url: fullUrl,
    nextUrl: {
      searchParams,
      pathname: urlObj.pathname,
      href: urlObj.href,
      origin: urlObj.origin,
    } as any,
    method,
    json: async () => body,
  } as NextRequest;
}

// Mock params
function createMockParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('Orders API', () => {
  let createdCustomerId: string;
  let createdProductId: string;
  let createdOrderId: string;
  let testOrderData: any;

  // 创建测试客户和产品
  beforeAll(async () => {
    // 创建测试客户
    const customer = await prisma.customer.create({
      data: {
        companyName: `测试客户_订单_${Date.now()}`,
        contactName: '张三',
        email: `order_test_${Date.now()}@example.com`,
        phone: '021-12345678',
        country: 'CN',
        address: '上海市浦东新区',
      },
    });
    createdCustomerId = customer.id;

    // 创建测试产品
    const product = await prisma.product.create({
      data: {
        sku: `PROD_ORDER_${Date.now()}`,
        name: '测试产品',
        specification: '标准规格',
        category: '测试类目',
        unit: 'PCS',
        costPrice: 50,
        salePrice: 100,
      },
    });
    createdProductId = product.id;
  });

  beforeEach(() => {
    testOrderData = {
      customerId: createdCustomerId,
      currency: 'USD',
      exchangeRate: 1,
      paymentTerms: 'T/T 30% deposit',
      deliveryTerms: 'FOB Shanghai',
      deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      shippingAddress: '上海市浦东新区测试路 1 号',
      shippingContact: '张三',
      shippingPhone: '021-12345678',
      notes: '测试订单',
      items: [
        {
          productId: createdProductId,
          quantity: 100,
          unitPrice: 100,
          discountRate: 0,
        },
        {
          productId: createdProductId,
          quantity: 50,
          unitPrice: 150,
          discountRate: 10,
        },
      ],
    };
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdOrderId) {
      await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => {});
    }
    if (createdProductId) {
      await prisma.product.delete({ where: { id: createdProductId } }).catch(() => {});
    }
    if (createdCustomerId) {
      await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/orders - 创建订单', () => {
    it('应该成功创建订单', async () => {
      const request = createMockRequest('/api/orders', 'POST', testOrderData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('orderNo');
      expect(result.data.orderNo).toMatch(/^SO-\d{8}-\d{3}$/);
      expect(result.data.status).toBe('PENDING');
      expect(result.data.totalAmount).toBe(16750); // 100*100 + 50*150*0.9
      expect(result.data.itemCount).toBe(2);

      createdOrderId = result.data.id;
    });

    it('应该验证必填字段 customerId', async () => {
      const invalidData = { ...testOrderData, customerId: '' };
      const request = createMockRequest('/api/orders', 'POST', invalidData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.success).toBe(false);
      expect(result.errors || result.data).toBeTruthy();
    });

    it('应该验证必填字段 items', async () => {
      const invalidData = { ...testOrderData, items: [] };
      const request = createMockRequest('/api/orders', 'POST', invalidData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.success).toBe(false);
    });

    it('应该验证客户存在', async () => {
      const invalidData = { ...testOrderData, customerId: 'clxxx123456789' };
      const request = createMockRequest('/api/orders', 'POST', invalidData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });

    it('应该验证交货日期必须晚于当前日期', async () => {
      const invalidData = { ...testOrderData, deliveryDate: new Date().toISOString() };
      const request = createMockRequest('/api/orders', 'POST', invalidData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);
    });

    it('应该允许可选字段为空', async () => {
      const minimalData = {
        customerId: createdCustomerId,
        items: [
          {
            productId: createdProductId,
            quantity: 10,
            unitPrice: 50,
          },
        ],
      };
      const request = createMockRequest('/api/orders', 'POST', minimalData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.data).toHaveProperty('id');

      // 清理
      await prisma.order.delete({ where: { id: result.data.id } }).catch(() => {});
    });

    it('应该正确计算带折扣的总金额', async () => {
      const discountData = {
        customerId: createdCustomerId,
        items: [
          {
            productId: createdProductId,
            quantity: 100,
            unitPrice: 100,
            discountRate: 20,
          },
        ],
      };
      const request = createMockRequest('/api/orders', 'POST', discountData);
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.data.totalAmount).toBe(8000); // 100 * 100 * 0.8

      // 清理
      await prisma.order.delete({ where: { id: result.data.id } }).catch(() => {});
    });
  });

  describe('GET /api/orders - 获取订单列表', () => {
    it('应该获取订单列表', async () => {
      const request = createMockRequest('/api/orders?page=1&limit=10');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('items');
      expect(result.data).toHaveProperty('pagination');
      expect(result.data.pagination).toHaveProperty('page');
      expect(result.data.pagination).toHaveProperty('limit');
      expect(result.data.pagination).toHaveProperty('total');
      expect(result.data.pagination).toHaveProperty('totalPages');
    });

    it('应该支持按状态筛选', async () => {
      const request = createMockRequest('/api/orders?page=1&limit=10&status=PENDING');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result.data.items)).toBe(true);
      result.data.items.forEach((order: any) => {
        expect(order.status).toBe('PENDING');
      });
    });

    it('应该支持按客户筛选', async () => {
      const request = createMockRequest(`/api/orders?page=1&limit=10&customerId=${createdCustomerId}`);
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it('应该支持搜索查询 - 订单号', async () => {
      const request = createMockRequest('/api/orders?page=1&limit=10&search=SO-');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it('应该支持搜索查询 - 客户名', async () => {
      const request = createMockRequest('/api/orders?page=1&limit=10&search=测试客户');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it('应该支持分页参数', async () => {
      const request = createMockRequest('/api/orders?page=1&limit=5');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.pagination.limit).toBe(5);
      expect(result.data.pagination.page).toBe(1);
    });

    it('应该包含客户和订单项信息', async () => {
      const request = createMockRequest('/api/orders?page=1&limit=1');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      if (result.data.items.length > 0) {
        expect(result.data.items[0]).toHaveProperty('customer');
        expect(result.data.items[0].customer).toHaveProperty('companyName');
        expect(result.data.items[0]).toHaveProperty('itemCount');
        expect(result.data.items[0]).toHaveProperty('paymentCount');
        expect(result.data.items[0]).toHaveProperty('shipmentCount');
      }
    });

    it('应该支持日期范围筛选', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();
      const request = createMockRequest(`/api/orders?page=1&limit=10&startDate=${startDate}&endDate=${endDate}`);
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result.data.items)).toBe(true);
    });
  });

  describe('GET /api/orders/[id] - 获取订单详情', () => {
    it('应该获取订单详情', async () => {
      if (!createdOrderId) return;

      const request = createMockRequest(`/api/orders/${createdOrderId}`);
      const response = await GET_BY_ID(request, createMockParams(createdOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(createdOrderId);
      expect(result.data).toHaveProperty('orderNo');
      expect(result.data).toHaveProperty('customer');
      expect(result.data).toHaveProperty('items');
      expect(result.data).toHaveProperty('payments');
      expect(result.data).toHaveProperty('shipments');
      expect(result.data).toHaveProperty('productionRecords');
      expect(result.data).toHaveProperty('qualityChecks');
    });

    it('应该返回 404 当订单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/orders/${fakeId}`);
      const response = await GET_BY_ID(request, createMockParams(fakeId));
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });

    it('应该包含完整的订单项信息', async () => {
      if (!createdOrderId) return;

      const request = createMockRequest(`/api/orders/${createdOrderId}`);
      const response = await GET_BY_ID(request, createMockParams(createdOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.items.length).toBeGreaterThan(0);
      expect(result.data.items[0]).toHaveProperty('productName');
      expect(result.data.items[0]).toHaveProperty('quantity');
      expect(result.data.items[0]).toHaveProperty('unitPrice');
      expect(result.data.items[0]).toHaveProperty('productionStatus');
    });
  });

  describe('PUT /api/orders/[id] - 更新订单', () => {
    it('应该更新订单信息', async () => {
      if (!createdOrderId) return;

      const updateData = {
        notes: '更新后的备注',
        shippingAddress: '上海市浦东新区更新路 2 号',
      };

      const request = createMockRequest(
        `/api/orders/${createdOrderId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(createdOrderId);
    });

    it('应该返回 404 当订单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/orders/${fakeId}`, 'PUT', {
        notes: '测试',
      });
      const response = await PUT(request, createMockParams(fakeId));
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });

    it('应该验证交货日期', async () => {
      if (!createdOrderId) return;

      const updateData = {
        deliveryDate: new Date().toISOString(),
      };
      const request = createMockRequest(
        `/api/orders/${createdOrderId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdOrderId));
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);
    });
  });

  describe('DELETE /api/orders/[id] - 删除订单', () => {
    it('应该删除 PENDING 状态的订单', async () => {
      // 创建一个专门用于删除测试的订单
      const testOrder = await prisma.order.create({
        data: {
          orderNo: `SO-TEST-${Date.now()}`,
          customerId: createdCustomerId,
          status: 'PENDING',
          currency: 'USD',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          items: {
            create: {
              productId: createdProductId,
              productName: '测试产品',
              quantity: 10,
              unitPrice: 100,
              amount: 1000,
            },
          },
        },
      });

      const request = createMockRequest(`/api/orders/${testOrder.id}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(testOrder.id));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // 验证已删除
      const deleted = await prisma.order.findUnique({
        where: { id: testOrder.id },
      });
      expect(deleted).toBeNull();
    });

    it('应该返回冲突当订单不是 PENDING 状态', async () => {
      if (!createdOrderId) return;

      // 先确认订单，使其状态变为 CONFIRMED
      await prisma.order.update({
        where: { id: createdOrderId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });

      const request = createMockRequest(`/api/orders/${createdOrderId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(createdOrderId));
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);

      // 恢复状态
      await prisma.order.update({
        where: { id: createdOrderId },
        data: { status: 'PENDING', confirmedAt: null },
      });
    });

    it('应该返回 404 当订单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/orders/${fakeId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(fakeId));
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/orders/[id]/confirm - 确认订单', () => {
    let pendingOrderId: string;

    beforeEach(async () => {
      // 创建一个待确认的订单
      const order = await prisma.order.create({
        data: {
          orderNo: `SO-CONFIRM-${Date.now()}`,
          customerId: createdCustomerId,
          status: 'PENDING',
          currency: 'USD',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          items: {
            create: {
              productId: createdProductId,
              productName: '测试产品',
              quantity: 10,
              unitPrice: 100,
              amount: 1000,
            },
          },
        },
      });
      pendingOrderId = order.id;
    });

    afterEach(async () => {
      await prisma.order.delete({ where: { id: pendingOrderId } }).catch(() => {});
    });

    it('应该成功确认订单', async () => {
      const url = `http://localhost:3000/api/orders/${pendingOrderId}/confirm`;
      const request = createMockRequest(url, 'POST', { notes: '确认备注' });
      const response = await POST_ACTION(request, createMockParams(pendingOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CONFIRMED');
      expect(result.data.confirmedAt).toBeTruthy();
    });

    it('应该返回冲突当订单不是 PENDING 状态', async () => {
      // 先确认订单
      await prisma.order.update({
        where: { id: pendingOrderId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });

      const url = `http://localhost:3000/api/orders/${pendingOrderId}/confirm`;
      const request = createMockRequest(url, 'POST', {});
      const response = await POST_ACTION(request, createMockParams(pendingOrderId));
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);
    });

    it('应该返回 404 当订单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const url = `http://localhost:3000/api/orders/${fakeId}/confirm`;
      const request = createMockRequest(url, 'POST', {});
      const response = await POST_ACTION(request, createMockParams(fakeId));
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/orders/[id]/cancel - 取消订单', () => {
    let cancellableOrderId: string;

    beforeEach(async () => {
      // 创建一个可取消的订单
      const order = await prisma.order.create({
        data: {
          orderNo: `SO-CANCEL-${Date.now()}`,
          customerId: createdCustomerId,
          status: 'CONFIRMED',
          currency: 'USD',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          items: {
            create: {
              productId: createdProductId,
              productName: '测试产品',
              quantity: 10,
              unitPrice: 100,
              amount: 1000,
            },
          },
        },
      });
      cancellableOrderId = order.id;
    });

    afterEach(async () => {
      await prisma.order.delete({ where: { id: cancellableOrderId } }).catch(() => {});
    });

    it('应该成功取消订单', async () => {
      const url = `http://localhost:3000/api/orders/${cancellableOrderId}/cancel`;
      const request = createMockRequest(url, 'POST', {
        cancelReason: '客户取消',
        notes: '取消备注',
      });
      const response = await POST_ACTION(request, createMockParams(cancellableOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CANCELLED');
      expect(result.data.cancelledAt).toBeTruthy();
      expect(result.data.cancelReason).toBe('客户取消');
    });

    it('应该验证取消原因必填', async () => {
      const url = `http://localhost:3000/api/orders/${cancellableOrderId}/cancel`;
      const request = createMockRequest(url, 'POST', { notes: '测试' });
      const response = await POST_ACTION(request, createMockParams(cancellableOrderId));
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.success).toBe(false);
    });

    it('应该返回冲突当订单已发货', async () => {
      // 先更新为 SHIPPED 状态
      await prisma.order.update({
        where: { id: cancellableOrderId },
        data: { status: 'SHIPPED' },
      });

      const url = `http://localhost:3000/api/orders/${cancellableOrderId}/cancel`;
      const request = createMockRequest(url, 'POST', { cancelReason: '测试' });
      const response = await POST_ACTION(request, createMockParams(cancellableOrderId));
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);
    });

    it('应该返回 404 当订单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const url = `http://localhost:3000/api/orders/${fakeId}/cancel`;
      const request = createMockRequest(url, 'POST', { cancelReason: '测试' });
      const response = await POST_ACTION(request, createMockParams(fakeId));
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });
  });

  describe('订单状态流转', () => {
    let workflowOrderId: string;

    beforeEach(async () => {
      // 创建一个用于状态流转测试的订单
      const order = await prisma.order.create({
        data: {
          orderNo: `SO-WORKFLOW-${Date.now()}`,
          customerId: createdCustomerId,
          status: 'PENDING',
          currency: 'USD',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          items: {
            create: {
              productId: createdProductId,
              productName: '测试产品',
              quantity: 10,
              unitPrice: 100,
              amount: 1000,
            },
          },
        },
      });
      workflowOrderId = order.id;
    });

    afterEach(async () => {
      await prisma.order.delete({ where: { id: workflowOrderId } }).catch(() => {});
    });

    it('应该支持 PENDING -> CONFIRMED 流转', async () => {
      const url = `http://localhost:3000/api/orders/${workflowOrderId}/confirm`;
      const request = createMockRequest(url, 'POST', {});
      const response = await POST_ACTION(request, createMockParams(workflowOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CONFIRMED');

      // 验证数据库状态
      const order = await prisma.order.findUnique({
        where: { id: workflowOrderId },
      });
      expect(order?.status).toBe('CONFIRMED');
      expect(order?.confirmedAt).toBeTruthy();
    });

    it('应该支持 CONFIRMED -> CANCELLED 流转', async () => {
      // 先确认
      await prisma.order.update({
        where: { id: workflowOrderId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });

      const url = `http://localhost:3000/api/orders/${workflowOrderId}/cancel`;
      const request = createMockRequest(url, 'POST', { cancelReason: '测试取消' });
      const response = await POST_ACTION(request, createMockParams(workflowOrderId));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CANCELLED');

      // 验证数据库状态
      const order = await prisma.order.findUnique({
        where: { id: workflowOrderId },
      });
      expect(order?.status).toBe('CANCELLED');
      expect(order?.cancelledAt).toBeTruthy();
    });

    it('应该不允许 CANCELLED -> 其他状态流转', async () => {
      // 先设置为 CANCELLED
      await prisma.order.update({
        where: { id: workflowOrderId },
        data: { 
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: '测试',
        },
      });

      // 尝试确认
      const url = `http://localhost:3000/api/orders/${workflowOrderId}/confirm`;
      const request = createMockRequest(url, 'POST', {});
      const response = await POST_ACTION(request, createMockParams(workflowOrderId));
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);
    });
  });
});
