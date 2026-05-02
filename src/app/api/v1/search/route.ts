/**
 * 全局搜索 API
 * GET /api/v1/search?q=xxx
 *
 * 同时搜索订单号、客户名、产品名、供应商名
 * 返回按模块分组的结果，每模块最多 5 条
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse } from '@/lib/api-response';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'order' | 'customer' | 'product' | 'supplier';
}

interface SearchResults {
  orders: SearchResult[];
  customers: SearchResult[];
  products: SearchResult[];
  suppliers: SearchResult[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 1) {
      return successResponse<SearchResults>({
        orders: [],
        customers: [],
        products: [],
        suppliers: [],
      });
    }

    const keyword = q;

    // 并行查询 4 个模块，每模块最多 5 条
    const [orders, customers, products, suppliers] = await Promise.all([
      // 1. 按订单号搜索
      prisma.order.findMany({
        where: {
          orderNo: { contains: keyword },
        },
        select: {
          id: true,
          orderNo: true,
          customer: { select: { companyName: true } },
          status: true,
          totalAmount: true,
          currency: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // 2. 按客户公司名搜索
      prisma.customer.findMany({
        where: {
          OR: [
            { companyName: { contains: keyword } },
            { contactName: { contains: keyword } },
            { email: { contains: keyword } },
          ],
        },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          status: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // 3. 按产品名搜索
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: keyword } },
            { nameEn: { contains: keyword } },
            { sku: { contains: keyword } },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // 4. 按供应商公司名搜索
      prisma.supplier.findMany({
        where: {
          OR: [
            { companyName: { contains: keyword } },
            { companyEn: { contains: keyword } },
            { contactName: { contains: keyword } },
          ],
        },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          status: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const results: SearchResults = {
      orders: orders.map((o) => ({
        id: o.id,
        title: o.orderNo,
        description: `客户: ${o.customer?.companyName ?? '-'} | ${o.status} | ${o.currency} ${o.totalAmount}`,
        url: `/orders/${o.id}`,
        type: 'order' as const,
      })),
      customers: customers.map((c) => ({
        id: c.id,
        title: c.companyName,
        description: `联系人: ${c.contactName ?? '-'} | ${c.email ?? '-'}`,
        url: `/customers/${c.id}`,
        type: 'customer' as const,
      })),
      products: products.map((p) => ({
        id: p.id,
        title: p.name,
        description: `SKU: ${p.sku}`,
        url: `/products/${p.id}`,
        type: 'product' as const,
      })),
      suppliers: suppliers.map((s) => ({
        id: s.id,
        title: s.companyName,
        description: `联系人: ${s.contactName ?? '-'}`,
        url: `/suppliers/${s.id}`,
        type: 'supplier' as const,
      })),
    };

    return successResponse<SearchResults>(results);
  } catch (error) {
    console.error('全局搜索出错:', error);
    return errorResponse('搜索失败，请稍后重试');
  }
}
