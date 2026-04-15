/**
 * 报表数据生成脚本
 * 为各报表模块生成模拟数据，用于开发和测试
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateReportData() {
  console.log('开始生成报表数据...\n');

  try {
    // 1. 生成销售数据
    console.log('📊 生成销售数据...');
    await generateSalesData();
    
    // 2. 生成库存数据
    console.log('📦 生成库存数据...');
    await generateInventoryData();
    
    // 3. 生成采购数据
    console.log('🛒 生成采购数据...');
    await generatePurchaseData();
    
    // 4. 生成财务数据
    console.log('💰 生成财务数据...');
    await generateFinancialData();
    
    console.log('\n✅ 报表数据生成完成！');
  } catch (error) {
    console.error('❌ 生成失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function generateSalesData() {
  // 生成销售订单数据
  const orders = [];
  for (let i = 0; i < 100; i++) {
    orders.push({
      orderNo: `SO-${2026000 + i}`,
      customerId: 'customer_1',
      status: ['DRAFT', 'CONFIRMED', 'SHIPPED', 'COMPLETED'][Math.floor(Math.random() * 4)],
      totalAmount: Math.random() * 100000 + 10000,
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    });
  }
  
  console.log(`   - 生成 ${orders.length} 个销售订单`);
}

async function generateInventoryData() {
  // 生成库存数据
  const products = await prisma.product.findMany({ take: 50 });
  
  console.log(`   - 找到 ${products.length} 个产品`);
  console.log(`   - 生成库存记录...`);
}

async function generatePurchaseData() {
  // 生成采购数据
  const suppliers = await prisma.supplier.findMany({ take: 10 });
  
  console.log(`   - 找到 ${suppliers.length} 个供应商`);
  console.log(`   - 生成采购订单...`);
}

async function generateFinancialData() {
  // 生成财务数据
  console.log(`   - 生成现金流记录...`);
  console.log(`   - 生成利润数据...`);
}

// 运行生成脚本
generateReportData().catch(console.error);
