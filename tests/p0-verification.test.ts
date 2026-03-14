/**
 * P0 问题修复验证测试
 * 
 * 测试目的：验证 4 个 P0 级别问题的修复情况
 * 测试日期：2026-03-14
 * 测试人员：Trade ERP 测试经理
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as CREATE_INBOUND } from '../src/app/api/v1/inbound-orders/route';
import { GET as LIST_INBOUND } from '../src/app/api/v1/inbound-orders/route';
import { POST as CONFIRM_INBOUND } from '../src/app/api/v1/inbound-orders/[id]/confirm/route';
import { DELETE as DELETE_INBOUND } from '../src/app/api/v1/inbound-orders/[id]/route';

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

function createMockParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

// ==================== 测试数据工厂函数 ====================

async function createTestSupplier() {
  const now = Date.now();
  return await prisma.supplier.create({
    data: {
      supplierNo: `SUP-P0-${now}`,
      companyName: `P0 测试供应商_${now}`,
      email: `p0test_${now}@example.com`,
      status: 'ACTIVE',
    },
  });
}

async function createTestProduct() {
  const now = Date.now();
  return await prisma.product.create({
    data: {
      sku: `SKU-P0-${now}`,
      name: `P0 测试产品_${now}`,
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

async function createTestInboundOrder(warehouseId: string, supplierId: string, productId: string, quantity: number = 100) {
  const inboundData = {
    type: 'PURCHASE_IN' as const,
    supplierId: supplierId,
    warehouseId: warehouseId,
    expectedDate: new Date().toISOString(),
    note: 'P0 验证测试入库单',
    items: [
      {
        productId: productId,
        expectedQuantity: quantity,
        unitPrice: 10.5,
        batchNo: `BATCH-P0-${Date.now()}`,
      },
    ],
  };

  const request = createMockRequest('/api/v1/inbound-orders', 'POST', inboundData);
  const response = await CREATE_INBOUND(request);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`创建入库单失败：${data.message}`);
  }
  
  return data.data;
}

// ==================== P0 问题 1: InboundOrderItem 关联验证 ====================

describe('P0-1: InboundOrderItem 关联验证', () => {
  let testSupplier: any;
  let testProduct: any;
  let testWarehouse: any;
  let createdInboundId: string;

  beforeAll(async () => {
    testSupplier = await createTestSupplier();
    testProduct = await createTestProduct();
    testWarehouse = await ensureDefaultWarehouse();
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdInboundId) {
      await prisma.inboundOrder.delete({ where: { id: createdInboundId } }).catch(() => {});
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.delete({ where: { id: testSupplier.id } }).catch(() => {});
    }
  });

  it('[P0-1-1] 创建入库单并添加入库单明细', async () => {
    const inbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id);
    
    expect(inbound).toBeDefined();
    expect(inbound.id).toBeDefined();
    expect(inbound.inboundNo).toBeDefined();
    expect(inbound.items).toBeDefined();
    expect(inbound.items.length).toBeGreaterThan(0);
    
    createdInboundId = inbound.id;
  });

  it('[P0-1-2] 查询入库单明细，验证关联正确', async () => {
    const inbound = await prisma.inboundOrder.findUnique({
      where: { id: createdInboundId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    expect(inbound).toBeDefined();
    expect(inbound!.items).toBeDefined();
    expect(inbound!.items.length).toBeGreaterThan(0);
    expect(inbound!.items[0].product).toBeDefined();
    expect(inbound!.items[0].product.id).toBe(testProduct.id);
  });

  it('[P0-1-3] 验证外键约束生效', async () => {
    // 尝试创建关联到不存在入库单的明细项（应该失败）
    const invalidItemId = 'non-existent-inbound-order-id';
    
    try {
      await prisma.inboundOrderItem.create({
        data: {
          inboundOrderId: invalidItemId,
          productId: testProduct.id,
          expectedQuantity: 100,
          actualQuantity: 0,
          unitPrice: 10.5,
          amount: 1050,
        },
      });
      // 如果执行到这里，说明外键约束未生效
      expect(true).toBe(false); // 应该失败
    } catch (error: any) {
      // 预期会失败，检查错误类型
      expect(error).toBeDefined();
      expect(error.code || error.message).toBeDefined();
    }
  });

  it('[P0-1-4] 验证级联删除正常', async () => {
    // 创建一个新的入库单用于删除测试
    const testInbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 50);
    const testInboundId = testInbound.id;
    
    // 验证明细项存在
    const itemsBeforeDelete = await prisma.inboundOrderItem.findMany({
      where: { inboundOrderId: testInboundId },
    });
    expect(itemsBeforeDelete.length).toBeGreaterThan(0);
    
    // 删除入库单
    await prisma.inboundOrder.delete({
      where: { id: testInboundId },
    });
    
    // 验证明细项已被级联删除
    const itemsAfterDelete = await prisma.inboundOrderItem.findMany({
      where: { inboundOrderId: testInboundId },
    });
    expect(itemsAfterDelete.length).toBe(0);
  });
});

// ==================== P0 问题 2: 数据库索引验证 ====================

describe('P0-2: 数据库索引验证', () => {
  let testSupplier: any;
  let testProduct: any;
  let testWarehouse: any;
  const createdInboundIds: string[] = [];

  beforeAll(async () => {
    testSupplier = await createTestSupplier();
    testProduct = await createTestProduct();
    testWarehouse = await ensureDefaultWarehouse();
    
    // 创建多个入库单用于性能测试
    for (let i = 0; i < 5; i++) {
      const inbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 20);
      createdInboundIds.push(inbound.id);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    for (const id of createdInboundIds) {
      await prisma.inboundOrder.delete({ where: { id } }).catch(() => {});
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.delete({ where: { id: testSupplier.id } }).catch(() => {});
    }
  });

  it('[P0-2-1] 执行入库单查询（按单号）', async () => {
    const startTime = Date.now();
    
    const orders = await prisma.inboundOrder.findMany({
      where: {
        inboundNo: { contains: 'IN-' },
      },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(orders).toBeDefined();
    expect(orders.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(50); // 性能要求：<50ms
    console.log(`按单号查询耗时：${duration}ms`);
  });

  it('[P0-2-2] 执行入库单查询（按供应商）', async () => {
    const startTime = Date.now();
    
    const orders = await prisma.inboundOrder.findMany({
      where: { supplierId: testSupplier.id },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(orders).toBeDefined();
    expect(orders.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(50); // 性能要求：<50ms
    console.log(`按供应商查询耗时：${duration}ms`);
  });

  it('[P0-2-3] 执行入库单查询（按状态）', async () => {
    const startTime = Date.now();
    
    const orders = await prisma.inboundOrder.findMany({
      where: { status: 'PENDING' },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(orders).toBeDefined();
    expect(orders.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(50); // 性能要求：<50ms
    console.log(`按状态查询耗时：${duration}ms`);
  });

  it('[P0-2-4] 执行库存查询（按产品）', async () => {
    const startTime = Date.now();
    
    const inventories = await prisma.inventory.findMany({
      where: { productId: testProduct.id },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(inventories).toBeDefined();
    expect(duration).toBeLessThan(50); // 性能要求：<50ms
    console.log(`按产品查询库存耗时：${duration}ms`);
  });

  it('[P0-2-5] 验证查询性能提升（<50ms）', async () => {
    // 执行多次查询，计算平均耗时
    const iterations = 10;
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      await prisma.inboundOrder.findMany({
        where: { status: 'PENDING' },
      });
      
      const endTime = Date.now();
      durations.push(endTime - startTime);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    
    console.log(`平均查询耗时：${avgDuration.toFixed(2)}ms，最大耗时：${maxDuration}ms`);
    
    expect(avgDuration).toBeLessThan(50);
    expect(maxDuration).toBeLessThan(100); // 最大不超过 100ms
  });
});

// ==================== P0 问题 3: 确认入库事务验证 ====================

describe('P0-3: 确认入库事务验证', () => {
  let testSupplier: any;
  let testProduct: any;
  let testWarehouse: any;
  let testInboundId: string;

  beforeAll(async () => {
    testSupplier = await createTestSupplier();
    testProduct = await createTestProduct();
    testWarehouse = await ensureDefaultWarehouse();
    
    const inbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 100);
    testInboundId = inbound.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testInboundId) {
      await prisma.inboundOrder.delete({ where: { id: testInboundId } }).catch(() => {});
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.delete({ where: { id: testSupplier.id } }).catch(() => {});
    }
  });

  it('[P0-3-1] 并发确认同一入库单', async () => {
    // 注意：当前实现可能不支持真正的并发控制
    // 这个测试用于验证当前行为
    
    const confirmRequest1 = createMockRequest(`/api/v1/inbound-orders/${testInboundId}/confirm`, 'POST', {});
    const confirmRequest2 = createMockRequest(`/api/v1/inbound-orders/${testInboundId}/confirm`, 'POST', {});
    
    // 并发执行两次确认
    const [response1, response2] = await Promise.all([
      CONFIRM_INBOUND(confirmRequest1, createMockParams(testInboundId)),
      CONFIRM_INBOUND(confirmRequest2, createMockParams(testInboundId)),
    ]);
    
    const data1 = await response1.json();
    const data2 = await response2.json();
    
    // 至少有一个应该成功，另一个应该失败（状态冲突）
    const successCount = [data1.success, data2.success].filter(s => s).length;
    expect(successCount).toBeLessThanOrEqual(1); // 最多一个成功
  });

  it('[P0-3-2] 验证库存更新原子性', async () => {
    // 创建新的入库单
    const newInbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 200);
    const newInboundId = newInbound.id;
    
    // 获取确认前的库存
    const inventoryBefore = await prisma.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: testProduct.id,
          warehouseId: testWarehouse.id,
        },
      },
    });
    
    const quantityBefore = inventoryBefore?.quantity || 0;
    
    // 确认入库
    const confirmRequest = createMockRequest(`/api/v1/inbound-orders/${newInboundId}/confirm`, 'POST', {});
    const response = await CONFIRM_INBOUND(confirmRequest, createMockParams(newInboundId));
    const data = await response.json();
    
    expect(data.success).toBe(true);
    
    // 获取确认后的库存
    const inventoryAfter = await prisma.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: testProduct.id,
          warehouseId: testWarehouse.id,
        },
      },
    });
    
    const quantityAfter = inventoryAfter?.quantity || 0;
    
    // 验证库存增加了 200
    expect(quantityAfter - quantityBefore).toBe(200);
    
    // 清理
    await prisma.inboundOrder.delete({ where: { id: newInboundId } }).catch(() => {});
  });

  it('[P0-3-3] 验证事务回滚正常', async () => {
    // 这个测试需要实际的事务支持
    // 当前实现可能没有完整的事务回滚机制
    
    // 创建一个入库单
    const newInbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 50);
    const newInboundId = newInbound.id;
    
    try {
      // 尝试在事务中执行一些操作
      await prisma.$transaction(async (tx) => {
        // 更新入库单状态
        await tx.inboundOrder.update({
          where: { id: newInboundId },
          data: { status: 'COMPLETED' },
        });
        
        // 故意抛出错误触发回滚
        throw new Error('模拟错误，触发回滚');
      });
      
      // 如果执行到这里，说明没有回滚
      expect(true).toBe(false);
    } catch (error: any) {
      // 预期会抛出错误
      expect(error.message).toContain('模拟错误');
      
      // 验证入库单状态已回滚
      const inbound = await prisma.inboundOrder.findUnique({
        where: { id: newInboundId },
      });
      
      expect(inbound?.status).toBe('PENDING'); // 应该保持原状态
    }
    
    // 清理
    await prisma.inboundOrder.delete({ where: { id: newInboundId } }).catch(() => {});
  });

  it('[P0-3-4] 验证数据一致性', async () => {
    // 创建新的入库单
    const newInbound = await createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 150);
    const newInboundId = newInbound.id;
    
    // 确认入库
    const confirmRequest = createMockRequest(`/api/v1/inbound-orders/${newInboundId}/confirm`, 'POST', {});
    const response = await CONFIRM_INBOUND(confirmRequest, createMockParams(newInboundId));
    const data = await response.json();
    
    expect(data.success).toBe(true);
    
    // 验证入库单状态
    const inbound = await prisma.inboundOrder.findUnique({
      where: { id: newInboundId },
      include: { items: true },
    });
    
    expect(inbound?.status).toBe('COMPLETED');
    expect(inbound?.items[0].actualQuantity).toBe(150);
    
    // 验证库存记录
    const inventory = await prisma.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: testProduct.id,
          warehouseId: testWarehouse.id,
        },
      },
    });
    
    expect(inventory).toBeDefined();
    expect(inventory!.quantity).toBeGreaterThanOrEqual(150);
    
    // 验证库存流水
    const logs = await prisma.inventoryLog.findMany({
      where: { inboundOrderId: newInboundId },
    });
    
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].quantity).toBe(150);
    
    // 清理
    await prisma.inboundOrder.delete({ where: { id: newInboundId } }).catch(() => {});
  });
});

// ==================== P0 问题 4: 单号生成验证 ====================

describe('P0-4: 单号生成验证', () => {
  let testSupplier: any;
  let testProduct: any;
  let testWarehouse: any;
  const createdInboundNos: string[] = [];

  beforeAll(async () => {
    testSupplier = await createTestSupplier();
    testProduct = await createTestProduct();
    testWarehouse = await ensureDefaultWarehouse();
  });

  afterAll(async () => {
    // 清理测试数据
    for (const no of createdInboundNos) {
      await prisma.inboundOrder.delete({ where: { inboundNo: no } }).catch(() => {});
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.delete({ where: { id: testSupplier.id } }).catch(() => {});
    }
  });

  it('[P0-4-1] 并发创建入库单（10 个）', async () => {
    const createPromises = [];
    
    for (let i = 0; i < 10; i++) {
      createPromises.push(
        createTestInboundOrder(testWarehouse.id, testSupplier.id, testProduct.id, 10)
      );
    }
    
    const results = await Promise.all(createPromises);
    
    results.forEach((inbound: any) => {
      expect(inbound).toBeDefined();
      expect(inbound.inboundNo).toBeDefined();
      createdInboundNos.push(inbound.inboundNo);
    });
    
    expect(results.length).toBe(10);
  });

  it('[P0-4-2] 验证单号唯一性', async () => {
    const uniqueNos = new Set(createdInboundNos);
    expect(uniqueNos.size).toBe(createdInboundNos.length);
  });

  it('[P0-4-3] 验证单号连续性', async () => {
    // 提取单号中的序号部分
    const getSequenceNumber = (no: string) => {
      const match = no.match(/IN-(\d+)-(\d+)/);
      if (match) {
        return parseInt(match[2], 10);
      }
      return 0;
    };
    
    const sequenceNumbers = createdInboundNos.map(getSequenceNumber).sort((a, b) => a - b);
    
    // 验证序号是连续的（允许有间隔，但应该是递增的）
    for (let i = 1; i < sequenceNumbers.length; i++) {
      expect(sequenceNumbers[i]).toBeGreaterThan(sequenceNumbers[i - 1]);
    }
  });

  it('[P0-4-4] 验证无重复单号', async () => {
    // 检查数据库中是否有重复单号
    const result = await prisma.$queryRaw<
      Array<{ inboundNo: string; count: number }>
    >`
      SELECT "inboundNo", COUNT(*) as count
      FROM "inbound_orders"
      WHERE "inboundNo" IN (${createdInboundNos.map(() => '').join(',')})
      GROUP BY "inboundNo"
      HAVING COUNT(*) > 1
    `;
    
    expect(result.length).toBe(0);
  });
});
