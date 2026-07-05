import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { z } from 'zod';

const CreateContactSchema = z.object({
  name: z.string().min(1, '联系人姓名不能为空').max(100),
  position: z.string().max(100).optional().default(''),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().max(50).optional().default(''),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().max(500).optional().default(''),
});

// POST /api/customers/[id]/contacts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: customerId } = await params;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return notFoundResponse('客户');
    }

    const body = await request.json();
    const v = CreateContactSchema.safeParse(body);
    if (!v.success) {
      return errorResponse(v.error.errors[0]?.message || '参数错误', 'VALIDATION_ERROR', 400);
    }

    // 如果是主联系人，先取消其他主联系人
    if (v.data.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.customerContact.create({
      data: {
        customerId,
        name: v.data.name,
        position: v.data.position || null,
        email: v.data.email || null,
        phone: v.data.phone || null,
        isPrimary: v.data.isPrimary,
        notes: v.data.notes || null,
      },
    });

    return successResponse(contact, 201);
  } catch (error) {
    console.error('Error creating contact:', error);
    return errorResponse('创建联系人失败', 'INTERNAL_ERROR', 500);
  }
}

// GET /api/customers/[id]/contacts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: customerId } = await params;

    const contacts = await prisma.customerContact.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return successResponse(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return errorResponse('获取联系人失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/customers/[id]/contacts - 更新联系人
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const { contactId, ...updateData } = body;

    if (!contactId) {
      return errorResponse('缺少联系人ID', 'VALIDATION_ERROR', 400);
    }

    const contact = await prisma.customerContact.findFirst({
      where: { id: contactId, customerId: (await params).id },
    });

    if (!contact) {
      return notFoundResponse('联系人');
    }

    const updated = await prisma.customerContact.update({
      where: { id: contactId },
      data: updateData,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Error updating contact:', error);
    return errorResponse('更新联系人失败', 'INTERNAL_ERROR', 500);
  }
}
