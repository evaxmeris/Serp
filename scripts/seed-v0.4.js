#!/usr/bin/env node
/**
 * v0.4.0 发布前数据种子脚本
 * 创建各模块测试数据
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建 v0.4.0 测试数据...\n');

  // 1. 创建测试客户
  console.log('1️⃣ 创建测试客户...');
  const customers = [];
  for (let i = 1; i <= 5; i++) {
    const customer = await prisma.customer.create({
      data: {
        companyName: `测试客户 ${i} 公司`,
        contactName: `联系人${i}`,
        email: `customer${i}@test.com`,
        phone: `1380013800${i}`,
        country: 'CN',
        status: 'ACTIVE',
      },
    });
    customers.push(customer);
    console.log(`   ✅ 客户：${customer.companyName}`);
  }

  // 2. 创建测试供应商
  console.log('\n2️⃣ 创建测试供应商...');
  const suppliers = [];
  const timestamp = Date.now();
  for (let i = 1; i <= 3; i++) {
    const supplier = await prisma.supplier.create({
      data: {
        supplierNo: `SUP-TEST-${timestamp}-${i}`,
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
    console.log(`   ✅ 供应商：${supplier.companyName}`);
  }

  // 3. 创建测试产品
  console.log('\n3️⃣ 创建测试产品...');
  const products = [];
  for (let i = 1; i <= 10; i++) {
    const product = await prisma.product.create({
      data: {
        sku: `TEST-SKU-1772966525${String(i).padStart(3, '0')}`,
        name: `测试产品${i}`,
        nameEn: `Test Product ${i}`,
        unit: 'PCS',
        costPrice: (Math.random() * 50 + 10).toFixed(2),
        salePrice: (Math.random() * 100 + 50).toFixed(2),
        currency: 'USD',
        status: 'ACTIVE',
      },
    });
    products.push(product);
    console.log(`   ✅ 产品：${product.name} (SKU: ${product.sku})`);
  }

  // 4. 创建测试询盘
  console.log('\n4️⃣ 创建测试询盘...');
  const inquiries = [];
  for (let i = 1; i <= 5; i++) {
    const inquiry = await prisma.inquiry.create({
      data: {
        inquiryNo: `INQ-TEST-${timestamp}-${i}`,
        customerId: customers[i - 1].id,
        source: 'Website',
        status: 'NEW',
        priority: 'MEDIUM',
        products: `产品${i}`,
        quantity: 100 * i,
        targetPrice: (Math.random() * 50 + 20).toFixed(2),
        currency: 'USD',
      },
    });
    inquiries.push(inquiry);
    console.log(`   ✅ 询盘：${inquiry.inquiryNo}`);
  }

  // 5. 创建测试报价
  console.log('\n5️⃣ 创建测试报价...');
  const quotations = [];
  for (let i = 1; i <= 3; i++) {
    const quotation = await prisma.quotation.create({
      data: {
        quotationNo: `QUO-TEST-${timestamp}-${i}`,
        customerId: customers[i - 1].id,
        currency: 'USD',
        paymentTerms: 'T/T 30% deposit',
        deliveryTerms: 'FOB Shanghai',
        validityDays: 30,
        totalAmount: 5000 * i,
        status: 'SENT',
        items: {
          create: {
            productName: `产品${i}`,
            quantity: 100,
            unitPrice: 50,
            amount: 5000,
          },
        },
      },
    });
    quotations.push(quotation);
    console.log(`   ✅ 报价：${quotation.quotationNo}`);
  }

  // 6. 创建测试订单
  console.log('\n6️⃣ 创建测试订单...');
  const orders = [];
  for (let i = 1; i <= 3; i++) {
    const order = await prisma.order.create({
      data: {
        orderNo: `SO-TEST-20260308-00${i}`,
        customerId: customers[i - 1].id,
        currency: 'USD',
        totalAmount: 10000 * i,
        paidAmount: 3000 * i,
        balanceAmount: 7000 * i,
        paymentTerms: 'T/T 30% deposit, 70% before shipment',
        deliveryTerms: 'FOB Shanghai',
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        shippingAddress: `测试地址${i}`,
        status: i === 1 ? 'PENDING' : i === 2 ? 'CONFIRMED' : 'IN_PRODUCTION',
        items: {
          create: {
            productName: `产品${i}`,
            quantity: 200,
            unitPrice: 50,
            amount: 10000,
          },
        },
      },
    });
    orders.push(order);
    console.log(`   ✅ 订单：${order.orderNo} (${order.status})`);
  }

  // 7. 创建测试采购订单
  console.log('\n7️⃣ 创建测试采购订单...');
  const purchaseOrders = [];
  for (let i = 1; i <= 2; i++) {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNo: `PO-TEST-20260308-00${i}`,
        supplierId: suppliers[i - 1].id,
        currency: 'CNY',
        totalAmount: 20000 * i,
        deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: i === 1 ? 'PENDING' : 'CONFIRMED',
        items: {
          create: {
            productName: `原材料${i}`,
            quantity: 500,
            unitPrice: 40,
            amount: 20000,
          },
        },
      },
    });
    purchaseOrders.push(po);
    console.log(`   ✅ 采购订单：${po.poNo} (${po.status})`);
  }

  // 汇总
  console.log('\n📊 数据汇总:');
  console.log('   ─────────────────────────────');
  console.log(`   客户数：${customers.length}`);
  console.log(`   供应商数：${suppliers.length}`);
  console.log(`   产品数：${products.length}`);
  console.log(`   询盘数：${inquiries.length}`);
  console.log(`   报价数：${quotations.length}`);
  console.log(`   订单数：${orders.length}`);
  console.log(`   采购订单数：${purchaseOrders.length}`);
  console.log('   ─────────────────────────────');
  console.log('\n✅ 测试数据创建完成！');
  console.log('\n🌐 访问地址：http://localhost:3001');
  console.log('   - 客户管理：/customers');
  console.log('   - 产品管理：/products');
  console.log('   - 询盘管理：/inquiries');
  console.log('   - 报价管理：/quotations');
  console.log('   - 订单管理：/orders');
  console.log('   - 采购管理：/purchase-orders');
  console.log('   - 供应商管理：/suppliers\n');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
