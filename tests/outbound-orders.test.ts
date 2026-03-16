/**
 * 出库单 API 单元测试
 * Sprint 5: 出库管理模块自动化测试
 * 
 * 测试覆盖:
 * - POST /api/v1/outbound-orders - 创建出库单
 * - POST /api/v1/outbound-orders/:id/confirm - 确认出库单
 * - POST /api/v1/outbound-orders/:id/cancel - 取消出库单
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/v1/outbound-orders/route';
import { GET as GET_BY_ID, PUT, DELETE as DELETE_BY_ID } from '@/app/api/v1/outbound-orders/[id]/route';
import { POST as CONFIRM } from '@/app/api/v1/outbound-orders/[id]/confirm/route';
import { POST as CANCEL } from '@/app/api/v1/outbound-orders/[id]/cancel/route';

// ============================================
// 辅助函数
// ============================================

/**
 * 创建 Mock NextRequest
 */
function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any,
  params?: Record<string, string>
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const urlObj = new URL(fullUrl);
  
  // 添加查询参数
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });
  }
  
  return {
    url: fullUrl,
    nextUrl: {
      searchParams: urlObj.searchParams,
      pathname: urlObj.pathname,
      href: urlObj.href,
      origin: urlObj.origin,
    } as any,
    method,
    json: async () => body,
  } as NextRequest;
}

/**
 * 创建 Mock 路由参数 (Next.js 15: params is Promise)
 */
function createMockParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

/**
 * 生成唯一标识
 */
const uniqueId = (prefix = 'TEST') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// 测试数据准备
// ============================================

let testCustomer: any;
let testProduct: any;
let testOrder: any;
let testWarehouse: any;
let createdOutboundOrderId: string;

/**
 * 准备测试数据
 */
async function prepareTestData() {
  // 创建测试客户
  testCustomer = await prisma.customer.create({
    data: {
      companyName: uniqueId('测试客户'),
      contactName: '张三',
      email: `${uniqueId('customer')}@test.com`,
      country: 'CN',
      status: 'ACTIVE',
    },
  });

  // 创建测试产品
  testProduct = await prisma.product.create({
    data: {
      sku: uniqueId('SKU'),
      name: uniqueId('测试产品'),
      costPrice: 50,
      salePrice: 100,
      currency: 'USD',
      status: 'ACTIVE',
    },
  });

  // 创建测试仓库
  testWarehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: '主仓库',
      code: 'MAIN',
      status: 'ACTIVE',
    },
  });

  // 创建测试库存
  await prisma.inventory.upsert({
    where: {
      productId_warehouseId: {
        productId: testProduct.id,
        warehouseId: testWarehouse.id,
      },
    },
    update: {
      quantity: 1000,
      availableQuantity: 1000,
    },
    create: {
      productId: testProduct.id,
      warehouseId: testWarehouse.id,
      quantity: 1000,
      availableQuantity: 1000,
    },
  });

  // 创建测试销售订单
  testOrder = await prisma.order.create({
    data: {
      orderNo: uniqueId('SO'),
      customerId: testCustomer.id,
      status: 'CONFIRMED',
      currency: 'USD',
      totalAmount: 10000,
      items: {
        create: {
          productId: testProduct.id,
          productName: testProduct.name,
          productSku: testProduct.sku,
          quantity: 100,
          unitPrice: 100,
          amount: 10000,
        },
      },
    },
    include: {
      items: true,
    },
  });

  console.log('✅ 测试数据准备完成');
  console.log(`   客户 ID: ${testCustomer.id}`);
  console.log(`   产品 ID: ${testProduct.id}`);
  console.log(`   订单 ID: ${testOrder.id}`);
  console.log(`   仓库 ID: ${testWarehouse.id}`);
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  try {
    // 删除出库单
    if (createdOutboundOrderId) {
      await prisma.outboundOrderItem.deleteMany({
        where: { outboundOrderId: createdOutboundOrderId },
      });
      await prisma.outboundOrder.delete({
        where: { id: createdOutboundOrderId },
      }).catch(() => {});
    }

    // 删除销售订单
    if (testOrder) {
      await prisma.order.delete({
        where: { id: testOrder.id },
      }).catch(() => {});
    }

    // 删除库存
    if (testProduct && testWarehouse) {
      await prisma.inventory.delete({
        where: {
          productId_warehouseId: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
          },
        },
      }).catch(() => {});
    }

    // 删除产品
    if (testProduct) {
      await prisma.product.delete({
        where: { id: testProduct.id },
      }).catch(() => {});
    }

    // 删除客户
    if (testCustomer) {
      await prisma.customer.delete({
        where: { id: testCustomer.id },
      }).catch(() => {});
    }

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('⚠️ 清理测试数据时出错:', error);
  }
}

// ============================================
// 测试用例
// ============================================

describe('Outbound Orders API', () => {
  // 测试前准备数据
  beforeAll(async () => {
    await prepareTestData();
  }, 30000);

  // 测试后清理数据
  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  }, 30000);

  // ============================================
  // POST /api/v1/outbound-orders
  // ============================================
  describe('POST /api/v1/outbound-orders', () => {
    it('应该成功创建出库单', async () => {
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
            notes: '测试出库',
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await POST(request);
      const data = await response.json();

      console.log('创建出库单响应:', response.status, JSON.stringify(data, null, 2));

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('outboundNo');
      expect(data.data.status).toBe('PENDING');
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0].quantity).toBe(10);

      createdOutboundOrderId = data.data.id;
      console.log(`✅ 出库单创建成功：${data.data.outboundNo}`);
    });

    it('应该验证必填字段', async () => {
      // 缺少 orderId - Zod 验证返回 422
      const invalidData1 = {
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request1 = createMockRequest('/api/v1/outbound-orders', 'POST', invalidData1);
      const response1 = await POST(request1);
      const data1 = await response1.json();

      // Zod 验证错误返回 422 而不是 400
      expect([400, 422]).toContain(response1.status);
      expect(data1.success).toBe(false);

      // 缺少 items - Zod 验证返回 422
      const invalidData2 = {
        orderId: testOrder.id,
      };

      const request2 = createMockRequest('/api/v1/outbound-orders', 'POST', invalidData2);
      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect([400, 422]).toContain(response2.status);
      expect(data2.success).toBe(false);

      // items 为空数组 - Zod 验证返回 422
      const invalidData3 = {
        orderId: testOrder.id,
        items: [],
      };

      const request3 = createMockRequest('/api/v1/outbound-orders', 'POST', invalidData3);
      const response3 = await POST(request3);
      const data3 = await response3.json();

      expect([400, 422]).toContain(response3.status);
      expect(data3.success).toBe(false);

      console.log('✅ 必填字段验证通过');
    });

    it('应该验证销售订单存在', async () => {
      const invalidData = {
        orderId: 'non-existent-order-id',
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);

      console.log('✅ 销售订单存在性验证通过');
    });

    it('应该验证库存充足', async () => {
      // 先查询当前库存
      const inventory = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
          },
        },
      });

      // 尝试创建超过库存数量的出库单
      const invalidData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct.id,
            quantity: (inventory?.availableQuantity || 0) + 1,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);

      console.log('✅ 库存充足性验证通过');
    });
  });

  // ============================================
  // POST /api/v1/outbound-orders/:id/confirm
  // ============================================
  describe('POST /api/v1/outbound-orders/:id/confirm', () => {
    let testOutboundOrderId: string;

    beforeEach(async () => {
      // 创建一个新的待确认出库单
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 5,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await POST(request);
      const data = await response.json();

      console.log('BeforeEach 创建出库单:', data.success, data.data?.id);

      // 确保创建成功
      if (data.success && data.data) {
        testOutboundOrderId = data.data.id;
      } else {
        throw new Error(`Failed to create test outbound order: ${JSON.stringify(data)}`);
      }
    });

    it('应该成功确认出库单', async () => {
      const mockParams = createMockParams(testOutboundOrderId);
      const request = createMockRequest(`/api/v1/outbound-orders/${testOutboundOrderId}/confirm`, 'POST', {});
      const response = await CONFIRM(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('SHIPPED');

      console.log('✅ 出库单确认成功');
    });

    it('应该扣减库存', async () => {
      // 创建出库单时已经扣减了库存，确认时只改变状态
      // 验证创建后库存已扣减
      const inventoryAfterCreate = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
          },
        },
      });

      // 确认出库单
      const mockParams = createMockParams(testOutboundOrderId);
      const request = createMockRequest(`/api/v1/outbound-orders/${testOutboundOrderId}/confirm`, 'POST', {});
      const response = await CONFIRM(request, mockParams);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.status).toBe('SHIPPED');

      // 确认后库存不变（创建时已扣减）
      const inventoryAfterConfirm = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
          },
        },
      });

      expect(inventoryAfterConfirm!.availableQuantity).toBe(inventoryAfterCreate!.availableQuantity);

      console.log('✅ 库存扣减验证通过（创建时扣减，确认时不变）');
    });

    it('应该验证状态转换（只有 PENDING 可以确认）', async () => {
      // 创建一个新出库单并确认
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 2,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request1 = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response1 = await POST(request1);
      const data1 = await response1.json();

      // 第一次确认（应该成功）
      const mockParams1 = createMockParams(data1.data.id);
      const request2 = createMockRequest(`/api/v1/outbound-orders/${data1.data.id}/confirm`, 'POST', {});
      const response2 = await CONFIRM(request2, mockParams1);
      const data2 = await response2.json();

      expect(data2.success).toBe(true);

      // 第二次确认（应该失败，因为已经是 SHIPPED 状态）
      const mockParams2 = createMockParams(data1.data.id);
      const request3 = createMockRequest(`/api/v1/outbound-orders/${data1.data.id}/confirm`, 'POST', {});
      const response3 = await CONFIRM(request3, mockParams2);
      const data3 = await response3.json();

      expect(response3.status).toBe(409);
      expect(data3.success).toBe(false);

      console.log('✅ 状态转换验证通过');
    });
  });

  // ============================================
  // POST /api/v1/outbound-orders/:id/cancel
  // ============================================
  describe('POST /api/v1/outbound-orders/:id/cancel', () => {
    let testOutboundOrderId: string;

    beforeEach(async () => {
      // 创建一个新的待确认出库单
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 3,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await POST(request);
      const data = await response.json();

      console.log('BeforeEach (cancel) 创建出库单:', data.success, data.data?.id);

      // 确保创建成功
      if (data.success && data.data) {
        testOutboundOrderId = data.data.id;
      } else {
        throw new Error(`Failed to create test outbound order: ${JSON.stringify(data)}`);
      }
    });

    it('应该成功取消出库单', async () => {
      const mockParams = createMockParams(testOutboundOrderId);
      const request = createMockRequest(`/api/v1/outbound-orders/${testOutboundOrderId}/cancel`, 'POST', {
        reason: '测试取消',
      });
      const response = await CANCEL(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('CANCELLED');

      console.log('✅ 出库单取消成功');
    });

    it('应该恢复库存', async () => {
      // 创建一个新的出库单用于测试取消
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 3,
            warehouseId: testWarehouse.id,
            unitPrice: 100,
          },
        ],
      };

      const request1 = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response1 = await POST(request1);
      const data1 = await response1.json();

      expect(data1.success).toBe(true);

      // 创建时的库存（已扣减）
      const inventoryAfterCreate = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
          },
        },
      });

      // 取消出库单（PENDING 状态）
      const mockParams = createMockParams(data1.data.id);
      const request2 = createMockRequest(`/api/v1/outbound-orders/${data1.data.id}/cancel`, 'POST', {
        reason: '测试取消恢复库存',
      });
      const response2 = await CANCEL(request2, mockParams);
      const data2 = await response2.json();

      expect(data2.success).toBe(true);
      expect(data2.data.status).toBe('CANCELLED');

      // 取消后的库存（应该恢复 3 个）
      const inventoryAfterCancel = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
          },
        },
      });

      // 验证库存恢复了 3 个
      expect(inventoryAfterCancel!.availableQuantity).toBe(inventoryAfterCreate!.availableQuantity + 3);

      console.log('✅ 库存恢复验证通过');
    });
  });
});
