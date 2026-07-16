const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 将所有大写角色名转为小写
  const users = await p.user.findMany({ select: { id: true, email: true, role: true } });
  for (const u of users) {
    const lower = u.role?.toLowerCase();
    if (lower && lower !== u.role) {
      await p.user.update({ where: { id: u.id }, data: { role: lower } });
      console.log(`${u.email.padEnd(30)} ${u.role} → ${lower}`);
    }
  }
  await p.$disconnect();
  console.log('\n完成');
}

main().catch(e => { console.error(e); process.exit(1); });
