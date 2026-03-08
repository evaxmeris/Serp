/**
 * 客户管理 API 单元测试
 * 
 * 测试覆盖:
 * - GET /api/customers - 获取客户列表
 * - POST /api/customers - 创建客户
 * - GET /api/customers/[id] - 获取客户详情
 * - PUT /api/customers/[id] - 更新客户
 * - DELETE /api/customers/[id] - 删除客户
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/customers/route';
import { GET as GET_BY_ID, PUT, DELETE as DELETE_BY_ID } from '@/app/api/customers/[id]/route';

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

describe('Customers API', () => {
  let createdCustomerId: string;
  let testCustomerData: any;

  beforeEach(() => {
    testCustomerData = {
      companyName: `测试客户_${Date.now()}`,
      contactName: '张三',
      email: `test_${Date.now()}@example.com`,
      phone: '021-12345678',
      country: 'CN',
      address: '上海市浦东新区',
      website: 'https://test-customer.com',
      source: '官网',
      creditLevel: 'A',
      notes: '测试客户',
    };
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdCustomerId) {
      await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/customers', () => {
    it('应该成功创建客户', async () => {
      const request = createMockRequest('/api/customers', 'POST', testCustomerData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.companyName).toBe(testCustomerData.companyName);
      expect(data.email).toBe(testCustomerData.email);

      createdCustomerId = data.id;
    });

    it('应该验证必填字段 companyName', async () => {
      const invalidData = { ...testCustomerData, companyName: '' };
      const request = createMockRequest('/api/customers', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('应该创建客户时允许可选字段为空', async () => {
      const minimalData = {
        companyName: `最小客户_${Date.now()}`,
      };
      const request = createMockRequest('/api/customers', 'POST', minimalData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.companyName).toBe(minimalData.companyName);

      // 清理
      await prisma.customer.delete({ where: { id: data.id } }).catch(() => {});
    });
  });

  describe('GET /api/customers', () => {
    it('应该获取客户列表', async () => {
      const request = createMockRequest('/api/customers?page=1&limit=10');
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

    it('应该支持搜索查询 - 公司名称', async () => {
      const request = createMockRequest(`/api/customers?search=${encodeURIComponent(testCustomerData.companyName)}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeTruthy();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('应该支持搜索查询 - 联系人', async () => {
      const request = createMockRequest(`/api/customers?search=${encodeURIComponent(testCustomerData.contactName)}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeTruthy();
    });

    it('应该支持搜索查询 - 邮箱', async () => {
      const request = createMockRequest(`/api/customers?search=${encodeURIComponent(testCustomerData.email)}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeTruthy();
    });

    it('应该返回分页数据', async () => {
      const request = createMockRequest('/api/customers?page=1&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.page).toBe(1);
    });

    it('应该包含 owner 和计数信息', async () => {
      const request = createMockRequest('/api/customers?page=1&limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('owner');
        expect(data.data[0]).toHaveProperty('_count');
      }
    });
  });

  describe('GET /api/customers/[id]', () => {
    it('应该获取客户详情', async () => {
      if (!createdCustomerId) return;

      const request = createMockRequest(`/api/customers/${createdCustomerId}`);
      const response = await GET_BY_ID(request, createMockParams(createdCustomerId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(createdCustomerId);
      expect(data).toHaveProperty('contacts');
      expect(data).toHaveProperty('inquiries');
      expect(data).toHaveProperty('orders');
    });

    it('应该返回 404 当客户不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/customers/${fakeId}`);
      const response = await GET_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/customers/[id]', () => {
    it('应该更新客户信息', async () => {
      if (!createdCustomerId) return;

      const updateData = {
        contactName: '李四',
        phone: '021-87654321',
        notes: '更新后的备注',
      };

      const request = createMockRequest(
        `/api/customers/${createdCustomerId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdCustomerId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contactName).toBe(updateData.contactName);
      expect(data.phone).toBe(updateData.phone);
      expect(data.notes).toBe(updateData.notes);
    });

    it('应该返回 500 当客户不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/customers/${fakeId}`, 'PUT', {
        contactName: '测试',
      });
      const response = await PUT(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to update');
    });
  });

  describe('DELETE /api/customers/[id]', () => {
    it('应该删除客户', async () => {
      // 创建一个专门用于删除测试的客户
      const testRequest = createMockRequest('/api/customers', 'POST', {
        companyName: `删除测试_${Date.now()}`,
        email: `delete_test_${Date.now()}@example.com`,
      });
      const testResponse = await POST(testRequest);
      const testData = await testResponse.json();
      const testId = testData.id;

      const request = createMockRequest(`/api/customers/${testId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(testId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证已删除
      const deleted = await prisma.customer.findUnique({
        where: { id: testId },
      });
      expect(deleted).toBeNull();
    });

    it('应该返回 500 当客户不存在', async () => {
      const fakeId = 'clxxx123456789';
      const request = createMockRequest(`/api/customers/${fakeId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to delete');
    });
  });
});
