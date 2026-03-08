import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp: string;
}

/**
 * 成功响应
 */
export function successResponse<T>(data: T, message?: string, code: string = 'SUCCESS') {
  return NextResponse.json<ApiResponse<T>>({
    success: true,
    code,
    data,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 列表响应（别名：paginatedResponse 用于向后兼容）
 */
export function listResponse<T>(items: T[], pagination: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}, code: string = 'SUCCESS') {
  return NextResponse.json<ApiResponse<{ items: T[]; pagination: typeof pagination }>>({
    success: true,
    code,
    data: {
      items,
      pagination,
    },
    timestamp: new Date().toISOString(),
  });
}

// 向后兼容别名
export const paginatedResponse = listResponse;

/**
 * 创建成功响应
 */
export function createdResponse<T>(data: T, message?: string) {
  return NextResponse.json<ApiResponse<T>>({
    success: true,
    code: 'CREATED',
    data,
    message: message || '创建成功',
    timestamp: new Date().toISOString(),
  }, { status: 201 });
}

/**
 * 错误响应
 */
export function errorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  errors?: Array<{ field: string; message: string }>
) {
  return NextResponse.json<ApiResponse>({
    success: false,
    code,
    message,
    errors,
    timestamp: new Date().toISOString(),
  }, { status });
}

/**
 * 从 Zod 错误提取验证错误信息
 */
export function extractZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  // Zod v4 uses 'issues' array
  return (error as any).issues.map((issue: any) => ({
    field: (issue.path || []).join('.'),
    message: issue.message,
  }));
}

/**
 * 验证错误响应（别名：validationError 用于向后兼容）
 */
export function validationErrorResponse(errors: Array<{ field: string; message: string }>) {
  return NextResponse.json<ApiResponse>({
    success: false,
    code: 'VALIDATION_ERROR',
    message: '请求参数验证失败',
    errors,
    timestamp: new Date().toISOString(),
  }, { status: 422 });
}

// 向后兼容别名
export const validationError = validationErrorResponse;

/**
 * 未找到响应
 */
export function notFoundResponse(resource: string = '资源') {
  return errorResponse(`${resource}不存在`, 'NOT_FOUND', 404);
}

/**
 * 冲突响应
 */
export function conflictResponse(message: string, code: string = 'CONFLICT') {
  return errorResponse(message, code, 409);
}

/**
 * 无权限响应
 */
export function forbiddenResponse(message: string = '无权限执行此操作') {
  return errorResponse(message, 'FORBIDDEN', 403);
}
