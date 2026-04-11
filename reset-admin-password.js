const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const EMAIL = 'admin@trade-erp.com';
const PASSWORD = 'Admin1234!';

async function main() {
  console.log('Looking for user:', EMAIL);
  
  // 查找用户
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
  });

  if (!user) {
    console.log('User not found, creating new super admin...');
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const newUser = await prisma.user.create({
      data: {
        email: EMAIL,
        name: 'Super Admin',
        passwordHash,
        role: 'ADMIN',
        isApproved: true,
      },
    });
    console.log('Created new super admin:', newUser.email);
    console.log('Role:', newUser.role);
    console.log('isApproved:', newUser.isApproved);
  } else {
    console.log('User found, updating password and approval status...');
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const updatedUser = await prisma.user.update({
      where: { email: EMAIL },
      data: {
        passwordHash,
        isApproved: true,
        role: 'ADMIN',
      },
    });
    console.log('Updated user:', updatedUser.email);
    console.log('Role:', updatedUser.role);
    console.log('isApproved:', updatedUser.isApproved);
  }

  console.log('\nDone! You can now login with:');
  console.log('Email: ' + EMAIL);
  console.log('Password: ' + PASSWORD);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
