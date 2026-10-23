/**
 * 数据修正：回滚 2026-09-11 出库方向 bug 的测试污染
 * 目标商品：sku 208「2lb山羊奶皂基块」@ ZS001CN，19 → 4（回滚 3 次错误 +5）
 * 原则：不删除任何历史流水（审计完整），改为补标注 + 新增一条带说明的修正流水
 * 用法：cd ~/clawd/trade-erp && node scripts/tmp-rollback-inventory-test.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WAREHOUSE = 'ZS001CN';
const SKU = '208';

const product = await prisma.product.findFirst({ where: { sku: SKU }, select: { id: true, name: true, sku: true } });
if (!product) { console.error('未找到商品 sku=' + SKU); process.exit(1); }
console.log('商品:', product.sku, product.name);

// 1. 找出所有异常出库流水（type=OUT 但 quantity>0）
const badLogs = await prisma.inventoryLog.findMany({
  where: { productId: product.id, warehouseId: WAREHOUSE, type: 'OUT', quantity: { gt: 0 } },
  orderBy: { createdAt: 'asc' },
});
const totalWrong = badLogs.reduce((s, l) => s + l.quantity, 0);
console.log(`异常流水 ${badLogs.length} 条，合计错误增量 +${totalWrong}`);
for (const l of badLogs) console.log(`  ${l.id} | ${l.createdAt.toISOString().slice(0, 19)} | +${l.quantity}`);

// 2. 当前库存与目标
const item = await prisma.inventoryItem.findUnique({
  where: { productId_warehouse: { productId: product.id, warehouse: WAREHOUSE } },
});
if (!item) { console.error('未找到库存记录'); process.exit(1); }
const before = item.quantity;
const target = before - totalWrong;
console.log(`库存: ${before} → ${target}（回滚 ${totalWrong}）`);
if (target < 0) { console.error('目标库存为负，中止'); process.exit(1); }

// 3. 事务：修正库存 + 新增修正流水 + 标注历史错误流水
await prisma.$transaction([
  prisma.inventoryItem.update({
    where: { id: item.id },
    data: { quantity: target, version: { increment: 1 }, lastOutboundDate: new Date() },
  }),
  prisma.inventoryLog.create({
    data: {
      productId: product.id,
      warehouseId: WAREHOUSE,
      type: 'OUT',
      quantity: -totalWrong,
      beforeQuantity: before,
      afterQuantity: target,
      referenceType: 'MANUAL_ROLLBACK',
      note: `回滚2026-09-11出库方向bug（库存调整接口忽略type一律相加）的测试污染：${before}→${target}，共回滚${totalWrong}件`,
    },
  }),
  prisma.inventoryLog.updateMany({
    where: { id: { in: badLogs.map(l => l.id) } },
    data: { referenceType: 'ROLLED_BACK_BUG' },
  }),
]);

// 4. 验证
const after = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
console.log(`\n✓ 修正完成：库存 ${before} → ${after.quantity}`);
console.log('错误流水已标注 referenceType=ROLLED_BACK_BUG（保留记录，不删除）');
await prisma.$disconnect();
