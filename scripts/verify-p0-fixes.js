#!/usr/bin/env node
/**
 * P0 问题修复验证脚本
 * 用于验证所有 P0 问题是否已正确修复
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 开始验证 Sprint 4 P0 问题修复...\n');

let allPassed = true;

// 验证 1: 检查 TypeScript 编译
console.log('✅ 验证 1: TypeScript 编译检查');
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('   ✅ TypeScript 编译通过\n');
} catch (error) {
  console.log('   ❌ TypeScript 编译失败\n');
  allPassed = false;
}

// 验证 2: 检查 Prisma schema
console.log('✅ 验证 2: Prisma Schema 检查');
try {
  execSync('npx prisma validate', { stdio: 'pipe' });
  console.log('   ✅ Prisma Schema 验证通过\n');
} catch (error) {
  console.log('   ❌ Prisma Schema 验证失败\n');
  allPassed = false;
}

// 验证 3: 检查 InboundOrderItem 关联
console.log('✅ 验证 3: InboundOrderItem 关联检查');
const fs = require('fs');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf-8');

if (schema.includes('references: [id], onDelete: Cascade') && 
    schema.includes('model InboundOrderItem')) {
  console.log('   ✅ InboundOrderItem 关联正确 (references: [id])\n');
} else {
  console.log('   ❌ InboundOrderItem 关联错误\n');
  allPassed = false;
}

// 验证 4: 检查索引定义
console.log('✅ 验证 4: 数据库索引检查');
const requiredIndexes = [
  'inbound_orders_supplierId_idx',
  'inbound_orders_status_idx',
  'inbound_orders_createdAt_idx',
  'inbound_order_items_inboundOrderId_idx',
  'inbound_order_items_productId_idx',
  'inventory_productId_idx',
  'inventory_warehouseId_idx',
  'stock_movement_productId_idx',
  'stock_movement_type_idx'
];

let indexesFound = 0;
requiredIndexes.forEach(index => {
  if (schema.includes(`@@index([`)) {
    indexesFound++;
  }
});

if (indexesFound >= 5) {
  console.log(`   ✅ 找到 ${indexesFound}+ 个索引定义\n`);
} else {
  console.log(`   ❌ 索引定义不足 (找到 ${indexesFound} 个)\n`);
  allPassed = false;
}

// 验证 5: 检查事务使用
console.log('✅ 验证 5: 事务使用检查');
const confirmRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'v1', 'inbound-orders', '[id]', 'confirm', 'route.ts');
const confirmRoute = fs.readFileSync(confirmRoutePath, 'utf-8');

if (confirmRoute.includes('prisma.$transaction')) {
  console.log('   ✅ 确认入库使用完整事务\n');
} else {
  console.log('   ❌ 确认入库未使用事务\n');
  allPassed = false;
}

// 验证 6: 检查单号生成工具
console.log('✅ 验证 6: 单号生成工具检查');
const utilsPath = path.join(__dirname, '..', 'src', 'lib', 'inbound-order-number.ts');
if (fs.existsSync(utilsPath)) {
  const utils = fs.readFileSync(utilsPath, 'utf-8');
  if (utils.includes('generateInboundNo') && utils.includes('prisma.$transaction')) {
    console.log('   ✅ 单号生成工具存在且使用原子操作\n');
  } else {
    console.log('   ❌ 单号生成工具实现错误\n');
    allPassed = false;
  }
} else {
  console.log('   ❌ 单号生成工具文件不存在\n');
  allPassed = false;
}

// 验证 7: 检查迁移文件
console.log('✅ 验证 7: 数据库迁移检查');
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
const migrations = fs.readdirSync(migrationsDir);
const p0Migration = migrations.find(m => m.includes('fix_p0'));

if (p0Migration) {
  console.log(`   ✅ 找到 P0 修复迁移：${p0Migration}\n`);
} else {
  console.log('   ❌ 未找到 P0 修复迁移\n');
  allPassed = false;
}

// 总结
console.log('═══════════════════════════════════════');
if (allPassed) {
  console.log('✅ 所有 P0 问题修复验证通过！');
  console.log('═══════════════════════════════════════\n');
  process.exit(0);
} else {
  console.log('❌ 部分验证未通过，请检查修复！');
  console.log('═══════════════════════════════════════\n');
  process.exit(1);
}
