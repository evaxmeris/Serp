import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  listResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  conflictResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { orderCreateSchema, orderListQuerySchema } from '@/lib/validators/order';

/**
 * GET /api/orders - 获取订单列表（行级隔离）
 * 管理员可以看到所有订单，普通用户只能看到自己负责的订单
 * 支持分页、筛选、搜索
 */
export async function GET(request: NextRequest) {
  try {
    // 获取当前登录用户
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED');
    }
    const currentUser = session;

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryResult = orderListQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const {
      page,
      limit,
      status,
      customerId,
      salesRepId,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 客户筛选
    if (customerId) {
      where.customerId = customerId;
    }

    // 业务员筛选
    if (salesRepId) {
      where.salesRepId = salesRepId;
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 搜索（订单号/客户名）
    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
        { shippingAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    // BUG-PERM-007: 添加行级隔离
    // 管理员/经理可以看到所有订单，普通用户只能看到自己负责的订单
    if (currentUser.role !== 'ADMIN') {
      where.salesRepId = currentUser.id;
    }

    // 执行查询
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
            },
          },
          salesRep: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              productSku: true,
              quantity: true,
              unitPrice: true,
              amount: true,
              productionStatus: true,
            },
          },
          _count: {
            select: {
              payments: true,
              shipments: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // 格式化响应数据
    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      orderNo: order.orderNo,
      customer: order.customer,
      status: order.status,
      approvalStatus: order.approvalStatus,
      currency: order.currency,
      totalAmount: order.totalAmount.toNumber(),
      paidAmount: order.paidAmount.toNumber(),
      balanceAmount: order.balanceAmount.toNumber(),
      deliveryDate: order.deliveryDate,
      deliveryDeadline: order.deliveryDeadline,
      salesRep: order.salesRep,
      itemCount: order.items.length,
      paymentCount: order._count.payments,
      shipmentCount: order._count.shipments,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return listResponse(formattedOrders, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return errorResponse('获取订单列表失败', 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/orders - 创建订单（行级隔离）
 * 自动分配给当前登录用户作为业务员
 */
export async function POST(request: NextRequest) {
  try {
    // 获取当前登录用户
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED');
    }
    const currentUser = session;

    // 解析并验证请求体
    const body = await request.json();
    const validationResult = orderCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const {
      customerId,
      sourceInquiryId,
      sourceQuotationId,
      currency,
      exchangeRate,
      paymentTerms,
      paymentDeadline,
      deliveryTerms,
      deliveryDate,
      deliveryDeadline,
      shippingAddress,
      shippingContact,
      shippingPhone,
      salesRepId,
      notes,
      internalNotes,
      attachments,
      items,
    } = validationResult.data;

    // BUG-PERM-007: 如果没有指定业务员，自动设置为当前用户
    const finalSalesRepId = salesRepId || currentUser.id;

    // 验证客户是否存在
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return notFoundResponse('客户');
    }

    // 验证交货日期（如果提供，必须晚于当前日期）
    if (deliveryDate) {
      const deliveryDateTime = new Date(deliveryDate);
      if (deliveryDateTime <= new Date()) {
        return conflictResponse('交货日期必须晚于当前日期', 'ORDER_INVALID_DELIVERY_DATE');
      }
    }

    // 计算总金额
    const totalAmount = items.reduce((sum, item) => {
      const discount = item.discountRate || 0;
      const itemAmount = item.quantity * item.unitPrice * (1 - discount / 100);
      return sum + itemAmount;
    }, 0);

    // 生成订单号：SO-YYYYMMDD-XXX
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const count = await prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        },
      },
    });
    const orderNo = `SO-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId,
        sourceInquiryId,
        sourceQuotationId,
        status: 'PENDING',
        approvalStatus: 'NOT_REQUIRED',
        currency: currency || 'USD',
        exchangeRate: exchangeRate || 1,
        totalAmount,
        paidAmount: 0,
        balanceAmount: totalAmount,
        paymentTerms,
        paymentDeadline: paymentDeadline ? new Date(paymentDeadline) : null,
        deliveryTerms,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null,
        shippingAddress,
        shippingContact,
        shippingPhone,
        salesRepId: finalSalesRepId,
        notes,
        internalNotes,
        attachments: attachments || [],
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName || '',
            productSku: item.productSku,
            specification: item.specification,
            quantity: item.quantity,
            unit: item.unit || 'PCS',
            unitPrice: item.unitPrice,
            discountRate: item.discountRate || 0,
            amount: item.quantity * item.unitPrice * (1 - (item.discountRate || 0) / 100),
            productionStatus: 'NOT_STARTED',
            shippedQty: 0,
            deliveredQty: 0,
            notes: item.notes,
          })),
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
          },
        },
        items: true,
      },
    });

    // 格式化响应
    const responseData = {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      currency: order.currency,
      itemCount: order.items.length,
      createdAt: order.createdAt,
    };

    return createdResponse(responseData, '订单创建成功');
  } catch (error) {
    console.error('Error creating order:', error);
    return errorResponse('创建订单失败', 'INTERNAL_ERROR');
  }
}
