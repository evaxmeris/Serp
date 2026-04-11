const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testLogin() {
  console.log('=== Testing Login ===');
  console.log('Email: admin@trade-erp.com');
  console.log('Password: Admin1234!');
  console.log('');
  
  try {
    // 1. 查找用户
    const user = await prisma.user.findUnique({
      where: { email: 'admin@trade-erp.com' },
    });
    
    if (!user) {
      console.log('❌ 用户不存在');
      return;
    }
    
    console.log('✅ 用户存在');
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('   isApproved:', user.isApproved);
    console.log('   passwordHash:', user.passwordHash.substring(0, 20) + '...');
    console.log('');
    
    // 2. 验证密码
    const isValid = await bcrypt.compare('Admin1234!', user.passwordHash);
    console.log('密码验证:', isValid ? '✅ 通过' : '❌ 失败');
    console.log('');
    
    // 3. 检查 isApproved
    if (!user.isApproved) {
      console.log('❌ 用户未批准');
    } else {
      console.log('✅ 用户已批准');
    }
    console.log('');
    
    if (isValid && user.isApproved) {
      console.log('🎉 登录应该成功！');
    } else {
      console.log('❌ 登录会失败');
    }
    
  } catch (error) {
    console.log('❌ 错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
