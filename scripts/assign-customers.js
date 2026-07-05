const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 跟进人 → 系统用户 ID
const FOLLOWER_MAP = {
  'Eliam':   'cmo80ulfh0003o301smv24bta',
  'Danny':   'cmo2ds65e0000s9qcmmt4t4e9',
  'Aran':    'cmo80ugxe0002o301f8xf5bnn',
  'ghostkid':'cmntop7gz0000s9gtai2c4xnv',
};

async function main() {
  // 1. 找到所有阿里导入的、未分配 owner 的客户
  const customers = await prisma.customer.findMany({
    where: { source: '阿里国际站', ownerId: null, deletedAt: null },
    select: { id: true, notes: true, companyName: true },
  });
  console.log(`找到 ${customers.length} 条未分配的阿里客户\n`);

  // 2. 按跟进人分组
  const groups = {};
  for (const name of Object.keys(FOLLOWER_MAP)) groups[name] = [];
  const unmatched = [];

  for (const c of customers) {
    const notes = c.notes || '';
    let matched = false;
    for (const [follower] of Object.entries(FOLLOWER_MAP)) {
      if (notes.includes(`原跟进人: ${follower}`)) {
        groups[follower].push(c.id);
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.push(c);
  }

  // 3. 批量更新
  let totalOk = 0, totalFail = 0;
  for (const [follower, ids] of Object.entries(groups)) {
    if (ids.length === 0) continue;
    const userId = FOLLOWER_MAP[follower];
    process.stdout.write(`${follower} (${ids.length} 条): `);
    
    try {
      const r = await prisma.customer.updateMany({
        where: { id: { in: ids } },
        data: { ownerId: userId },
      });
      totalOk += r.count;
      console.log(`✅ ${r.count} 条已分配`);
    } catch (e) {
      totalFail += ids.length;
      console.log(`❌ 失败: ${e.message}`);
    }
  }

  console.log(`\n✅ 完成: ${totalOk} 成功, ${totalFail} 失败`);
  
  if (unmatched.length > 0) {
    console.log(`\n⚠️ 未匹配的 ${unmatched.length} 条:`);
    const stats = {};
    for (const c of unmatched) {
      const m = (c.notes || '').match(/原跟进人: ([^\n]+)/);
      const name = m ? m[1].trim() : '(无跟进人信息)';
      stats[name] = (stats[name] || 0) + 1;
    }
    for (const [name, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count} 条`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
