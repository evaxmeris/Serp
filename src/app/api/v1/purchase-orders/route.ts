import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import {
  CreatePurchaseOrderSchema,
  PurchaseOrderQuerySchema,
} from '@/lib/validators/purchase-order';

// GET /api/v1/purchase-orders - 获取采购订单列表
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 解析和验证查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryResult = PurchaseOrderQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const {
      page,
      limit,
      status,
      supplierId,
      salesOrderId,
      purchaserId,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (purchaserId) {
      where.purchaserId = purchaserId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { poNo: { contains: search } },
        { notes: { contains: search } },
        { supplier: { companyName: { contains: search } } },
      ];
    }

    // 执行查询
    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              companyEn: true,
              contactName: true,
              email: true,
              phone: true,
            },
          },
          purchaser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          salesOrder: {
            select: {
              id: true,
              orderNo: true,
              customerId: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
              receipts: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return paginatedResponse(purchaseOrders, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return errorResponse('获取采购订单列表失败', 'INTERNAL_ERROR');
  }
}

// POST /api/v1/purchase-orders - 创建采购订单
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = CreatePurchaseOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      return errorResponse('供应商不存在', 'SUPPLIER_NOT_FOUND', 404);
    }

    // 检查供应商状态
    if (supplier.status === 'INACTIVE' || supplier.status === 'BLACKLISTED') {
      return errorResponse('供应商已停用或被拉黑', 'SUPPLIER_INACTIVE', 409);
    }

    // 生成采购订单编号
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const count = await prisma.purchaseOrder.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        },
      },
    });

    const poNo = `PO-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;

    // 计算总金额
    let totalAmount = 0;
    const itemsData = data.items.map((item) => {
      const amount = item.quantity * item.unitPrice * (1 - item.discountRate / 100);
      const taxAmount = amount * (item.taxRate / 100);
      totalAmount += amount + taxAmount;
      return {
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        specification: item.specification,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountRate: item.discountRate,
        amount,
        taxRate: item.taxRate,
        taxAmount,
        expectedDeliveryDate: item.expectedDeliveryDate
          ? new Date(item.expectedDeliveryDate)
          : null,
        notes: item.notes,
      };
    });

    // 创建采购订单
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNo,
        supplierId: data.supplierId,
        salesOrderId: data.salesOrderId,
        status: 'PENDING',
        approvalStatus: 'NOT_REQUIRED',
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        totalAmount,
        paidAmount: 0,
        balanceAmount: totalAmount,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        deliveryDeadline: data.deliveryDeadline
          ? new Date(data.deliveryDeadline)
          : null,
        deliveryAddress: data.deliveryAddress,
        shippingMethod: data.shippingMethod,
        paymentTerms: data.paymentTerms,
        paymentDeadline: data.paymentDeadline
          ? new Date(data.paymentDeadline)
          : null,
        purchaserId: data.purchaserId,
        notes: data.notes,
        internalNotes: data.internalNotes,
        attachments: data.attachments,
        items: {
          create: itemsData,
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            companyEn: true,
          },
        },
        purchaser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: true,
      },
    });

    return successResponse(purchaseOrder, '采购订单创建成功', 'CREATED');
  } catch (error) {
    console.error('Error creating purchase order:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return errorResponse('采购订单编号已存在', 'CONFLICT', 409);
    }

    return errorResponse('创建采购订单失败', 'INTERNAL_ERROR');
  }
}
