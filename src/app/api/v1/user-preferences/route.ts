import { NextRequest, NextResponse } from 'next/server';

/**
 * 用户偏好设置 API
 * 使用 localStorage 作为主要存储，后端 API 作为可选的同步层
 * 
 * GET  - 获取当前用户偏好
 * PUT  - 更新当前用户偏好
 */

// 默认偏好设置
const DEFAULT_PREFERENCES = {
  theme: 'system' as 'light' | 'dark' | 'system',
  language: 'zh' as 'zh' | 'en',
  pageSize: 20 as 10 | 20 | 50,
  notifications: true as boolean,
};

export type UserPreferences = typeof DEFAULT_PREFERENCES;

/**
 * GET /api/v1/user-preferences
 * 获取当前用户偏好设置
 * 优先从 cookie 中读取，否则返回默认值
 */
export async function GET(request: NextRequest) {
  try {
    // 从 cookie 获取用户偏好（JSON 字符串）
    const prefsCookie = request.cookies.get('user_preferences')?.value;

    if (prefsCookie) {
      try {
        const parsed = JSON.parse(prefsCookie);
        // 合并默认值，确保所有字段都存在
        const preferences = { ...DEFAULT_PREFERENCES, ...parsed };
        return NextResponse.json({ success: true, data: preferences });
      } catch {
        // cookie 解析失败，返回默认值
        return NextResponse.json({ success: true, data: DEFAULT_PREFERENCES });
      }
    }

    // 没有 cookie，返回默认值
    return NextResponse.json({ success: true, data: DEFAULT_PREFERENCES });
  } catch (error) {
    console.error('获取用户偏好失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户偏好失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/user-preferences
 * 更新当前用户偏好设置
 * 将偏好写入 cookie（有效期 1 年）
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // 校验字段
    const allowedFields = ['theme', 'language', 'pageSize', 'notifications'];
    const validated: Record<string, any> = {};

    if (body.theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(body.theme)) {
        return NextResponse.json(
          { success: false, error: '无效的主题值，可选值: light, dark, system' },
          { status: 400 }
        );
      }
      validated.theme = body.theme;
    }

    if (body.language !== undefined) {
      if (!['zh', 'en'].includes(body.language)) {
        return NextResponse.json(
          { success: false, error: '无效的语言值，可选值: zh, en' },
          { status: 400 }
        );
      }
      validated.language = body.language;
    }

    if (body.pageSize !== undefined) {
      if (![10, 20, 50].includes(body.pageSize)) {
        return NextResponse.json(
          { success: false, error: '无效的每页条数，可选值: 10, 20, 50' },
          { status: 400 }
        );
      }
      validated.pageSize = body.pageSize;
    }

    if (body.notifications !== undefined) {
      if (typeof body.notifications !== 'boolean') {
        return NextResponse.json(
          { success: false, error: '通知开关必须为布尔值' },
          { status: 400 }
        );
      }
      validated.notifications = body.notifications;
    }

    // 读取现有偏好，合并更新
    const existingCookie = request.cookies.get('user_preferences')?.value;
    const existing = existingCookie ? JSON.parse(existingCookie) : {};
    const merged = { ...DEFAULT_PREFERENCES, ...existing, ...validated };

    // 构建响应，设置 cookie
    const response = NextResponse.json({
      success: true,
      data: merged,
      message: '偏好设置已更新',
    });

    // 设置 cookie，有效期 1 年
    response.cookies.set('user_preferences', JSON.stringify(merged), {
      httpOnly: false, // 前端也需要读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60, // 1 年
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('更新用户偏好失败:', error);
    return NextResponse.json(
      { success: false, error: '更新用户偏好失败' },
      { status: 500 }
    );
  }
}
