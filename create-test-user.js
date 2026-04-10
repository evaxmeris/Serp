const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  
  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
    }
  });
  
  console.log('Created user:', user.email);
  console.log('Email: admin@example.com, Password: Admin123!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
