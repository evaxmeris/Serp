/**
 * 多平台订单同步服务
 *
 * 负责：
 * 1. 从各平台拉取新订单
 * 2. 按订单性质分流落库：
 *    - B2B 单（阿里国际站等）：写入 B2B 的 Order 表，必要时关联/创建客户
 *    - 零售单（Amazon / TikTok / Shopify）：写入 PlatformOrder 镜像表，
 *      不创建 Customer、不创建 Order，避免污染 B2B 账套
 * 3. 记录同步日志
 * 4. 通知业务员
 * 5. 互斥锁：防止同一平台（同一站点）并发同步
 * 6. 重试机制：指数退避，最多 3 次
 */

import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '@/lib/crypto-utils';
import { platformRegistry } from './registry';
import {
  mapUnifiedOrderToERP,
  updateOrderStatus,
  mapUnifiedOrderToPlatformOrder,
  mapUnifiedOrderToPlatformOrderUpdate,
  resolvePlatformType,
} from './mapper';
import type { UnifiedOrder, SyncResult, PlatformConfig } from './types';

// ============================================
// 零售平台判定
// ============================================

/**
 * 兜底名单：适配器未声明 orderKind 时，这些平台按零售单处理。
 * 适配器上的 orderKind 字段优先。
 */
const RETAIL_PLATFORM_CODES = new Set(['amazon', 'tiktok', 'shopify']);

/**
 * 判断某平台同步过来的订单是否为零售单（写 PlatformOrder 镜像表）
 */
export function isRetailPlatform(platformCode: string, adapter?: { orderKind?: string }): boolean {
  const kind = adapter?.orderKind ?? platformRegistry.get(platformCode)?.orderKind;
  if (kind) return kind === 'RETAIL';
  return RETAIL_PLATFORM_CODES.has((platformCode || '').toLowerCase());
}

// ============================================
// 互斥锁：内存 Map，跟踪正在同步的平台（platformCode@marketplaceId）
// ============================================
const syncingPlatforms = new Set<string>();

// ============================================
// 重试工具函数
// ============================================

/** 判断错误是否可重试（网络/临时故障 vs 认证/配置错误） */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // 不可重试：认证失败、配置错误、权限问题
  const nonRetryable = [
    'auth', 'authenticate', 'credential', '401', 'unauthorized',
    'config', 'not configured', 'not enabled', 'bad request',
    '400', '404', 'permission', 'forbidden', '403',
    'invalid api key', 'invalid token', 'token expired',
  ];
  if (nonRetryable.some(k => message.includes(k))) {
    return false;
  }
  
  // 明确可重试：网络超时、503、429、连接错误
  const retryable = [
    'timeout', 'timed out', 'econn', 'etimedout', 'econnrefused',
    'econnreset', 'enotfound', '503', '502', '504',
    '429', 'rate limit', 'network', 'dns', 'temporary',
    'fetch failed', 'socket', 'unreachable',
  ];
  if (retryable.some(k => message.includes(k))) {
    return true;
  }
  
  // 默认策略：未知错误归为不可重试（安全第一）
  return false;
}

/** 延迟工具函数 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 带指数退避重试的 fetchOrders 包装器 */
async function fetchWithRetry(
  adapter: { fetchOrders: Function },
  params: { page?: number; pageSize: number; createdAtStart?: Date },
  config: PlatformConfig,
  platformCode: string,
): Promise<{ orders: UnifiedOrder[]; retryCount: number }> {
  let lastError: Error | null = null;
  const maxRetries = 3;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const orders = await adapter.fetchOrders(params, config);
      return { orders, retryCount: attempt }; // attempt=0 表示首次成功，无需重试
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 判断是否可重试
      if (!isRetryableError(lastError)) {
        console.error(`[Sync ${platformCode}] 不可重试错误（跳过重试）: ${lastError.message}`);
        throw lastError;
      }
      
      // 已达最大重试次数
      if (attempt >= maxRetries) {
        console.error(`[Sync ${platformCode}] 已达最大重试次数 (${maxRetries})，放弃`);
        throw lastError;
      }
      
      // 指数退避：1s, 2s, 4s
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[Sync ${platformCode}] 第 ${attempt + 1}/${maxRetries} 次重试 ` +
        `（等待 ${delayMs / 1000}s，错误: ${lastError.message}）`
      );
      await sleep(delayMs);
    }
  }
  
  throw lastError!;
}

/**
 * 执行指定平台的订单同步
 * 
 * @param platformCode 平台代码
 * @param triggerType 触发类型（manual/scheduled）
 * @param marketplaceId 站点标识（可选，多站点场景；不传则用配置里的默认站点）
 * @returns 同步结果
 */
export async function executePlatformSync(
  platformCode: string,
  triggerType: 'manual' | 'scheduled' | 'webhook' = 'scheduled',
  marketplaceId?: string
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const lockKey = marketplaceId ? `${platformCode}@${marketplaceId}` : platformCode;
  
  // ============================================
  // 互斥锁检查：防止同一平台并发同步
  // ============================================
  if (syncingPlatforms.has(lockKey)) {
    console.warn(`[Sync ${lockKey}] 平台正在同步中，跳过本次同步（互斥锁保护）`);
    return {
      platformCode,
      status: 'failed',
      ordersFound: 0,
      ordersSynced: 0,
      ordersFailed: 0,
      errors: [`平台 ${lockKey} 正在同步中，跳过本次同步`],
      durationMs: Date.now() - startTime,
    };
  }
  
  // 获取互斥锁
  syncingPlatforms.add(lockKey);
  
  // 累计重试次数（跨所有分页）
  let totalRetryCount = 0;
  
  // 1. 获取平台适配器
  const adapter = platformRegistry.get(platformCode);
  if (!adapter) {
    syncingPlatforms.delete(lockKey); // 释放锁
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
      marketplaceId: marketplaceId || '',
      resource: 'orders',
      triggerType,
      status: 'processing',
      retryCount: 0,
    },
  });
  
  try {
    // 3. 获取平台配置（多站点：优先精确匹配 marketplaceId，退化到该平台的任一配置）
    const platformConfig =
      (await prisma.platformSyncConfig.findUnique({
        where: {
          platformCode_marketplaceId: {
            platformCode,
            marketplaceId: marketplaceId || '',
          },
        },
      })) ||
      (await prisma.platformSyncConfig.findFirst({
        where: { platformCode },
        orderBy: { updatedAt: 'desc' },
      }));
    
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
    
    const decryptedCredentials = decryptCredentials(platformConfig.credentials) as Record<string, string>;
    const rawSettings = (platformConfig.settings as Record<string, any>) || {};
    // 站点解析优先级：显式入参 > 配置行 > 凭据/站点设置
    const effectiveMarketplaceId =
      marketplaceId ||
      platformConfig.marketplaceId ||
      decryptedCredentials?.marketplaceId ||
      rawSettings?.marketplaceId ||
      '';
    
    // 构建配置对象
    const config: PlatformConfig = {
      id: platformConfig.id,
      platformCode: platformConfig.platformCode,
      marketplaceId: effectiveMarketplaceId,
      enabled: platformConfig.enabled,
      syncIntervalMin: platformConfig.syncIntervalMin,
      credentials: effectiveMarketplaceId
        ? { marketplaceId: effectiveMarketplaceId, ...decryptedCredentials }
        : decryptedCredentials,
      settings: Object.keys(rawSettings).length > 0 ? rawSettings : undefined,
    };
    
    // 4. 获取上次同步时间
    const lastSyncAt = platformConfig.lastSyncAt;

    // 5. 拉取订单（基于时间的增量同步）
    const fetchParams = {
      page: 1,
      pageSize: 50,
      createdAtStart: lastSyncAt || undefined,
      createdAtEnd: new Date(), // 以当前时间作为结束时间，确保增量同步
    };

    let allOrders: UnifiedOrder[] = [];
    let hasMore = true;
    // 放宽页数限制以避免意外死循环（500 页 = 25000 条，远大于实际场景）
    const MAX_PAGES = 500;

    while (hasMore) {
      // 使用重试机制拉取订单（指数退避，最多 3 次）
      const { orders, retryCount } = await fetchWithRetry(
        adapter,
        fetchParams,
        config,
        platformCode,
      );
      totalRetryCount += retryCount;

      if (orders.length > 0) {
        allOrders = allOrders.concat(orders);
      }

      // 检查是否有更多页
      if (orders.length < fetchParams.pageSize) {
        hasMore = false;
      } else {
        fetchParams.page = (fetchParams.page || 1) + 1;
      }

      // 安全限制：防止死循环，最多拉取 MAX_PAGES 页
      if (fetchParams.page > MAX_PAGES) {
        console.warn(`[Sync ${platformCode}] 已达最大分页限制 (${MAX_PAGES})，停止拉取（共 ${allOrders.length} 条）`);
        hasMore = false;
      }
    }
    
    // 6. 处理每个订单（按 B2B / RETAIL 分流）
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
    
    // 7. 更新平台配置（仅在同步成功后更新 lastSyncAt，避免失败时丢失订单）
    const syncStatus = errors.length > 0 && synced > 0 ? 'partial' : errors.length > 0 ? 'failed' : 'success';
    
    // 只在同步成功或部分成功时更新 lastSyncAt
    if (syncStatus !== 'failed') {
      await prisma.platformSyncConfig.update({
        where: { id: platformConfig.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: syncStatus,
        },
      });
    } else {
      // 同步失败时只更新状态，不更新 lastSyncAt（保留上次成功时间以便重试）
      await prisma.platformSyncConfig.update({
        where: { id: platformConfig.id },
        data: {
          lastSyncStatus: syncStatus,
        },
      });
    }
    
    // 8. 更新同步日志
    const durationMs = Date.now() - startTime;
    await prisma.platformSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: errors.length > 0 && synced > 0 ? 'partial' : errors.length > 0 ? 'failed' : 'success',
        ordersFound: allOrders.length,
        ordersSynced: synced,
        ordersFailed: failed,
        retryCount: totalRetryCount,
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
        retryCount: totalRetryCount,
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
        durationMs,
      },
    });
    
    throw error;
  } finally {
    // 释放互斥锁
    syncingPlatforms.delete(lockKey);
  }
}

/**
 * 处理单个订单：按平台性质分流
 *
 * - 零售单（amazon/tiktok/shopify）→ PlatformOrder 镜像表
 * - B2B 单（alibaba 等）→ B2B Order 表（+ 客户关联/创建）
 *
 * @param order 统一订单
 * @param config 平台配置
 */
async function processSingleOrder(
  order: UnifiedOrder,
  config: PlatformConfig
): Promise<void> {
  if (isRetailPlatform(order.platformCode)) {
    await processRetailOrder(order, config.marketplaceId || '');
    return;
  }
  await processB2BOrder(order);
}

/**
 * 零售单：只写 PlatformOrder 镜像表
 *
 * 刻意不做的事：
 * - 不创建 Customer（零售买家不是 B2B 客户主数据）
 * - 不创建 Order（B2B 账套只保留阿里国际站等 B2B 单）
 */
async function processRetailOrder(order: UnifiedOrder, marketplaceId: string): Promise<void> {
  const platformAccountId = await ensurePlatformAccount(order.platformCode, marketplaceId);
  
  await prisma.platformOrder.upsert({
    where: {
      platformCode_platformOrderId: {
        platformCode: order.platformCode,
        platformOrderId: order.platformOrderId,
      },
    },
    create: mapUnifiedOrderToPlatformOrder(order, platformAccountId, marketplaceId || undefined),
    update: mapUnifiedOrderToPlatformOrderUpdate(order, marketplaceId || undefined),
  });
}

/**
 * B2B 单：写 B2B Order 表（保持原有行为）
 */
async function processB2BOrder(order: UnifiedOrder): Promise<void> {
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
  
  // 2. 查找或创建客户（仅 B2B 单允许）
  const customerId = await findOrCreateCustomer(order);
  
  // 3. 创建 ERP 订单
  const orderData = mapUnifiedOrderToERP(order, customerId);
  
  await prisma.order.create({
    data: orderData,
  });
}

// ============================================
// 平台账号（PlatformOrder 的外键依赖）
// ============================================

/** 平台账号缓存：platformCode@marketplaceId → PlatformAccount.id */
const platformAccountCache = new Map<string, string>();

/**
 * 确保平台账号存在（PlatformOrder.platformAccountId 为必填外键）
 *
 * 注：这是平台连接账号（店铺维度），不是客户主数据。
 */
async function ensurePlatformAccount(platformCode: string, marketplaceId: string): Promise<string> {
  const cacheKey = `${platformCode}@${marketplaceId}`;
  const cached = platformAccountCache.get(cacheKey);
  if (cached) return cached;
  
  const platformType = resolvePlatformType(platformCode);
  const adapter = platformRegistry.get(platformCode);
  const platformName = adapter?.platformName || platformCode;
  const accountKey = marketplaceId || platformCode;
  
  const existing = await prisma.platformAccount.findFirst({
    where: { platformType, accountId: accountKey },
    orderBy: { createdAt: 'asc' },
  });
  
  if (existing) {
    platformAccountCache.set(cacheKey, existing.id);
    return existing.id;
  }
  
  const created = await prisma.platformAccount.create({
    data: {
      platformType,
      platformName,
      accountName: marketplaceId ? `${platformName} (${marketplaceId})` : platformName,
      accountId: accountKey,
      shopId: marketplaceId || null,
      region: marketplaceId || null,
      isActive: true,
    },
  });
  
  platformAccountCache.set(cacheKey, created.id);
  return created.id;
}

/**
 * 查找或创建客户（仅用于 B2B 单）
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
  const retail = isRetailPlatform(platformCode);
  const entityType = retail ? 'PlatformOrder' : 'Order';
  
  // 创建审计日志记录作为通知
  for (const order of orders) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'SYNC_NOTIFICATION',
          entityType,
          entityId: order.platformOrderId,
          details: {
            platformCode,
            orderNo: order.orderNo,
            totalAmount: order.totalAmount,
            currency: order.currency,
            customerName: order.customer.contactName || order.customer.companyName || '未知',
            message: `${retail ? '新零售订单' : '新订单'}同步：${order.orderNo}，金额：${order.totalAmount} ${order.currency}`,
          },
        },
      });
    } catch (error) {
      console.error(`[Sync ${platformCode}] 创建通知审计日志失败：`, error);
    }
  }

  console.log(`[Sync ${platformCode}] 📢 已创建 ${orders.length} 条同步通知审计日志（entityType=${entityType}）`);
}
