/**
 * 文件上传 API
 * POST /api/upload — 上传文件（图片/PDF/Excel）
 * 限制：单文件 ≤ 10MB
 * 安全：MIME 检查 + 文件头部魔数验证
 */

import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

// 魔数签名定义（文件头部字节）
const MAGIC_SIGNATURES: Record<string, Uint8Array[]> = {
  'image/jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  'image/jpg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  'application/pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
};
/**
 * 验证文件头部魔数是否匹配声明的 MIME 类型
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_SIGNATURES[mimeType];
  if (!signatures) return false;

  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) return false;
    }
    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证', 'UNAUTHORIZED', 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('请选择文件', 'NO_FILE', 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse('仅支持 JPG/PNG/WebP/PDF/Excel 格式', 'INVALID_TYPE', 400);
    }

    if (file.size > MAX_SIZE) {
      return errorResponse('文件不能超过 10MB', 'FILE_TOO_LARGE', 400);
    }

    // 文件头部魔数验证（防止 MIME 类型伪造）
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, file.type)) {
      return errorResponse('文件内容与声明格式不符，疑似伪造文件', 'INVALID_MAGIC_BYTES', 400);
    }

    // 确保上传目录存在
    await mkdir(UPLOAD_DIR, { recursive: true });

    // 生成唯一文件名：时间戳_随机hex.扩展名
    const ext = file.name.split('.').pop() || 'jpg';
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    await writeFile(filePath, buffer);

    // 返回可访问的 URL
    const url = `/uploads/${uniqueName}`;

    return successResponse({
      url, name: uniqueName, size: file.size,
    }, '上传成功');
  } catch (error) {
    console.error('文件上传失败:', error);
    return errorResponse('上传失败', 'INTERNAL_ERROR', 500);
  }
}
