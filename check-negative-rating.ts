#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for negative ratings...\n');
  
  // Find all products with rating < 0
  const negativeProducts = await prisma.productResearch.findMany({
    where: {
      rating: {
        lt: 0,
      },
    },
    select: {
      id: true,
      name: true,
      rating: true,
      createdAt: true,
    },
  });
  
  console.log(`Found ${negativeProducts.length} products with negative rating:`);
  negativeProducts.forEach(p => {
    console.log(`  - ${p.name} (${p.id}): rating = ${p.rating}`);
  });
  
  // Also check ProductComparison
  console.log('\nChecking ProductComparison for negative ratings...');
  const negativeComparisons = await prisma.productComparison.findMany({
    where: {
      rating: {
        lt: 0,
      },
    },
    select: {
      id: true,
      name: true,
      rating: true,
    },
  });
  
  console.log(`Found ${negativeComparisons.length} comparisons with negative rating:`);
  negativeComparisons.forEach(c => {
    console.log(`  - ${c.name} (${c.id}): rating = ${c.rating}`);
  });
  
  process.exit(0);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
