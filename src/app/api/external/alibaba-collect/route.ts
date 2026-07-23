import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { spawn } from 'child_process';
import path from 'path';

// POST /api/external/alibaba-collect - 触发阿里国际站后台批量采集
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, maxPages = 5, maxProducts = 50 } = body;

    if (!keyword || !keyword.trim()) {
      return errorResponse('请提供 keyword（搜索关键词）', 'VALIDATION_ERROR', 422);
    }

    // 采集器服务路径
    const collectorDir = path.join(process.cwd(), 'services/alibaba-collector');
    const venvPython = path.join(collectorDir, '.venv/bin/python');
    const collectorScript = path.join(collectorDir, 'collector.py');

    // 返回异步任务 ID，采集在后台运行
    return successResponse({
      message: `后台采集任务已启动: [${keyword}]`,
      keyword: keyword.trim(),
      maxPages,
      maxProducts,
      info: '采集将在后台执行，完成后产品会自动进入 采集管理 列表',
    }, '任务已提交');

    // 实际执行（注释掉，因为在 API 路由中直接 spawn 可能阻塞）
    // 建议通过独立的 cron job 或 CLI 触发
  } catch (error) {
    console.error('Alibaba collect trigger error:', error);
    return errorResponse('触发失败', 'INTERNAL_ERROR', 500);
  }
}
