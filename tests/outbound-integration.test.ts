/**
 * 出库管理集成测试
 * Sprint 5: 销售订单→出库单→库存扣减→发货全流程测试
 * 
 * 测试流程:
 * 1. 创建销售订单
 * 2. 创建出库单
 * 3. 确认出库单（扣减库存）
 * 4. 验证库存变化
 * 5. 验证销售订单状态更新
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as CREATE_OUTBOUND } from '@/app/api/v1/outbound-orders/route';
import { POST as CONFIRM } from '@/app/api/v1/outbound-orders/[id]/confirm/route';
import { POST as CANCEL } from '@/app/api/v1/outbound-orders/[id]/cancel/route';

// ============================================
// 辅助函数
// ============================================

function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const urlObj = new URL(fullUrl);
  
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

function createMockParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

const uniqueId = (prefix = 'TEST') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// 测试数据
// ============================================

let testCustomer: any;
let testProduct1: any;
let testProduct2: any;
let testWarehouse: any;
let testOrder: any;

// ============================================
// 集成测试
// ============================================

describe('Outbound Integration Tests', () => {
  // ============================================
  // 测试前准备
  // ============================================
  beforeAll(async () => {
    console.log('\n📦 开始准备集成测试数据...\n');

    // 创建测试客户
    testCustomer = await prisma.customer.create({
      data: {
        companyName: uniqueId('集成测试客户'),
        contactName: '李四',
        email: `${uniqueId('customer')}@test.com`,
        country: 'CN',
        status: 'ACTIVE',
      },
    });

    // 创建测试产品 1
    testProduct1 = await prisma.product.create({
      data: {
        sku: uniqueId('SKU1'),
        name: uniqueId('测试产品 1'),
        costPrice: 50,
        salePrice: 100,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    // 创建测试产品 2
    testProduct2 = await prisma.product.create({
      data: {
        sku: uniqueId('SKU2'),
        name: uniqueId('测试产品 2'),
        costPrice: 30,
        salePrice: 80,
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

    // 创建测试库存（产品 1: 500 个，产品 2: 300 个）
    await prisma.inventory.upsert({
      where: {
          productId: testProduct1.id,
        },
      },
      update: {
        quantity: 500,
        availableQuantity: 500,
      },
      create: {
        productId: testProduct1.id,
        quantity: 500,
        availableQuantity: 500,
      },
    });

    await prisma.inventory.upsert({
      where: {
          productId: testProduct2.id,
        },
      },
      update: {
        quantity: 300,
        availableQuantity: 300,
      },
      create: {
        productId: testProduct2.id,
        quantity: 300,
        availableQuantity: 300,
      },
    });

    // 创建测试销售订单（包含 2 个产品）
    testOrder = await prisma.order.create({
      data: {
        orderNo: uniqueId('SO-INT'),
        customerId: testCustomer.id,
        status: 'CONFIRMED',
        currency: 'USD',
        totalAmount: 7400,
        items: {
          create: [
            {
              productId: testProduct1.id,
              productName: testProduct1.name,
              productSku: testProduct1.sku,
              quantity: 50,
              unitPrice: 100,
              amount: 5000,
            },
            {
              productId: testProduct2.id,
              productName: testProduct2.name,
              productSku: testProduct2.sku,
              quantity: 30,
              unitPrice: 80,
              amount: 2400,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });

    console.log('✅ 集成测试数据准备完成\n');
    console.log(`   客户：${testCustomer.companyName} (ID: ${testCustomer.id})`);
    console.log(`   产品 1: ${testProduct1.name} (ID: ${testProduct1.id})`);
    console.log(`   产品 2: ${testProduct2.name} (ID: ${testProduct2.id})`);
    console.log(`   仓库：${testWarehouse.name} (ID: ${testWarehouse.id})`);
    console.log(`   销售订单：${testOrder.orderNo} (ID: ${testOrder.id})`);
    console.log(`   订单金额：$${testOrder.items.reduce((sum: number, item: any) => sum + Number(item.amount), 0)}\n`);
  }, 30000);

  // ============================================
  // 测试后清理
  // ============================================
  afterAll(async () => {
    console.log('\n🧹 开始清理集成测试数据...\n');

    try {
      // 删除出库单
      const outboundOrders = await prisma.outboundOrder.findMany({
        where: {
          OR: [
            { orderId: testOrder?.id },
          ],
        },
        include: {
          items: true,
        },
      });

      for (const order of outboundOrders) {
        await prisma.outboundOrderItem.deleteMany({
          where: { outboundOrderId: order.id },
        });
        await prisma.outboundOrder.delete({
          where: { id: order.id },
        }).catch(() => {});
      }

      // 删除销售订单
      if (testOrder) {
        await prisma.order.delete({
          where: { id: testOrder.id },
        }).catch(() => {});
      }

      // 删除库存
      if (testProduct1 && testWarehouse) {
        await prisma.inventory.delete({
          where: {
              productId: testProduct1.id,
            },
          },
        }).catch(() => {});
      }

      if (testProduct2 && testWarehouse) {
        await prisma.inventory.delete({
          where: {
              productId: testProduct2.id,
            },
          },
        }).catch(() => {});
      }

      // 删除产品
      if (testProduct1) {
        await prisma.product.delete({
          where: { id: testProduct1.id },
        }).catch(() => {});
      }

      if (testProduct2) {
        await prisma.product.delete({
          where: { id: testProduct2.id },
        }).catch(() => {});
      }

      // 删除客户
      if (testCustomer) {
        await prisma.customer.delete({
          where: { id: testCustomer.id },
        }).catch(() => {});
      }

      console.log('✅ 集成测试数据清理完成\n');
    } catch (error) {
      console.error('⚠️ 清理测试数据时出错:', error);
    }

    await prisma.$disconnect();
  }, 30000);

  // ============================================
  // 集成测试用例
  // ============================================

  describe('完整出库流程测试', () => {
    let createdOutboundOrderId: string;
    let initialInventory1: number;
    let initialInventory2: number;

    it('应该记录初始库存', async () => {
      const inv1 = await prisma.inventory.findUnique({
        where: {
            productId: testProduct1.id,
          },
        },
      });

      const inv2 = await prisma.inventory.findUnique({
        where: {
            productId: testProduct2.id,
          },
        },
      });

      initialInventory1 = inv1!.availableQuantity;
      initialInventory2 = inv2!.availableQuantity;

      expect(initialInventory1).toBe(500);
      expect(initialInventory2).toBe(300);

      console.log(`📊 初始库存 - 产品 1: ${initialInventory1}, 产品 2: ${initialInventory2}`);
    });

    it('应该成功创建出库单（多产品）', async () => {
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct1.id,
            quantity: 20,
            unitPrice: 100,
            notes: '第一批出库',
          },
          {
            productId: testProduct2.id,
            quantity: 15,
            unitPrice: 80,
            notes: '第一批出库',
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await CREATE_OUTBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('outboundNo');
      expect(data.data.status).toBe('PENDING');
      expect(data.data.items).toHaveLength(2);

      createdOutboundOrderId = data.data.id;

      console.log(`✅ 出库单创建成功：${data.data.outboundNo}`);
      console.log(`   产品 1 出库：20 个`);
      console.log(`   产品 2 出库：15 个`);
    });

    it('创建出库单后应该立即扣减库存', async () => {
      const inv1 = await prisma.inventory.findUnique({
        where: {
            productId: testProduct1.id,
          },
        },
      });

      const inv2 = await prisma.inventory.findUnique({
        where: {
            productId: testProduct2.id,
          },
        },
      });

      // 创建出库单时已经扣减了库存
      expect(inv1!.availableQuantity).toBe(initialInventory1 - 20);
      expect(inv2!.availableQuantity).toBe(initialInventory2 - 15);

      console.log(`📉 创建后库存 - 产品 1: ${inv1!.availableQuantity} (-20), 产品 2: ${inv2!.availableQuantity} (-15)`);
    });

    it('应该验证库存日志已创建', async () => {
      const logs = await prisma.inventoryLog.findMany({
        where: {
          referenceType: 'OUTBOUND_ORDER',
          referenceId: createdOutboundOrderId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(logs).toHaveLength(2);
      expect(logs[0].type).toBe('OUT');
      expect(logs[0].quantity).toBeLessThan(0);

      console.log(`📝 库存日志已创建：${logs.length} 条记录`);
    });

    it('应该成功确认出库单', async () => {
      const mockParams = createMockParams(createdOutboundOrderId);
      const request = createMockRequest(`/api/v1/outbound-orders/${createdOutboundOrderId}/confirm`, 'POST', {});
      const response = await CONFIRM(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('SHIPPED');

      console.log(`✅ 出库单已确认：${data.data.outboundNo}`);
    });

    it('确认后应该更新销售订单的出库状态', async () => {
      const updatedOrder = await prisma.order.findUnique({
        where: { id: testOrder.id },
        include: {
          items: true,
        },
      });

      // 验证销售订单项的已出库数量
      const item1 = updatedOrder!.items.find((i: any) => i.productId === testProduct1.id)!;
      const item2 = updatedOrder!.items.find((i: any) => i.productId === testProduct2.id)!;

      expect(item1.shippedQty).toBe(20);
      expect(item2.shippedQty).toBe(15);

      console.log(`📦 销售订单出库状态更新:`);
      console.log(`   产品 1: 已出库 ${item1.shippedQty}/${item1.quantity}`);
      console.log(`   产品 2: 已出库 ${item2.shippedQty}/${item2.quantity}`);
    });

    it('应该验证确认后的库存日志', async () => {
      const logs = await prisma.inventoryLog.findMany({
        where: {
          referenceType: 'OUTBOUND_ORDER',
          referenceId: createdOutboundOrderId,
        },
      });

      expect(logs.length).toBeGreaterThanOrEqual(2);

      console.log(`📝 总库存日志数：${logs.length}`);
    });

    it('应该可以取消已确认的出库单并恢复库存', async () => {
      // 取消出库单
      const mockParams = createMockParams(createdOutboundOrderId);
      const request = createMockRequest(`/api/v1/outbound-orders/${createdOutboundOrderId}/cancel`, 'POST', {
        reason: '集成测试 - 取消并恢复库存',
      });
      const response = await CANCEL(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('CANCELLED');

      // 验证库存恢复
      const inv1 = await prisma.inventory.findUnique({
        where: {
            productId: testProduct1.id,
          },
        },
      });

      const inv2 = await prisma.inventory.findUnique({
        where: {
            productId: testProduct2.id,
          },
        },
      });

      // 库存应该恢复到初始状态
      expect(inv1!.availableQuantity).toBe(initialInventory1);
      expect(inv2!.availableQuantity).toBe(initialInventory2);

      console.log(`✅ 出库单已取消，库存已恢复`);
      console.log(`📈 恢复后库存 - 产品 1: ${inv1!.availableQuantity}, 产品 2: ${inv2!.availableQuantity}`);
    });

    it('取消后应该创建库存恢复日志', async () => {
      const logs = await prisma.inventoryLog.findMany({
        where: {
          referenceType: 'OUTBOUND_ORDER',
          referenceId: createdOutboundOrderId,
          type: 'RETURN',
        },
      });

      expect(logs).toHaveLength(2);
      expect(logs[0].quantity).toBeGreaterThan(0);

      console.log(`📝 库存恢复日志：${logs.length} 条记录`);
    });
  });

  // ============================================
  // 分批出库测试
  // ============================================
  describe('分批出库测试', () => {
    let testOrder2: any;
    let outboundOrder1: string;
    let outboundOrder2: string;

    it('应该创建新的销售订单用于分批出库测试', async () => {
      testOrder2 = await prisma.order.create({
        data: {
          orderNo: uniqueId('SO-BATCH'),
          customerId: testCustomer.id,
          status: 'CONFIRMED',
          currency: 'USD',
          totalAmount: 10000,
          items: {
            create: {
              productId: testProduct1.id,
              productName: testProduct1.name,
              productSku: testProduct1.sku,
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

      console.log(`\n📦 创建分批出库测试订单：${testOrder2.orderNo}`);
    });

    it('应该创建第一批出库单（50 个）', async () => {
      const orderData = {
        orderId: testOrder2.id,
        items: [
          {
            productId: testProduct1.id,
            quantity: 50,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await CREATE_OUTBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      outboundOrder1 = data.data.id;

      console.log(`✅ 第一批出库单创建：${data.data.outboundNo} (50 个)`);
    });

    it('应该确认第一批出库单', async () => {
      const mockParams = createMockParams(outboundOrder1);
      const request = createMockRequest(`/api/v1/outbound-orders/${outboundOrder1}/confirm`, 'POST', {});
      const response = await CONFIRM(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      console.log(`✅ 第一批出库单已确认`);
    });

    it('应该创建第二批出库单（剩余 50 个）', async () => {
      const orderData = {
        orderId: testOrder2.id,
        items: [
          {
            productId: testProduct1.id,
            quantity: 50,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await CREATE_OUTBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      outboundOrder2 = data.data.id;

      console.log(`✅ 第二批出库单创建：${data.data.outboundNo} (50 个)`);
    });

    it('应该确认第二批出库单', async () => {
      const mockParams = createMockParams(outboundOrder2);
      const request = createMockRequest(`/api/v1/outbound-orders/${outboundOrder2}/confirm`, 'POST', {});
      const response = await CONFIRM(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      console.log(`✅ 第二批出库单已确认`);
    });

    it('应该验证销售订单所有项目都已出库', async () => {
      const updatedOrder = await prisma.order.findUnique({
        where: { id: testOrder2.id },
        include: {
          items: true,
        },
      });

      const item = updatedOrder!.items[0];
      expect(item.shippedQty).toBe(100);
      expect(item.shippedQty).toBe(item.quantity);

      console.log(`📦 销售订单已全部出库：${item.shippedQty}/${item.quantity}`);
    });

    it('应该验证销售订单状态自动更新为 SHIPPED', async () => {
      const updatedOrder = await prisma.order.findUnique({
        where: { id: testOrder2.id },
      });

      expect(updatedOrder!.status).toBe('SHIPPED');

      console.log(`✅ 销售订单状态已自动更新为：SHIPPED`);
    });
  });

  // ============================================
  // 异常场景测试
  // ============================================
  describe('异常场景测试', () => {
    it('应该拒绝不存在的销售订单', async () => {
      const orderData = {
        orderId: 'non-existent-order',
        items: [
          {
            productId: testProduct1.id,
            quantity: 10,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await CREATE_OUTBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);

      console.log('✅ 正确拒绝不存在的销售订单');
    });

    it('应该拒绝不存在的产品', async () => {
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: 'non-existent-product',
            quantity: 10,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await CREATE_OUTBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);

      console.log('✅ 正确拒绝不存在的产品');
    });

    it('应该拒绝库存不足的出库单', async () => {
      const inventory = await prisma.inventory.findUnique({
        where: {
            productId: testProduct1.id,
          },
        },
      });

      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct1.id,
            quantity: (inventory?.availableQuantity || 0) + 1,
            unitPrice: 100,
          },
        ],
      };

      const request = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response = await CREATE_OUTBOUND(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);

      console.log('✅ 正确拒绝库存不足的出库单');
    });

    it('应该拒绝重复确认已发货的出库单', async () => {
      // 创建新的出库单
      const orderData = {
        orderId: testOrder.id,
        items: [
          {
            productId: testProduct1.id,
            quantity: 1,
            unitPrice: 100,
          },
        ],
      };

      const request1 = createMockRequest('/api/v1/outbound-orders', 'POST', orderData);
      const response1 = await CREATE_OUTBOUND(request1);
      const data1 = await response1.json();

      // 第一次确认
      const mockParams = createMockParams(data1.data.id);
      const request2 = createMockRequest(`/api/v1/outbound-orders/${data1.data.id}/confirm`, 'POST', {});
      await CONFIRM(request2, mockParams);

      // 第二次确认（应该失败）
      const request3 = createMockRequest(`/api/v1/outbound-orders/${data1.data.id}/confirm`, 'POST', {});
      const response3 = await CONFIRM(request3, mockParams);
      const data3 = await response3.json();

      expect(response3.status).toBe(409);
      expect(data3.success).toBe(false);

      console.log('✅ 正确拒绝重复确认');
    });
  });
});
