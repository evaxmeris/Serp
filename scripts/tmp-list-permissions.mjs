/**
 * 列出全部权限码（供菜单权限映射使用）
 * 用法：cd ~/clawd/trade-erp && node scripts/tmp-list-permissions.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const perms = await prisma.permission.findMany({
  select: { code: true, module: true, displayName: true },
  orderBy: [{ module: 'asc' }, { code: 'asc' }],
});
console.log('权限码总数:', perms.length, '\n');
let lastModule = '';
for (const p of perms) {
  if (p.module !== lastModule) { console.log(`\n--- module: ${p.module} ---`); lastModule = p.module; }
  console.log(`  ${p.code.padEnd(34)} ${p.displayName}`);
}
await prisma.$disconnect();
