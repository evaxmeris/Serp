const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 恢复关键用户角色
  const updates = [
    { email: 'admin@trade-erp.com', role: 'ADMIN' },
    { email: 'ftest@test.com', role: 'ADMIN' },
    { email: 'admin_test@example.com', role: 'ADMIN' },
    { email: '13286360818@163.com', role: 'PURCHASING' },
  ];

  for (const u of updates) {
    const r = await p.user.updateMany({
      where: { email: u.email },
      data: { role: u.role },
    });
    console.log(`${u.email} → ${u.role} ${r.count > 0 ? 'OK' : 'FAIL'}`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
