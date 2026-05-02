import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { listResponse, createdResponse, errorResponse, successResponse, notFoundResponse, validationErrorResponse } from '@/lib/api-response';
import { generateReimbursementNo } from '@/lib/id-generator';

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const [items, total] = await Promise.all([
      prisma.reimbursement.findMany({ orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit }),
      prisma.reimbursement.count(),
    ]);
    return listResponse(items, { page, limit, total, totalPages: Math.ceil(total/limit) });
  } catch (e) { console.error(e); return errorResponse('获取失败', 'INTERNAL_ERROR', 500); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const body = await request.json();
    const { expenseIds, title, description, amount } = body;

    // 验证 expenseIds 数组
    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      return validationErrorResponse([{ field: 'expenseIds', message: '请选择至少一条费用记录' }]);
    }

    // 验证 expenseIds 对应的 Expense 记录存在且属于当前用户
    const expenses = await prisma.expense.findMany({
      where: { id: { in: expenseIds }, applicantId: session.id },
    });

    if (expenses.length !== expenseIds.length) {
      return errorResponse('部分费用记录不存在或无权限', 'VALIDATION_ERROR', 422);
    }

    // 计算总金额
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // 用 $transaction 包裹创建
    const item = await prisma.$transaction(async (tx) => {
      return tx.reimbursement.create({
        data: {
          reimbursementNo: await generateReimbursementNo(),
          applicantId: session.id,
          description: description || title || null,
          totalAmount,
          status: 'PENDING',
          expenseIds,
          expenses: {
            connect: expenseIds.map((id: string) => ({ id })),
          },
        },
      });
    });

    return createdResponse(item, '创建成功');
  } catch (e) { console.error(e); return errorResponse('创建失败', 'INTERNAL_ERROR', 500); }
}
