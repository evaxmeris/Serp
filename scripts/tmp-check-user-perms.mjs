/**
 * 临时排查：新用户 zhangqq 的角色与权限配置
 * 用法：cd ~/clawd/trade-erp && node scripts/tmp-check-user-perms.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const u = await prisma.user.findFirst({
  where: { OR: [{ name: { contains: 'zhangqq', mode: 'insensitive' } }, { email: { contains: 'zhangqq' } }] },
  include: {
    userRoles: {
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    },
  },
});

if (!u) {
  console.log('未找到 zhangqq 用户');
} else {
  console.log('用户:', u.email, '|', u.name, '| isApproved:', u.isApproved, '| isActive:', u.isActive);
  console.log('角色数:', u.userRoles.length);
  for (const ur of u.userRoles) {
    const codes = ur.role.permissions.map(p => p.permission.code);
    console.log(`  角色: ${ur.role.name} (${ur.role.displayName}) primary=${ur.isPrimary} active=${ur.role.isActive} | 权限点数=${codes.length}`);
    console.log('    权限:', codes.length ? codes.join(', ') : '（无权限点！）');
  }
}

// 对照：admin 用户的权限规模
const admin = await prisma.user.findFirst({
  where: { email: 'admin@trade-erp.com' },
  include: { userRoles: { include: { role: { include: { permissions: true } } } } },
});
if (admin) {
  console.log('\n[对照] admin:', admin.email);
  for (const ur of admin.userRoles) {
    console.log(`  角色: ${ur.role.name} | 权限点数=${ur.role.permissions.length}`);
  }
}

// 全部角色及其权限点数量（便于判断该给她的角色是否配齐）
console.log('\n=== 全部角色权限点数量 ===');
const roles = await prisma.role.findMany({
  include: { _count: { select: { permissions: true, userRoles: true } } },
  orderBy: { name: 'asc' },
});
for (const r of roles) {
  console.log(` ${r.name} (${r.displayName}) | 权限点=${r._count.permissions} | 用户数=${r._count.userRoles}`);
}

await prisma.$disconnect();
