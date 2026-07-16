const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// 各用户应恢复的角色（旧 User.role 值 → Role 表 name）
const RESTORE = [
  { email: 'admin@trade-erp.com',      roleName: 'super-admin' },
  { email: 'ftest@test.com',           roleName: 'admin' },
  { email: 'admin_test@example.com',   roleName: 'admin' },
  { email: '13286360818@163.com',      roleName: 'purchasing' },
  { email: '809129385@qq.com',         roleName: 'admin' },
  { email: 'zhengxiaoxiong1990@gmail.com', roleName: 'viewer' },
  { email: 'ghostkid@163.com',         roleName: 'super-admin' },
  { email: '1208823864@qq.com',        roleName: 'admin' },
  { email: '245686887@qq.com',         roleName: 'admin' },
];

async function main() {
  // 1. 查找所有 Role
  const allRoles = await p.role.findMany();
  const roleByName = {};
  for (const r of allRoles) roleByName[r.name] = r;

  // 2. 为每个用户创建 UserRole(isPrimary=true)
  for (const item of RESTORE) {
    const user = await p.user.findUnique({ where: { email: item.email } });
    if (!user) { console.log(`❌ 用户 ${item.email} 不存在`); continue; }
    
    const role = roleByName[item.roleName];
    if (!role) { console.log(`❌ 角色 ${item.roleName} 不存在`); continue; }

    // 检查是否已有记录
    const existing = await p.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });

    if (existing) {
      await p.userRole.update({
        where: { id: existing.id },
        data: { isPrimary: true },
      });
      console.log(`🔄 ${user.email} → ${role.displayName} (已存在，设为primary)`);
    } else {
      await p.userRole.create({
        data: { userId: user.id, roleId: role.id, isPrimary: true },
      });
      console.log(`✅ ${user.email} → ${role.displayName} (新建)`);
    }
  }

  await p.$disconnect();
  console.log('\n完成');
}

main().catch(e => { console.error(e); process.exit(1); });
