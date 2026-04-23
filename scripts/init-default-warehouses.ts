/**
 * 初始化默认仓库脚本
 * 运行: npx tsx scripts/init-default-warehouses.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existingCount = await prisma.warehouse.count();
  
  if (existingCount > 0) {
    console.log(`已有 ${existingCount} 个仓库，无需初始化`);
    return;
  }

  const defaultWarehouses = [
    {
      name: '深圳主仓库',
      code: 'SZ-MAIN',
      address: '深圳市宝安区',
      manager: '',
      phone: '',
      status: 'ACTIVE' as const,
    },
    {
      name: '广州仓库',
      code: 'GZ-WH',
      address: '广州市白云区',
      manager: '',
      phone: '',
      status: 'ACTIVE' as const,
    },
    {
      name: '义乌仓库',
      code: 'YW-WH',
      address: '义乌市',
      manager: '',
      phone: '',
      status: 'ACTIVE' as const,
    },
    {
      name: '海外仓（美国）',
      code: 'US-FBA',
      address: '美国洛杉矶',
      manager: '',
      phone: '',
      status: 'ACTIVE' as const,
    },
  ];

  const created = [];
  for (const wh of defaultWarehouses) {
    const warehouse = await prisma.warehouse.create({
      data: wh,
    });
    created.push(warehouse);
    console.log(`✅ 创建仓库: ${warehouse.name} (${warehouse.code})`);
  }

  console.log(`\n🎉 成功创建 ${created.length} 个默认仓库`);
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
