/**
 * 客户批量导入 API
 *
 * 性能优化（PERF-001）：
 * - 单次 findMany 批量查询所有已存在邮箱 → 消除 N+1 查询
 * - createMany 批量创建新客户（1 条 SQL）
 * - Promise.all 并行更新已存在客户
 *
 * 事务保护（VAL-001）：
 * - prisma.$transaction 包裹所有写操作
 * - 任一操作失败即整体回滚
 * - 导入前二次校验 1000 条上限
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { BatchImportSchema } from '@/lib/api-schemas';
import { CustomerStatus } from '@prisma/client';

/** 单次导入最大条数（与 schema 保持一致） */
const MAX_BATCH_SIZE = 1000;

/** 客户导入数据 */
interface CustomerRow {
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  source?: string | null;
  status?: string | null;
  level?: string | null;
  notes?: string | null;
  tags?: string[];
}

/**
 * POST /api/customers/batch-import
 * 批量导入客户
 */
export async function POST(request: Request) {
  try {
    // ────────────── 认证检查 ──────────────
    const user = await getCurrentUser();
    if (!user || !['ADMIN', 'SALES'].includes(user.role)) {
      return NextResponse.json(
        { error: '需要客户管理权限' },
        { status: 403 },
      );
    }

    // ────────────── 解析请求 ──────────────
    const body = await request.json();
    const v = validateOrReturn(BatchImportSchema, body);
    if (!v.success) return v.response;
    const { customers, mode } = v.data as {
      customers: CustomerRow[];
      mode: 'create' | 'update';
    };

    // ────────────── VAL-001: 数量限制二次校验 ──────────────
    if (customers.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `单次最多导入 ${MAX_BATCH_SIZE} 条，当前 ${customers.length} 条`,
        },
        { status: 400 },
      );
    }

    // ══════════════════════════════════════════════════════
    // PERF-001: 单次查询替代 N+1 查询
    // ══════════════════════════════════════════════════════

    // 收集所有非空邮箱（去重、trim、小写）
    const emails = customers
      .map(c => c.email?.trim() || '')
      .filter(e => e.length > 0)
      .map(e => e.toLowerCase());

    // 去重后的唯一邮箱列表
    const uniqueEmails = Array.from(new Set(emails));

    // 单次查询获取所有已存在客户
    const existingCustomers =
      uniqueEmails.length > 0
        ? await prisma.customer.findMany({
            where: { email: { in: uniqueEmails } },
            select: { id: true, email: true },
          })
        : [];

    // 构建 email → customer 映射（O(1) 查找）
    const existingMap = new Map<string, { id: string; email: string | null }>(
      existingCustomers.map(c => [c.email!.toLowerCase(), c]),
    );

    // ══════════════════════════════════════════════════════
    // 分离待创建 / 待更新 / 校验失败
    // ══════════════════════════════════════════════════════

    const toCreate: CustomerRow[] = [];
    const toUpdate: Array<{ id: string; data: CustomerRow }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const rawEmail = customer.email?.trim() || '';
      const emailKey = rawEmail.toLowerCase();
      const existing = emailKey ? existingMap.get(emailKey) : undefined;

      if (mode === 'create') {
        // 创建模式：邮箱重复则记录错误
        if (existing) {
          errors.push({
            index: i + 1,
            error: `邮箱 ${rawEmail} 已存在`,
          });
        } else {
          toCreate.push(customer);
        }
      } else {
        // 更新模式：有匹配则加入更新列表，否则错误
        if (existing) {
          toUpdate.push({ id: existing.id, data: customer });
        } else {
          errors.push({
            index: i + 1,
            error: emailKey
              ? `邮箱 ${rawEmail} 的客户不存在，无法更新`
              : `第 ${i + 1} 行缺少邮箱，无法匹配更新目标`,
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════
    // VAL-001: 事务保护批量操作
    // ══════════════════════════════════════════════════════
    const [createdCount, updatedCount] = await prisma.$transaction(
      async tx => {
        let created = 0;
        let updated = 0;

        // 批量创建（1 条 SQL）
        if (toCreate.length > 0) {
          const result = await tx.customer.createMany({
            data: toCreate.map(c => ({
              companyName: c.companyName,
              contactName: c.contactName || null,
              email: c.email || null,
              phone: c.phone || null,
              country: c.country || 'CN',
              status: (c.status || 'ACTIVE') as CustomerStatus,
              creditLevel: c.level || 'NORMAL',
              source: c.source || null,
              website: c.website || null,
              address: c.address || null,
              notes: c.notes || null,
            })),
          });
          created = result.count;
        }

        // 并行更新（每个客户一条 SQL，但并发执行）
        if (toUpdate.length > 0) {
          const updateResults = await Promise.all(
            toUpdate.map(({ id, data }) =>
              tx.customer.update({
                where: { id },
                data: {
                  companyName: data.companyName,
                  contactName: data.contactName || null,
                  email: data.email || null,
                  phone: data.phone || null,
                  country: data.country || 'CN',
                  status: (data.status || 'ACTIVE') as CustomerStatus,
                  creditLevel: data.level || 'NORMAL',
                  source: data.source || null,
                  website: data.website || null,
                  address: data.address || null,
                  notes: data.notes || null,
                },
              }),
            ),
          );
          updated = updateResults.length;
        }

        return [created, updated];
      },
      {
        // 超时保护：单次事务最长 30 秒
        timeout: 30000,
      },
    );

    // ────────────── 返回结果 ──────────────
    const successCount = createdCount + updatedCount;

    return NextResponse.json({
      success: true,
      message: `导入完成：成功 ${successCount} 条（新增 ${createdCount}，更新 ${updatedCount}），失败 ${errors.length} 条`,
      results: {
        success: successCount,
        failed: errors.length,
        created: createdCount,
        updated: updatedCount,
        errors,
      },
    });
  } catch (error: any) {
    console.error('批量导入错误:', error);
    return NextResponse.json(
      { error: '导入失败：' + error.message },
      { status: 500 },
    );
  }
}
