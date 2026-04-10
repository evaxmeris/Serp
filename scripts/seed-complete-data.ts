#!/usr/bin/env ts-node
/**
 * 完整测试数据初始化脚本
 * 满足需求：
 * 1. 供应商数据 - 至少 20 条
 * 2. 采购订单 - 至少 30 条
 * 3. 入库单 - 至少 20 条
 * 4. 出库单 - 至少 20 条
 * 5. 库存记录 - 至少 50 条
 * 6. 用户数据 - 各角色至少 1 个
 */

import { PrismaClient, RoleEnum } from '@prisma/client';

const prisma = new PrismaClient();
const timestamp = Date.now();

// 供应商数据 - 真实供应商名称列表
const supplierData = [
  { companyName: '广州美肤化妆品有限公司', companyEn: 'Guangzhou Meifu Cosmetics Co., Ltd.', contactName: '张经理', email: 'zhang@meifu-cos.com', phone: '13900139001', country: 'CN', type: 'DOMESTIC', level: 'STRATEGIC', currency: 'CNY' },
  { companyName: '义乌塑料制品厂', companyEn: 'Yiwu Plastic Products Factory', contactName: '王厂长', email: 'wang@yiwu-plastic.com', phone: '13900139002', country: 'CN', type: 'DOMESTIC', level: 'PREFERRED', currency: 'CNY' },
  { companyName: '深圳电子科技有限公司', companyEn: 'Shenzhen Electronics Technology Co., Ltd.', contactName: '李总', email: 'li@sz-electronics.com', phone: '13900139003', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
  { companyName: '浙江文具制造有限公司', companyEn: 'Zhejiang Stationery Manufacturing Co., Ltd.', contactName: '赵经理', email: 'zhao@zj-stationery.com', phone: '13900139004', country: 'CN', type: 'DOMESTIC', level: 'PREFERRED', currency: 'CNY' },
  { companyName: '东莞玩具加工厂', companyEn: 'Dongguan Toy Processing Factory', contactName: '陈老板', email: 'chen@dg-toys.com', phone: '13900139005', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
  { companyName: '苏州纺织品有限公司', companyEn: 'Suzhou Textile Co., Ltd.', contactName: '刘总', email: 'liu@suzhou-textile.com', phone: '13900139006', country: 'CN', type: 'DOMESTIC', level: 'STRATEGIC', currency: 'CNY' },
  { companyName: '泉州石材加工厂', companyEn: 'Quanzhou Stone Processing Factory', contactName: '黄经理', email: 'huang@quanzhou-stone.com', phone: '13900139007', country: 'CN', type: 'DOMESTIC', level: 'RESTRICTED', currency: 'CNY' },
  { companyName: '佛山陶瓷有限公司', companyEn: 'Foshan Ceramics Co., Ltd.', contactName: '周总', email: 'zhou@foshan-ceramic.com', phone: '13900139008', country: 'CN', type: 'DOMESTIC', level: 'PREFERRED', currency: 'CNY' },
  { companyName: '宁波五金制品厂', companyEn: 'Ningbo Hardware Products Factory', contactName: '吴厂长', email: 'wu@ningbo-hardware.com', phone: '13900139009', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
  { companyName: '青岛海产品加工厂', companyEn: 'Qingdao Seafood Processing Factory', contactName: '孙总', email: 'sun@qingdao-seafood.com', phone: '13900139010', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
  { companyName: '韩国化妆品株式会社', companyEn: 'Korea Cosmetics Co., Ltd.', contactName: '朴社长', email: 'park@korea-cos.co.kr', phone: '+821012345678', country: 'KR', type: 'OVERSEAS', level: 'STRATEGIC', currency: 'USD' },
  { companyName: '日本电子株式会社', companyEn: 'Japan Electronics Co., Ltd.', contactName: '佐藤', email: 'sato@japan-elec.co.jp', phone: '+819012345678', country: 'JP', type: 'OVERSEAS', level: 'PREFERRED', currency: 'USD' },
  { companyName: '美国包装材料公司', companyEn: 'American Packaging Materials Inc.', contactName: 'John Smith', email: 'john@us-pack.com', phone: '+12125551234', country: 'US', type: 'OVERSEAS', level: 'NORMAL', currency: 'USD' },
  { companyName: '德国机械制造有限公司', companyEn: 'German Machinery Manufacturing GmbH', contactName: 'Hans Müller', email: 'hans@de-machinery.com', phone: '+4915123456789', country: 'DE', type: 'OVERSEAS', level: 'PREFERRED', currency: 'EUR' },
  { companyName: '台湾塑料制品公司', companyEn: 'Taiwan Plastic Products Co.', contactName: '陈先生', email: 'chen@taiwan-plastic.com.tw', phone: '+886912345678', country: 'TW', type: 'OVERSEAS', level: 'NORMAL', currency: 'USD' },
  { companyName: '香港贸易公司', companyEn: 'Hong Kong Trading Company', contactName: '李女士', email: 'li@hk-trade.com.hk', phone: '+85291234567', country: 'HK', type: 'OVERSEAS', level: 'PREFERRED', currency: 'USD' },
  { companyName: '成都包装印刷厂', companyEn: 'Chengdu Packaging Printing Factory', contactName: '邓厂长', email: 'deng@cd-print.com', phone: '13900139011', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
  { companyName: '武汉化妆品包材厂', companyEn: 'Wuhan Cosmetic Packaging Factory', contactName: '胡经理', email: 'hu@wh-packaging.com', phone: '13900139012', country: 'CN', type: 'DOMESTIC', level: 'PREFERRED', currency: 'CNY' },
  { companyName: '长沙玻璃制品厂', companyEn: 'Changsha Glass Products Factory', contactName: '郭厂长', email: 'guo@cs-glass.com', phone: '13900139013', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
  { companyName: '重庆模具制造厂', companyEn: 'Chongqing Mold Manufacturing Factory', contactName: '廖总', email: 'liao@cq-mold.com', phone: '13900139014', country: 'CN', type: 'DOMESTIC', level: 'PREFERRED', currency: 'CNY' },
  { companyName: '西安纸品加工厂', companyEn: 'Xi\'an Paper Processing Factory', contactName: '何厂长', email: 'he@xa-paper.com', phone: '13900139015', country: 'CN', type: 'DOMESTIC', level: 'NORMAL', currency: 'CNY' },
];

// 用户数据 - 各角色
const userData = [
  { email: 'admin@trade-erp.com', name: '管理员', role: RoleEnum.ADMIN },
  { email: 'manager@trade-erp.com', name: '部门经理', role: RoleEnum.MANAGER },
  { email: 'sales@trade-erp.com', name: '销售代表', role: RoleEnum.USER },
  { email: 'purchaser@trade-erp.com', name: '采购员', role: RoleEnum.USER },
  { email: 'warehouse@trade-erp.com', name: '仓库管理员', role: RoleEnum.USER },
  { email: 'viewer@trade-erp.com', name: '访客用户', role: RoleEnum.VIEWER },
];

// 随机状态生成函数
function randomPurchaseOrderStatus() {
  const statuses = ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'RECEIVED', 'COMPLETED', 'CANCELLED'];
  const weights = [15, 20, 15, 10, 15, 20, 5];
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < statuses.length; i++) {
    random -= weights[i];
    if (random <= 0) return statuses[i];
  }
  return 'PENDING';
}

function randomInboundStatus() {
  const statuses = ['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'];
  const weights = [20, 15, 55, 10];
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < statuses.length; i++) {
    random -= weights[i];
    if (random <= 0) return statuses[i];
  }
  return 'PENDING';
}

function randomOutboundStatus() {
  const statuses = ['PENDING', 'PROCESSING', 'PICKED', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
  const weights = [20, 20, 15, 15, 25, 5];
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < statuses.length; i++) {
    random -= weights[i];
    if (random <= 0) return statuses[i];
  }
  return 'PENDING';
}

// 生成随机日期
function randomDate(start: number, end: number): Date {
  return new Date(start + Math.random() * (end - start));
}

async function main() {
  console.log('🌱 开始创建完整测试数据...\n');

  // 1. 创建用户 - 各角色至少一个
  console.log('1️⃣ 创建用户数据...');
  const users = [];
  for (const user of userData) {
    const created = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: '$2a$10$exampleHash', // 示例哈希
      },
    });
    users.push(created);
    console.log(`   ✅ ${user.name} (${user.role})`);
  }
  console.log(`   创建完成：${users.length} 个用户\n`);

  // 2. 创建供应商 - 21 条（满足至少 20 条）
  console.log('2️⃣ 创建供应商数据...');
  const suppliers = [];
  for (let i = 0; i < supplierData.length; i++) {
    const data = supplierData[i];
    const supplier = await prisma.supplier.create({
      data: {
        supplierNo: `SUP-${timestamp}-${i + 1}`,
        companyName: data.companyName,
        companyEn: data.companyEn,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        status: 'ACTIVE',
        type: data.type as any,
        level: data.level as any,
        currency: data.currency,
        ownerId: users.find(u => u.role === RoleEnum.ADMIN)?.id,
      },
    });
    suppliers.push(supplier);
    console.log(`   ✅ ${data.companyName}`);
  }
  console.log(`   创建完成：${suppliers.length} 个供应商\n`);

  // 3. 获取现有产品
  console.log('3️⃣ 获取现有产品...');
  const products = await prisma.product.findMany();
  console.log(`   找到 ${products.length} 个产品\n`);

  if (products.length === 0) {
    console.log('   ⚠️  没有找到产品，请先创建产品数据！');
    throw new Error('产品表为空，请先初始化产品数据');
  }

  // 4. 获取现有客户和销售订单
  console.log('4️⃣ 获取现有客户和销售订单...');
  const customers = await prisma.customer.findMany();
  const existingOrders = await prisma.order.findMany({ take: 30 });
  console.log(`   找到 ${customers.length} 个客户，${existingOrders.length} 个销售订单\n`);

  // 5. 创建采购订单 - 至少 30 条
  console.log('5️⃣ 创建采购订单...');
  const purchaseOrders = [];
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  for (let i = 1; i <= 35; i++) {
    const supplier = suppliers[(i - 1) % suppliers.length];
    const purchaser = users.find(u => u.email === 'purchaser@trade-erp.com');
    const randomDays = Math.floor(Math.random() * 30) + 7;
    const status = randomPurchaseOrderStatus();

    const po = await prisma.purchaseOrder.create({
      data: {
        poNo: `PO-${timestamp}-${i}`,
        supplierId: supplier.id,
        status: status as any,
        currency: supplier.currency,
        exchangeRate: supplier.currency === 'CNY' ? 1 : (Math.random() * 0.2 + 7).toFixed(4),
        deliveryDeadline: new Date(now + randomDays * 24 * 60 * 60 * 1000),
        purchaserId: purchaser?.id,
        totalAmount: (Math.random() * 50000 + 5000).toFixed(2),
        confirmedAt: status !== 'PENDING' && status !== 'CANCELLED' ? randomDate(weekAgo, now) : null,
        completedAt: status === 'COMPLETED' ? randomDate(weekAgo, now) : null,
        cancelledAt: status === 'CANCELLED' ? randomDate(weekAgo, now) : null,
      },
    });
    purchaseOrders.push(po);

    // 为每个采购订单添加 1-3 个订单项
    const itemCount = Math.floor(Math.random() * 3) + 1;
    for (let j = 1; j <= itemCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 500) + 50;
      const unitPrice = product.costPrice || (Math.random() * 100 + 10).toFixed(2);
      const amount = Number(unitPrice) * quantity;

      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: quantity,
          unitPrice: Number(unitPrice),
          amount: amount,
          receivedQty: status === 'COMPLETED' ? quantity : Math.floor(Math.random() * quantity),
        },
      });
    }

    console.log(`   ✅ ${po.poNo} (${status})`);
  }
  console.log(`   创建完成：${purchaseOrders.length} 个采购订单\n`);

  // 6. 创建入库单（InboundOrder）- 至少 20 条
  console.log('6️⃣ 创建入库单...');
  const inboundOrders = [];
  for (let i = 1; i <= 25; i++) {
    // 70% 从采购订单入库，30% 其他类型
    const isPurchaseIn = Math.random() > 0.3;
    const po = purchaseOrders[Math.floor(Math.random() * purchaseOrders.length)];
    const supplier = po ? suppliers.find(s => s.id === po.supplierId) : suppliers[Math.floor(Math.random() * suppliers.length)];
    const status = randomInboundStatus();

    const inbound = await prisma.inboundOrder.create({
      data: {
        inboundNo: `IN-${timestamp}-${i}`,
        type: isPurchaseIn ? 'PURCHASE_IN' : (Math.random() > 0.5 ? 'RETURN_IN' : 'ADJUSTMENT_IN'),
        status: status as any,
        purchaseOrderId: isPurchaseIn ? po.id : null,
        supplierId: supplier?.id,
        warehouseId: 'MAIN',
        expectedDate: new Date(),
        actualDate: status === 'COMPLETED' ? new Date() : null,
        totalAmount: (Math.random() * 20000 + 2000).toFixed(2),
        note: isPurchaseIn ? `采购入库 - ${po?.poNo}` : '其他入库',
      },
    });
    inboundOrders.push(inbound);

    // 添加入库项 1-5 个
    const itemCount = Math.floor(Math.random() * 4) + 1;
    for (let j = 1; j <= itemCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 200) + 10;
      const unitPrice = product.costPrice || (Math.random() * 100 + 10).toFixed(2);
      const actualQuantity = status === 'COMPLETED' ? quantity : Math.floor(Math.random() * quantity);

      await prisma.inboundOrderItem.create({
        data: {
          inboundOrderId: inbound.id,
          productId: product.id,
          expectedQuantity: quantity,
          actualQuantity: actualQuantity,
          unitPrice: Number(unitPrice),
          amount: Number(unitPrice) * actualQuantity,
        },
      });

      // 创建库存日志并更新库存
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          warehouseId: 'MAIN',
          inboundOrderId: inbound.id,
          type: 'IN',
          quantity: actualQuantity,
          beforeQuantity: 0,
          afterQuantity: actualQuantity,
          referenceType: 'INBOUND',
          referenceId: inbound.id,
          note: `采购入库`,
        },
      });

      // 更新或创建库存项
      const existingInventory = await prisma.inventoryItem.findUnique({
        where: {
          productId_warehouse: {
            productId: product.id,
            warehouse: 'MAIN',
          },
        },
      });

      if (existingInventory) {
        await prisma.inventoryItem.update({
          where: { id: existingInventory.id },
          data: {
            quantity: existingInventory.quantity + actualQuantity,
            availableQty: existingInventory.availableQty + actualQuantity,
            lastInboundDate: new Date(),
          },
        });
      } else {
        await prisma.inventoryItem.create({
          data: {
            productId: product.id,
            warehouse: 'MAIN',
            quantity: actualQuantity,
            availableQty: actualQuantity,
            reservedQty: 0,
            minStock: 10,
            maxStock: 1000,
            location: `A-${Math.floor(Math.random() * 10) + 1}-${Math.floor(Math.random() * 10) + 1}`,
            lastInboundDate: new Date(),
          },
        });
      }
    }

    console.log(`   ✅ ${inbound.inboundNo} (${status})`);
  }
  console.log(`   创建完成：${inboundOrders.length} 个入库单\n`);

  // 7. 创建出库单（OutboundOrder）- 至少 20 条
  console.log('7️⃣ 创建出库单...');
  const outboundOrders = [];
  for (let i = 1; i <= 25; i++) {
    // 90% 关联销售订单
    const order = existingOrders.length > 0
      ? existingOrders[Math.floor(Math.random() * existingOrders.length)]
      : null;
    const status = randomOutboundStatus();

    const outboundData: any = {
      outboundNo: `OUT-${timestamp}-${i}`,
      warehouseId: 'MAIN',
      status: status as any,
      totalAmount: (Math.random() * 15000 + 1000).toFixed(2),
    };
    if (order?.id) {
      outboundData.orderId = order.id;
    }
    const outbound = await prisma.outboundOrder.create({
      data: outboundData,
    });
    outboundOrders.push(outbound);

    // 获取当前可用库存
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { warehouse: 'MAIN', availableQty: { gt: 0 } },
      take: 5,
    });

    if (inventoryItems.length > 0) {
      const itemCount = Math.min(Math.floor(Math.random() * 4) + 1, inventoryItems.length);

      for (let j = 1; j <= itemCount; j++) {
        const inventory = inventoryItems[j - 1];
        const maxQty = Math.min(inventory.availableQty, 50);
        const quantity = Math.floor(Math.random() * maxQty) + 1;

        await prisma.outboundOrderItem.create({
          data: {
            outboundOrderId: outbound.id,
            productId: inventory.productId,
            quantity: quantity,
            shippedQuantity: status === 'COMPLETED' || status === 'SHIPPED' ? quantity : 0,
          },
        });

        // 如果已完成出库，扣减库存并创建日志
        if (status === 'COMPLETED' || status === 'SHIPPED') {
          const currentInventory = await prisma.inventoryItem.findUnique({
            where: { id: inventory.id },
          });

          if (currentInventory && currentInventory.availableQty >= quantity) {
            await prisma.inventoryLog.create({
              data: {
                productId: inventory.productId,
                warehouseId: 'MAIN',
                outboundOrderId: outbound.id,
                type: 'OUT',
                quantity: quantity,
                beforeQuantity: currentInventory.quantity,
                afterQuantity: currentInventory.quantity - quantity,
                referenceType: 'OUTBOUND',
                referenceId: outbound.id,
                note: order ? `销售出库 - ${order.orderNo}` : '其他出库',
              },
            });

            await prisma.inventoryItem.update({
              where: { id: inventory.id },
              data: {
                quantity: currentInventory.quantity - quantity,
                availableQty: currentInventory.availableQty - quantity,
                lastOutboundDate: new Date(),
              },
            });
          }
        }
      }
    }

    console.log(`   ✅ ${outbound.outboundNo} (${status})`);
  }
  console.log(`   创建完成：${outboundOrders.length} 个出库单\n`);

  // 8. 统计最终数据
  console.log('8️⃣ 统计最终数据...');

  const finalStats = {
    users: await prisma.user.count(),
    suppliers: await prisma.supplier.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseOrderItems: await prisma.purchaseOrderItem.count(),
    inboundOrders: await prisma.inboundOrder.count(),
    inboundOrderItems: await prisma.inboundOrderItem.count(),
    outboundOrders: await prisma.outboundOrder.count(),
    outboundOrderItems: await prisma.outboundOrderItem.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    inventoryLogs: await prisma.inventoryLog.count(),
  };

  console.log('\n📊 数据统计结果:');
  console.log(`  - 用户: ${finalStats.users} (各角色至少 1 个) ${finalStats.users >= 6 ? '✅' : '❌'}`);
  console.log(`  - 供应商: ${finalStats.suppliers} ${finalStats.suppliers >= 20 ? '✅' : '❌'}`);
  console.log(`  - 采购订单: ${finalStats.purchaseOrders} ${finalStats.purchaseOrders >= 30 ? '✅' : '❌'}`);
  console.log(`  - 采购订单项: ${finalStats.purchaseOrderItems}`);
  console.log(`  - 入库单: ${finalStats.inboundOrders} ${finalStats.inboundOrders >= 20 ? '✅' : '❌'}`);
  console.log(`  - 入库单项: ${finalStats.inboundOrderItems}`);
  console.log(`  - 出库单: ${finalStats.outboundOrders} ${finalStats.outboundOrders >= 20 ? '✅' : '❌'}`);
  console.log(`  - 出库单项: ${finalStats.outboundOrderItems}`);
  console.log(`  - 库存记录: ${finalStats.inventoryItems} ${finalStats.inventoryItems >= 50 ? '✅' : '❌'}`);
  console.log(`  - 库存日志: ${finalStats.inventoryLogs}`);

  // 检查是否满足所有需求
  const allRequirementsMet =
    finalStats.users >= 6 &&
    finalStats.suppliers >= 20 &&
    finalStats.purchaseOrders >= 30 &&
    finalStats.inboundOrders >= 20 &&
    finalStats.outboundOrders >= 20 &&
    finalStats.inventoryItems >= 50;

  console.log(`\n${allRequirementsMet ? '✅ 所有需求都已满足！' : '❌ 部分需求未满足，请检查。'}`);
  console.log('\n🎉 完整测试数据创建完成！');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
