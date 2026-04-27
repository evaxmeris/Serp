/**
 * 询盘管理 API 单元测试
 * 
 * 测试覆盖:
 * - GET /api/inquiries - 获取询盘列表
 * - POST /api/inquiries - 创建询盘
 * - GET /api/inquiries/[id] - 获取询盘详情
 * - PUT /api/inquiries/[id] - 更新询盘
 * - DELETE /api/inquiries/[id] - 删除询盘
 * - 状态流转测试
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock 认证模块：返回 ADMIN 会话，通过所有权限检查（包括行级权限 assignedTo）
jest.mock('@/lib/auth-api', () => ({
  getUserFromRequest: jest.fn().mockResolvedValue({
    id: 'test-admin-id',
    email: 'admin@testerp.com',
    name: 'Test Admin',
    role: 'ADMIN',
  }),
}));

import { GET, POST } from '@/app/api/inquiries/route';
import { GET as GET_BY_ID, PUT, DELETE as DELETE_BY_ID } from '@/app/api/inquiries/[id]/route';

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

describe('Inquiries API', () => {
  let createdInquiryId: string;
  let testCustomerId: string;
  let testInquiryData: any;

  beforeAll(async () => {
    // 创建测试客户
    const customer = await prisma.customer.create({
      data: {
        companyName: `测试客户_Inquiries_${Date.now()}`,
        contactName: '张三',
        email: `inquiry_test_${Date.now()}@example.com`,
        phone: '021-12345678',
        country: 'CN',
        address: '上海市浦东新区',
        source: '官网',
      },
    });
    testCustomerId = customer.id;
  });

  beforeEach(() => {
    testInquiryData = {
      customerId: testCustomerId,
      subject: `测试询盘_${Date.now()}`,
      content: '需要定制 Logo，包装要求精美，数量 1000 个 LED Pen Light',
      source: 'Website',
      products: 'LED Pen Light',
      quantity: 1000,
      targetPrice: 2.5,
      currency: 'USD',
      requirements: '需要定制 Logo，包装要求精美',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'HIGH',
    };
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdInquiryId) {
      await prisma.inquiry.delete({ where: { id: createdInquiryId } }).catch(() => {});
    }
    if (testCustomerId) {
      await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/inquiries', () => {
    it('应该成功创建询盘', async () => {
      const request = createMockRequest('/api/inquiries', 'POST', testInquiryData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.code).toBe('CREATED');
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('inquiryNo');
      expect(data.data.customerId).toBe(testCustomerId);
      expect(data.data.products).toBe(testInquiryData.products);
      expect(data.data.quantity).toBe(testInquiryData.quantity);
      expect(data.data.priority).toBe('HIGH');
      expect(data.data.status).toBe('NEW');

      createdInquiryId = data.data.id;
    });

    it('应该验证必填字段 customerId', async () => {
      const invalidData = { ...testInquiryData, customerId: '' };
      const request = createMockRequest('/api/inquiries', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('应该创建询盘时允许可选字段为空', async () => {
      const minimalData = {
        customerId: testCustomerId,
        subject: 'Minimal Test Inquiry',
        content: 'Minimal content for testing',
      };
      const request = createMockRequest('/api/inquiries', 'POST', minimalData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.status).toBe('NEW');

      // 清理
      await prisma.inquiry.delete({ where: { id: data.data.id } }).catch(() => {});
    });

    it('应该自动生成询盘编号', async () => {
      const request = createMockRequest('/api/inquiries', 'POST', {
        customerId: testCustomerId,
        subject: 'Auto Number Test',
        content: 'Testing auto-generated inquiry number',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.inquiryNo).toMatch(/^INQ\d+$/);

      // 清理
      await prisma.inquiry.delete({ where: { id: data.data.id } }).catch(() => {});
    });

    it('应该支持不同的优先级', async () => {
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      
      for (const priority of priorities) {
        const request = createMockRequest('/api/inquiries', 'POST', {
          customerId: testCustomerId,
          subject: `Priority ${priority} Test`,
          content: `Testing priority ${priority}`,
          priority,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.priority).toBe(priority);

        await prisma.inquiry.delete({ where: { id: data.data.id } }).catch(() => {});
      }
    });
  });

  describe('GET /api/inquiries', () => {
    it('应该获取询盘列表', async () => {
      const request = createMockRequest('/api/inquiries?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('items');
      expect(data.data).toHaveProperty('pagination');
      expect(data.data.pagination).toHaveProperty('page');
      expect(data.data.pagination).toHaveProperty('limit');
      expect(data.data.pagination).toHaveProperty('total');
      expect(data.data.pagination).toHaveProperty('totalPages');
    });

    it('应该支持按状态过滤', async () => {
      const request = createMockRequest('/api/inquiries?status=NEW');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items).toBeTruthy();
      expect(Array.isArray(data.data.items)).toBe(true);
      
      // 所有返回的询盘状态都应该是 NEW
      data.data.items.forEach((inquiry: any) => {
        expect(inquiry.status).toBe('NEW');
      });
    });

    it('应该支持按优先级过滤', async () => {
      const request = createMockRequest('/api/inquiries?priority=HIGH');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items).toBeTruthy();
      
      // 所有返回的询盘优先级都应该是 HIGH
      data.data.items.forEach((inquiry: any) => {
        expect(inquiry.priority).toBe('HIGH');
      });
    });

    it('应该支持分页', async () => {
      const request = createMockRequest('/api/inquiries?page=1&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.limit).toBe(5);
      expect(data.data.pagination.page).toBe(1);
    });

    it('应该包含客户信息', async () => {
      const request = createMockRequest('/api/inquiries?page=1&limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.data.items.length > 0) {
        expect(data.data.items[0]).toHaveProperty('customer');
        expect(data.data.items[0].customer).toHaveProperty('companyName');
        expect(data.data.items[0].customer).toHaveProperty('contactName');
      }
    });

    it('应该包含最近的跟进记录', async () => {
      const request = createMockRequest('/api/inquiries?page=1&limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.data.items.length > 0) {
        expect(data.data.items[0]).toHaveProperty('followUps');
        expect(Array.isArray(data.data.items[0].followUps)).toBe(true);
      }
    });
  });

  describe('GET /api/inquiries/[id]', () => {
    it('应该获取询盘详情', async () => {
      if (!createdInquiryId) return;

      const request = createMockRequest(`/api/inquiries/${createdInquiryId}`);
      const response = await GET_BY_ID(request, createMockParams(createdInquiryId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdInquiryId);
      expect(data.data).toHaveProperty('customer');
      expect(data.data).toHaveProperty('followUps');
      expect(data.data.customer).toHaveProperty('companyName');
    });

    it('应该返回 404 当询盘不存在', async () => {
      const fakeId = 'clxx1234567890abcdefg'; // 有效 cuid 格式
      const request = createMockRequest(`/api/inquiries/${fakeId}`);
      const response = await GET_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.code).toBe('NOT_FOUND');
    });

    it('应该包含完整的客户联系信息', async () => {
      if (!createdInquiryId) return;

      const request = createMockRequest(`/api/inquiries/${createdInquiryId}`);
      const response = await GET_BY_ID(request, createMockParams(createdInquiryId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.customer).toHaveProperty('email');
      expect(data.data.customer).toHaveProperty('phone');
    });
  });

  describe('PUT /api/inquiries/[id]', () => {
    it('应该更新询盘信息', async () => {
      if (!createdInquiryId) return;

      const updateData = {
        quantity: 2000,
        targetPrice: '2.3',
        requirements: '更新后的需求说明',
        priority: 'URGENT',
      };

      const request = createMockRequest(
        `/api/inquiries/${createdInquiryId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdInquiryId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.quantity).toBe(updateData.quantity);
      expect(String(data.data.targetPrice)).toBe(updateData.targetPrice);
      expect(data.data.requirements).toBe(updateData.requirements);
      expect(data.data.priority).toBe(updateData.priority);
    });

    it('应该更新询盘状态', async () => {
      if (!createdInquiryId) return;

      const updateData = { status: 'CONTACTED' };
      const request = createMockRequest(
        `/api/inquiries/${createdInquiryId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdInquiryId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('CONTACTED');
    });

    it('应该返回 404 当询盘不存在', async () => {
      const fakeId = 'clxx1234567890abcdefg'; // 有效 cuid 格式
      const request = createMockRequest(`/api/inquiries/${fakeId}`, 'PUT', {
        quantity: 100,
      });
      const response = await PUT(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/inquiries/[id]', () => {
    it('应该删除询盘', async () => {
      // 创建一个专门用于删除测试的询盘
      const createRequest = createMockRequest('/api/inquiries', 'POST', {
        customerId: testCustomerId,
        subject: 'Delete Test Inquiry',
        content: 'Testing delete functionality',
      });
      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();
      const testId = createData.data.id;

      const request = createMockRequest(`/api/inquiries/${testId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(testId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证已删除
      const deleted = await prisma.inquiry.findUnique({
        where: { id: testId },
      });
      expect(deleted).toBeNull();
    });

    it('应该返回 404 当询盘不存在', async () => {
      const fakeId = 'clxx1234567890abcdefg'; // 有效 cuid 格式
      const request = createMockRequest(`/api/inquiries/${fakeId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.code).toBe('NOT_FOUND');
    });
  });

  describe('询盘状态流转', () => {
    let statusTestInquiryId: string;

    beforeEach(async () => {
      // 创建用于状态流转测试的询盘
      const createRequest = createMockRequest('/api/inquiries', 'POST', {
        customerId: testCustomerId,
        products: 'Status Flow Test',
        priority: 'MEDIUM',
      });
      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();
      statusTestInquiryId = createData.id;
    });

    afterEach(async () => {
      // 清理状态流转测试数据
      if (statusTestInquiryId) {
        await prisma.inquiry.delete({ where: { id: statusTestInquiryId } }).catch(() => {});
      }
    });

    it('应该支持状态流转：NEW -> CONTACTED', async () => {
      const updateRequest = createMockRequest(
        `/api/inquiries/${statusTestInquiryId}`,
        'PUT',
        { status: 'CONTACTED' }
      );
      const updateResponse = await PUT(updateRequest, createMockParams(statusTestInquiryId));
      const data = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(data.status).toBe('CONTACTED');
    });

    it('应该支持状态流转：CONTACTED -> QUOTED', async () => {
      // 先转为 CONTACTED
      await PUT(
        createMockRequest(`/api/inquiries/${statusTestInquiryId}`, 'PUT', { status: 'CONTACTED' }),
        createMockParams(statusTestInquiryId)
      );

      // 再转为 QUOTED
      const updateRequest = createMockRequest(
        `/api/inquiries/${statusTestInquiryId}`,
        'PUT',
        { status: 'QUOTED' }
      );
      const updateResponse = await PUT(updateRequest, createMockParams(statusTestInquiryId));
      const data = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(data.status).toBe('QUOTED');
    });

    it('应该支持状态流转：QUOTED -> WON', async () => {
      // 流转到 QUOTED
      await PUT(
        createMockRequest(`/api/inquiries/${statusTestInquiryId}`, 'PUT', { status: 'QUOTED' }),
        createMockParams(statusTestInquiryId)
      );

      // 转为 WON
      const updateRequest = createMockRequest(
        `/api/inquiries/${statusTestInquiryId}`,
        'PUT',
        { status: 'WON' }
      );
      const updateResponse = await PUT(updateRequest, createMockParams(statusTestInquiryId));
      const data = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(data.status).toBe('WON');
    });

    it('应该支持状态流转：QUOTED -> LOST', async () => {
      // 流转到 QUOTED
      await PUT(
        createMockRequest(`/api/inquiries/${statusTestInquiryId}`, 'PUT', { status: 'QUOTED' }),
        createMockParams(statusTestInquiryId)
      );

      // 转为 LOST
      const updateRequest = createMockRequest(
        `/api/inquiries/${statusTestInquiryId}`,
        'PUT',
        { status: 'LOST' }
      );
      const updateResponse = await PUT(updateRequest, createMockParams(statusTestInquiryId));
      const data = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(data.status).toBe('LOST');
    });

    it('应该支持状态流转：NEW -> NEGOTIATING', async () => {
      const updateRequest = createMockRequest(
        `/api/inquiries/${statusTestInquiryId}`,
        'PUT',
        { status: 'NEGOTIATING' }
      );
      const updateResponse = await PUT(updateRequest, createMockParams(statusTestInquiryId));
      const data = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(data.status).toBe('NEGOTIATING');
    });
  });
});
