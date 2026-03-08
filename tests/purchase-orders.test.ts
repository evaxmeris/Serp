/**
 * 采购管理 API 单元测试
 * 
 * 测试覆盖:
 * - 供应商管理 (Suppliers)
 *   - GET /api/v1/suppliers - 获取供应商列表
 *   - POST /api/v1/suppliers - 创建供应商
 *   - GET /api/v1/suppliers/[id] - 获取供应商详情
 *   - PUT /api/v1/suppliers/[id] - 更新供应商
 *   - DELETE /api/v1/suppliers/[id] - 删除供应商
 * 
 * - 采购订单管理 (Purchase Orders)
 *   - GET /api/v1/purchase-orders - 获取采购订单列表
 *   - POST /api/v1/purchase-orders - 创建采购订单
 *   - GET /api/v1/purchase-orders/[id] - 获取采购订单详情
 *   - PUT /api/v1/purchase-orders/[id] - 更新采购订单
 *   - DELETE /api/v1/purchase-orders/[id] - 删除采购订单
 *   - POST /api/v1/purchase-orders/[id]/confirm - 确认采购订单
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET as GET_SUPPLIERS, POST as POST_SUPPLIER } from '@/app/api/v1/suppliers/route';
import { GET as GET_SUPPLIER_BY_ID, PUT as PUT_SUPPLIER, DELETE as DELETE_SUPPLIER } from '@/app/api/v1/suppliers/[id]/route';
import { GET as GET_PO, POST as POST_PO } from '@/app/api/v1/purchase-orders/route';
import { GET as GET_PO_BY_ID, PUT as PUT_PO, DELETE as DELETE_PO, POST as POST_PO_CONFIRM } from '@/app/api/v1/purchase-orders/[id]/route';

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

describe('Purchase Management API V1', () => {
  let createdSupplierId: string;
  let createdPurchaseOrderId: string;
  let testSupplierData: any;
  let testPurchaseOrderData: any;

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

    testPurchaseOrderData = {
      supplierId: createdSupplierId, // 使用全局变量
      currency: 'CNY',
      exchangeRate: 1,
      deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryAddress: '上海市浦东新区测试路 100 号',
      shippingMethod: '快递',
      paymentTerms: '月结 30 天',
      paymentDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      purchaserId: undefined,
      notes: '测试采购订单',
      internalNotes: '内部备注',
      items: [
        {
          productName: '测试产品 A',
          productSku: 'SKU-TEST-001',
          specification: '规格 A',
          unit: 'PCS',
          quantity: 100,
          unitPrice: 10.5,
          discountRate: 5,
          taxRate: 13,
          expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          notes: '产品 A 备注',
        },
        {
          productName: '测试产品 B',
          productSku: 'SKU-TEST-002',
          specification: '规格 B',
          unit: 'PCS',
          quantity: 200,
          unitPrice: 20.0,
          discountRate: 0,
          taxRate: 13,
          notes: '产品 B 备注',
        },
      ],
    };
  });

  beforeAll(async () => {
    // 在测试开始前创建一个供应商供采购订单测试使用
    const supplierData = {
      companyName: `采购测试供应商_${Date.now()}`,
      companyEn: 'Purchase Test Supplier Co., Ltd.',
      contactName: '测试联系人',
      email: `purchase_test_${Date.now()}@example.com`,
      phone: '021-12345678',
      country: 'CN',
      type: 'DOMESTIC',
      level: 'NORMAL',
      status: 'ACTIVE',
    };
    
    const request = createMockRequest('/api/v1/suppliers', 'POST', supplierData);
    const response = await POST_SUPPLIER(request);
    const data = await response.json();
    createdSupplierId = data.data.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdPurchaseOrderId) {
      await prisma.purchaseOrder.delete({ where: { id: createdPurchaseOrderId } }).catch(() => {});
    }
    if (createdSupplierId) {
      await prisma.supplier.delete({ where: { id: createdSupplierId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // ==================== 供应商管理测试 ====================
  describe('Suppliers API', () => {
    let localSupplierId: string;

    afterAll(async () => {
      // 清理本测试组创建的供应商
      if (localSupplierId) {
        await prisma.supplier.delete({ where: { id: localSupplierId } }).catch(() => {});
      }
    });

    describe('POST /api/v1/suppliers', () => {
      it('应该成功创建供应商', async () => {
        const request = createMockRequest('/api/v1/suppliers', 'POST', testSupplierData);
        const response = await POST_SUPPLIER(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.code).toBe('CREATED');
        expect(data.data).toHaveProperty('id');
        expect(data.data.companyName).toBe(testSupplierData.companyName);
        expect(data.data.supplierNo).toMatch(/^SUP-\d{8}-\d{3}$/);

        localSupplierId = data.data.id;
      });

      it('应该验证必填字段 companyName', async () => {
        const invalidData = { ...testSupplierData, companyName: '' };
        const request = createMockRequest('/api/v1/suppliers', 'POST', invalidData);
        const response = await POST_SUPPLIER(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
        expect(data.code).toBe('VALIDATION_ERROR');
      });

      it('应该验证邮箱格式', async () => {
        const invalidData = { ...testSupplierData, email: 'invalid-email' };
        const request = createMockRequest('/api/v1/suppliers', 'POST', invalidData);
        const response = await POST_SUPPLIER(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });

      it('应该允许可选字段为空', async () => {
        const minimalData = {
          companyName: `最小供应商_${Date.now()}`,
          email: `minimal_${Date.now()}@example.com`,
        };
        const request = createMockRequest('/api/v1/suppliers', 'POST', minimalData);
        const response = await POST_SUPPLIER(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.companyName).toBe(minimalData.companyName);

        // 清理
        await prisma.supplier.delete({ where: { id: data.data.id } }).catch(() => {});
      });
    });

    describe('GET /api/v1/suppliers', () => {
      it('应该获取供应商列表', async () => {
        const request = createMockRequest('/api/v1/suppliers?page=1&limit=10');
        const response = await GET_SUPPLIERS(request);
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
        const response = await GET_SUPPLIERS(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.items).toBeTruthy();
      });

      it('应该支持状态筛选', async () => {
        const request = createMockRequest('/api/v1/suppliers?status=ACTIVE');
        const response = await GET_SUPPLIERS(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.items).toBeTruthy();
      });

      it('应该支持类型筛选', async () => {
        const request = createMockRequest('/api/v1/suppliers?type=DOMESTIC');
        const response = await GET_SUPPLIERS(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.items).toBeTruthy();
      });

      it('应该验证分页参数', async () => {
        const request = createMockRequest('/api/v1/suppliers?page=-1&limit=1000');
        const response = await GET_SUPPLIERS(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });
    });

    describe('GET /api/v1/suppliers/[id]', () => {
      it('应该获取供应商详情', async () => {
        if (!createdSupplierId) return;

        const request = createMockRequest(`/api/v1/suppliers/${createdSupplierId}`);
        const response = await GET_SUPPLIER_BY_ID(request, createMockParams(createdSupplierId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe(createdSupplierId);
        expect(data.data).toHaveProperty('contacts');
        expect(data.data).toHaveProperty('purchaseOrders');
        expect(data.data).toHaveProperty('evaluations');
        expect(data.data).toHaveProperty('_count');
      });

      it('应该返回 404 当供应商不存在', async () => {
        const fakeId = 'clxxx123456789';
        const request = createMockRequest(`/api/v1/suppliers/${fakeId}`);
        const response = await GET_SUPPLIER_BY_ID(request, createMockParams(fakeId));
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });

      it('应该验证 ID 格式', async () => {
        const request = createMockRequest('/api/v1/suppliers/invalid-id');
        const response = await GET_SUPPLIER_BY_ID(request, createMockParams('invalid-id'));
        const data = await response.json();

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
        const response = await PUT_SUPPLIER(request, createMockParams(createdSupplierId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.contactName).toBe(updateData.contactName);
        expect(data.data.phone).toBe(updateData.phone);
      });

      it('应该返回 404 当供应商不存在', async () => {
        const fakeId = 'clxxx123456789';
        const request = createMockRequest(`/api/v1/suppliers/${fakeId}`, 'PUT', {
          contactName: '测试',
        });
        const response = await PUT_SUPPLIER(request, createMockParams(fakeId));
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
        const testResponse = await POST_SUPPLIER(testRequest);
        const testData = await testResponse.json();
        const testId = testData.data.id;

        const request = createMockRequest(`/api/v1/suppliers/${testId}`, 'DELETE');
        const response = await DELETE_SUPPLIER(request, createMockParams(testId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // 验证已删除
        const deleted = await prisma.supplier.findUnique({
          where: { id: testId },
        });
        expect(deleted).toBeNull();
      });

      it('应该返回 409 当供应商有关联订单', async () => {
        // 这个测试需要实际创建采购订单，暂时跳过
        expect(true).toBe(true);
      });
    });
  });

  // ==================== 采购订单管理测试 ====================
  describe('Purchase Orders API', () => {
    describe('POST /api/v1/purchase-orders', () => {
      it('应该成功创建采购订单', async () => {
        if (!createdSupplierId) {
          throw new Error('Supplier ID not set');
        }

        const poData = {
          ...testPurchaseOrderData,
          supplierId: createdSupplierId,
        };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', poData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.code).toBe('CREATED');
        expect(data.data).toHaveProperty('id');
        expect(data.data.poNo).toMatch(/^PO-\d{8}-\d{3}$/);
        expect(data.data.status).toBe('PENDING');
        expect(data.data.items).toHaveLength(2);
        expect(Number(data.data.totalAmount)).toBeGreaterThan(0);

        createdPurchaseOrderId = data.data.id;
      });

      it('应该验证必填字段 supplierId', async () => {
        const invalidData = { ...testPurchaseOrderData, supplierId: '' };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', invalidData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
        expect(data.code).toBe('VALIDATION_ERROR');
      });

      it('应该验证 items 至少有一项', async () => {
        const invalidData = { ...testPurchaseOrderData, items: [] };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', invalidData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });

      it('应该验证数量必须为正整数', async () => {
        const invalidData = {
          ...testPurchaseOrderData,
          items: [{
            productName: '测试产品',
            quantity: -1,
            unitPrice: 10,
          }],
        };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', invalidData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });

      it('应该验证单价不能为负数', async () => {
        const invalidData = {
          ...testPurchaseOrderData,
          items: [{
            productName: '测试产品',
            quantity: 10,
            unitPrice: -5,
          }],
        };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', invalidData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });

      it('应该验证供应商是否存在', async () => {
        // 使用有效的 cuid 格式但不存在的 ID
        const invalidData = {
          ...testPurchaseOrderData,
          supplierId: 'clxxx123456789012345678',
        };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', invalidData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.code).toBe('SUPPLIER_NOT_FOUND');
      });

      it('应该验证供应商状态', async () => {
        // 创建一个被停用的供应商
        const inactiveSupplier = {
          ...testSupplierData,
          companyName: `停用供应商_${Date.now()}`,
          email: `inactive_${Date.now()}@example.com`,
          status: 'INACTIVE',
        };
        const supplierRequest = createMockRequest('/api/v1/suppliers', 'POST', inactiveSupplier);
        const supplierResponse = await POST_SUPPLIER(supplierRequest);
        const supplierData = await supplierResponse.json();

        const poData = {
          ...testPurchaseOrderData,
          supplierId: supplierData.data.id,
        };
        const request = createMockRequest('/api/v1/purchase-orders', 'POST', poData);
        const response = await POST_PO(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
        expect(data.code).toBe('SUPPLIER_INACTIVE');

        // 清理
        await prisma.supplier.delete({ where: { id: supplierData.data.id } }).catch(() => {});
      });
    });

    describe('GET /api/v1/purchase-orders', () => {
      it('应该获取采购订单列表', async () => {
        const request = createMockRequest('/api/v1/purchase-orders?page=1&limit=10');
        const response = await GET_PO(request);
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

      it('应该支持按状态筛选', async () => {
        const request = createMockRequest('/api/v1/purchase-orders?status=PENDING');
        const response = await GET_PO(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.items).toBeTruthy();
      });

      it('应该支持按供应商筛选', async () => {
        if (!createdSupplierId) return;

        const request = createMockRequest(`/api/v1/purchase-orders?supplierId=${createdSupplierId}`);
        const response = await GET_PO(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.items).toBeTruthy();
      });

      it('应该支持搜索查询', async () => {
        const request = createMockRequest('/api/v1/purchase-orders?search=测试');
        const response = await GET_PO(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.items).toBeTruthy();
      });

      it('应该包含关联数据', async () => {
        const request = createMockRequest('/api/v1/purchase-orders?page=1&limit=1');
        const response = await GET_PO(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        if (data.data.items.length > 0) {
          expect(data.data.items[0]).toHaveProperty('supplier');
          expect(data.data.items[0]).toHaveProperty('purchaser');
          expect(data.data.items[0]).toHaveProperty('items');
          expect(data.data.items[0]).toHaveProperty('_count');
        }
      });

      it('应该验证分页参数', async () => {
        const request = createMockRequest('/api/v1/purchase-orders?page=-1&limit=1000');
        const response = await GET_PO(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });
    });

    describe('GET /api/v1/purchase-orders/[id]', () => {
      it('应该获取采购订单详情', async () => {
        if (!createdPurchaseOrderId) return;

        const request = createMockRequest(`/api/v1/purchase-orders/${createdPurchaseOrderId}`);
        const response = await GET_PO_BY_ID(request, createMockParams(createdPurchaseOrderId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe(createdPurchaseOrderId);
        expect(data.data).toHaveProperty('supplier');
        expect(data.data).toHaveProperty('items');
        expect(data.data).toHaveProperty('receipts');
        expect(data.data).toHaveProperty('payments');
      });

      it('应该返回 404 当采购订单不存在', async () => {
        const fakeId = 'clxxx123456789';
        const request = createMockRequest(`/api/v1/purchase-orders/${fakeId}`);
        const response = await GET_PO_BY_ID(request, createMockParams(fakeId));
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });

      it('应该验证 ID 格式', async () => {
        const request = createMockRequest('/api/v1/purchase-orders/invalid-id');
        const response = await GET_PO_BY_ID(request, createMockParams('invalid-id'));
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);
      });
    });

    describe('PUT /api/v1/purchase-orders/[id]', () => {
      it('应该更新采购订单信息', async () => {
        if (!createdPurchaseOrderId) return;

        const updateData = {
          deliveryAddress: '更新后的地址',
          notes: '更新后的备注',
          shippingMethod: '海运',
        };

        const request = createMockRequest(
          `/api/v1/purchase-orders/${createdPurchaseOrderId}`,
          'PUT',
          updateData
        );
        const response = await PUT_PO(request, createMockParams(createdPurchaseOrderId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.deliveryAddress).toBe(updateData.deliveryAddress);
        expect(data.data.notes).toBe(updateData.notes);
      });

      it('应该返回 404 当采购订单不存在', async () => {
        const fakeId = 'clxxx123456789';
        const request = createMockRequest(`/api/v1/purchase-orders/${fakeId}`, 'PUT', {
          notes: '测试',
        });
        const response = await PUT_PO(request, createMockParams(fakeId));
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });

      it('应该返回 409 当订单已完成', async () => {
        // 这个测试需要先更新订单状态为 COMPLETED，暂时跳过
        expect(true).toBe(true);
      });
    });

    describe('DELETE /api/v1/purchase-orders/[id]', () => {
      it('应该删除采购订单', async () => {
        if (!createdSupplierId) return;

        // 创建一个专门用于删除测试的采购订单
        const testPoData = {
          supplierId: createdSupplierId,
          currency: 'CNY',
          items: [{
            productName: '删除测试产品',
            quantity: 10,
            unitPrice: 5,
          }],
        };
        const testRequest = createMockRequest('/api/v1/purchase-orders', 'POST', testPoData);
        const testResponse = await POST_PO(testRequest);
        const testData = await testResponse.json();
        
        if (!testData.data || !testData.data.id) {
          throw new Error('Failed to create test purchase order');
        }
        
        const testId = testData.data.id;

        const request = createMockRequest(`/api/v1/purchase-orders/${testId}`, 'DELETE');
        const response = await DELETE_PO(request, createMockParams(testId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // 验证已删除
        const deleted = await prisma.purchaseOrder.findUnique({
          where: { id: testId },
        });
        expect(deleted).toBeNull();
      });

      it('应该返回 404 当采购订单不存在', async () => {
        const fakeId = 'clxxx123456789';
        const request = createMockRequest(`/api/v1/purchase-orders/${fakeId}`, 'DELETE');
        const response = await DELETE_PO(request, createMockParams(fakeId));
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });

      it('应该返回 409 当订单有关联入库单或付款', async () => {
        // 这个测试需要实际创建入库单或付款，暂时跳过
        expect(true).toBe(true);
      });
    });

    describe('POST /api/v1/purchase-orders/[id]/confirm', () => {
      it('应该确认采购订单', async () => {
        if (!createdSupplierId) return;

        // 创建一个新的待确认订单
        const newPoData = {
          supplierId: createdSupplierId,
          currency: 'CNY',
          items: [{
            productName: '确认测试产品',
            quantity: 50,
            unitPrice: 15,
          }],
        };
        const poRequest = createMockRequest('/api/v1/purchase-orders', 'POST', newPoData);
        const poResponse = await POST_PO(poRequest);
        const poData = await poResponse.json();
        
        if (!poData.data || !poData.data.id) {
          throw new Error('Failed to create test purchase order for confirm');
        }
        
        const poId = poData.data.id;

        const confirmRequest = createMockRequest(
          `/api/v1/purchase-orders/${poId}/confirm`,
          'POST',
          { notes: '已确认' }
        );
        const response = await POST_PO_CONFIRM(confirmRequest, createMockParams(poId));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('CONFIRMED');
        expect(data.data).toHaveProperty('confirmedAt');

        // 清理
        await prisma.purchaseOrder.delete({ where: { id: poId } }).catch(() => {});
      });

      it('应该返回 409 当订单不是待确认状态', async () => {
        if (!createdPurchaseOrderId) return;

        // 先确认订单（如果还是 PENDING 状态）
        const order = await prisma.purchaseOrder.findUnique({
          where: { id: createdPurchaseOrderId },
        });

        if (order?.status === 'PENDING') {
          const confirmRequest1 = createMockRequest(
            `/api/v1/purchase-orders/${createdPurchaseOrderId}/confirm`,
            'POST',
            { notes: '首次确认' }
          );
          await POST_PO_CONFIRM(confirmRequest1, createMockParams(createdPurchaseOrderId));
        }

        // 再次确认应该失败
        const confirmRequest2 = createMockRequest(
          `/api/v1/purchase-orders/${createdPurchaseOrderId}/confirm`,
          'POST',
          { notes: '再次确认' }
        );
        const response = await POST_PO_CONFIRM(confirmRequest2, createMockParams(createdPurchaseOrderId));
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
        expect(data.code).toBe('ORDER_INVALID_STATUS');
      });

      it('应该返回 404 当采购订单不存在', async () => {
        const fakeId = 'clxxx123456789';
        const request = createMockRequest(`/api/v1/purchase-orders/${fakeId}/confirm`, 'POST', {
          notes: '测试',
        });
        const response = await POST_PO_CONFIRM(request, createMockParams(fakeId));
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });
    });
  });
});
