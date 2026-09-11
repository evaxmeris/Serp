/**
 * seed-ads.ts — 广告域默认数据播种（REQ-ADS-006-1：P0 提供默认站点集）
 * 用法：node scripts/seed-ads.ts
 * 幂等：已存在的 code/marketplaceId 跳过（upsert）
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
// .env.local 的 DATABASE_URL 值带引号（Next.js 内置加载会剥离，dotenv 不剥）→ 手动剥离
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
}
const prisma = new PrismaClient();

const MARKETPLACES = [
  { code: 'US', name: '美国站', marketplaceId: 'ATVPDKIKX0DER', currency: 'USD', adEndpoint: 'advertising-api.amazon.com' },
  { code: 'CA', name: '加拿大站', marketplaceId: 'A2EUQ1WTGCTBG2', currency: 'CAD', adEndpoint: 'advertising-api.amazon.com' },
  { code: 'BR', name: '巴西站', marketplaceId: 'A2Q3Y263D00KWC', currency: 'BRL', adEndpoint: 'advertising-api.amazon.com' },
  { code: 'UK', name: '英国站', marketplaceId: 'A1F83G8C2ARO7P', currency: 'GBP', adEndpoint: 'advertising-api-eu.amazon.com' },
  { code: 'DE', name: '德国站', marketplaceId: 'A1PA6795UKMFR9', currency: 'EUR', adEndpoint: 'advertising-api-eu.amazon.com' },
  { code: 'FR', name: '法国站', marketplaceId: 'A13V1IB3VIYZZH', currency: 'EUR', adEndpoint: 'advertising-api-eu.amazon.com' },
  { code: 'ES', name: '西班牙站', marketplaceId: 'A1RKKUPIHCS9HS', currency: 'EUR', adEndpoint: 'advertising-api-eu.amazon.com' },
  { code: 'IT', name: '意大利站', marketplaceId: 'APJ6JRA9NG5V4', currency: 'EUR', adEndpoint: 'advertising-api-eu.amazon.com' },
  { code: 'JP', name: '日本站', marketplaceId: 'A1VC38T7YXB528', currency: 'JPY', adEndpoint: 'advertising-api-fe.amazon.com' },
];

async function main() {
  let created = 0;
  for (const m of MARKETPLACES) {
    await prisma.adMarketplace.upsert({
      where: { code: m.code },
      update: {},
      create: m,
    });
    created++;
  }
  const total = await prisma.adMarketplace.count();
  console.log(`✅ 站点播种完成：写入 ${created} 个，当前共 ${total} 个`);
}

main()
  .catch(e => { console.error('播种失败:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
