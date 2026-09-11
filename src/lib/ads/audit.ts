/**
 * 广告域审计日志统一封装
 *
 * 依据：docs/advertising-domain-m1-be-design.md §3.5 / §10
 *  - 对齐 orders 路由 writeAuditLog 范式：prisma.auditLog.create
 *  - request 透传取 x-forwarded-for || x-real-ip || 'unknown' 与 user-agent
 *  - details 只记业务变更，凭据只记「已更新」不记明文（§9.3 双保险）
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface AdsAuditLogParams {
  /** 操作类型：CREATE / UPDATE / DELETE / UPLOAD / ANALYZE / EXPORT 等 */
  action: string;
  /** 操作对象类型：AdAccount / AdReport / AdKeyword / AdMarketplace / AdRecommendation */
  entityType: string;
  /** 操作对象 ID */
  entityId: string;
  /** 操作人 ID（未登录时为 null，调用方保证已认证） */
  userId?: string | null;
  /** 业务变更详情（禁止包含凭据明文） */
  details?: Record<string, unknown>;
  /** 透传请求用于取 IP / UA */
  request?: NextRequest | null;
}

/** 从请求提取客户端 IP 与 User-Agent（对齐 orders 路由 getClientInfo） */
function getClientInfo(request?: NextRequest | null): { ipAddress?: string; userAgent?: string } {
  if (!request) return {};
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;
  return { ipAddress: ip, userAgent };
}

/**
 * 写广告域审计日志
 * @param params 审计参数（details 内凭据只记状态不记明文）
 */
export async function writeAdsAuditLog(params: AdsAuditLogParams): Promise<void> {
  const { userId, request, ...rest } = params;
  const { ipAddress, userAgent } = getClientInfo(request);
  await prisma.auditLog.create({
    data: {
      ...rest,
      ...(userId ? { userId } : {}),
      ipAddress,
      userAgent,
    } as any, // AuditLog.userId 为可空软关联，与现有 orders 路由同款写法
  });
}
