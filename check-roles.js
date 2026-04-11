const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRoles() {
  console.log('=== Checking Roles in Database ===\n');
  
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Total roles: ${roles.length}\n`);
  
  roles.forEach((role, index) => {
    console.log(`${index + 1}. ${role.name} (${role.displayName})`);
    console.log(`   ID: ${role.id}`);
    console.log(`   Description: ${role.description || 'N/A'}`);
    console.log(`   Is System: ${role.isSystem}`);
    console.log(`   Is Active: ${role.isActive}`);
    console.log(`   Permissions: ${role.permissions.length}`);
    if (role.permissions.length > 0) {
      console.log(`   Permission codes: ${role.permissions.map(p => p.permission.code).join(', ')}`);
    }
    console.log('');
  });
  
  // 检查 permissions
  console.log('\n=== Checking Permissions ===\n');
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { code: 'asc' }]
  });
  
  console.log(`Total permissions: ${permissions.length}\n`);
  
  const modules = [...new Set(permissions.map(p => p.module))];
  modules.forEach(module => {
    const modulePermissions = permissions.filter(p => p.module === module);
    console.log(`Module: ${module} (${modulePermissions.length} permissions)`);
    modulePermissions.forEach(p => {
      console.log(`  - ${p.code}: ${p.displayName}`);
    });
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkRoles();
