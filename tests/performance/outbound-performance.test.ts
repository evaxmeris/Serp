/**
 * 出库管理模块性能测试
 * Sprint 5: Phase 5 - 性能测试
 * 
 * 测试场景:
 * - 大数据量列表加载
 * - 并发创建出库单
 * - 批量操作性能
 */

import { prisma } from '@/lib/prisma';

// ============================================
// 性能测试配置
// ============================================

const CONFIG = {
  // 大数据量测试：创建 100 个出库单
  LARGE_DATASET_SIZE: 100,
  
  // 并发测试：10 个并发请求
  CONCURRENT_REQUESTS: 10,
  
  // 批量操作测试：批量处理 50 个出库单
  BATCH_SIZE: 50,
  
  // 性能指标阈值
  THRESHOLDS: {
    listLoadTime: 1000,      // 列表加载 < 1 秒
    createOrderTime: 500,    // 创建出库单 < 500ms
    batchOperationTime: 5000, // 批量操作 < 5 秒
  },
};

// ============================================
// 测试数据准备
// ============================================

let testCustomer: any;
let testProduct: any;
let testOrder: any;
let testWarehouse: any;

async function prepareTestData() {
  console.log('📦 准备测试数据...');
  
  // 创建测试客户
  testCustomer = await prisma.customer.create({
    data: {
      companyName: `性能测试客户_${Date.now()}`,
      email: `perf_${Date.now()}@test.com`,
      country: 'CN',
      status: 'ACTIVE',
    },
  });

  // 创建测试产品
  testProduct = await prisma.product.create({
    data: {
      sku: `PERF_SKU_${Date.now()}`,
      name: `性能测试产品_${Date.now()}`,
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

  // 创建充足库存
  await prisma.inventory.upsert({
    where: {
      productId_warehouseId: {
        productId: testProduct.id,
        warehouseId: testWarehouse.id,
      },
    },
    update: {
      quantity: 100000,
      availableQuantity: 100000,
    },
    create: {
      productId: testProduct.id,
      warehouseId: testWarehouse.id,
      quantity: 100000,
      availableQuantity: 100000,
    },
  });

  // 创建测试销售订单
  testOrder = await prisma.order.create({
    data: {
      orderNo: `PERF_SO_${Date.now()}`,
      customerId: testCustomer.id,
      status: 'CONFIRMED',
      currency: 'USD',
      totalAmount: 1000000,
      items: {
        create: {
          productId: testProduct.id,
          productName: testProduct.name,
          productSku: testProduct.sku,
          quantity: 10000,
          unitPrice: 100,
          amount: 1000000,
        },
      },
    },
  });

  console.log('✅ 测试数据准备完成');
}

async function cleanupTestData() {
  console.log('🧹 清理测试数据...');
  
  try {
    // 删除测试出库单
    await prisma.outboundOrder.deleteMany({
      where: {
        order: {
          customerId: testCustomer.id,
        },
      },
    });

    // 删除测试订单
    await prisma.order.delete({
      where: { id: testOrder.id },
    }).catch(() => {});

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
    await prisma.product.delete({
      where: { id: testProduct.id },
    }).catch(() => {});

    // 删除客户
    await prisma.customer.delete({
      where: { id: testCustomer.id },
    }).catch(() => {});

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('⚠️ 清理测试数据时出错:', error);
  }
}

// ============================================
// 性能测试用例
// ============================================

describe('出库管理模块性能测试', () => {
  beforeAll(async () => {
    await prepareTestData();
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  }, 60000);

  /**
   * 测试 1: 大数据量列表加载性能
   */
  describe('大数据量列表加载', () => {
    it(`应该快速加载 ${CONFIG.LARGE_DATASET_SIZE} 个出库单`, async () => {
      console.log(`\n📊 测试：大数据量列表加载 (${CONFIG.LARGE_DATASET_SIZE} 条记录)`);
      
      // 创建大量测试数据
      const startTime = Date.now();
      
      const orders = [];
      for (let i = 0; i < CONFIG.LARGE_DATASET_SIZE; i++) {
        const order = await prisma.outboundOrder.create({
          data: {
            outboundNo: `PERF_OB_${Date.now()}_${i}`,
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
      
      const createTime = Date.now() - startTime;
      console.log(`   创建 ${CONFIG.LARGE_DATASET_SIZE} 个出库单耗时：${createTime}ms`);
      
      // 测试列表查询性能
      const queryStart = Date.now();
      
      const result = await prisma.outboundOrder.findMany({
        where: {
          order: {
            customerId: testCustomer.id,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          order: {
            include: {
              customer: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      });
      
      const queryTime = Date.now() - queryStart;
      
      console.log(`   列表查询耗时：${queryTime}ms`);
      console.log(`   返回记录数：${result.length}`);
      
      // 验证性能指标
      expect(queryTime).toBeLessThan(CONFIG.THRESHOLDS.listLoadTime);
      expect(result.length).toBeLessThanOrEqual(20);
      
      console.log(`   ✅ 性能达标 (< ${CONFIG.THRESHOLDS.listLoadTime}ms)`);
      
      // 清理测试数据
      await prisma.outboundOrder.deleteMany({
        where: { id: { in: orders } },
      });
    }, 120000);
  });

  /**
   * 测试 2: 并发创建出库单性能
   */
  describe('并发创建出库单', () => {
    it(`应该支持 ${CONFIG.CONCURRENT_REQUESTS} 个并发创建请求`, async () => {
      console.log(`\n📊 测试：并发创建出库单 (${CONFIG.CONCURRENT_REQUESTS} 并发)`);
      
      const startTime = Date.now();
      
      // 并发创建出库单
      const promises = [];
      for (let i = 0; i < CONFIG.CONCURRENT_REQUESTS; i++) {
        promises.push(
          prisma.outboundOrder.create({
            data: {
              outboundNo: `CONCURRENT_OB_${Date.now()}_${i}`,
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
          })
        );
      }
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / CONFIG.CONCURRENT_REQUESTS;
      
      console.log(`   总耗时：${totalTime}ms`);
      console.log(`   平均每个请求：${avgTime}ms`);
      console.log(`   成功创建：${results.length} 个`);
      
      // 验证性能指标
      expect(avgTime).toBeLessThan(CONFIG.THRESHOLDS.createOrderTime);
      expect(results.length).toBe(CONFIG.CONCURRENT_REQUESTS);
      
      console.log(`   ✅ 并发性能达标 (平均 < ${CONFIG.THRESHOLDS.createOrderTime}ms)`);
      
      // 清理测试数据
      await prisma.outboundOrder.deleteMany({
        where: {
          outboundNo: {
            startsWith: 'CONCURRENT_OB_',
          },
        },
      });
    }, 60000);
  });

  /**
   * 测试 3: 批量操作性能
   */
  describe('批量操作性能', () => {
    it(`应该快速处理 ${CONFIG.BATCH_SIZE} 个出库单的批量确认`, async () => {
      console.log(`\n📊 测试：批量操作性能 (${CONFIG.BATCH_SIZE} 个出库单)`);
      
      // 创建批量测试数据
      const orderIds = [];
      for (let i = 0; i < CONFIG.BATCH_SIZE; i++) {
        const order = await prisma.outboundOrder.create({
          data: {
            outboundNo: `BATCH_OB_${Date.now()}_${i}`,
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
        orderIds.push(order.id);
      }
      
      console.log(`   已创建 ${orderIds.length} 个测试出库单`);
      
      // 测试批量确认性能
      const startTime = Date.now();
      
      // 批量更新状态
      await prisma.outboundOrder.updateMany({
        where: {
          id: { in: orderIds },
        },
        data: {
          status: 'SHIPPED',
        },
      });
      
      const batchTime = Date.now() - startTime;
      
      console.log(`   批量确认耗时：${batchTime}ms`);
      console.log(`   平均每个出库单：${batchTime / CONFIG.BATCH_SIZE}ms`);
      
      // 验证性能指标
      expect(batchTime).toBeLessThan(CONFIG.THRESHOLDS.batchOperationTime);
      
      console.log(`   ✅ 批量操作性能达标 (< ${CONFIG.THRESHOLDS.batchOperationTime}ms)`);
      
      // 清理测试数据
      await prisma.outboundOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
    }, 60000);
  });

  /**
   * 测试 4: 库存扣减性能
   */
  describe('库存扣减性能', () => {
    it('应该快速扣减库存', async () => {
      console.log('\n📊 测试：库存扣减性能');
      
      const testCases = [10, 50, 100];
      
      for (const quantity of testCases) {
        const startTime = Date.now();
        
        // 扣减库存
        await prisma.inventory.update({
          where: {
            productId_warehouseId: {
              productId: testProduct.id,
              warehouseId: testWarehouse.id,
            },
          },
          data: {
            quantity: { decrement: quantity },
            availableQuantity: { decrement: quantity },
          },
        });
        
        const updateTime = Date.now() - startTime;
        
        console.log(`   扣减 ${quantity} 个库存耗时：${updateTime}ms`);
        expect(updateTime).toBeLessThan(100); // 每次扣减 < 100ms
      }
      
      console.log('   ✅ 库存扣减性能达标');
    }, 30000);
  });
});
