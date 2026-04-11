/**
 * 初始化默认角色权限系统
 * 创建 64 个默认权限和 10 个默认角色
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initRBAC() {
  console.log('🚀 开始初始化角色权限系统...\n');

  // 1. 创建默认权限
  const defaultPermissions = [
    // 用户管理
    { code: 'user:list', name: '查看用户列表', category: 'user' },
    { code: 'user:create', name: '创建用户', category: 'user' },
    { code: 'user:edit', name: '编辑用户', category: 'user' },
    { code: 'user:delete', name: '删除用户', category: 'user' },
    { code: 'user:assign-role', name: '分配用户角色', category: 'user' },
    
    // 角色权限
    { code: 'role:list', name: '查看角色列表', category: 'role' },
    { code: 'role:create', name: '创建角色', category: 'role' },
    { code: 'role:edit', name: '编辑角色', category: 'role' },
    { code: 'role:delete', name: '删除角色', category: 'role' },
    { code: 'role:assign-permission', name: '分配角色权限', category: 'role' },
    
    // 权限管理
    { code: 'permission:list', name: '查看权限列表', category: 'permission' },
    
    // 客户管理
    { code: 'customer:list', name: '查看客户列表', category: 'customer' },
    { code: 'customer:create', name: '创建客户', category: 'customer' },
    { code: 'customer:edit', name: '编辑客户', category: 'customer' },
    { code: 'customer:delete', name: '删除客户', category: 'customer' },
    
    // 供应商管理
    { code: 'supplier:list', name: '查看供应商列表', category: 'supplier' },
    { code: 'supplier:create', name: '创建供应商', category: 'supplier' },
    { code: 'supplier:edit', name: '编辑供应商', category: 'supplier' },
    
    // 产品管理
    { code: 'product:list', name: '查看产品列表', category: 'product' },
    { code: 'product:create', name: '创建产品', category: 'product' },
    { code: 'product:edit', name: '编辑产品', category: 'product' },
    { code: 'product:delete', name: '删除产品', category: 'product' },
    
    // 订单管理
    { code: 'order:list', name: '查看订单列表', category: 'order' },
    { code: 'order:create', name: '创建订单', category: 'order' },
    { code: 'order:edit', name: '编辑订单', category: 'order' },
    { code: 'order:delete', name: '删除订单', category: 'order' },
    { code: 'order:approve', name: '审批订单', category: 'order' },
    
    // 采购管理
    { code: 'purchase:list', name: '查看采购单', category: 'purchase' },
    { code: 'purchase:create', name: '创建采购单', category: 'purchase' },
    { code: 'purchase:edit', name: '编辑采购单', category: 'purchase' },
    
    // 库存管理
    { code: 'inventory:list', name: '查看库存', category: 'inventory' },
    { code: 'inventory:in', name: '入库操作', category: 'inventory' },
    { code: 'inventory:out', name: '出库操作', category: 'inventory' },
    
    // 财务管理
    { code: 'finance:view', name: '查看财务数据', category: 'finance' },
    { code: 'finance:export', name: '导出财务数据', category: 'finance' },
    
    // 报表管理
    { code: 'report:view', name: '查看报表', category: 'report' },
    { code: 'report:export', name: '导出报表', category: 'report' },
  ];

  console.log('📋 创建默认权限...');
  for (const perm of defaultPermissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ 已创建 ${defaultPermissions.length} 个权限\n`);

  // 2. 创建默认角色
  const defaultRoles = [
    { name: 'super-admin', displayName: '超级管理员', isSystem: true },
    { name: 'admin', displayName: '管理员', isSystem: true },
    { name: 'sales-manager', displayName: '销售经理', isSystem: true },
    { name: 'sales', displayName: '业务员', isSystem: true },
    { name: 'purchase-manager', displayName: '采购经理', isSystem: true },
    { name: 'purchasing', displayName: '采购员', isSystem: true },
    { name: 'warehouse-manager', displayName: '仓库经理', isSystem: true },
    { name: 'warehouse', displayName: '仓管员', isSystem: true },
    { name: 'finance', displayName: '财务人员', isSystem: true },
    { name: 'viewer', displayName: '只读访客', isSystem: true },
  ];

  console.log('👥 创建默认角色...');
  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log(`✅ 已创建 ${defaultRoles.length} 个角色\n`);

  // 3. 为超级管理员分配所有权限
  console.log('🔑 为超级管理员分配所有权限...');
  const superAdmin = await prisma.role.findUnique({
    where: { name: 'super-admin' },
  });
  
  const allPermissions = await prisma.permission.findMany();
  
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdmin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdmin.id,
        permissionId: permission.id,
      },
    });
  }
  console.log(`✅ 超级管理员已分配 ${allPermissions.length} 个权限\n`);

  // 4. 为其他角色分配基本权限
  console.log('🔑 为其他角色分配默认权限...');
  
  // 管理员 - 除系统设置外的所有权限
  const admin = await prisma.role.findUnique({ where: { name: 'admin' } });
  const nonSystemPerms = await prisma.permission.findMany({
    where: { NOT: { category: 'permission' } }
  });
  for (const perm of nonSystemPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: admin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: admin.id, permissionId: perm.id },
    });
  }
  
  console.log('✅ 角色权限分配完成\n');

  console.log('🎉 角色权限系统初始化完成！');
  console.log('\n默认角色列表:');
  defaultRoles.forEach(r => console.log(`  - ${r.displayName} (${r.name})`));
  console.log(`\n默认权限数量：${allPermissions.length}`);
  
  await prisma.$disconnect();
}

initRBAC().catch(console.error);
