import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// GET /api/settings/translation - 获取翻译配置
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'translation_config' },
    });

    const data = config ? JSON.parse(config.value) : {
      provider: 'deepseek',
      apiKey: '',
      model: 'deepseek-chat',
    };

    // 隐藏 API Key
    if (data.apiKey) {
      data.apiKey = data.apiKey.substring(0, 8) + '...' + data.apiKey.slice(-4);
    }

    return successResponse(data);
  } catch (error) {
    return errorResponse('获取翻译配置失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/settings/translation - 更新翻译配置
export async function PUT(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const body = await request.json();

    if (!body.apiKey) {
      return errorResponse('API Key 为必填项', 'VALIDATION_ERROR', 422);
    }

    const value = JSON.stringify({
      provider: body.provider || 'deepseek',
      apiKey: body.apiKey,
      model: body.model || 'deepseek-chat',
    });

    await prisma.systemConfig.upsert({
      where: { key: 'translation_config' },
      update: { value },
      create: { key: 'translation_config', value, description: 'AI 翻译服务配置' },
    });

    return successResponse({ updated: true }, '翻译配置已保存');
  } catch (error) {
    return errorResponse('保存翻译配置失败', 'INTERNAL_ERROR', 500);
  }
}
