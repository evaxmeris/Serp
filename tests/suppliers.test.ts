/**
 * 供应商管理 API 单元测试
 * 
 * 测试覆盖:
 * - GET /api/v1/suppliers - 获取供应商列表
 * - POST /api/v1/suppliers - 创建供应商
 * - GET /api/v1/suppliers/[id] - 获取供应商详情
 * - PUT /api/v1/suppliers/[id] - 更新供应商
 * - DELETE /api/v1/suppliers/[id] - 删除供应商
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock 认证模块：返回 ADMIN 会话，通过所有权限检查
jest.mock('@/lib/auth-api', () => ({
  getUserFromRequest: jest.fn().mockResolvedValue({
    id: 'test-admin-id',
    email: 'admin@testerp.com',
    name: 'Test Admin',
    role: 'ADMIN',
  }),
}));

import { GET, POST } from '@/app/api/v1/suppliers/route';
import { GET as GET_BY_ID, PUT, DELETE as DELETE_BY_ID } from '@/app/api/v1/suppliers/[id]/route';

// Mock NextRequest
function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any
): NextRequest {
  const searchParams = new URLSearchParams(url.split('?')[1] || '');
  const mockUrl = new URL(url, 'http://localhost:3000');
  
  return {
    nextUrl: {
      searchParams,
      pathname: mockUrl.pathname,
      href: mockUrl.href,
      origin: mockUrl.origin,
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

describe('Suppliers API V1', () => {
  let createdSupplierId: string;
  let testSupplierData: any;

  beforeEach(() => {
    testSupplierData = {
      companyName: `测试供应商_${Date.now()}`,
      companyEn: 'Test Supplier Co., Ltd.',
      contactName: '张三',
      contactTitle: '销售经理',
      email: `test_${Date.now()}@example.com`,
      phone: '021-12345678',
      mobile: '13800138000',
      address: '上海市浦东新区',
      city: '上海',
      province: '上海',
      country: 'CN',
      website: 'https://test-supplier.com',
      taxId: '91310000XXXXXXXX1234',
      bankName: '中国工商银行',
      bankAccount: '1234567890123456789',
      products: '电子产品、塑料制品',
      categories: ['electronics', 'plastics'],
      type: 'DOMESTIC',
      level: 'NORMAL',
      creditTerms: '月结 30 天',
      paymentMethods: ['T/T', '支付宝'],
      currency: 'CNY',
      notes: '测试供应商',
    };
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdSupplierId) {
      await prisma.supplier.delete({ where: { id: createdSupplierId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/suppliers', () => {
    it('应该成功创建供应商', async () => {
      const request = createMockRequest('/api/v1/suppliers', 'POST', testSupplierData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.code).toBe('CREATED');
      expect(data.data).toHaveProperty('id');
      expect(data.data.companyName).toBe(testSupplierData.companyName);
      expect(data.data.supplierNo).toMatch(/^SUP-\d{8}-\d{3}$/);

      createdSupplierId = data.data.id;
    });

    it('应该验证必填字段 companyName', async () => {
      const invalidData = { ...testSupplierData, companyName: '' };
      const request = createMockRequest('/api/v1/suppliers', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('应该验证邮箱格式', async () => {
      const invalidData = { ...testSupplierData, email: 'invalid-email' };
      const request = createMockRequest('/api/v1/suppliers', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/suppliers', () => {
    it('应该获取供应商列表', async () => {
      const request = createMockRequest('/api/v1/suppliers?page=1&limit=10');
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

    it('应该支持搜索查询', async () => {
      const request = createMockRequest(`/api/v1/suppliers?search=${testSupplierData.companyName}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items).toBeTruthy();
    });

    it('应该支持状态筛选', async () => {
      const request = createMockRequest('/api/v1/suppliers?status=ACTIVE');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items).toBeTruthy();
    });

    it('应该验证分页参数', async () => {
      const request = createMockRequest('/api/v1/suppliers?page=-1&limit=1000');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/suppliers/[id]', () => {
    it('应该获取供应商详情', async () => {
      if (!createdSupplierId) return;

      const request = createMockRequest(`/api/v1/suppliers/${createdSupplierId}`);
      const response = await GET_BY_ID(request, createMockParams(createdSupplierId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdSupplierId);
      expect(data.data).toHaveProperty('contacts');
      expect(data.data).toHaveProperty('purchaseOrders');
      expect(data.data).toHaveProperty('evaluations');
    });

    it('应该返回 404 当供应商不存在', async () => {
      // 使用有效的 cuid 格式但数据库中不存在的 ID
      const fakeId = 'clxx1234567890abcdefg'; // 有效 cuid 格式
      const request = createMockRequest(`/api/v1/suppliers/${fakeId}`);
      const response = await GET_BY_ID(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('应该验证 ID 格式（cuid）', async () => {
      const request = createMockRequest('/api/v1/suppliers/invalid-id');
      const response = await GET_BY_ID(request, createMockParams('invalid-id'));
      const data = await response.json();

      // V1 路由使用 cuid 格式验证，无效格式返回 422
      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/v1/suppliers/[id]', () => {
    it('应该更新供应商信息', async () => {
      if (!createdSupplierId) return;

      const updateData = {
        contactName: '李四',
        phone: '021-87654321',
        notes: '更新后的备注',
      };

      const request = createMockRequest(
        `/api/v1/suppliers/${createdSupplierId}`,
        'PUT',
        updateData
      );
      const response = await PUT(request, createMockParams(createdSupplierId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.contactName).toBe(updateData.contactName);
      expect(data.data.phone).toBe(updateData.phone);
    });

    it('应该返回 404 当供应商不存在', async () => {
      const fakeId = 'clxx1234567890abcdefg'; // 有效 cuid 格式
      const request = createMockRequest(`/api/v1/suppliers/${fakeId}`, 'PUT', {
        contactName: '测试',
      });
      const response = await PUT(request, createMockParams(fakeId));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/suppliers/[id]', () => {
    it('应该删除供应商', async () => {
      // 创建一个专门用于删除测试的供应商
      const testRequest = createMockRequest('/api/v1/suppliers', 'POST', {
        companyName: `删除测试_${Date.now()}`,
        email: `delete_test_${Date.now()}@example.com`,
      });
      const testResponse = await POST(testRequest);
      const testData = await testResponse.json();
      const testId = testData.data.id;

      const request = createMockRequest(`/api/v1/suppliers/${testId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(testId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证已删除
      const deleted = await prisma.supplier.findUnique({
        where: { id: testId },
      });
      expect(deleted).toBeNull();
    });

    it('应该返回 409 当供应商有关联采购订单', async () => {
      // 创建一个测试供应商
      const testRequest = createMockRequest('/api/v1/suppliers', 'POST', {
        companyName: `级联删除测试_${Date.now()}`,
        email: `cascade_test_${Date.now()}@example.com`,
      });
      const testResponse = await POST(testRequest);
      const testData = await testResponse.json();
      const testId = testData.data.id;

      // 为该供应商创建一条采购订单
      await prisma.purchaseOrder.create({
        data: {
          poNo: `PO-CASCADE-${Date.now()}`,
          supplierId: testId,
          totalAmount: 1000,
          purchaserId: 'test-admin-id',
        },
      });

      // 尝试删除供应商 → 应返回 409 冲突
      const request = createMockRequest(`/api/v1/suppliers/${testId}`, 'DELETE');
      const response = await DELETE_BY_ID(request, createMockParams(testId));
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.code).toBe('CONFLICT');

      // 清理：先删除采购订单，再删除供应商
      await prisma.purchaseOrder.deleteMany({ where: { supplierId: testId } });
      await prisma.supplier.delete({ where: { id: testId } }).catch(() => {});
    });
  });
});
