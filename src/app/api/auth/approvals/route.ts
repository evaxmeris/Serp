import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, forbiddenResponse } from '@/lib/api-response';

/**
 * GET /api/auth/approvals - 获取注册申请列表
 * 管理员可以查看所有待审批/已审批/已拒绝的注册申请
 */
export async function GET(request: Request) {
  try {
    // 验证管理员权限
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return forbiddenResponse('无权限访问');
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // 构建查询条件
    const where = status ? { status: status as any } : {};

    // 查询注册申请列表
    const registrations = await prisma.userRegistration.findMany({
      where,
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return successResponse({
      registrations,
      total: registrations.length,
      pendingCount: registrations.filter(r => r.status === 'PENDING').length,
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return errorResponse('获取审批列表失败', 'INTERNAL_ERROR', 500);
  }
}
