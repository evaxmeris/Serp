const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@trade-erp.com' }
    });
    
    if (!user) {
      console.log('❌ 用户不存在');
      return;
    }
    
    console.log('✅ 用户存在:');
    console.log('  ID:', user.id);
    console.log('  邮箱:', user.email);
    console.log('  姓名:', user.name);
    console.log('  状态:', user.status);
    console.log('  密码哈希:', user.passwordHash?.substring(0, 20) + '...');
    
    // 测试密码
    const testPassword = 'Admin@123456';
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);
    console.log('\n🔐 密码验证测试:');
    console.log('  测试密码:', testPassword);
    console.log('  验证结果:', isValid ? '✅ 正确' : '❌ 错误');
    
    if (!isValid) {
      console.log('\n💡 建议：重置密码');
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('  新哈希:', newHash);
      console.log('\n执行以下 SQL 更新密码:');
      console.log(`  UPDATE "users" SET "passwordHash"='${newHash}' WHERE email='admin@trade-erp.com';`);
    }
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
