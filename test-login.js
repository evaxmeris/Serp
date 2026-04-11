const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const EMAIL = 'admin@trade-erp.com';
const PASSWORD = 'Admin1234!';

async function main() {
  console.log('Testing login for:', EMAIL);
  
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
  });

  if (!user) {
    console.log('ERROR: User not found');
    return;
  }

  console.log('User found:');
  console.log('  email:', user.email);
  console.log('  name:', user.name);
  console.log('  role:', user.role);
  console.log('  isApproved:', user.isApproved);
  console.log('  passwordHash length:', user.passwordHash.length);

  const isValid = await bcrypt.compare(PASSWORD, user.passwordHash);
  console.log('Password validation:', isValid);

  if (!isValid) {
    console.log('Password mismatch, regenerating...');
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.update({
      where: { email: EMAIL },
      data: { passwordHash, isApproved: true },
    });
    console.log('Password updated. Please try again.');
  } else {
    console.log('Password OK! Login should work now.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
