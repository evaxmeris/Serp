/**
 * 一次性脚本：user:disable 权限点接线（幂等）
 * 用途：dev/prod 环境初始化 —— 确保权限点存在并接线 super_admin / admin 角色
 * 用法：cd ~/clawd/trade-erp && node scripts/wire-user-disable-perm.mjs
 * 说明：与 lib/permissions.ts::seedUserDisablePermission 同逻辑；API 入口为 POST /api/permissions/init
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 确保权限点存在
  let perm = await prisma.permission.findUnique({ where: { code: 'user:disable' } });
  if (!perm) {
    perm = await prisma.permission.create({
      data: {
        name: 'user:disable',
        code: 'user:disable',
        displayName: '停用/启用用户',
        module: 'user',
        description: '停用或启用用户账号（停用后禁止登录，历史数据保留）',
      },
    });
    console.log('[create] permission user:disable ->', perm.id);
  } else {
    console.log('[exists] permission user:disable ->', perm.id);
  }

  // 2. 角色接线（幂等）；超级管理员实际名为 'super-admin'（连字符），兼容 super_admin
  for (const roleName of ['super-admin', 'super_admin', 'admin']) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.log('[skip] role not found:', roleName);
      continue;
    }
    const res = await prisma.rolePermission.createMany({
      data: [{ roleId: role.id, permissionId: perm.id }],
      skipDuplicates: true,
    });
    console.log(`[wire] ${roleName} <- user:disable (inserted=${res.count})`);
  }

  // 3. 校验输出
  const check = await prisma.rolePermission.count({
    where: { permission: { code: 'user:disable' } },
  });
  console.log('[verify] rolePermission rows for user:disable =', check);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
