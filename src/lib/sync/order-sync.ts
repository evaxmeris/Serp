/**
 * 多平台订单同步服务
 * 
 * 负责：
 * 1. 从各平台拉取新订单
 * 2. 自动创建/关联客户
 * 3. 创建/更新 ERP 订单及明细
 * 4. 记录同步日志
 * 5. 通知业务员
 */

import { prisma } from '@/lib/prisma';
import { platformRegistry } from './registry';
import { mapUnifiedOrderToERP, updateOrderStatus } from './mapper';
import type { UnifiedOrder, SyncResult, PlatformConfig } from './types';

/**
 * 执行指定平台的订单同步
 * 
 * @param platformCode 平台代码
 * @param triggerType 触发类型（manual/scheduled）
 * @returns 同步结果
 */
export async function executePlatformSync(
  platformCode: string,
  triggerType: 'manual' | 'scheduled' = 'scheduled'
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  
  // 1. 获取平台适配器
  const adapter = platformRegistry.get(platformCode);
  if (!adapter) {
    return {
      platformCode,
      status: 'failed',
      ordersFound: 0,
      ordersSynced: 0,
      ordersFailed: 0,
      errors: [`平台 ${platformCode} 未注册`],
      durationMs: Date.now() - startTime,
    };
  }
  
  // 2. 创建同步日志
  const syncLog = await prisma.platformSyncLog.create({
    data: {
      platformCode,
      triggerType,
      status: 'processing',
    },
  });
  
  try {
    // 3. 获取平台配置
    const platformConfig = await prisma.platformSyncConfig.findUnique({
      where: { platformCode },
    });
    
    if (!platformConfig || !platformConfig.enabled) {
      await prisma.platformSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errorMessage: `平台 ${platformCode} 未启用或未配置`,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });
      
      return {
        platformCode,
        status: 'failed',
        ordersFound: 0,
        ordersSynced: 0,
        ordersFailed: 0,
        errors: ['平台未启用或未配置'],
        durationMs: Date.now() - startTime,
      };
    }
    
    // 构建配置对象
    const config: PlatformConfig = {
      id: platformConfig.id,
      platformCode: platformConfig.platformCode,
      enabled: platformConfig.enabled,
      syncIntervalMin: platformConfig.syncIntervalMin,
      credentials: platformConfig.credentials as Record<string, string>,
      settings: (platformConfig.settings as Record<string, any>) || undefined,
    };
    
    // 4. 获取上次同步时间
    const lastSyncAt = platformConfig.lastSyncAt;
    
    // 5. 拉取订单
    const fetchParams = {
      page: 1,
      pageSize: 50,
      createdAtStart: lastSyncAt || undefined,
    };
    
    let allOrders: UnifiedOrder[] = [];
    let hasMore = true;
    
    while (hasMore) {
      const orders = await adapter.fetchOrders(fetchParams, config);
      
      if (orders.length > 0) {
        allOrders = allOrders.concat(orders);
      }
      
      // 检查是否有更多页
      if (orders.length < fetchParams.pageSize) {
        hasMore = false;
      } else {
        fetchParams.page = (fetchParams.page || 1) + 1;
      }
      
      // 安全限制：防止死循环，最多拉取 5 页
      if (fetchParams.page > 5) {
        hasMore = false;
      }
    }
    
    // 6. 处理每个订单
    let synced = 0;
    let failed = 0;
    
    for (const order of allOrders) {
      try {
        await processSingleOrder(order, config);
        synced++;
      } catch (error) {
        failed++;
        const errorMsg = `订单 ${order.platformOrderId} 同步失败：${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`[Sync ${platformCode}] ${errorMsg}`);
      }
    }
    
    // 7. 更新平台配置（记录最后同步时间）
    await prisma.platformSyncConfig.update({
      where: { platformCode },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: errors.length > 0 && synced > 0 ? 'partial' : errors.length > 0 ? 'failed' : 'success',
      },
    });
    
    // 8. 更新同步日志
    const durationMs = Date.now() - startTime;
    await prisma.platformSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: errors.length > 0 && synced > 0 ? 'partial' : errors.length > 0 ? 'failed' : 'success',
        ordersFound: allOrders.length,
        ordersSynced: synced,
        ordersFailed: failed,
        errorMessage: errors.length > 0 ? errors.join('\n') : null,
        completedAt: new Date(),
        durationMs,
      },
    });
    
    // 9. 如果有新订单，通知业务员
    if (synced > 0) {
      await notifySalesRep(platformCode, allOrders.slice(0, synced));
    }
    
    return {
      platformCode,
      status: errors.length > 0 && synced > 0 ? 'partial' : errors.length > 0 ? 'failed' : 'success',
      ordersFound: allOrders.length,
      ordersSynced: synced,
      ordersFailed: failed,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
    };
    
  } catch (error) {
    // 记录错误
    const durationMs = Date.now() - startTime;
    await prisma.platformSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
        durationMs,
      },
    });
    
    throw error;
  }
}

/**
 * 处理单个订单
 * 
 * @param order 统一订单
 * @param config 平台配置
 */
async function processSingleOrder(
  order: UnifiedOrder,
  config: PlatformConfig
): Promise<void> {
  // 1. 检查订单是否已存在（根据 platformOrderId 和 sourcePlatform）
  const existingOrder = await prisma.order.findFirst({
    where: {
      platformOrderId: order.platformOrderId,
      sourcePlatform: order.platformCode,
    },
  });
  
  if (existingOrder) {
    // 订单已存在，更新状态（幂等性检查）
    const newStatus = updateOrderStatus(existingOrder.status, order.status);
    
    if (newStatus !== existingOrder.status) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: { status: newStatus },
      });
    }
    return;
  }
  
  // 2. 查找或创建客户
  const customerId = await findOrCreateCustomer(order);
  
  // 3. 创建 ERP 订单
  const orderData = mapUnifiedOrderToERP(order, customerId);
  
  await prisma.order.create({
    data: orderData,
  });
}

/**
 * 查找或创建客户
 * 
 * 策略：
 * 1. 优先匹配邮箱
 * 2. 其次匹配公司名称
 * 3. 最后自动创建新客户
 */
async function findOrCreateCustomer(order: UnifiedOrder): Promise<string> {
  const customerInfo = order.customer;
  
  // 1. 尝试通过邮箱查找
  if (customerInfo.email) {
    const existingCustomer = await prisma.customer.findFirst({
      where: { email: customerInfo.email },
    });
    
    if (existingCustomer) {
      return existingCustomer.id;
    }
  }
  
  // 2. 尝试通过公司名称查找
  if (customerInfo.companyName) {
    const existingCustomer = await prisma.customer.findFirst({
      where: { companyName: customerInfo.companyName },
    });
    
    if (existingCustomer) {
      return existingCustomer.id;
    }
  }
  
  // 3. 创建新客户
  // 如果没有公司名称，使用默认名称 "平台-客户-ID"
  const companyName = customerInfo.companyName || `${order.platformCode.toUpperCase()}-Customer-${order.platformOrderId}`;
  
  const newCustomer = await prisma.customer.create({
    data: {
      companyName,
      contactName: customerInfo.contactName || undefined,
      email: customerInfo.email || undefined,
      phone: customerInfo.phone || undefined,
      country: customerInfo.country || undefined,
      address: customerInfo.address || order.shippingInfo?.address || undefined,
      source: order.platformCode.toUpperCase(), // 标记来源
      status: 'ACTIVE', // 默认状态
    },
  });
  
  return newCustomer.id;
}

/**
 * 通知业务员新订单
 * 
 * @param platformCode 平台代码
 * @param orders 新订单列表
 */
async function notifySalesRep(platformCode: string, orders: UnifiedOrder[]): Promise<void> {
  // TODO: 实现通知逻辑
  // 目前先记录日志
  const orderList = orders.map(o => `订单号：${o.orderNo}，金额：${o.totalAmount} ${o.currency}`).join('\n');
  console.log(`[Sync ${platformCode}] 📢 新订单通知:\n${orderList}`);
}
