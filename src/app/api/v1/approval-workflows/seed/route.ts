/**
 * 审批流程种子数据 API — POST 初始化默认流程
 *
 * POST /api/v1/approval-workflows/seed
 *
 * 创建两个默认审批流程：
 * 1. LOGISTICS_PURCHASE — "物流服务采购审批" (4步: 提交→校对→审批→财务确认)
 * 2. PRODUCT_PURCHASE   — "产品采购审批" (3步: 提交→审批→财务确认)
 *
 * 幂等设计：如果流程 code 已存在则跳过
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse } from '@/lib/api-response';

// ==================== POST: 初始化默认流程 ====================

export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const results: Array<{ code: string; name: string; action: 'created' | 'skipped' }> = [];

    // ——— 1. 物流服务采购审批 (4步) ———
    const logisticsCode = 'LOGISTICS_PURCHASE';
    const logisticsExists = await prisma.approvalWorkflow.findUnique({
      where: { code: logisticsCode },
      select: { id: true },
    });

    if (!logisticsExists) {
      await prisma.approvalWorkflow.create({
        data: {
          name: '物流服务采购审批',
          code: logisticsCode,
          description: '物流服务采购订单的审批流程：提交、校对、审批、财务确认',
          applicableTo: ['LOGISTICS'],
          isActive: true,
          steps: {
            create: [
              {
                order: 1,
                name: '提交',
                description: '提交物流采购申请',
                assignees: {
                  create: [{ role: 'ADMIN' }, { role: 'SALES' }, { role: 'PURCHASING' }],
                },
              },
              {
                order: 2,
                name: '校对',
                description: '校对物流订单信息、费用明细',
                assignees: {
                  create: [{ role: 'ADMIN' }, { role: 'PURCHASING' }],
                },
              },
              {
                order: 3,
                name: '审批',
                description: '审批物流采购订单',
                assignees: {
                  create: [{ role: 'ADMIN' }],
                },
              },
              {
                order: 4,
                name: '财务确认',
                description: '财务确认费用并安排付款',
                assignees: {
                  create: [{ role: 'ADMIN' }],
                },
              },
            ],
          },
        },
      });
      results.push({ code: logisticsCode, name: '物流服务采购审批', action: 'created' });
    } else {
      results.push({ code: logisticsCode, name: '物流服务采购审批', action: 'skipped' });
    }

    // ——— 2. 产品采购审批 (3步) ———
    const productCode = 'PRODUCT_PURCHASE';
    const productExists = await prisma.approvalWorkflow.findUnique({
      where: { code: productCode },
      select: { id: true },
    });

    if (!productExists) {
      await prisma.approvalWorkflow.create({
        data: {
          name: '产品采购审批',
          code: productCode,
          description: '产品/商品采购订单的审批流程：提交、审批、财务确认',
          applicableTo: ['PURCHASE', 'PRODUCT'],
          isActive: true,
          steps: {
            create: [
              {
                order: 1,
                name: '提交',
                description: '提交产品采购申请',
                assignees: {
                  create: [{ role: 'ADMIN' }, { role: 'SALES' }, { role: 'PURCHASING' }],
                },
              },
              {
                order: 2,
                name: '审批',
                description: '审批产品采购订单',
                assignees: {
                  create: [{ role: 'ADMIN' }, { role: 'PURCHASING' }],
                },
              },
              {
                order: 3,
                name: '财务确认',
                description: '财务确认采购费用并安排付款',
                assignees: {
                  create: [{ role: 'ADMIN' }],
                },
              },
            ],
          },
        },
      });
      results.push({ code: productCode, name: '产品采购审批', action: 'created' });
    } else {
      results.push({ code: productCode, name: '产品采购审批', action: 'skipped' });
    }

    return successResponse(results, '默认审批流程初始化完成');
  } catch (error) {
    console.error('初始化审批流程失败:', error);
    return errorResponse('初始化审批流程失败', 'INTERNAL_ERROR', 500);
  }
}
