/**
 * 速率限制中间件
 * 
 * @文件说明 防止暴力破解和 API 滥用
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 速率限制记录
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * 速率限制 Map (按 IP 地址)
 */
const limitMap = new Map<string, RateLimitRecord>();

/**
 * 速率限制函数
 * 
 * @param request Next.js 请求对象
 * @param options 配置选项
 * @param options.limit 最大请求次数
 * @param options.windowMs 时间窗口（毫秒）
 * @returns 如果超限返回错误响应，否则返回 null
 * 
 * @示例
 * const error = rateLimit(request, { limit: 5, windowMs: 15 * 60 * 1000 });
 * if (error) return error;
 */
export function rateLimit(
  request: NextRequest,
  options: {
    limit: number;
    windowMs: number;
  }
): NextResponse | null {
  // 获取客户端 IP
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const now = Date.now();
  
  // 获取或创建记录
  let record = limitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    // 新窗口
    record = {
      count: 1,
      resetTime: now + options.windowMs,
    };
  } else {
    // 当前窗口内累加
    record.count += 1;
  }
  
  // 更新记录
  limitMap.set(ip, record);
  
  // 检查是否超限
  if (record.count > options.limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    
    return NextResponse.json(
      { 
        error: '请求过于频繁，请稍后再试',
        retryAfter: retryAfter,
        message: `请在 ${retryAfter} 秒后重试`,
      },
      { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }
  
  return null;
}

/**
 * 清理过期的速率限制记录
 * 建议每 10 分钟调用一次
 */
export function cleanupRateLimitRecords() {
  const now = Date.now();
  
  for (const [ip, record] of limitMap.entries()) {
    if (now > record.resetTime) {
      limitMap.delete(ip);
    }
  }
}

// 每 10 分钟自动清理
setInterval(cleanupRateLimitRecords, 10 * 60 * 1000);
