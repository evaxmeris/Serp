import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as CREATE_INBOUND } from '../src/app/api/v1/inbound-orders/route';
import { GET as LIST_INBOUND } from '../src/app/api/v1/inbound-orders/route';
import { GET as GET_INBOUND, PUT as UPDATE_INBOUND, DELETE as DELETE_INBOUND } from '../src/app/api/v1/inbound-orders/[id]/route';
import { POST as CONFIRM_INBOUND } from '../src/app/api/v1/inbound-orders/[id]/confirm/route';
import { POST as CANCEL_INBOUND } from '../src/app/api/v1/inbound-orders/[id]/cancel/route';
import { GET as LIST_INVENTORY, POST as ADJUST_INVENTORY } from '../src/app/api/v1/inventory/route';

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

// ==================== 测试数据工厂函数 ====================

function createTestInboundOrderData(warehouseId: string, supplierId: string, productId: string) {
  return {
    type: 'PURCHASE_IN' as const,
    supplierId: supplierId,
    warehouseId: warehouseId,
    expectedDate: new Date().toISOString(),
    note: '测试入库单',
    items: [
      {
        productId: productId,
        expectedQuantity: 100,
        unitPrice: 10.5,
        batchNo: 'BATCH-001',
      },
    ],
  };
}

// ==================== 工具函数 ====================

async function createTestSupplier() {
  const now = Date.now();
  return await prisma.supplier.create({
    data: {
      supplierNo: `SUP-${now}`,
      companyName: `测试供应商_${now}`,
      email: `test_${now}@example.com`,
      status: 'ACTIVE',
    },
  });
}

async function createTestProduct() {
  const now = Date.now();
  return await prisma.product.create({
    data: {
      sku: `SKU_${now}`,
      name: `测试产品_${now}`,
      costPrice: 8.5,
      salePrice: 12.0,
      status: 'ACTIVE',
    },
  });
}

async function ensureDefaultWarehouse() {
  let warehouse = await prisma.warehouse.findUnique({
    where: { code: 'default' },
  });
  
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        code: 'default',
        name: '默认仓库',
        status: 'ACTIVE',
      },
    });
  }
  
  return warehouse;
}

// ==================== 入库单管理测试 ====================

describe('Inbound Orders API', () => {
  let testSupplier: any;
  let testProduct: any;
  let testWarehouse: any;
  let createdInboundId: string;

  beforeAll(async () => {
    testSupplier = await createTestSupplier();
    testProduct = await createTestProduct();
    // 创建或获取默认仓库（使用 upsert 避免重复）
    const warehouse = await prisma.warehouse.upsert({
      where: { code: 'default' },
      create: {
        code: 'default',
        name: '默认仓库',
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
      },
    });
    testWarehouse = warehouse;
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdInboundId) {
      await prisma.inboundOrder.delete({ where: { id: createdInboundId } }).catch(() => {});
    }
    if (testWarehouse) {
      await prisma.warehouse.delete({ where: { id: testWarehouse.id } }).catch(() => {});
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.delete({ where: { id: testSupplier.id } }).catch(() => {});
    }
  });

  describe('POST /api/v1/inbound-orders', () => {
    it('应该成功创建入库单', async () => {
      const inboundData = createTestInboundOrderData(testWarehouse.id, testSupplier.id, testProduct.id);

      const request = createMockRequest('/api/v1/inbound-orders', 'POST', inboundData);
      const response = await CREATE_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.inboundNo).toBeDefined();
      expect(data.data.status).toBe('PENDING');
      expect(data.data.items).toHaveLength(1);

      createdInboundId = data.data.id;
    });

    it('应该验证必填字段 type', async () => {
      const invalidData = {
        ...createTestInboundOrderData(testWarehouse.id, testSupplier.id, testProduct.id),
        type: undefined,
      };

      const request = createMockRequest('/api/v1/inbound-orders', 'POST', invalidData);
      const response = await CREATE_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });

    it('应该验证 items 至少有一项', async () => {
      const invalidData = {
        type: 'PURCHASE_IN',
        items: [],
      };

      const request = createMockRequest('/api/v1/inbound-orders', 'POST', invalidData);
      const response = await CREATE_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });

    it('应该验证产品是否存在', async () => {
      const invalidData = {
        ...createTestInboundOrderData(testWarehouse.id, testSupplier.id, 'invalid-id'),
        items: [
          {
            productId: 'invalid-id',
            expectedQuantity: 100,
            unitPrice: 10.5,
          },
        ],
      };

      const request = createMockRequest('/api/v1/inbound-orders', 'POST', invalidData);
      const response = await CREATE_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/inbound-orders', () => {
    it('应该获取入库单列表', async () => {
      const request = createMockRequest('/api/v1/inbound-orders', 'GET');
      const response = await LIST_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.pagination).toBeDefined();
    });

    it('应该支持按状态筛选', async () => {
      const request = createMockRequest('/api/v1/inbound-orders?status=PENDING', 'GET');
      const response = await LIST_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items.every((item: any) => item.status === 'PENDING')).toBe(true);
    });

    it('应该支持按类型筛选', async () => {
      const request = createMockRequest('/api/v1/inbound-orders?type=PURCHASE_IN', 'GET');
      const response = await LIST_INBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items.every((item: any) => item.type === 'PURCHASE_IN')).toBe(true);
    });
  });

  describe('GET /api/v1/inbound-orders/[id]', () => {
    it('应该获取入库单详情', async () => {
      const request = createMockRequest(`/api/v1/inbound-orders/${createdInboundId}`, 'GET');
      const response = await GET_INBOUND(request, createMockParams(createdInboundId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdInboundId);
      expect(data.data.items).toBeDefined();
    });

    it('应该返回 404 当入库单不存在', async () => {
      const request = createMockRequest('/api/v1/inbound-orders/non-existent-id', 'GET');
      const response = await GET_INBOUND(request, createMockParams('non-existent-id'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/v1/inbound-orders/[id]', () => {
    it('应该更新入库单信息', async () => {
      const updateData = {
        note: '更新后的备注',
      };

      const request = createMockRequest(`/api/v1/inbound-orders/${createdInboundId}`, 'PUT', updateData);
      const response = await UPDATE_INBOUND(request, createMockParams(createdInboundId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.note).toBe('更新后的备注');
    });

    it('应该返回 409 当入库单已完成', async () => {
      // 先确认入库单
      const confirmRequest = createMockRequest(`/api/v1/inbound-orders/${createdInboundId}/confirm`, 'POST', {});
      await CONFIRM_INBOUND(confirmRequest, createMockParams(createdInboundId));

      // 尝试更新
      const updateData = { note: '不应该成功' };
      const request = createMockRequest(`/api/v1/inbound-orders/${createdInboundId}`, 'PUT', updateData);
      const response = await UPDATE_INBOUND(request, createMockParams(createdInboundId));
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/inbound-orders/[id]', () => {
    it('应该返回 409 当入库单已完成', async () => {
      const request = createMockRequest(`/api/v1/inbound-orders/${createdInboundId}`, 'DELETE');
      const response = await DELETE_INBOUND(request, createMockParams(createdInboundId));
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/v1/inbound-orders/[id]/confirm', () => {
    it('应该确认入库单', async () => {
      // 创建一个新的入库单用于确认测试
      const newInboundData = createTestInboundOrderData(testWarehouse.id, testSupplier.id, testProduct.id);
      newInboundData.items[0].expectedQuantity = 50;

      const createRequest = createMockRequest('/api/v1/inbound-orders', 'POST', newInboundData);
      const createResponse = await CREATE_INBOUND(createRequest);
      const createData = await createResponse.json();
      const newInboundId = createData.data.id;

      // 确认入库
      const confirmRequest = createMockRequest(`/api/v1/inbound-orders/${newInboundId}/confirm`, 'POST', {});
      const response = await CONFIRM_INBOUND(confirmRequest, createMockParams(newInboundId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('COMPLETED');

      // 清理
      await prisma.inboundOrder.delete({ where: { id: newInboundId } }).catch(() => {});
    });

    it('应该返回 409 当入库单已完成', async () => {
      const confirmRequest = createMockRequest(`/api/v1/inbound-orders/${createdInboundId}/confirm`, 'POST', {});
      const response = await CONFIRM_INBOUND(confirmRequest, createMockParams(createdInboundId));
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/v1/inbound-orders/[id]/cancel', () => {
    it('应该取消入库单', async () => {
      // 创建一个新的入库单用于取消测试
      const newInboundData = createTestInboundOrderData(testWarehouse.id, testSupplier.id, testProduct.id);
      newInboundData.items[0].expectedQuantity = 30;

      const createRequest = createMockRequest('/api/v1/inbound-orders', 'POST', newInboundData);
      const createResponse = await CREATE_INBOUND(createRequest);
      const createData = await createResponse.json();
      const newInboundId = createData.data.id;

      // 取消入库
      const cancelRequest = createMockRequest(`/api/v1/inbound-orders/${newInboundId}/cancel`, 'POST', { reason: '测试取消' });
      const response = await CANCEL_INBOUND(cancelRequest, createMockParams(newInboundId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('CANCELLED');

      // 清理
      await prisma.inboundOrder.delete({ where: { id: newInboundId } }).catch(() => {});
    });
  });
});

// ==================== 库存管理测试 ====================

describe('Inventory API', () => {
  let testProduct: any;
  let testWarehouse: any;

  beforeAll(async () => {
    testProduct = await createTestProduct();
    testWarehouse = await ensureDefaultWarehouse();
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
  });

  describe('GET /api/v1/inventory', () => {
    it('应该获取库存列表', async () => {
      const request = createMockRequest('/api/v1/inventory', 'GET');
      const response = await LIST_INVENTORY(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('应该支持按产品筛选', async () => {
      const request = createMockRequest(`/api/v1/inventory?productId=${testProduct.id}`, 'GET');
      const response = await LIST_INVENTORY(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items.every((item: any) => item.productId === testProduct.id)).toBe(true);
    });
  });

  describe('POST /api/v1/inventory/adjust', () => {
    it('应该成功调整库存（增加）', async () => {
      const adjustData = {
        productId: testProduct.id,
        warehouseId: testWarehouse.id,
        quantity: 100,
        type: 'IN' as const,
        note: '测试入库',
      };

      const request = createMockRequest('/api/v1/inventory/adjust', 'POST', adjustData);
      const response = await ADJUST_INVENTORY(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.afterQuantity).toBe(100);
    });

    it('应该成功调整库存（减少）', async () => {
      const adjustData = {
        productId: testProduct.id,
        warehouseId: testWarehouse.id,
        quantity: -20,
        type: 'OUT' as const,
        note: '测试出库',
      };

      const request = createMockRequest('/api/v1/inventory/adjust', 'POST', adjustData);
      const response = await ADJUST_INVENTORY(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.afterQuantity).toBe(80);
    });

    it('应该返回 409 当调整后库存为负', async () => {
      const adjustData = {
        productId: testProduct.id,
        warehouseId: testWarehouse.id,
        quantity: -1000,
        type: 'OUT' as const,
        note: '应该失败',
      };

      const request = createMockRequest('/api/v1/inventory/adjust', 'POST', adjustData);
      const response = await ADJUST_INVENTORY(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });

    it('应该验证必填字段', async () => {
      const invalidData = {
        productId: undefined,
        warehouseId: testWarehouse.id,
        quantity: 100,
      };

      const request = createMockRequest('/api/v1/inventory/adjust', 'POST', invalidData);
      const response = await ADJUST_INVENTORY(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });
  });
});
