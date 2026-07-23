import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

// POST /api/collected-products/[id]/translate - AI 翻译
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const { fields } = await request.json();

    const product = await prisma.collectedProduct.findUnique({ where: { id } });
    if (!product) return notFoundResponse('采集产品不存在');

    // 从系统配置读取翻译 API 配置
    const transConfig = await prisma.systemConfig.findUnique({
      where: { key: 'translation_config' },
    });

    if (!transConfig) {
      return errorResponse('未配置翻译服务，请先在系统设置中配置', 'CONFIG_MISSING', 400);
    }

    const config = JSON.parse(transConfig.value);

    // 确定需要翻译的字段
    const fieldList: string[] = fields || ['title', 'description'];
    const result: Record<string, string> = {};

    for (const field of fieldList) {
      const sourceText = (product as any)[field];
      if (!sourceText) continue;

      // 调用 LLM API 翻译
      const translated = await callTranslationAPI(
        sourceText,
        config.provider,
        config.apiKey,
        config.model,
        field === 'title' ? 'product title' : 'product description'
      );

      // 翻译结果写入对应的英文版本字段
      const targetField = field === 'title' ? 'titleEn'
        : field === 'description' ? 'descriptionEn'
        : field === 'shortDescription' ? 'shortDescription'
        : `${field}En`;

      result[targetField] = translated;
    }

    return successResponse(result);
  } catch (error) {
    console.error('Error translating:', error);
    return errorResponse('翻译失败', 'INTERNAL_ERROR', 500);
  }
}

async function callTranslationAPI(
  text: string,
  provider: string,
  apiKey: string,
  model: string,
  context: string = 'product description'
): Promise<string> {
  const prompt = `You are an e-commerce translation specialist. Translate the following ${context} from Chinese to English. Keep it professional, natural, and suitable for an e-commerce product page. Preserve all HTML tags, line breaks, and formatting exactly as they appear. Only translate the text content, do not modify any HTML structure.

Source text:
${text}

English translation:`;

  // DeepSeek API
  if (provider === 'deepseek') {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }

  // OpenAI 兼容 API
  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }

  throw new Error(`不支持的翻译服务商: ${provider}`);
}
