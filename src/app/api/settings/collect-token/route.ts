import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// GET /api/settings/collect-token - 获取当前 API Token
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'collect_api_token' },
    });

    const token = config ? config.value : null;

    return successResponse({
      hasToken: !!token,
      token: token ? token.substring(0, 12) + '...' : null,
    });
  } catch (error) {
    return errorResponse('获取 Token 失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/settings/collect-token - 生成或重新生成 API Token
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // 生成随机 Token
    const token = 'tcp_' + randomBytes(24).toString('hex');

    await prisma.systemConfig.upsert({
      where: { key: 'collect_api_token' },
      update: { value: token },
      create: { key: 'collect_api_token', value: token, description: 'Chrome 插件采集 API Token' },
    });

    return successResponse({ token }, 'Token 已生成，请立即复制，关闭后将不再显示');
  } catch (error) {
    return errorResponse('生成 Token 失败', 'INTERNAL_ERROR', 500);
  }
}
