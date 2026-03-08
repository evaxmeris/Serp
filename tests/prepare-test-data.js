#!/usr/bin/env node

/**
 * Trade ERP 测试数据准备脚本
 * 
 * 用于准备订单管理和采购管理模块的测试数据
 * 
 * 使用方法:
 *   node tests/prepare-test-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 测试数据工厂
const TestDataFactory = {
  createCustomer(suffix = '') {
    const timestamp = Date.now();
    return {
      companyName: `TEST_CUSTOMER_${timestamp}${suffix}`,
      contactName: '测试联系人',
      email: `test_${timestamp}${suffix}@example.com`,
      phone: '13800138000',
      country: '中国',
      status: 'ACTIVE',
      notes: '自动化测试创建的客户'
    };
  },

  createSupplier(suffix = '') {
    const timestamp = Date.now();
    return {
      companyName: `TEST_SUPPLIER_${timestamp}${suffix}`,
      contactName: '供应商联系人',
      email: `supplier_${timestamp}${suffix}@example.com`,
      phone: '13900139000',
      country: '中国',
      status: 'ACTIVE',
      notes: '自动化测试创建的供应商'
    };
  },

  createProduct(suffix = '') {
    const timestamp = Date.now();
    return {
      sku: `TEST_SKU_${timestamp}${suffix}`,
      name: '测试产品',
      nameEn: 'Test Product',
      unit: 'PCS',
      costPrice: '5.00',
      salePrice: '10.00',
      currency: 'USD',
      status: 'ACTIVE',
      description: '自动化测试创建的产品'
    };
  }
};

async function prepareTestData() {
  console.log('📦 Trade ERP 测试数据准备开始...\n');

  try {
    // 1. 创建测试客户
    console.log('1️⃣ 创建测试客户...');
    const customers = [];
    for (let i = 1; i <= 3; i++) {
      const customer = await prisma.customer.create({
        data: TestDataFactory.createCustomer(`_00${i}`)
      });
      customers.push(customer);
      console.log(`   ✅ 客户 ${i}: ${customer.companyName} (ID: ${customer.id})`);
    }

    // 2. 创建测试供应商
    console.log('\n2️⃣ 创建测试供应商...');
    const suppliers = [];
    for (let i = 1; i <= 3; i++) {
      const supplier = await prisma.supplier.create({
        data: TestDataFactory.createSupplier(`_00${i}`)
      });
      suppliers.push(supplier);
      console.log(`   ✅ 供应商 ${i}: ${supplier.companyName} (ID: ${supplier.id})`);
    }

    // 3. 创建测试产品
    console.log('\n3️⃣ 创建测试产品...');
    const products = [];
    for (let i = 1; i <= 5; i++) {
      const product = await prisma.product.create({
        data: TestDataFactory.createProduct(`_00${i}`)
      });
      products.push(product);
      console.log(`   ✅ 产品 ${i}: ${product.name} (SKU: ${product.sku}, ID: ${product.id})`);
    }

    // 4. 创建测试用户（如果不存在）
    console.log('\n4️⃣ 检查测试用户...');
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@trade-erp.com' }
    });

    if (!testUser) {
      const user = await prisma.user.create({
        data: {
          email: 'test@trade-erp.com',
          name: '测试用户',
          passwordHash: '$2a$10$testhash', // 占位符，实际测试中可能需要正确哈希
          role: 'ADMIN'
        }
      });
      console.log(`   ✅ 测试用户创建：${user.email} (ID: ${user.id})`);
    } else {
      console.log(`   ℹ️  测试用户已存在：${testUser.email}`);
    }

    // 5. 汇总信息
    console.log('\n📊 测试数据汇总:');
    console.log('   ──────────────────────────────');
    const customerCount = await prisma.customer.count({
      where: { companyName: { contains: 'TEST_CUSTOMER_' } }
    });
    const supplierCount = await prisma.supplier.count({
      where: { companyName: { contains: 'TEST_SUPPLIER_' } }
    });
    const productCount = await prisma.product.count({
      where: { sku: { contains: 'TEST_SKU_' } }
    });

    console.log(`   测试客户数：${customerCount}`);
    console.log(`   测试供应商数：${supplierCount}`);
    console.log(`   测试产品数：${productCount}`);
    console.log('   ──────────────────────────────');

    console.log('\n✅ 测试数据准备完成！\n');

    // 返回测试数据引用（供后续测试使用）
    return {
      customers,
      suppliers,
      products
    };

  } catch (error) {
    console.error('❌ 测试数据准备失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 清理测试数据函数
async function cleanupTestData() {
  console.log('🧹 清理测试数据...\n');

  try {
    // 删除测试订单
    const deletedOrders = await prisma.order.deleteMany({
      where: { notes: { contains: '测试订单' } }
    });
    console.log(`   删除测试订单：${deletedOrders.count}`);

    // 删除测试采购单
    const deletedPurchases = await prisma.purchaseOrder.deleteMany({
      where: { notes: { contains: '测试采购单' } }
    });
    console.log(`   删除测试采购单：${deletedPurchases.count}`);

    // 删除测试客户
    const deletedCustomers = await prisma.customer.deleteMany({
      where: { companyName: { contains: 'TEST_CUSTOMER_' } }
    });
    console.log(`   删除测试客户：${deletedCustomers.count}`);

    // 删除测试供应商
    const deletedSuppliers = await prisma.supplier.deleteMany({
      where: { companyName: { contains: 'TEST_SUPPLIER_' } }
    });
    console.log(`   删除测试供应商：${deletedSuppliers.count}`);

    // 删除测试产品
    const deletedProducts = await prisma.product.deleteMany({
      where: { sku: { contains: 'TEST_SKU_' } }
    });
    console.log(`   删除测试产品：${deletedProducts.count}`);

    console.log('\n✅ 测试数据清理完成！\n');

  } catch (error) {
    console.error('❌ 测试数据清理失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 主程序
const command = process.argv[2];

if (command === 'cleanup') {
  cleanupTestData();
} else {
  prepareTestData();
}
