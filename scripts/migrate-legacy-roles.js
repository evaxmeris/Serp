/**
 * 迁移脚本：将旧版固定角色迁移到新的 RBAC 系统
 *
 * 功能：
 * 1. 创建 5 个系统内置角色
 * 2. 将现有用户的 role 枚举值迁移到 UserRole 表
 * 3. 初始化基础权限
 * 4. 为 ADMIN 角色分配全部权限
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 系统内置角色定义
const SYSTEM_ROLES = [
  {
    name: 'ADMIN',
    displayName: '系统管理员',
    description: '系统内置管理员角色，拥有全部权限',
    isSystem: true,
    isActive: true,
  },
  {
    name: 'SALES',
    displayName: '业务员',
    description: '业务员角色，管理客户、报价、订单',
    isSystem: true,
    isActive: true,
  },
  {
    name: 'PURCHASING',
    displayName: '采购员',
    description: '采购员角色，管理供应商、采购、入库',
    isSystem: true,
    isActive: true,
  },
  {
    name: 'WAREHOUSE',
    displayName: '仓管员',
    description: '仓管员角色，管理出入库、库存',
    isSystem: true,
    isActive: true,
  },
  {
    name: 'VIEWER',
    displayName: '只读访客',
    description: '只读访问权限，无法修改数据',
    isSystem: true,
    isActive: true,
  },
];

// 默认权限定义
const DEFAULT_PERMISSIONS = [
  // 用户管理
  { code: 'user:view', name: '查看用户', category: '系统管理' },
  { code: 'user:create', name: '创建用户', category: '系统管理' },
  { code: 'user:edit', name: '编辑用户', category: '系统管理' },
  { code: 'user:delete', name: '删除用户', category: '系统管理' },

  // 角色权限管理
  { code: 'role:view', name: '查看角色', category: '系统管理' },
  { code: 'role:create', name: '创建角色', category: '系统管理' },
  { code: 'role:edit', name: '编辑角色', category: '系统管理' },
  { code: 'role:delete', name: '删除角色', category: '系统管理' },
  { code: 'permission:view', name: '查看权限', category: '系统管理' },

  // 客户管理
  { code: 'customer:view', name: '查看客户', category: '客户管理' },
  { code: 'customer:create', name: '创建客户', category: '客户管理' },
  { code: 'customer:edit', name: '编辑客户', category: '客户管理' },
  { code: 'customer:delete', name: '删除客户', category: '客户管理' },

  // 询盘管理
  { code: 'inquiry:view', name: '查看询盘', category: '客户管理' },
  { code: 'inquiry:create', name: '创建询盘', category: '客户管理' },
  { code: 'inquiry:edit', name: '编辑询盘', category: '客户管理' },
  { code: 'inquiry:delete', name: '删除询盘', category: '客户管理' },

  // 报价管理
  { code: 'quotation:view', name: '查看报价', category: '报价管理' },
  { code: 'quotation:create', name: '创建报价', category: '报价管理' },
  { code: 'quotation:edit', name: '编辑报价', category: '报价管理' },
  { code: 'quotation:delete', name: '删除报价', category: '报价管理' },

  // 订单管理
  { code: 'order:view', name: '查看订单', category: '订单管理' },
  { code: 'order:create', name: '创建订单', category: '订单管理' },
  { code: 'order:edit', name: '编辑订单', category: '订单管理' },
  { code: 'order:delete', name: '删除订单', category: '订单管理' },
  { code: 'order:approve', name: '审批订单', category: '订单管理' },

  // 采购管理
  { code: 'purchase:view', name: '查看采购', category: '采购管理' },
  { code: 'purchase:create', name: '创建采购', category: '采购管理' },
  { code: 'purchase:edit', name: '编辑采购', category: '采购管理' },
  { code: 'purchase:delete', name: '删除采购', category: '采购管理' },

  // 供应商管理
  { code: 'supplier:view', name: '查看供应商', category: '供应商管理' },
  { code: 'supplier:create', name: '创建供应商', category: '供应商管理' },
  { code: 'supplier:edit', name: '编辑供应商', category: '供应商管理' },
  { code: 'supplier:delete', name: '删除供应商', category: '供应商管理' },

  // 产品管理
  { code: 'product:view', name: '查看产品', category: '产品管理' },
  { code: 'product:create', name: '创建产品', category: '产品管理' },
  { code: 'product:edit', name: '编辑产品', category: '产品管理' },
  { code: 'product:delete', name: '删除产品', category: '产品管理' },

  // 库存管理
  { code: 'inventory:view', name: '查看库存', category: '库存管理' },
  { code: 'inventory:adjust', name: '调整库存', category: '库存管理' },
  { code: 'inbound:view', name: '查看入库', category: '库存管理' },
  { code: 'inbound:create', name: '创建入库', category: '库存管理' },
  { code: 'inbound:process', name: '处理入库', category: '库存管理' },
  { code: 'outbound:view', name: '查看出库', category: '库存管理' },
  { code: 'outbound:create', name: '创建出库', category: '库存管理' },
  { code: 'outbound:process', name: '处理出库', category: '库存管理' },

  // 财务管理
  { code: 'finance:view', name: '查看财务', category: '财务管理' },
  { code: 'payment:view', name: '查看付款', category: '财务管理' },
  { code: 'payment:create', name: '创建付款', category: '财务管理' },

  // 报表
  { code: 'report:view', name: '查看报表', category: '报表' },
  { code: 'report:export', name: '导出报表', category: '报表' },

  // 研究开发
  { code: 'research:view', name: '查看调研', category: '市场调研' },
  { code: 'research:create', name: '创建调研', category: '市场调研' },
  { code: 'research:edit', name: '编辑调研', category: '市场调研' },
];

// 默认权限分配（向后兼容旧角色）
const ROLE_DEFAULT_PERMISSIONS = {
  ADMIN: ['*'], // 全部权限，特殊处理
  SALES: [
    'customer:view', 'customer:create', 'customer:edit',
    'inquiry:view', 'inquiry:create', 'inquiry:edit',
    'quotation:view', 'quotation:create', 'quotation:edit',
    'order:view', 'order:create', 'order:edit',
    'report:view',
  ],
  PURCHASING: [
    'supplier:view', 'supplier:create', 'supplier:edit',
    'product:view', 'product:create', 'product:edit',
    'purchase:view', 'purchase:create', 'purchase:edit',
    'inventory:view',
    'report:view',
  ],
  WAREHOUSE: [
    'product:view',
    'inventory:view', 'inventory:adjust',
    'inbound:view', 'inbound:create', 'inbound:process',
    'outbound:view', 'outbound:create', 'outbound:process',
    'report:view',
  ],
  VIEWER: [
    'customer:view',
    'inquiry:view',
    'quotation:view',
    'order:view',
    'supplier:view',
    'product:view',
    'purchase:view',
    'inventory:view',
    'report:view',
  ],
};

async function migrateLegacyRoles() {
  console.log('=== 开始迁移旧版角色到 RBAC 系统 ===\n');

  // 1. 创建系统角色
  console.log('1. 创建系统内置角色...');
  for (const role of SYSTEM_ROLES) {
    const result = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    console.log(`   ${result.name} - ${result.displayName}`);
  }
  console.log('   ✓ 系统角色创建完成\n');

  // 2. 迁移现有用户角色
  console.log('2. 迁移现有用户角色...');
  const users = await prisma.user.findMany({
    where: {
      role: { not: null },
    },
  });
  console.log(`   找到 ${users.length} 个用户需要迁移`);

  let migratedCount = 0;
  for (const user of users) {
    const roleName = user.role; // ADMIN | SALES | ...
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });
      migratedCount++;
    }
  }
  console.log(`   ✓ 完成 ${migratedCount} 个用户迁移\n`);

  // 3. 初始化基础权限
  console.log('3. 初始化基础权限...');
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`   ✓ 创建 ${DEFAULT_PERMISSIONS.length} 个基础权限\n`);

  // 4. 为 ADMIN 角色分配全部权限
  console.log('4. 为 ADMIN 角色分配全部权限...');
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const allPermissions = await prisma.permission.findMany();

  let assignedCount = 0;
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
    assignedCount++;
  }
  console.log(`   ✓ 分配 ${assignedCount} 个权限给 ADMIN\n`);

  // 5. 为其他系统角色分配默认权限
  console.log('5. 为其他系统角色分配默认权限...');
  const allPermissionsMap = new Map(
    allPermissions.map(p => [p.code, p.id])
  );

  for (const [roleName, permissionCodes] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
    if (roleName === 'ADMIN') continue; // ADMIN 已处理

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    let count = 0;
    for (const code of permissionCodes) {
      const permId = allPermissionsMap.get(code);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
        count++;
      }
    }
    console.log(`   ${roleName}: 分配 ${count} 个权限`);
  }
  console.log('   ✓ 默认权限分配完成\n');

  console.log('=== 迁移完成！ ===');
  console.log('\n统计信息：');
  console.log(`- 系统角色: ${SYSTEM_ROLES.length}`);
  console.log(`- 基础权限: ${DEFAULT_PERMISSIONS.length}`);
  console.log(`- 迁移用户: ${migratedCount}`);
  console.log(`- ADMIN 权限: ${assignedCount}`);
}

migrateLegacyRoles()
  .catch((error) => {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
