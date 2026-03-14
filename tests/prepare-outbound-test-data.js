#!/usr/bin/env node
/**
 * 出库管理模块测试数据准备脚本
 * Sprint 5: 为出库单测试准备基础数据
 * 
 * 使用方法:
 *   npm run test:data:prepare-outbound
 *   node tests/prepare-outbound-test-data.js
 *   node tests/prepare-outbound-test-data.js cleanup  # 清理数据
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// 配置
// ============================================

const TEST_CONFIG = {
  customer: {
    companyName: 'Sprint5 测试客户',
    contactName: '测试联系人',
    email: 'sprint5-test@example.com',
    country: 'CN',
  },
  products: [
    {
      sku: 'Sprint5-TEST-001',
      name: 'Sprint5 测试产品 1',
      costPrice: 50,
      salePrice: 100,
      currency: 'USD',
    },
    {
      sku: 'Sprint5-TEST-002',
      name: 'Sprint5 测试产品 2',
      costPrice: 30,
      salePrice: 80,
      currency: 'USD',
    },
    {
      sku: 'Sprint5-TEST-003',
      name: 'Sprint5 测试产品 3',
      costPrice: 40,
      salePrice: 90,
      currency: 'USD',
    },
  ],
  warehouse: {
    name: '测试仓库',
    code: 'TEST-WH',
  },
  initialStock: 1000, // 每个产品初始库存
};

// ============================================
// 辅助函数
// ============================================

/**
 * 生成唯一标识
 */
function uniqueId(prefix = 'TEST') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 等待指定时间
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 准备测试数据
// ============================================

async function prepareTestData() {
  console.log('\n📦 开始准备出库管理测试数据...\n');

  try {
    // 1. 创建测试客户
    console.log('1️⃣  创建测试客户...');
    const customer = await prisma.customer.create({
      data: {
        ...TEST_CONFIG.customer,
        companyName: uniqueId(TEST_CONFIG.customer.companyName),
        email: uniqueId(TEST_CONFIG.customer.email),
      },
    });
    console.log(`   ✅ 客户创建成功：${customer.companyName} (ID: ${customer.id})`);

    // 2. 创建测试产品
    console.log('\n2️⃣  创建测试产品...');
    const products = [];
    for (const productConfig of TEST_CONFIG.products) {
      const product = await prisma.product.create({
        data: {
          ...productConfig,
          sku: uniqueId(productConfig.sku),
          name: uniqueId(productConfig.name),
        },
      });
      products.push(product);
      console.log(`   ✅ 产品创建成功：${product.name} (SKU: ${product.sku}, ID: ${product.id})`);
    }

    // 3. 创建测试仓库
    console.log('\n3️⃣  创建测试仓库...');
    const warehouse = await prisma.warehouse.upsert({
      where: { code: TEST_CONFIG.warehouse.code },
      update: {},
      create: TEST_CONFIG.warehouse,
    });
    console.log(`   ✅ 仓库创建成功：${warehouse.name} (ID: ${warehouse.id})`);

    // 4. 创建测试库存
    console.log('\n4️⃣  创建测试库存...');
    for (const product of products) {
      await prisma.inventory.upsert({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
        update: {
          quantity: TEST_CONFIG.initialStock,
          availableQuantity: TEST_CONFIG.initialStock,
        },
        create: {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: TEST_CONFIG.initialStock,
          availableQuantity: TEST_CONFIG.initialStock,
        },
      });
      console.log(`   ✅ 产品 ${product.name} 库存：${TEST_CONFIG.initialStock} 个`);
    }

    // 5. 创建测试销售订单
    console.log('\n5️⃣  创建测试销售订单...');
    const order = await prisma.order.create({
      data: {
        orderNo: uniqueId('SO-TEST'),
        customerId: customer.id,
        status: 'CONFIRMED',
        currency: 'USD',
        items: {
          create: products.map((product, index) => ({
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            quantity: 50 + index * 10,
            unitPrice: Number(product.salePrice),
            amount: (50 + index * 10) * Number(product.salePrice),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    const totalAmount = order.items.reduce((sum, item) => sum + Number(item.amount), 0);
    console.log(`   ✅ 销售订单创建成功：${order.orderNo} (ID: ${order.id})`);
    console.log(`      商品数量：${order.items.length} 种`);
    console.log(`      订单总额：$${totalAmount}`);

    // 6. 输出测试数据摘要
    console.log('\n📊 测试数据摘要:');
    console.log('   =========================================');
    console.log(`   客户 ID: ${customer.id}`);
    console.log(`   仓库 ID: ${warehouse.id}`);
    console.log(`   订单 ID: ${order.id}`);
    console.log('   产品列表:');
    products.forEach((product, index) => {
      console.log(`     ${index + 1}. ${product.name} (ID: ${product.id}, 库存：${TEST_CONFIG.initialStock})`);
    });
    console.log('   =========================================\n');

    // 7. 保存测试数据到文件（供测试脚本使用）
    const testData = {
      customerId: customer.id,
      warehouseId: warehouse.id,
      orderId: order.id,
      productIds: products.map(p => p.id),
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
      })),
      createdAt: new Date().toISOString(),
    };

    const fs = require('fs');
    const path = require('path');
    const testDataFile = path.join(__dirname, 'test-data.json');
    fs.writeFileSync(testDataFile, JSON.stringify(testData, null, 2));
    console.log(`💾 测试数据已保存到：${testDataFile}\n`);

    return testData;
  } catch (error) {
    console.error('\n❌ 准备测试数据失败:', error);
    throw error;
  }
}

// ============================================
// 清理测试数据
// ============================================

async function cleanupTestData() {
  console.log('\n🧹 开始清理出库管理测试数据...\n');

  try {
    // 1. 读取测试数据文件
    const fs = require('fs');
    const path = require('path');
    const testDataFile = path.join(__dirname, 'test-data.json');

    if (!fs.existsSync(testDataFile)) {
      console.log('⚠️  测试数据文件不存在，跳过清理');
      return;
    }

    const testData = JSON.parse(fs.readFileSync(testDataFile, 'utf-8'));

    // 2. 删除出库单
    console.log('1️⃣  删除出库单...');
    const outboundOrders = await prisma.outboundOrder.findMany({
      where: {
        OR: testData.orderId ? [{ orderId: testData.orderId }] : [],
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
    console.log(`   ✅ 删除了 ${outboundOrders.length} 个出库单`);

    // 3. 删除销售订单
    if (testData.orderId) {
      console.log('\n2️⃣  删除销售订单...');
      await prisma.order.delete({
        where: { id: testData.orderId },
      }).catch(() => {});
      console.log(`   ✅ 订单已删除：${testData.orderId}`);
    }

    // 4. 删除库存
    console.log('\n3️⃣  删除库存...');
    if (testData.productIds && testData.warehouseId) {
      for (const productId of testData.productIds) {
        await prisma.inventory.delete({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId: testData.warehouseId,
            },
          },
        }).catch(() => {});
      }
      console.log(`   ✅ 删除了 ${testData.productIds.length} 个产品的库存`);
    }

    // 5. 删除产品
    console.log('\n4️⃣  删除产品...');
    if (testData.productIds) {
      for (const productId of testData.productIds) {
        await prisma.product.delete({
          where: { id: productId },
        }).catch(() => {});
      }
      console.log(`   ✅ 删除了 ${testData.productIds.length} 个产品`);
    }

    // 6. 删除客户
    if (testData.customerId) {
      console.log('\n5️⃣  删除客户...');
      await prisma.customer.delete({
        where: { id: testData.customerId },
      }).catch(() => {});
      console.log(`   ✅ 客户已删除：${testData.customerId}`);
    }

    // 7. 删除测试数据文件
    fs.unlinkSync(testDataFile);
    console.log('\n💾 测试数据文件已删除\n');

    console.log('✅ 测试数据清理完成\n');
  } catch (error) {
    console.error('\n❌ 清理测试数据失败:', error);
    throw error;
  }
}

// ============================================
// 主程序
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'cleanup') {
      await cleanupTestData();
    } else {
      await prepareTestData();
    }
  } catch (error) {
    console.error('操作失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主程序
main();
