/**
 * 报表调度执行器
 *
 * 查找所有已到期的 ReportSchedule，生成报表数据并更新调度状态。
 * 使用 cron-parser 精确计算下次执行时间。
 * 支持 ReportData 去重和 profit 类型报表数据填充。
 *
 * 函数签名：export async function executeSchedules(): Promise<{executed: number, errors: string[]}>
 */

import { prisma } from '@/lib/prisma';
import CronExpressionParser from 'cron-parser';

/**
 * 构建简易利润摘要数据（从最新的 ProfitCalculation 记录中提取）
 */
async function buildProfitSummary(): Promise<Record<string, unknown>> {
  try {
    const latest = await prisma.profitCalculation.findFirst({
      orderBy: { calculatedAt: 'desc' },
      select: {
        name: true,
        totalRevenue: true,
        totalCost: true,
        totalExpense: true,
        netProfit: true,
        profitMargin: true,
        orderCount: true,
        period: true,
        calculatedAt: true,
      },
    });

    if (!latest) {
      return { note: '暂无利润计算数据' };
    }

    return {
      summaryType: 'profit',
      generatedAt: new Date().toISOString(),
      name: latest.name,
      period: latest.period,
      totalRevenue: Number(latest.totalRevenue),
      totalCost: Number(latest.totalCost),
      totalExpense: Number(latest.totalExpense),
      netProfit: Number(latest.netProfit),
      profitMargin: latest.profitMargin ? Number(latest.profitMargin) : null,
      orderCount: latest.orderCount,
      calculatedAt: latest.calculatedAt?.toISOString(),
    };
  } catch (error) {
    console.error('[Report Scheduler] 获取利润摘要失败:', error);
    return { note: '获取利润数据失败', error: String(error) };
  }
}

/**
 * 执行所有已到期的报表调度
 *
 * 查询 ReportSchedule WHERE isActive=true AND nextRunAt <= now()
 * 对每个匹配的调度，创建 ReportData 记录，更新 lastRunAt 和 nextRunAt
 *
 * @returns 执行结果统计
 */
export async function executeSchedules(): Promise<{ executed: number; errors: string[] }> {
  const errors: string[] = [];
  let executed = 0;

  try {
    // 查找所有已到期且激活的调度
    const schedules = await prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: new Date(),
        },
      },
      include: {
        report: true,
      },
    });

    console.log(`[Report Scheduler] 找到 ${schedules.length} 个待执行的调度`);

    for (const schedule of schedules) {
      try {
        // 生成报表数据记录
        const periodStart = new Date();
        const periodEnd = new Date();
        // 默认生成过去一期的数据
        periodStart.setDate(periodStart.getDate() - 1);

        const periodKey = `${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}`;

        // 查重：检查相同 reportId + period 是否已存在 ReportData
        const existing = await prisma.reportData.findFirst({
          where: {
            reportId: schedule.reportId,
            period: periodKey,
          },
        });
        if (existing) {
          console.log(`[Report Scheduler] 跳过重复调度：${schedule.name} — 周期 ${periodKey} 已有数据`);
          // 跳过数据生成，但仍更新调度时间
        } else {
          // 判断是否为 profit 类型报表，填充数据
          let dataPayload: Record<string, unknown> = {};
          if (schedule.report.type === 'profit') {
            dataPayload = await buildProfitSummary();
          }

          await prisma.reportData.create({
            data: {
              reportId: schedule.reportId,
              period: periodKey,
              periodStart,
              periodEnd,
              data: dataPayload,
              metrics: {
                generatedBy: 'scheduler',
                scheduleName: schedule.name,
                scheduleId: schedule.id,
              },
            },
          });
        }

        // 使用 cron-parser 精确计算下次执行时间
        let nextRunAt: Date;
        try {
          const interval = CronExpressionParser.parse(schedule.cronExpression, {
            tz: schedule.timezone || 'Asia/Shanghai',
          });
          nextRunAt = interval.next().toDate();
        } catch (cronError) {
          console.warn(`[Report Scheduler] cron 表达式解析失败 (${schedule.cronExpression})，回退 +24h`, cronError);
          nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        // 更新调度状态
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt,
          },
        });

        executed++;
        console.log(`[Report Scheduler] 调度执行成功：${schedule.name} (${schedule.id}), 下次执行: ${nextRunAt.toISOString()}`);
      } catch (error) {
        const errorMsg = `调度 ${schedule.name} (${schedule.id}) 执行失败：${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`[Report Scheduler] ${errorMsg}`);
      }
    }
  } catch (error) {
    const errorMsg = `查询报表调度失败：${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    console.error(`[Report Scheduler] ${errorMsg}`);
  }

  return { executed, errors };
}
