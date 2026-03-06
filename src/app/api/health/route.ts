import { NextResponse } from 'next/server';

// GET /api/health - 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Trade ERP API',
    version: '0.3.0',
  });
}
