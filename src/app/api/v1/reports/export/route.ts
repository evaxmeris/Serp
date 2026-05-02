/**
 * 报表导出 API
 * 提供报表导出功能，支持 PDF、Excel、CSV 格式
 * 使用 xlsx 库生成真实的 Excel 文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import * as XLSX from 'xlsx';

/**
 * 根据报表类型和数据生成 Excel 工作簿
 */
function generateExcelWorkbook(reportType: string, data: any, filters?: Record<string, any>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 通用样式信息行
  const now = new Date().toLocaleString('zh-CN');

  switch (reportType) {
    case 'profit': {
      // 利润报表
      const summaryRows = [
        ['利润报表', '', ''],
        [`导出时间: ${now}`, '', ''],
        [],
        ['利润汇总', '', ''],
        ['营业收入', data.summary?.totalRevenue ?? 0, ''],
        ['总成本', data.summary?.totalCost ?? 0, ''],
        ['毛利润', data.summary?.grossProfit ?? 0, ''],
        ['毛利率', `${data.summary?.grossProfitMargin ?? 0}%`, ''],
        ['营业费用', '', ''],
        ['  平台费用', data.summary?.operatingExpenses?.platformFee ?? 0, ''],
        ['  物流费用', data.summary?.operatingExpenses?.logisticsFee ?? 0, ''],
        ['  其他费用', data.summary?.operatingExpenses?.otherFees ?? 0, ''],
        ['净利润', data.summary?.netProfit ?? 0, ''],
        ['净利率', `${data.summary?.netProfitMargin ?? 0}%`, ''],
        ['订单数', data.summary?.orderCount ?? 0, ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws1, '利润汇总');

      // 趋势表
      if (data.trends && data.trends.length > 0) {
        const trendRows = [['期间', '收入', '成本', '利润', '利润率']];
        data.trends.forEach((t: any) => {
          trendRows.push([t.period, t.revenue, t.cost, t.profit, `${t.margin}%`]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(trendRows);
        XLSX.utils.book_append_sheet(wb, ws2, '趋势数据');
      }

      // 分组数据
      if (data.groupedData && data.groupedData.length > 0) {
        const groupRows = [['ID', '名称', '收入', '成本', '利润', '利润率', '订单数']];
        data.groupedData.forEach((g: any) => {
          groupRows.push([g.id, g.name, g.revenue, g.cost, g.profit, `${g.margin}%`, g.orderCount]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(groupRows);
        XLSX.utils.book_append_sheet(wb, ws3, '分组明细');
      }
      break;
    }

    case 'sales': {
      const summaryRows = [
        ['销售报表', '', ''],
        [`导出时间: ${now}`, '', ''],
        [],
        ['销售汇总', '', ''],
        ['销售总额', data.summary?.totalRevenue ?? 0, ''],
        ['订单总数', data.summary?.totalOrders ?? 0, ''],
        ['销售数量', data.summary?.totalQuantity ?? 0, ''],
        ['平均订单金额', data.summary?.averageOrderValue ?? 0, ''],
        ['客户数量', data.summary?.totalCustomers ?? 0, ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws1, '销售汇总');

      if (data.groupedData && data.groupedData.length > 0) {
        const groupRows = [['名称', '销售额', '订单数', '数量', '占比']];
        const totalRev = data.summary?.totalRevenue ?? 1;
        data.groupedData.forEach((g: any) => {
          groupRows.push([g.name, g.revenue, g.orders, g.quantity, `${((g.revenue / totalRev) * 100).toFixed(1)}%`]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(groupRows);
        XLSX.utils.book_append_sheet(wb, ws2, '分组统计');
      }

      if (data.trends && data.trends.length > 0) {
        const trendRows = [['日期', '销售额', '订单数']];
        data.trends.forEach((t: any) => {
          trendRows.push([t.date, t.revenue, t.orders]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(trendRows);
        XLSX.utils.book_append_sheet(wb, ws3, '趋势数据');
      }
      break;
    }

    case 'inventory': {
      const summaryRows = [
        ['库存报表', '', ''],
        [`导出时间: ${now}`, '', ''],
        [],
        ['库存汇总', '', ''],
        ['库存项数', data.summary?.totalItems ?? 0, ''],
        ['总数量', data.summary?.totalQuantity ?? 0, ''],
        ['总价值', data.summary?.totalValue ?? 0, ''],
        ['低库存', data.summary?.lowStockItems ?? 0, ''],
        ['缺货', data.summary?.outOfStockItems ?? 0, ''],
        ['超储', data.summary?.overstockItems ?? 0, ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws1, '库存汇总');

      if (data.items && data.items.length > 0) {
        const itemRows = [['SKU', '名称', '数量', '价值', '状态']];
        data.items.forEach((i: any) => {
          itemRows.push([i.sku, i.name, i.quantity, i.value, i.status]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(itemRows);
        XLSX.utils.book_append_sheet(wb, ws2, '库存明细');
      }

      if (data.byCategory && data.byCategory.length > 0) {
        const catRows = [['品类', '库存项数', '库存价值', '占比']];
        const totalVal = data.summary?.totalValue ?? 1;
        data.byCategory.forEach((c: any) => {
          catRows.push([c.name, c.items, c.value, `${((c.value / totalVal) * 100).toFixed(1)}%`]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(catRows);
        XLSX.utils.book_append_sheet(wb, ws3, '品类统计');
      }
      break;
    }

    case 'cashflow': {
      const summaryRows = [
        ['现金流报表', '', ''],
        [`导出时间: ${now}`, '', ''],
        [],
        ['现金流汇总', '', ''],
        ['总流入', data.summary?.totalInflow ?? 0, ''],
        ['总流出', data.summary?.totalOutflow ?? 0, ''],
        ['净现金流', data.summary?.netCashflow ?? 0, ''],
        ['期初余额', data.summary?.openingBalance ?? 0, ''],
        ['期末余额', data.summary?.closingBalance ?? 0, ''],
        [],
        ['经营活动现金流', '', ''],
        ['  现金流入', data.operatingActivities?.cashInflow ?? 0, ''],
        ['  现金流出', data.operatingActivities?.cashOutflow ?? 0, ''],
        ['  净额', data.operatingActivities?.netCashflow ?? 0, ''],
        [],
        ['投资活动现金流', '', ''],
        ['  现金流入', data.investingActivities?.cashInflow ?? 0, ''],
        ['  现金流出', data.investingActivities?.cashOutflow ?? 0, ''],
        ['  净额', data.investingActivities?.netCashflow ?? 0, ''],
        [],
        ['筹资活动现金流', '', ''],
        ['  现金流入', data.financingActivities?.cashInflow ?? 0, ''],
        ['  现金流出', data.financingActivities?.cashOutflow ?? 0, ''],
        ['  净额', data.financingActivities?.netCashflow ?? 0, ''],
        [],
        ['应收/应付', '', ''],
        ['应收账款总额', data.receivables?.total ?? 0, ''],
        ['逾期金额', data.receivables?.overdue ?? 0, ''],
        ['逾期率', `${data.receivables?.overdueRate ?? 0}%`, ''],
        ['应付账款总额', data.payables?.total ?? 0, ''],
        ['逾期金额', data.payables?.overdue ?? 0, ''],
        ['逾期率', `${data.payables?.overdueRate ?? 0}%`, ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws1, '现金流报表');
      break;
    }

    case 'purchase': {
      const summaryRows = [
        ['采购报表', '', ''],
        [`导出时间: ${now}`, '', ''],
        [],
        ['采购汇总', '', ''],
        ['采购总额', data.totalPurchaseAmount ?? 0, ''],
        ['订单总数', data.totalOrders ?? 0, ''],
        ['平均订单金额', data.averageOrderValue ?? 0, ''],
        ['准时交付率', `${data.deliveryPerformance?.onTime ?? 0}%`, ''],
        [],
        ['质量指标', '', ''],
        ['合格率', `${data.qualityMetrics?.passRate ?? 0}%`, ''],
        ['退货率', `${data.qualityMetrics?.returnRate ?? 0}%`, ''],
        ['投诉率', `${data.qualityMetrics?.complaintRate ?? 0}%`, ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws1, '采购汇总');

      if (data.topSuppliers && data.topSuppliers.length > 0) {
        const supRows = [['排名', '供应商', '金额', '占比']];
        data.topSuppliers.forEach((s: any, i: number) => {
          supRows.push([i + 1, s.name, s.amount, `${s.percentage}%`]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(supRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'Top供应商');
      }

      if (data.purchaseByCategory && data.purchaseByCategory.length > 0) {
        const catRows = [['品类', '金额', '占比']];
        data.purchaseByCategory.forEach((c: any) => {
          catRows.push([c.category, c.amount, `${c.percentage}%`]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(catRows);
        XLSX.utils.book_append_sheet(wb, ws3, '品类分布');
      }
      break;
    }

    default: {
      // 通用导出：尝试将 data 转为表格
      const rows: any[][] = [['字段', '值']];
      if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([key, val]) => {
          rows.push([key, typeof val === 'object' ? JSON.stringify(val) : val]);
        });
      }
      const ws1 = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws1, '数据');

      if (filters) {
        const filterRows = [['筛选条件', '值']];
        Object.entries(filters).forEach(([key, val]) => {
          filterRows.push([key, String(val)]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(filterRows);
        XLSX.utils.book_append_sheet(wb, ws2, '筛选条件');
      }
      break;
    }
  }

  return wb;
}

/**
 * 执行导出：生成 Excel 文件并返回 Buffer
 */
async function performExport(
  reportType: string,
  data: any,
  filters?: Record<string, any>,
): Promise<ArrayBuffer> {
  const wb = generateExcelWorkbook(reportType, data, filters);
  const array = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return array as ArrayBuffer;
}

/**
 * 获取导出文件名
 */
function getExportFilename(reportType: string): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const names: Record<string, string> = {
    profit: '利润报表',
    sales: '销售报表',
    inventory: '库存报表',
    cashflow: '现金流报表',
    purchase: '采购报表',
  };
  return `${names[reportType] || '报表'}_${dateStr}.xlsx`;
}

/**
 * GET /api/v1/reports/export
 * 获取导出历史记录
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get('reportId');
    const status = searchParams.get('status');

    const where: any = {};
    if (reportId) where.reportId = reportId;
    if (status) where.status = status;

    const logs = await prisma.reportExportLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取导出记录失败:', error);
    return NextResponse.json(
      { error: '获取导出记录失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/export
 * 导出报表
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // 支持两种调用方式：
    // 1. reportType + data + filters (由各报表页面直接调用，如利润报表)
    // 2. reportId + format + filters (由报表列表页面创建导出任务)
    const reportType = body.reportType;
    const data = body.data;
    const reportId = body.reportId;
    const format = body.format || 'excel';
    const filters = body.filters || {};

    if (reportType && data) {
      // 方式 1: 立即导出 - 直接生成 Excel 文件返回
      try {
        const excelBuffer = await performExport(reportType, data, filters);
        const filename = getExportFilename(reportType);

        // 创建导出记录
        await prisma.reportExportLog.create({
          data: {
            reportId: reportType,
            userId: session.userId || 'system',
            exportType: 'IMMEDIATE',
            format,
            status: 'completed',
            fileSize: excelBuffer.byteLength,
            completedAt: new Date(),
          },
        }).catch((err) => {
          console.warn('创建导出记录失败(非关键):', err);
        });

        // 返回 Excel 文件下载
        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': String(excelBuffer.byteLength),
          },
        });
      } catch (exportError) {
        console.error('生成 Excel 文件失败:', exportError);
        return NextResponse.json(
          { error: '生成报表文件失败', message: exportError instanceof Error ? exportError.message : '未知错误' },
          { status: 500 },
        );
      }
    }

    if (!reportId) {
      return NextResponse.json(
        { error: '缺少报表 ID 或报表数据' },
        { status: 400 }
      );
    }

    // 方式 2: 通过 reportId 创建导出任务
    const v = validateOrReturn(z.object({ reportId: z.string(), format: z.enum(['pdf','excel','csv']).optional(), filters: z.record(z.string(), z.any()).optional() }), body);
    if (!v.success) return v.response;

    // 创建导出记录
    const exportLog = await prisma.reportExportLog.create({
      data: {
        reportId,
        userId: session.userId || 'system',
        exportType: 'IMMEDIATE',
        format,
        status: 'pending',
      },
    });

    // 尝试异步执行导出
    try {
      // 查询报表定义以获取 reportType 信息
      const reportDef = await prisma.reportDefinition.findUnique({
        where: { id: reportId },
      });

      if (reportDef) {
        // 如果找到报表定义，尝试生成导出
        const reportTypeFromDef = reportDef.type || reportDef.id;
        const config = (reportDef.config as any) || {};
        const exportData = config.sampleData || {};

        const excelBuffer = await performExport(reportTypeFromDef, exportData, filters);

        // 更新导出记录
        await prisma.reportExportLog.update({
          where: { id: exportLog.id },
          data: {
            status: 'completed',
            fileSize: excelBuffer.byteLength,
            completedAt: new Date(),
          },
        });

        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(getExportFilename(reportTypeFromDef))}"`,
            'Content-Length': String(excelBuffer.byteLength),
          },
        });
      }
    } catch (asyncErr) {
      console.warn('异步导出执行失败，保留导出记录:', asyncErr);
    }

    return NextResponse.json({
      success: true,
      data: exportLog,
      message: '导出任务已创建',
    });
  } catch (error) {
    console.error('导出报表失败:', error);
    return NextResponse.json(
      { error: '导出报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
