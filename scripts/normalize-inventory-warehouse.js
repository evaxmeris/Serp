#!/usr/bin/env node
/**
 * 库存仓库字段归一化迁移（Bug 1）
 *
 * 背景：
 *   InventoryItem.warehouse 是裸字符串，历史数据里混用了三种值
 *     a) Warehouse.id（cuid，前端下拉框 value 直接用 wh.id）
 *     b) Warehouse.code（SZ-MAIN / ZS001CN ...）
 *     c) 字面量 'MAIN'（schema @default）
 *   同一物理仓被拆成多条库存行，可用库存恒为 0（按 code 查不到 cuid 行）。
 *
 * 本脚本：
 *   1. 盘点 inventory_items / inventory_logs / stock_movements / purchase_receipts 的 warehouse 值分布
 *   2. 把 id / 'MAIN' 等一切非 code 值映射成仓库编码 code
 *   3. 映射后同一 (productId, code) 出现多行时合并：quantity / reservedQty 相加，
 *      日期取最新、最小/最大库存取有值者，流水改挂到目标行，删除多余行（唯一约束 [productId, warehouse] 不冲突）
 *   4. 输出迁移前后分布对比
 *
 * 用法：
 *   node scripts/normalize-inventory-warehouse.js            # dry-run，只打印计划
 *   node scripts/normalize-inventory-warehouse.js --apply    # 真正写库
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const MAIN_ALIASES = new Set(['MAIN', '主仓', 'MAIN-WH', 'DEFAULT']);

function fmtTable(rows) {
  if (!rows.length) return '  (empty)';
  return rows
    .map(r => `  ${String(r.warehouse).padEnd(30)} rows=${String(r.rows).padStart(4)} qty=${String(r.qty).padStart(6)}`)
    .join('\n');
}

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, code: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!warehouses.length) throw new Error('warehouses 表为空，无法确定仓库编码');

  const byId = new Map(warehouses.map(w => [w.id, w]));
  const byCode = new Map(warehouses.map(w => [w.code.toUpperCase(), w]));
  const explicitMain = warehouses.find(w => w.code.toUpperCase() === 'MAIN') || warehouses[0];

  /** 任意标识 → warehouse 记录；无法识别返回 null */
  function resolve(input) {
    const raw = (input || '').trim();
    if (!raw) return null;
    if (byId.has(raw)) return byId.get(raw);
    const upper = raw.toUpperCase();
    if (byCode.has(upper)) return byCode.get(upper);
    if (MAIN_ALIASES.has(upper)) return explicitMain;
    return null;
  }

  console.log(`模式: ${APPLY ? 'APPLY（写库）' : 'DRY-RUN（只打印）'}`);
  console.log(`仓库: ${warehouses.map(w => `${w.code}(${w.id.slice(-6)})`).join(', ')}\n`);

  // ---------- 1. 迁移前盘点 ----------
  const beforeInv = await prisma.$queryRawUnsafe(
    `SELECT warehouse, COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS qty
     FROM inventory_items GROUP BY warehouse ORDER BY rows DESC`
  );
  const beforeLog = await prisma.$queryRawUnsafe(
    `SELECT "warehouseId" AS warehouse, COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS qty
     FROM inventory_logs GROUP BY "warehouseId" ORDER BY rows DESC`
  );
  const beforeTotal = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS qty FROM inventory_items`
  );

  console.log('=== 迁移前 inventory_items 按 warehouse ===');
  console.log(fmtTable(beforeInv));
  console.log(`  合计: rows=${beforeTotal[0].rows} qty=${beforeTotal[0].qty}\n`);
  console.log('=== 迁移前 inventory_logs 按 warehouseId ===');
  console.log(fmtTable(beforeLog));
  console.log('');

  // ---------- 2. 规划迁移 ----------
  const items = await prisma.inventoryItem.findMany({
    select: {
      id: true,
      productId: true,
      warehouse: true,
      quantity: true,
      reservedQty: true,
      minStock: true,
      maxStock: true,
      location: true,
      lastInboundDate: true,
      lastOutboundDate: true,
      lastCountedAt: true,
      createdAt: true,
      version: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const unresolved = [];
  const groups = new Map(); // `${productId}::${code}` -> rows[]

  for (const item of items) {
    const wh = resolve(item.warehouse);
    if (!wh) {
      unresolved.push(item);
      groups.set(`${item.productId}::raw:${item.warehouse}`, [item]);
      continue;
    }
    const key = `${item.productId}::${wh.code}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const plans = []; // { code, keeper, others, merged }
  for (const [key, rows] of groups.entries()) {
    if (key.includes('::raw:')) continue;
    const code = key.split('::')[1];
    const canonical = rows.filter(r => r.warehouse === code);
    const keeper = canonical[0] || rows[0];
    const others = rows.filter(r => r.id !== keeper.id);
    if (keeper.warehouse !== code || others.length > 0) {
      plans.push({ code, keeper, others, rows });
    }
  }

  console.log('=== 迁移计划 ===');
  if (!plans.length) console.log('  （无需迁移：所有 warehouse 值已是仓库编码且无重复行）');
  for (const p of plans) {
    const totalQty = p.rows.reduce((s, r) => s + r.quantity, 0);
    const totalReserved = p.rows.reduce((s, r) => s + r.reservedQty, 0);
    console.log(
      `  product=${p.keeper.productId} → ${p.code}: ${p.rows.length} 行合并为 1 行` +
      `（qty ${p.rows.map(r => r.quantity).join('+')}=${totalQty}, reserved=${totalReserved}）` +
      ` 来源: [${p.rows.map(r => r.warehouse).join(', ')}]`
    );
  }
  if (unresolved.length) {
    console.log(`\n⚠️ 无法识别的 warehouse 值（保持原样，需人工确认）: ${unresolved.length} 行`);
    for (const r of unresolved.slice(0, 20)) {
      console.log(`  product=${r.productId} warehouse=${JSON.stringify(r.warehouse)}`);
    }
  }

  if (!APPLY) {
    console.log('\nDRY-RUN 结束，未写库。加 --apply 执行。');
    return;
  }

  // ---------- 3. 执行合并 ----------
  let mergedDeleted = 0;
  let converted = 0;

  for (const p of plans) {
    await prisma.$transaction(async (tx) => {
      const { keeper, others, code } = p;
      const all = [keeper, ...others];

      const maxDate = (field) =>
        all.reduce((acc, r) => {
          const v = r[field];
          if (!v) return acc;
          return !acc || v > acc ? v : acc;
        }, null);
      const pick = (field) =>
        all.map(r => r[field]).find(v => v !== null && v !== undefined) ?? null;

      const mergedQty = all.reduce((s, r) => s + r.quantity, 0);
      const mergedReserved = all.reduce((s, r) => s + r.reservedQty, 0);

      // 先把流水挂到 keeper 的 id 所属仓库编码（按字符串值改，与 keeper id 无关）
      await tx.inventoryLog.updateMany({
        where: { warehouseId: { in: all.map(r => r.warehouse) } },
        data: { warehouseId: code },
      });

      // keeper 若不在目标编码上，先改成目标编码（同组内不存在第二个目标编码行）
      if (keeper.warehouse !== code) {
        await tx.inventoryItem.update({
          where: { id: keeper.id },
          data: { warehouse: code },
        });
        converted++;
      }

      // 删除其余行（数量已在下面一次性写回）
      if (others.length) {
        await tx.inventoryItem.deleteMany({ where: { id: { in: others.map(r => r.id) } } });
        mergedDeleted += others.length;
      }

      await tx.inventoryItem.update({
        where: { id: keeper.id },
        data: {
          quantity: mergedQty,
          reservedQty: mergedReserved,
          availableQty: mergedQty - mergedReserved,
          minStock: pick('minStock'),
          maxStock: pick('maxStock'),
          location: pick('location'),
          lastInboundDate: maxDate('lastInboundDate'),
          lastOutboundDate: maxDate('lastOutboundDate'),
          lastCountedAt: maxDate('lastCountedAt'),
          version: { increment: 1 },
        },
      });
    });
  }

  // ---------- 4. 其它含 warehouse 字符串的表 ----------
  const auxTables = [
    { table: 'inventory_logs', column: 'warehouseId' },
    { table: 'stock_movements', column: 'warehouse' },
    { table: 'purchase_receipts', column: 'warehouse' },
    { table: 'purchase_receipt_items', column: 'warehouse' },
  ];
  let auxUpdates = 0;
  for (const t of auxTables) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "${t.column}" AS v FROM ${t.table} WHERE "${t.column}" IS NOT NULL`
    );
    for (const { v } of rows) {
      const wh = resolve(v);
      if (!wh || wh.code === v) continue;
      const res = await prisma.$executeRawUnsafe(
        `UPDATE ${t.table} SET "${t.column}" = $1 WHERE "${t.column}" = $2`,
        wh.code,
        v
      );
      auxUpdates += Number(res) || 0;
      console.log(`  ${t.table}.${t.column}: ${v} → ${wh.code} (${res} 行)`);
    }
  }

  // ---------- 5. 迁移后盘点 ----------
  const afterInv = await prisma.$queryRawUnsafe(
    `SELECT warehouse, COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS qty
     FROM inventory_items GROUP BY warehouse ORDER BY rows DESC`
  );
  const afterTotal = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS qty FROM inventory_items`
  );

  console.log('\n=== 迁移后 inventory_items 按 warehouse ===');
  console.log(fmtTable(afterInv));
  console.log(`  合计: rows=${afterTotal[0].rows} qty=${afterTotal[0].qty}`);
  console.log('\n=== 对比 ===');
  console.log(`  inventory_items 行数: ${beforeTotal[0].rows} → ${afterTotal[0].rows}（删除重复行 ${mergedDeleted}）`);
  console.log(`  inventory_items 总数量: ${beforeTotal[0].qty} → ${afterTotal[0].qty}（差值应为 0）`);
  console.log(`  仓库值改写: ${converted} 行；辅助表改写: ${auxUpdates} 行`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
