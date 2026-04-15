/**
 * API 验证中间件
 * 
 * 为 Next.js API 路由提供声明式 Zod 验证，一行代码即可添加验证。
 * 自动解析 body/query/params，验证失败返回 422。
 * 
 * @example
 * // 验证请求体
 * export const POST = withValidation(
 *   { body: CreateCustomerSchema },
 *   async (req, { body }) => {
 *     // body 已验证，类型安全
 *     return createdResponse(await prisma.customer.create({ data: body }));
 *   }
 * );
 * 
 * @example
 * // 同时验证 body + query
 * export const POST = withValidation(
 *   { body: CreateProductSchema, query: PaginationSchema },
 *   async (req, { body, query }) => { ... }
 * );
 * 
 * @example
 * // 仅验证 query（GET 请求常用）
 * export const GET = withValidation(
 *   { query: PaginationSchema },
 *   async (req, { query }) => { ... }
 * );
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validationErrorResponse } from './api-response';

// ==================== 类型定义 ====================

type ValidationTargets = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

type ValidatedHandler<T extends ValidationTargets> = (
  request: NextRequest,
  ctx: {
    body: T['body'] extends z.ZodTypeAny ? z.infer<T['body']> : unknown;
    query: T['query'] extends z.ZodTypeAny ? z.infer<T['query']> : unknown;
    params: T['params'] extends z.ZodTypeAny ? z.infer<T['params']> : unknown;
  }
) => Promise<NextResponse> | NextResponse;

// ==================== 核心中间件 ====================

/**
 * 创建带验证的 API 路由处理器
 */
export function withValidation<T extends ValidationTargets>(
  targets: T,
  handler: ValidatedHandler<T>
) {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => {
    try {
      // 1. 验证 body
      let body: unknown = undefined;
      if (targets.body) {
        try {
          body = await request.json();
        } catch {
          return validationErrorResponse([{ field: 'body', message: '请求体不是有效的 JSON' }]);
        }
        const result = (targets.body as z.ZodTypeAny).safeParse(body);
        if (!result.success) {
          return validationErrorResponse(
            result.error.issues.map((issue) => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            }))
          );
        }
        body = result.data;
      }

      // 2. 验证 query
      let query: unknown = undefined;
      if (targets.query) {
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);
        const result = (targets.query as z.ZodTypeAny).safeParse(searchParams);
        if (!result.success) {
          return validationErrorResponse(
            result.error.issues.map((issue) => ({
              field: issue.path.join('.') || 'query',
              message: issue.message,
            }))
          );
        }
        query = result.data;
      }

      // 3. 验证 params（路径参数，Next.js 16 中 params 可能是 Promise）
      let params: unknown = undefined;
      if (targets.params && context?.params) {
        const resolvedParams = context.params instanceof Promise
          ? await context.params
          : context.params;
        const result = (targets.params as z.ZodTypeAny).safeParse(resolvedParams);
        if (!result.success) {
          return validationErrorResponse(
            result.error.issues.map((issue) => ({
              field: issue.path.join('.') || 'params',
              message: issue.message,
            }))
          );
        }
        params = result.data;
      }

      // 4. 调用处理器
      return handler(request, { body, query, params } as any);
    } catch (error) {
      console.error('Validation middleware error:', error);
      return NextResponse.json(
        { success: false, code: 'INTERNAL_ERROR', message: '服务器内部错误', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }
  };
}

// ==================== 便捷函数（不改写路由签名时用） ====================

/**
 * 简单验证函数，适合在现有路由中直接使用（不改变函数签名）
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const body = await request.json();
 *   const validated = validateOrReturn(CreateCustomerSchema, body);
 *   if (!validated.success) return validated.response;
 *   const { companyName, email } = validated.data;
 *   // ...
 * }
 */
export function validateOrReturn<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  target: 'body' | 'query' = 'body'
):
  | { success: true; data: z.infer<T>; response?: never }
  | { success: false; data?: never; response: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: validationErrorResponse(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || target,
        message: issue.message,
      }))
    ),
  };
}

/**
 * 批量验证多个 schema
 * 
 * @example
 * const validated = validateMany(body, {
 *   customer: CreateCustomerSchema,
 *   tags: z.array(z.string()),
 * });
 * if (!validated.success) return validated.response;
 * const { customer, tags } = validated.data;
 */
export function validateMany(
  data: unknown,
  schemas: Record<string, z.ZodTypeAny>,
  field?: string
):
  | { success: true; data: Record<string, unknown>; response?: never }
  | { success: false; data?: never; response: NextResponse } {
  const errors: Array<{ field: string; message: string }> = [];
  const validated: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(data);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        errors.push({
          field: field ? `${field}.${key}.${issue.path.join('.')}` : `${key}.${issue.path.join('.')}`,
          message: issue.message,
        });
      });
    } else {
      validated[key] = result.data;
    }
  }

  if (errors.length > 0) {
    return { success: false, response: validationErrorResponse(errors) };
  }
  return { success: true, data: validated };
}
