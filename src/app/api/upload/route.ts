/**
 * 文件上传 API
 * POST /api/upload — 上传图片（营业执照、身份证等）
 * 限制：单文件 ≤ 500KB，仅允许图片格式
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: '未认证', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择文件', code: 'NO_FILE' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: '仅支持 JPG/PNG/WebP 格式', code: 'INVALID_TYPE' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: '文件不能超过 500KB', code: 'FILE_TOO_LARGE' }, { status: 400 });
    }

    // 确保上传目录存在
    await mkdir(UPLOAD_DIR, { recursive: true });

    // 生成唯一文件名：时间戳_随机hex.扩展名
    const ext = file.name.split('.').pop() || 'jpg';
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // 返回可访问的 URL
    const url = `/uploads/${uniqueName}`;

    return NextResponse.json({
      success: true,
      data: { url, name: uniqueName, size: file.size },
      message: '上传成功',
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 });
  }
}
