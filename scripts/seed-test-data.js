#!/usr/bin/env node
/**
 * 创建测试数据 - 修复 orders 和 suppliers 空表问题
 * 用法：node scripts/seed-test-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建测试数据...\n');

  // 1. 创建供应商
  console.log('1️⃣ 创建供应商...');
  const suppliers = [];
  const timestamp = Date.now();
  for (let i = 1; i <= 5; i++) {
    const supplier = await prisma.supplier.create({
      data: {
        supplierNo: `SUP-${timestamp}-${i}`,
        companyName: `测试供应商${i}公司`,
        contactName: `供应商联系人${i}`,
        email: `supplier${i}@test.com`,
        phone: `1390013900${i}`,
        country: 'CN',
        status: 'ACTIVE',
        type: 'DOMESTIC',
        level: 'NORMAL',
        currency: 'CNY',
      },
    });
    suppliers.push(supplier);
    console.log(`   ✅ ${supplier.companyName}`);
  }
  console.log(`   创建完成：${suppliers.length} 个供应商\n`);

  // 2. 获取现有产品
  console.log('2️⃣ 获取现有产品...');
  const products = await prisma.product.findMany({ take: 5 });
  console.log(`   找到 ${products.length} 个产品\n`);

  // 3. 获取现有客户
  console.log('3️⃣ 获取现有客户...');
  const customers = await prisma.customer.findMany({ take: 5 });
  console.log(`   找到 ${customers.length} 个客户\n`);

  // 4. 创建采购订单
  console.log('4️⃣ 创建采购订单...');
  const purchaseOrders = [];
  for (let i = 1; i <= 5; i++) {
    const supplier = suppliers[i - 1];
    const po = await prisma.purchaseOrder.create({
      data: {
        poNo: `PO-${timestamp}-${i}`,
        supplierId: supplier.id,
        deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
        currency: 'CNY',
        totalAmount: (Math.random() * 10000 + 5000).toFixed(2),
      },
    });
    purchaseOrders.push(po);
    console.log(`   ✅ ${po.poNo}`);
  }
  console.log(`   创建完成：${purchaseOrders.length} 个采购订单\n`);

  // 5. 创建销售订单
  console.log('5️⃣ 创建销售订单...');
  const orders = [];
  for (let i = 1; i <= 10; i++) {
    const customer = customers[i % customers.length];
    const order = await prisma.order.create({
      data: {
        orderNo: `ORD-${timestamp}-${i}`,
        customerId: customer.id,
        status: 'CONFIRMED',
        currency: 'USD',
        totalAmount: (Math.random() * 5000 + 1000).toFixed(2),
        deliveryDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    orders.push(order);
    console.log(`   ✅ ${order.orderNo}`);
  }
  console.log(`   创建完成：${orders.length} 个销售订单\n`);

  console.log('✅ 测试数据创建完成！');
  console.log('\n数据统计:');
  console.log(`  - 供应商：${suppliers.length}`);
  console.log(`  - 采购订单：${purchaseOrders.length}`);
  console.log(`  - 销售订单：${orders.length}`);
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
