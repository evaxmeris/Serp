/**
 * 订单管理 API 单元测试
 * 测试覆盖率目标：>80%
 */

import { prisma } from '../../src/lib/prisma';

// 测试数据
let testCustomer: any;
let testUser: any;
let testOrder: any;

describe('订单管理 API', () => {
  // 测试前准备数据
  beforeAll(async () => {
    // 创建测试用户
    testUser = await prisma.user.create({
      data: {
        email: `test_${Date.now()}@example.com`,
        name: '测试业务员',
        role: 'USER',
      },
    });

    // 创建测试客户
    testCustomer = await prisma.customer.create({
      data: {
        companyName: '测试客户公司',
        contactName: '张三',
        email: 'test@example.com',
        phone: '+86-138-0000-0000',
        country: 'CN',
        status: 'ACTIVE',
      },
    });
  });

  // 清理测试数据
  afterAll(async () => {
    // 删除测试订单
    if (testOrder) {
      await prisma.order.delete({ where: { id: testOrder.id } }).catch(() => {});
    }

    // 删除测试客户
    if (testCustomer) {
      await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});
    }

    // 删除测试用户
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  describe('GET /api/orders - 获取订单列表', () => {
    it('应该返回空列表当没有订单时', async () => {
      const response = await fetch('http://localhost:3000/api/orders');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(20);
    });

    it('应该支持分页参数', async () => {
      const response = await fetch('http://localhost:3000/api/orders?page=2&limit=10');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.limit).toBe(10);
    });

    it('应该支持状态筛选', async () => {
      const response = await fetch('http://localhost:3000/api/orders?status=PENDING');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该支持搜索参数', async () => {
      const response = await fetch('http://localhost:3000/api/orders?search=测试');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该验证无效的分页参数', async () => {
      const response = await fetch('http://localhost:3000/api/orders?page=-1');
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/orders - 创建订单', () => {
    it('应该成功创建订单', async () => {
      const orderData = {
        customerId: testCustomer.id,
        currency: 'USD',
        exchangeRate: 7.25,
        paymentTerms: 'T/T 30% deposit, 70% before shipment',
        deliveryTerms: 'FOB Shanghai',
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        shippingAddress: '123 Test Street, Test City',
        salesRepId: testUser.id,
        notes: '测试订单',
        items: [
          {
            productName: '测试产品 A',
            quantity: 100,
            unitPrice: 10.00,
            discountRate: 0,
          },
          {
            productName: '测试产品 B',
            quantity: 50,
            unitPrice: 20.00,
            discountRate: 5,
          },
        ],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.code).toBe('CREATED');
      expect(data.data.id).toBeDefined();
      expect(data.data.orderNo).toMatch(/^SO-\d{8}-\d{3}$/);
      expect(data.data.status).toBe('PENDING');

      testOrder = data.data;
    });

    it('应该拒绝缺少客户 ID 的请求', async () => {
      const orderData = {
        currency: 'USD',
        items: [
          {
            productName: '测试产品',
            quantity: 100,
            unitPrice: 10.00,
          },
        ],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
      expect(data.errors.some((e: any) => e.field === 'customerId')).toBe(true);
    });

    it('应该拒绝空商品列表', async () => {
      const orderData = {
        customerId: testCustomer.id,
        items: [],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it('应该拒绝无效的客户 ID', async () => {
      const orderData = {
        customerId: 'invalid-id',
        items: [
          {
            productName: '测试产品',
            quantity: 100,
            unitPrice: 10.00,
          },
        ],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('应该拒绝过去的交货日期', async () => {
      const orderData = {
        customerId: testCustomer.id,
        deliveryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            productName: '测试产品',
            quantity: 100,
            unitPrice: 10.00,
          },
        ],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });

    it('应该正确计算总金额', async () => {
      const orderData = {
        customerId: testCustomer.id,
        items: [
          {
            productName: '产品 A',
            quantity: 100,
            unitPrice: 10.00,
            discountRate: 0,
          },
          {
            productName: '产品 B',
            quantity: 50,
            unitPrice: 20.00,
            discountRate: 10, // 10% 折扣
          },
        ],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      // 100*10 + 50*20*0.9 = 1000 + 900 = 1900
      expect(data.data.totalAmount).toBeCloseTo(1900, 0);

      // 清理测试订单
      await prisma.order.delete({ where: { id: data.data.id } }).catch(() => {});
    });
  });

  describe('GET /api/orders/[id] - 获取订单详情', () => {
    it('应该返回订单详情', async () => {
      if (!testOrder) {
        return; // 跳过如果前面没有创建成功
      }

      const response = await fetch(`http://localhost:3000/api/orders/${testOrder.id}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testOrder.id);
      expect(data.data.orderNo).toBeDefined();
      expect(data.data.customer).toBeDefined();
      expect(data.data.items).toBeInstanceOf(Array);
    });

    it('应该返回 404 当订单不存在', async () => {
      const response = await fetch('http://localhost:3000/api/orders/non-existent-id');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/orders/[id] - 更新订单', () => {
    it('应该成功更新订单', async () => {
      if (!testOrder) {
        return;
      }

      const updateData = {
        status: 'CONFIRMED',
        notes: '订单已确认',
      };

      const response = await fetch(`http://localhost:3000/api/orders/${testOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('CONFIRMED');

      // 更新测试订单状态
      testOrder.status = 'CONFIRMED';
    });

    it('应该拒绝更新已取消的订单', async () => {
      // 创建一个新订单用于测试取消
      const newOrder = await prisma.order.create({
        data: {
          orderNo: `TEST-CANCEL-${Date.now()}`,
          customerId: testCustomer.id,
          status: 'CANCELLED',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          currency: 'USD',
        },
      });

      try {
        const response = await fetch(`http://localhost:3000/api/orders/${newOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CONFIRMED' }),
        });

        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
      } finally {
        await prisma.order.delete({ where: { id: newOrder.id } }).catch(() => {});
      }
    });

    it('应该拒绝无效的订单 ID', async () => {
      const response = await fetch('http://localhost:3000/api/orders/invalid-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/orders/[id] - 删除订单', () => {
    it('应该拒绝删除非 PENDING 状态的订单', async () => {
      if (!testOrder) {
        return;
      }

      const response = await fetch(`http://localhost:3000/api/orders/${testOrder.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });

    it('应该拒绝删除不存在的订单', async () => {
      const response = await fetch('http://localhost:3000/api/orders/non-existent-id', {
        method: 'DELETE',
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/orders/[id]/confirm - 确认订单', () => {
    it('应该成功确认订单', async () => {
      // 创建一个新订单用于测试确认
      const newOrder = await prisma.order.create({
        data: {
          orderNo: `TEST-CONFIRM-${Date.now()}`,
          customerId: testCustomer.id,
          status: 'PENDING',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          currency: 'USD',
        },
      });

      try {
        const response = await fetch(
          `http://localhost:3000/api/orders/${newOrder.id}/confirm`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: '确认订单' }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('CONFIRMED');
        expect(data.data.confirmedAt).toBeDefined();
      } finally {
        await prisma.order.delete({ where: { id: newOrder.id } }).catch(() => {});
      }
    });

    it('应该拒绝确认非 PENDING 状态的订单', async () => {
      if (!testOrder) {
        return;
      }

      const response = await fetch(
        `http://localhost:3000/api/orders/${testOrder.id}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/orders/[id]/cancel - 取消订单', () => {
    it('应该成功取消订单', async () => {
      // 创建一个新订单用于测试取消
      const newOrder = await prisma.order.create({
        data: {
          orderNo: `TEST-CANCEL2-${Date.now()}`,
          customerId: testCustomer.id,
          status: 'PENDING',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          currency: 'USD',
        },
      });

      try {
        const response = await fetch(
          `http://localhost:3000/api/orders/${newOrder.id}/cancel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cancelReason: '客户取消',
              notes: '因市场变化取消',
            }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('CANCELLED');
        expect(data.data.cancelReason).toBe('客户取消');
      } finally {
        await prisma.order.delete({ where: { id: newOrder.id } }).catch(() => {});
      }
    });

    it('应该拒绝取消已发货的订单', async () => {
      // 创建一个已发货状态的订单
      const shippedOrder = await prisma.order.create({
        data: {
          orderNo: `TEST-SHIPPED-${Date.now()}`,
          customerId: testCustomer.id,
          status: 'SHIPPED',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          currency: 'USD',
        },
      });

      try {
        const response = await fetch(
          `http://localhost:3000/api/orders/${shippedOrder.id}/cancel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cancelReason: '测试取消' }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
      } finally {
        await prisma.order.delete({ where: { id: shippedOrder.id } }).catch(() => {});
      }
    });

    it('应该拒绝缺少取消原因的请求', async () => {
      // 创建一个新订单用于测试
      const newOrder = await prisma.order.create({
        data: {
          orderNo: `TEST-CANCEL3-${Date.now()}`,
          customerId: testCustomer.id,
          status: 'PENDING',
          totalAmount: 1000,
          paidAmount: 0,
          balanceAmount: 1000,
          currency: 'USD',
        },
      });

      try {
        const response = await fetch(
          `http://localhost:3000/api/orders/${newOrder.id}/cancel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
        expect(data.errors).toBeDefined();
      } finally {
        await prisma.order.delete({ where: { id: newOrder.id } }).catch(() => {});
      }
    });
  });
});
