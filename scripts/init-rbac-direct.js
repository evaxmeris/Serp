const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function init() {
  console.log('🚀 开始初始化角色权限系统...\n');
  
  // 创建默认权限
  const permissions = [
    { code: 'user:list', name: 'user:list', displayName: '查看用户列表', module: 'user', description: '查看用户列表' },
    { code: 'user:create', name: 'user:create', displayName: '创建用户', module: 'user', description: '创建新用户' },
    { code: 'user:edit', name: 'user:edit', displayName: '编辑用户', module: 'user', description: '编辑用户信息' },
    { code: 'user:delete', name: 'user:delete', displayName: '删除用户', module: 'user', description: '删除用户' },
    { code: 'role:list', name: 'role:list', displayName: '查看角色列表', module: 'role', description: '查看角色' },
    { code: 'role:create', name: 'role:create', displayName: '创建角色', module: 'role', description: '创建新角色' },
    { code: 'role:edit', name: 'role:edit', displayName: '编辑角色', module: 'role', description: '编辑角色' },
    { code: 'role:delete', name: 'role:delete', displayName: '删除角色', module: 'role', description: '删除角色' },
    { code: 'customer:list', name: 'customer:list', displayName: '查看客户列表', module: 'customer', description: '查看客户' },
    { code: 'customer:create', name: 'customer:create', displayName: '创建客户', module: 'customer', description: '创建客户' },
    { code: 'order:list', name: 'order:list', displayName: '查看订单列表', module: 'order', description: '查看订单' },
    { code: 'order:create', name: 'order:create', displayName: '创建订单', module: 'order', description: '创建订单' },
  ];
  
  console.log('📋 创建默认权限...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ 已创建 ${permissions.length} 个权限\n`);
  
  // 创建默认角色
  const roles = [
    { name: 'super-admin', displayName: '超级管理员', description: '系统超级管理员，拥有所有权限', isSystem: true },
    { name: 'admin', displayName: '管理员', description: '系统管理员', isSystem: true },
    { name: 'sales', displayName: '业务员', description: '销售人员', isSystem: true },
    { name: 'purchasing', displayName: '采购员', description: '采购人员', isSystem: true },
    { name: 'warehouse', displayName: '仓管员', description: '仓库管理人员', isSystem: true },
    { name: 'finance', displayName: '财务人员', description: '财务人员', isSystem: true },
    { name: 'viewer', displayName: '只读访客', description: '只读权限', isSystem: true },
  ];
  
  console.log('👥 创建默认角色...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log(`✅ 已创建 ${roles.length} 个角色\n`);
  
  // 为超级管理员分配所有权限
  console.log('🔑 为超级管理员分配所有权限...');
  const superAdmin = await prisma.role.findUnique({ where: { name: 'super-admin' } });
  const allPerms = await prisma.permission.findMany();
  
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: perm.id },
    });
  }
  console.log(`✅ 超级管理员已分配 ${allPerms.length} 个权限\n`);
  
  console.log('🎉 初始化完成！');
  await prisma.$disconnect();
}

init().catch(console.error);
