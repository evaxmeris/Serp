/**
 * 准备认证系统测试数据
 * 
 * 创建测试用户用于认证集成测试
 * 
 * 使用方法:
 *   node tests/prepare-auth-test-data.js
 *   node tests/prepare-auth-test-data.js cleanup
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const testUsers = [
  {
    email: 'test@example.com',
    name: 'Test User',
    password: 'Password123!',
    role: 'USER',
    status: 'ACTIVE',
  },
  {
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'Admin123!',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
  {
    email: 'pending@example.com',
    name: 'Pending User',
    password: 'Password123!',
    role: 'USER',
    status: 'PENDING_APPROVAL',
  },
  {
    email: 'suspended@example.com',
    name: 'Suspended User',
    password: 'Password123!',
    role: 'USER',
    status: 'SUSPENDED',
  },
  {
    email: 'manager@example.com',
    name: 'Manager User',
    password: 'Manager123!',
    role: 'MANAGER',
    status: 'ACTIVE',
  },
];

async function prepareData() {
  console.log('🚀 准备认证系统测试数据...\n');

  for (const userData of testUsers) {
    // 检查用户是否已存在
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      console.log(`⚠️  用户已存在: ${userData.email} - 跳过`);
      continue;
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(userData.password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash,
        role: userData.role,
        status: userData.status,
      },
    });

    console.log(`✅ 创建测试用户: ${user.email} (${user.role}, ${user.status})`);
  }

  console.log('\n✨ 测试数据准备完成！');
  console.log('\n📋 测试用户清单:');
  testUsers.forEach(u => {
    console.log(`   - ${u.email} / ${u.password} (${u.role}, ${u.status})`);
  });
}

async function cleanupData() {
  console.log('🧹 清理认证系统测试数据...\n');

  for (const userData of testUsers) {
    try {
      await prisma.user.delete({
        where: { email: userData.email },
      });
      console.log(`✅ 删除测试用户: ${userData.email}`);
    } catch (error) {
      console.log(`⚠️  用户不存在: ${userData.email} - 跳过`);
    }
  }

  console.log('\n✨ 清理完成！');
}

async function main() {
  const action = process.argv[2];

  if (action === 'cleanup') {
    await cleanupData();
  } else {
    await prepareData();
  }

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
