/**
 * 数据迁移脚本: 将 Inventory 表数据迁移到 InventoryItem 表
 *
 * 使用方法:
 *   ts-node scripts/migrate-inventory-to-inventory-item.ts
 *
 * 前置条件:
 *   已经运行 prisma migrate dev，创建了新的 InventoryItem 结构
 *   Warehouse 表已有数据
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateInventory() {
  console.log('🚀 开始库存数据迁移...\n')

  // 1. 获取所有仓库，建立 id -> code 的映射
  console.log('📋 获取仓库数据...')
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, code: true }
  })
  const warehouseIdToCode = new Map<string, string>()
  warehouses.forEach(w => warehouseIdToCode.set(w.id, w.code))
  console.log(`✅ 获取到 ${warehouses.length} 个仓库\n`)

  // 2. 获取所有原有库存记录
  console.log('📋 获取原有库存数据...')
  const oldInventories = await prisma.inventory.findMany()
  console.log(`✅ 获取到 ${oldInventories.length} 条库存记录\n`)

  // 3. 逐行迁移
  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const oldInv of oldInventories) {
    const warehouseCode = warehouseIdToCode.get(oldInv.warehouseId)
    if (!warehouseCode) {
      console.warn(`⚠️  跳过: 库存 ID ${oldInv.id}，仓库 ID ${oldInv.warehouseId} 不存在`)
      skipped++
      continue
    }

    try {
      // 检查是否已存在
      const existing = await prisma.inventoryItem.findUnique({
        where: {
          productId_warehouse: {
            productId: oldInv.productId,
            warehouse: warehouseCode
          }
        }
      })

      if (existing) {
        // 更新已有记录
        await prisma.inventoryItem.update({
          where: {
            id: existing.id
          },
          data: {
            quantity: oldInv.quantity,
            reservedQty: oldInv.lockedQuantity,
            availableQty: oldInv.availableQuantity,
            minStock: oldInv.minStock,
            maxStock: oldInv.maxStock,
            lastInboundDate: oldInv.lastInboundDate,
            lastOutboundDate: oldInv.lastOutboundDate
          }
        })
      } else {
        // 创建新记录
        await prisma.inventoryItem.create({
          data: {
            productId: oldInv.productId,
            warehouse: warehouseCode,
            quantity: oldInv.quantity,
            reservedQty: oldInv.lockedQuantity,
            availableQty: oldInv.availableQuantity,
            minStock: oldInv.minStock,
            maxStock: oldInv.maxStock,
            lastInboundDate: oldInv.lastInboundDate,
            lastOutboundDate: oldInv.lastOutboundDate
          }
        })
      }

      migrated++
      if (migrated % 100 === 0) {
        console.log(`   ...已迁移 ${migrated} 条`)
      }
    } catch (err) {
      console.error(`❌ 迁移失败: 库存 ID ${oldInv.id}`, err)
      errors++
    }
  }

  // 4. 输出统计
  console.log('\n📊 迁移完成统计:')
  console.log(`   原有记录: ${oldInventories.length}`)
  console.log(`   成功迁移: ${migrated}`)
  console.log(`   跳过: ${skipped}`)
  console.log(`   失败: ${errors}`)

  if (errors === 0) {
    console.log('\n✅ 迁移全部成功！')
    console.log('\n📝 下一步:')
    console.log('1. 验证数据正确性')
    console.log('2. 确认无误后，下次 migration 会删除原 Inventory 表')
  } else {
    console.log('\n⚠️  存在错误，请检查后重试')
  }
}

migrateInventory()
  .catch(err => {
    console.error('❌ 迁移失败', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
