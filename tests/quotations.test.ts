/**
 * 报价管理 API 单元测试
 * 
 * 测试覆盖:
 * - GET /api/quotations - 获取报价单列表
 * - POST /api/quotations - 创建报价单
 * - GET /api/quotations/[id] - 获取报价单详情
 * - PUT /api/quotations/[id] - 更新报价单
 * - DELETE /api/quotations/[id] - 删除报价单
 * - POST /api/quotations/[id]/send - 发送报价单
 * - POST /api/quotations/[id]/convert - 转订单
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/quotations/route';
import { GET as GET_BY_ID, PUT, DELETE as DELETE_BY_ID } from '@/app/api/quotations/[id]/route';
import { POST as SEND } from '@/app/api/quotations/[id]/send/route';
import { POST as CONVERT } from '@/app/api/quotations/[id]/convert/route';

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

describe('Quotations API', () => {
  let createdQuotationId: string;
  let createdCustomerId: string;
  let testQuotationData: any;

  beforeEach(async () => {
    // 创建测试客户
    const customer = await prisma.customer.create({
      data: {
        companyName: `测试客户_${Date.now()}`,
        contactName: '张三',
        email: `test_${Date.now()}@example.com`,
        phone: '021-12345678',
        country: 'CN',
      },
    });
    createdCustomerId = customer.id;

    testQuotationData = {
      customerId: customer.id,
      currency: 'USD',
      paymentTerms: 'T/T 30% deposit',
      deliveryTerms: 'FOB Shanghai',
      validityDays: 30,
      notes: '测试报价单',
      items: [
        {
          productName: '测试产品 1',
          specification: '规格 A',
          quantity: 100,
          unitPrice: 10.5,
          notes: '产品备注 1',
        },
        {
          productName: '测试产品 2',
          specification: '规格 B',
          quantity: 50,
          unitPrice: 20.0,
          notes: '产品备注 2',
        },
      ],
    };
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdQuotationId) {
      await prisma.quotation.delete({ where: { id: createdQuotationId } }).catch(() => {});
    }
    if (createdCustomerId) {
      await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/quotations', () => {
    it('应该成功创建报价单', async () => {
      const request = createMockRequest('/api/quotations', 'POST', testQuotationData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.quotationNo).toMatch(/^QT\d+/);
      expect(data.customerId).toBe(testQuotationData.customerId);
      expect(data.currency).toBe('USD');
      expect(data.status).toBe('DRAFT');
      expect(data.items).toHaveLength(2);
      // totalAmount 可能是 Decimal 类型，转换为数字比较
      expect(parseFloat(data.totalAmount)).toBe(100 * 10.5 + 50 * 20.0); // 2050

      createdQuotationId = data.id;
    });

    it('应该验证必填字段 customerId', async () => {
      const invalidData = { ...testQuotationData, customerId: '' };
      const request = createMockRequest('/api/quotations', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Validation failed');
    });

    it('应该验证 items 至少有一项', async () => {
      const invalidData = { ...testQuotationData, items: [] };
      const request = createMockRequest('/api/quotations', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('应该验证数量必须为正数', async () => {
      const invalidData = {
        ...testQuotationData,
        items: [{ productName: '测试', quantity: -1, unitPrice: 10 }],
      };
      const request = createMockRequest('/api/quotations', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/quotations', () => {
    it('应该获取报价单列表', async () => {
      const request = createMockRequest('/api/quotations?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('totalPages');
    });

    it('应该支持状态筛选', async () => {
      const request = createMockRequest('/api/quotations?status=DRAFT');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeTruthy();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('应该支持搜索查询', async () => {
      const request = createMockRequest('/api/quotations?search=测试');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeTruthy();
    });

    it('应该包含 customer 和 items 信息', async () => {
      const request = createMockRequest('/api/quotations?page=1&limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('customer');
        expect(data.data[0].customer).toHaveProperty('companyName');
        expect(data.data[0]).toHaveProperty('items');
      }
    });
  });

  describe('GET /api/quotations/[id]', () => {
    it('应该获取报价单详情', async () => {
      if (!createdQuotationId) return;

      const request = createMockRequest(`/api/quotations/${createdQuotationId}`);
      const response = await GET_BY_ID(request, createMockParams(createdQuotationId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(createdQuotationId);
      expect(data).toHaveProperty('customer');
      expect(data).toHaveProperty('items');
    });

    it('应该返回 404 当报价单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/quotations/${fakeId}`);
      const response = await GET_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/quotations/[id]', () => {
    it('应该更新报价单信息', async () => {
      if (!createdQuotationId) return;

      const updateData = {
        paymentTerms: 'T/T 50% deposit',
        deliveryTerms: 'CIF New York',
        validityDays: 60,
        notes: '更新后的备注',
      };

      const request = createMockRequest(
        `/api/quotations/${createdQuotationId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdQuotationId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentTerms).toBe(updateData.paymentTerms);
      expect(data.deliveryTerms).toBe(updateData.deliveryTerms);
      expect(data.validityDays).toBe(updateData.validityDays);
    });

    it('应该更新报价单 items', async () => {
      if (!createdQuotationId) return;

      const updateData = {
        items: [
          {
            productName: '新产品',
            specification: '新规格',
            quantity: 200,
            unitPrice: 15.0,
            notes: '新产品备注',
          },
        ],
      };

      const request = createMockRequest(
        `/api/quotations/${createdQuotationId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdQuotationId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].productName).toBe('新产品');
      expect(parseFloat(data.totalAmount)).toBe(200 * 15.0); // 3000
    });

    it('应该返回 404 当报价单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/quotations/${fakeId}`, 'PUT', {
        notes: '测试',
      });
      const response = await PUT(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('DELETE /api/quotations/[id]', () => {
    it('应该删除报价单', async () => {
      // 创建一个专门用于删除测试的报价单
      const testRequest = createMockRequest('/api/quotations', 'POST', {
        customerId: createdCustomerId,
        items: [
          { productName: '删除测试', quantity: 1, unitPrice: 10 },
        ],
      });
      const testResponse = await POST(testRequest);
      const testData = await testResponse.json();
      const testId = testData.id;

      const request = createMockRequest(`/api/quotations/${testId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(testId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证已删除
      const deleted = await prisma.quotation.findUnique({
        where: { id: testId },
      });
      expect(deleted).toBeNull();
    });

    it('应该返回 404 当报价单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/quotations/${fakeId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('POST /api/quotations/[id]/send', () => {
    it('应该发送报价单并更新状态', async () => {
      if (!createdQuotationId) return;

      const sendData = {
        recipientEmails: ['customer@example.com'],
        subject: '报价单测试',
        message: '请查收',
      };

      const request = createMockRequest(
        `/api/quotations/${createdQuotationId}/send`,
        'POST',
        sendData
      );
      const response = await SEND(request, createMockParams(createdQuotationId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sentTo).toEqual(sendData.recipientEmails);

      // 验证状态已更新
      const updatedQuotation = await prisma.quotation.findUnique({
        where: { id: createdQuotationId },
      });
      expect(updatedQuotation?.status).toBe('SENT');
    });

    it('应该验证收件人邮箱', async () => {
      if (!createdQuotationId) return;

      const invalidData = {
        recipientEmails: [],
      };

      const request = createMockRequest(
        `/api/quotations/${createdQuotationId}/send`,
        'POST',
        invalidData
      );
      const response = await SEND(request, createMockParams(createdQuotationId));
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('应该返回 404 当报价单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/quotations/${fakeId}/send`, 'POST', {
        recipientEmails: ['test@example.com'],
      });
      const response = await SEND(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/quotations/[id]/convert', () => {
    it('应该将报价单转为订单', async () => {
      if (!createdQuotationId) return;

      // 先发送报价单
      await prisma.quotation.update({
        where: { id: createdQuotationId },
        data: { status: 'SENT' },
      });

      const convertData = {
        paymentTerms: 'T/T 30% deposit',
        deliveryTerms: 'FOB Shanghai',
      };

      const request = createMockRequest(
        `/api/quotations/${createdQuotationId}/convert`,
        'POST',
        convertData
      );
      const response = await CONVERT(request, createMockParams(createdQuotationId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order).toHaveProperty('orderNo');
      expect(data.order.orderNo).toMatch(/^PO\d+/);

      // 验证报价单状态已更新为 ACCEPTED
      const updatedQuotation = await prisma.quotation.findUnique({
        where: { id: createdQuotationId },
      });
      expect(updatedQuotation?.status).toBe('ACCEPTED');

      // 清理创建的订单
      if (data.order.id) {
        await prisma.order.delete({ where: { id: data.order.id } }).catch(() => {});
      }
    });

    it('应该拒绝草稿状态的报价单转订单', async () => {
      // 创建一个新的草稿报价单
      const draftRequest = createMockRequest('/api/quotations', 'POST', {
        customerId: createdCustomerId,
        items: [
          { productName: '测试产品', quantity: 10, unitPrice: 100 },
        ],
      });
      const draftResponse = await POST(draftRequest);
      const draftData = await draftResponse.json();
      const draftId = draftData.id;

      const request = createMockRequest(
        `/api/quotations/${draftId}/convert`,
        'POST',
        {}
      );
      const response = await CONVERT(request, createMockParams(draftId));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('草稿状态');

      // 清理
      await prisma.quotation.delete({ where: { id: draftId } }).catch(() => {});
    });

    it('应该返回 404 当报价单不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/quotations/${fakeId}/convert`, 'POST', {});
      const response = await CONVERT(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
    });
  });
});
