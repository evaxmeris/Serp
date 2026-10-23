/**
 * 同步调度 tick —— 外部 cron 的唯一入口（二期 BE-1）
 *
 * 为什么不是进程内 setInterval：见 src/lib/sync/sync-jobs.ts 顶部说明。
 * 挂法（宿主机 crontab 每 5 分钟打一次）：
 *
 *   SYNC_TICK_TOKEN=<随机长串> 写进 .env / 部署环境
 *   *\/5 * * * * curl -s -X POST -H "x-sync-token: $SYNC_TICK_TOKEN" http://127.0.0.1:3001/api/sync/tick
 *
 * 认证：x-sync-token（或 Authorization: Bearer <token>）=== process.env.SYNC_TICK_TOKEN，
 *       或者带管理员会话 cookie（便于人工在后台点一下）。
 *
 * 防重入：SyncJob.isRunning 原子领取 + nextRunAt 预先推进（详见 runDueSyncJobs）。
 *
 * GET：只读查看任务列表与下次执行时间，需要登录会话。
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { runDueSyncJobs } from '@/lib/sync';

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'super_admin', 'ADMIN', 'SUPER_ADMIN', 'SUPER-ADMIN']);

function timingSafeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** 校验 tick 调用方：定时任务 token 或管理员会话 */
async function authorizeTick(request: NextRequest): Promise<{ ok: true; via: string } | { ok: false }> {
  const configured = process.env.SYNC_TICK_TOKEN;
  const headerToken =
    request.headers.get('x-sync-token') ||
    (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (configured && configured.length >= 8 && headerToken && timingSafeEquals(headerToken, configured)) {
    return { ok: true, via: 'token' };
  }

  const session = await getUserFromRequest(request);
  if (session && ADMIN_ROLES.has(String(session.role || ''))) {
    return { ok: true, via: 'session' };
  }
  return { ok: false };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeTick(request);
    if (!auth.ok) {
      return errorResponse(
        '未授权：请提供 x-sync-token（与 SYNC_TICK_TOKEN 一致）或使用管理员账号登录',
        'UNAUTHORIZED',
        401,
      );
    }

    const body = await request.json().catch(() => ({} as any));
    const limit = Number(body?.limit);
    const result = await runDueSyncJobs(Number.isFinite(limit) && limit > 0 ? limit : 5);

    return successResponse(
      { ...result, via: auth.via },
      result.claimed > 0 ? `本轮执行 ${result.claimed} 个同步任务` : '本轮没有到期任务',
    );
  } catch (error) {
    console.error('[Sync Tick] 执行失败:', error);
    return errorResponse(
      error instanceof Error ? error.message : '调度执行失败',
      'TICK_FAILED',
      500,
    );
  }
}

/** 只读：任务清单（人工排查用） */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const jobs = await prisma.syncJob.findMany({ orderBy: [{ platformCode: 'asc' }, { marketplaceId: 'asc' }] });
    return successResponse({
      items: jobs,
      serverTime: new Date().toISOString(),
      tickTokenConfigured: Boolean(process.env.SYNC_TICK_TOKEN && process.env.SYNC_TICK_TOKEN.length >= 8),
    });
  } catch (error) {
    console.error('[Sync Tick] 查询任务失败:', error);
    return errorResponse('查询同步任务失败');
  }
}
