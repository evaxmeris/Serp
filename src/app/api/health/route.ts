import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';

// GET /api/health - 健康检查
// 返回服务状态和版本信息（版本号从 package.json 自动读取）
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Trade ERP API',
    version: pkg.version,
  });
}
