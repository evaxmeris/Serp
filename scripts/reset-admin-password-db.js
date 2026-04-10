#!/usr/bin/env node
/**
 * Reset admin password directly in database using Prisma
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// New password hash generated for "Admin123!"
const NEW_HASH = '$2b$10$aVsYwUCLAMYQ72tZwv7DZeZXlAEncHsfKCXCBt9BtgNlgJPzq4sju';

async function main() {
  console.log('🔐 Resetting admin password...\n');
  
  const user = await prisma.user.update({
    where: { email: 'admin@trade-erp.com' },
    data: { passwordHash: NEW_HASH }
  });
  
  console.log(`✅ Password updated for user: ${user.email}`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   New password: Admin123!`);
  console.log();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
