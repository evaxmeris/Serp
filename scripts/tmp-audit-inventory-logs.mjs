/**
 * 临时审计脚本：库存出库方向 bug 的污染数据排查
 * 用法：cd ~/clawd/trade-erp && node scripts/tmp-audit-inventory-logs.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. 异常出库流水：type=OUT 但 quantity>0（库存被执行了加法）
const badOut = await prisma.inventoryLog.findMany({
  where: { type: 'OUT', quantity: { gt: 0 } },
  include: { product: { select: { name: true, sku: true } } },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
console.log('=== 异常出库流水 (type=OUT 但 quantity>0 → 库存被增加) ===');
console.log('条数:', badOut.length);
for (const l of badOut) {
  console.log(` ${l.createdAt.toISOString().slice(0, 19)} | ${l.product?.sku || ''} ${l.product?.name || ''} | qty=+${l.quantity} | ${l.beforeQuantity} -> ${l.afterQuantity} | ${l.note || ''} | refId=${l.referenceId || '-'}`);
}

// 2. 全部流水类型分布（对照）
const groups = await prisma.inventoryLog.groupBy({ by: ['type'], _count: { _all: true }, _sum: { quantity: true } });
console.log('\n=== 流水类型分布 ===');
for (const g of groups) console.log(` ${g.type}: ${g._count._all} 条, sum(quantity)=${g._sum.quantity}`);

// 3. 受影响商品的当前库存
if (badOut.length) {
  const ids = [...new Set(badOut.map(l => l.productId))];
  const items = await prisma.inventoryItem.findMany({
    where: { productId: { in: ids } },
    include: { product: { select: { name: true, sku: true } } },
  });
  console.log('\n=== 受影响商品的当前库存 ===');
  for (const it of items) {
    console.log(` ${it.product?.sku || ''} ${it.product?.name || ''} @ ${it.warehouse}: quantity=${it.quantity} reserved=${it.reservedQty} version=${it.version}`);
  }
}

// 4. 最近的库存流水（看全貌，含正常出库单的 OUT 记录）
const recent = await prisma.inventoryLog.findMany({
  include: { product: { select: { name: true, sku: true } } },
  orderBy: { createdAt: 'desc' },
  take: 15,
});
console.log('\n=== 最近 15 条库存流水 ===');
for (const l of recent) {
  console.log(` ${l.createdAt.toISOString().slice(0, 19)} | ${l.type} | ${l.product?.sku || ''} ${l.product?.name || ''} | qty=${l.quantity} | ${l.beforeQuantity} -> ${l.afterQuantity} | ${l.referenceType || ''}`);
}

await prisma.$disconnect();
