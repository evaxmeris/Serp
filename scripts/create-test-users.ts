/**
 * 创建测试用户脚本
 * 用于 Sprint 7 认证测试
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 开始创建测试用户...\n');

  // 测试用户列表
  const testUsers = [
    {
      email: 'admin@trade-erp.com',
      password: 'Admin@123456',
      name: '系统管理员',
      role: 'ADMIN' as const,
    },
    {
      email: 'manager@trade-erp.com',
      password: 'Manager@123456',
      name: '部门经理',
      role: 'MANAGER' as const,
    },
    {
      email: 'user@trade-erp.com',
      password: 'User@123456',
      name: '普通用户',
      role: 'USER' as const,
    },
    {
      email: 'viewer@trade-erp.com',
      password: 'Viewer@123456',
      name: '访客',
      role: 'VIEWER' as const,
    },
  ];

  for (const userData of testUsers) {
    try {
      // 检查用户是否已存在
      const existing = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existing) {
        console.log(`⚠️  用户 ${userData.email} 已存在，跳过`);
        continue;
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // 创建用户
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: hashedPassword,
          name: userData.name,
          role: userData.role,
        },
      });

      console.log(`✅ 创建用户：${user.email} (${user.role})`);
    } catch (error) {
      console.error(`❌ 创建用户 ${userData.email} 失败:`, error);
    }
  }

  console.log('\n✅ 测试用户创建完成！\n');
  console.log('📋 测试账号列表:');
  console.log('─────────────────────────────────────');
  console.log('管理员：admin@trade-erp.com / Admin@123456');
  console.log('经  理：manager@trade-erp.com / Manager@123456');
  console.log('用  户：user@trade-erp.com / User@123456');
  console.log('访  客：viewer@trade-erp.com / Viewer@123456');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
