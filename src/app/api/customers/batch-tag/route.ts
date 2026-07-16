/**
 * 客户批量打标签 API
 */

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { BatchTagSchema } from '@/lib/api-schemas';

/**
 * POST /api/customers/batch-tag
 * 批量给客户打标签
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user || !['admin', 'sales'].includes(user.role)) {
      return forbiddenResponse('需要客户管理权限');
    }

    // 解析请求数据
    const body = await request.json();
    const v = validateOrReturn(BatchTagSchema, body);
    if (!v.success) return v.response;
    const { customerIds, tags } = v.data;
    const ids = customerIds;
    const mode = 'add';

    // 查询客户 - tags 字段暂未添加到 schema
    const customers = await prisma.customer.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
      },
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };

    // TODO: 批量标签功能待实现 - tags 字段未添加到 schema
    return successResponse({ results }, '批量标签功能暂未实现');
  } catch (error: any) {
    console.error('批量标签错误:', error);
    return errorResponse('操作失败：' + error.message, 'INTERNAL_ERROR', 500);
  }
}
