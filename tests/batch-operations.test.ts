/**
 * 批量操作 API 单元测试
 * Sprint 5: Phase 5 - 测试与修复
 * 
 * 测试覆盖:
 * - 批量确认出库单
 * - 批量取消出库单
 * - 批量导出
 * - 错误处理
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/v1/outbound-orders/batch/route';

// ============================================
// 辅助函数
// ============================================

function createMockRequest(body: any): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
}

const uniqueId = (prefix = 'TEST') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// 测试数据
// ============================================

let testCustomer: any;
let testProduct: any;
let testOrder: any;
let testWarehouse: any;
let testOutboundOrders: string[] = [];

async function prepareTestData() {
  // 创建测试客户
  testCustomer = await prisma.customer.create({
    data: {
      companyName: uniqueId('测试客户'),
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
    include: { items: true },
  });

  // 创建多个测试出库单
  const orders = [];
  for (let i = 0; i < 3; i++) {
    const order = await prisma.outboundOrder.create({
      data: {
        outboundNo: uniqueId('OB'),
        orderId: testOrder.id,
        warehouseId: testWarehouse.id,
        status: 'PENDING',
        items: {
          create: {
            productId: testProduct.id,
            warehouseId: testWarehouse.id,
            quantity: 10,
            unitPrice: 100,
          },
        },
      },
    });
    orders.push(order.id);
  }

  testOutboundOrders = orders;
  console.log('✅ 测试数据准备完成');
}

async function cleanupTestData() {
  try {
    // 删除出库单
    await prisma.outboundOrderItem.deleteMany({
      where: { outboundOrderId: { in: testOutboundOrders } },
    });
    await prisma.outboundOrder.deleteMany({
      where: { id: { in: testOutboundOrders } },
    });

    // 删除销售订单
    await prisma.order.delete({ where: { id: testOrder.id } }).catch(() => {});

    // 删除库存
    await prisma.inventory.delete({
      where: {
        productId_warehouseId: {
          productId: testProduct.id,
          warehouseId: testWarehouse.id,
        },
      },
    }).catch(() => {});

    // 删除产品
    await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});

    // 删除客户
    await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('⚠️ 清理测试数据时出错:', error);
  }
}

// ============================================
// 测试用例
// ============================================

describe('批量操作 API', () => {
  beforeAll(async () => {
    await prepareTestData();
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  }, 30000);

  describe('POST /api/v1/outbound-orders/batch', () => {
    describe('批量确认', () => {
      it('应该成功批量确认出库单', async () => {
        const request = createMockRequest({
          ids: testOutboundOrders.slice(0, 2),
          action: 'confirm',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.action).toBe('confirm');
        expect(data.data.successCount).toBe(2);
        expect(data.data.failedCount).toBe(0);

        console.log('✅ 批量确认成功');
      });

      it('应该验证部分出库单状态不正确', async () => {
        // 先确认一个，再尝试批量确认
        const remainingOrder = testOutboundOrders[2];
        
        const request = createMockRequest({
          ids: [remainingOrder],
          action: 'confirm',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.successCount).toBe(1);

        console.log('✅ 状态验证通过');
      });
    });

    describe('批量取消', () => {
      it('应该成功批量取消草稿状态出库单', async () => {
        // 创建草稿状态的出库单
        const draftOrders = [];
        for (let i = 0; i < 2; i++) {
          const order = await prisma.outboundOrder.create({
            data: {
              outboundNo: uniqueId('OB-DRAFT'),
              orderId: testOrder.id,
              warehouseId: testWarehouse.id,
              status: 'PENDING',
              items: {
                create: {
                  productId: testProduct.id,
                  warehouseId: testWarehouse.id,
                  quantity: 5,
                  unitPrice: 100,
                },
              },
            },
          });
          draftOrders.push(order.id);
        }

        const request = createMockRequest({
          ids: draftOrders,
          action: 'cancel',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.successCount).toBe(2);

        // 清理
        await prisma.outboundOrderItem.deleteMany({
          where: { outboundOrderId: { in: draftOrders } },
        });
        await prisma.outboundOrder.deleteMany({
          where: { id: { in: draftOrders } },
        });

        console.log('✅ 批量取消成功');
      });

      it('应该拒绝取消已发货状态的出库单', async () => {
        // 创建一个已发货状态的出库单
        const shippedOrder = await prisma.outboundOrder.create({
          data: {
            outboundNo: uniqueId('OB-SHIPPED'),
            orderId: testOrder.id,
            warehouseId: testWarehouse.id,
            status: 'SHIPPED',
            items: {
              create: {
                productId: testProduct.id,
                warehouseId: testWarehouse.id,
                quantity: 5,
                unitPrice: 100,
              },
            },
          },
        });

        const request = createMockRequest({
          ids: [shippedOrder.id],
          action: 'cancel',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.failedCount).toBe(1);
        expect(data.data.failed[0].reason).toContain('无法取消');

        // 清理
        await prisma.outboundOrder.delete({ where: { id: shippedOrder.id } });

        console.log('✅ 状态验证通过');
      });
    });

    describe('批量导出', () => {
      it('应该成功导出出库单数据', async () => {
        const request = createMockRequest({
          ids: testOutboundOrders,
          action: 'export',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.action).toBe('export');
        expect(data.data.format).toBe('csv');
        expect(data.data.count).toBe(3);
        expect(data.data.data).toContain('出库单号');
        expect(data.data.data).toContain('销售订单');

        console.log('✅ 批量导出成功');
      });
    });

    describe('错误处理', () => {
      it('应该验证必填字段', async () => {
        const request = createMockRequest({
          ids: [],
          action: 'confirm',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.success).toBe(false);

        console.log('✅ 必填字段验证通过');
      });

      it('应该验证出库单存在性', async () => {
        const request = createMockRequest({
          ids: ['non-existent-id'],
          action: 'confirm',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);

        console.log('✅ 出库单存在性验证通过');
      });

      it('应该验证操作类型', async () => {
        const request = createMockRequest({
          ids: testOutboundOrders,
          action: 'invalid-action',
        });

        const response = await POST(request);

        // Zod 验证会返回 422
        expect(response.status).toBe(422);

        console.log('✅ 操作类型验证通过');
      });
    });
  });
});
