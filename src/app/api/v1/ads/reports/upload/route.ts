import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import {
  createdResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
} from '@/lib/api-response';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import path from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { runParse } from '@/lib/ads/engine-client';
import { writeAdsAuditLog } from '@/lib/ads/audit';

// ──────────────────────────────────────────────────────────────
// 常量与校验（BE 设计 §4.7：⚠️ 不用 withValidation，按 /api/upload 手写范式）
// ──────────────────────────────────────────────────────────────

/** 私有归档目录（非 public，next.config 不暴露，§12.1） */
const ADS_REPORTS_DIR = path.join(process.cwd(), 'data', 'ads-reports');
/** 单文件上限 50MB（E9） */
const MAX_FILE_SIZE = 50 * 1024 * 1024;
/** 允许的扩展名 */
const ALLOWED_EXTS = ['xlsx', 'csv'];

/** 表单元数据校验（手写 Zod safeParse，失败 422 VALIDATION_ERROR） */
const UploadMetaSchema = z
  .object({
    accountId: z.string().min(1, 'accountId 不能为空'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD'),
    uploadBatchId: z.string().uuid('uploadBatchId 须为 UUID').optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: 'startDate 不能晚于 endDate' });

/** 解析结果契约（引擎 parse 模式，§6.2/§6.3；engine-client 返回） */
interface ParsedReportShape {
  columns: string[];
  rowCount: number;
  summary: Record<string, unknown>;
  rawRows: unknown[];
}
interface ParseResultOk {
  ok: true;
  reports: { search?: ParsedReportShape; targeting?: ParsedReportShape };
  consistency?: {
    spendDiffPct?: number | null;
    ordersDiffPct?: number | null;
    dateMismatch?: boolean;
    warning?: boolean;
  };
}
interface ParseResultFail {
  ok: false;
  error: { errors: string[] };
}
type ParseResult = ParseResultOk | ParseResultFail;

// ──────────────────────────────────────────────────────────────
// 文件校验（E1/E9）
// ──────────────────────────────────────────────────────────────

/** 校验文件扩展名与大小；返回 { ext, buffer } 或错误响应 */
async function validateReportFile(file: File) {
  const name = file.name || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTS.includes(ext)) {
    return { error: errorResponse(`不支持的文件类型：${name}（仅支持 xlsx/csv）`, 'INVALID_TYPE', 400) };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: errorResponse(`文件超过 50MB 上限：${name}`, 'FILE_TOO_LARGE', 400) };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  // 魔数校验（E1）：xlsx 头部 PK\x03\x04（zip 头）；csv 校验 UTF-8 可解码
  if (ext === 'xlsx') {
    const sig = [0x50, 0x4b, 0x03, 0x04];
    const ok = buffer.length >= 4 && sig.every((b, i) => buffer[i] === b);
    if (!ok) {
      return { error: errorResponse('xlsx 文件内容与声明格式不符（缺失 zip 头）', 'INVALID_MAGIC_BYTES', 400) };
    }
  } else {
    // csv：前 8KB 必须可按 UTF-8 解码（剥 BOM 由引擎做）
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, 8192));
    } catch {
      return { error: errorResponse('csv 文件不是有效的 UTF-8 文本', 'INVALID_MAGIC_BYTES', 400) };
    }
  }
  return { ext, buffer };
}

// POST /api/v1/ads/reports/upload — 双报告上传（ads:edit，multipart）
// 流程：账户校验 → 文件校验 → 私有目录落盘 → 引擎 parse → 单事务落 AdReport → 审计
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    const ok = await hasPermission(session.id, 'ads:edit');
    if (!ok) return forbiddenResponse();

    // 1. 表单解析 + 元数据校验
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse('请求体不是有效的 multipart 表单', 'VALIDATION_ERROR', 422);
    }
    const metaRaw = {
      accountId: (formData.get('accountId') as string) || '',
      startDate: (formData.get('startDate') as string) || '',
      endDate: (formData.get('endDate') as string) || '',
      uploadBatchId: (formData.get('uploadBatchId') as string) || undefined,
    };
    const metaResult = UploadMetaSchema.safeParse(metaRaw);
    if (!metaResult.success) {
      return errorResponse(
        '上传参数校验失败',
        'VALIDATION_ERROR',
        422,
        metaResult.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }))
      );
    }
    const meta = metaResult.data;

    const searchFile = formData.get('searchFile') as File | null;
    const targetingFile = formData.get('targetingFile') as File | null;
    if (!searchFile && !targetingFile) {
      return errorResponse('至少上传一份报告（searchFile 或 targetingFile）', 'NO_FILE', 422);
    }

    // 2. 账户校验（deletedAt=null，B12）；isActive=false → 422 ACCOUNT_INACTIVE
    const account = await prisma.adAccount.findUnique({ where: { id: meta.accountId } });
    if (!account || account.deletedAt) return notFoundResponse('广告账户');
    if (!account.isActive) return errorResponse('账户已停用，无法上传报告', 'ACCOUNT_INACTIVE', 422);

    // 3. 文件校验（E1/E9）
    const validated: Array<{ kind: 'search' | 'targeting'; ext: string; buffer: Buffer; originalName: string }> = [];
    if (searchFile) {
      const r = await validateReportFile(searchFile);
      if ('error' in r) return r.error;
      validated.push({ kind: 'search', ext: r.ext, buffer: r.buffer, originalName: searchFile.name });
    }
    if (targetingFile) {
      const r = await validateReportFile(targetingFile);
      if ('error' in r) return r.error;
      validated.push({ kind: 'targeting', ext: r.ext, buffer: r.buffer, originalName: targetingFile.name });
    }

    // 4. 私有目录落盘：data/ads-reports/{accountId}/{uuid}.{ext}（文件名系统生成，不沿用用户文件名，§12）
    const accountDir = path.join(ADS_REPORTS_DIR, meta.accountId);
    await mkdir(accountDir, { recursive: true });
    const archived: Array<{ kind: 'search' | 'targeting'; fileName: string; filePath: string; fileSize: number; originalName: string }> = [];
    const batchId = meta.uploadBatchId ?? randomUUID();
    try {
      for (const v of validated) {
        const fileName = `${randomUUID()}.${v.ext}`;
        const filePath = path.join(accountDir, fileName);
        await writeFile(filePath, v.buffer);
        archived.push({ kind: v.kind, fileName, filePath, fileSize: v.buffer.length, originalName: v.originalName });
      }
    } catch (error) {
      // 落盘失败：清理已写文件，避免孤儿归档
      for (const a of archived) {
        unlink(a.filePath).catch(() => {});
      }
      console.error('报告归档写入失败:', error);
      return errorResponse('报告文件保存失败', 'INTERNAL_ERROR', 500);
    }

    // 5. 引擎 parse（§6.3 runParse：searchPath/targetingPath 均为服务端生成路径）
    const searchArchived = archived.find((a) => a.kind === 'search');
    const targetingArchived = archived.find((a) => a.kind === 'targeting');
    let parseResult: ParseResult;
    try {
      parseResult = (await runParse({
        searchPath: searchArchived?.filePath,
        targetingPath: targetingArchived?.filePath,
        startDate: meta.startDate,
        endDate: meta.endDate,
      })) as ParseResult;
    } catch (error) {
      // 引擎子进程异常（非契约失败）：按 PARSE_FAILED 处理，清理归档
      for (const a of archived) unlink(a.filePath).catch(() => {});
      console.error('报告解析失败:', error);
      return errorResponse('报告解析失败（引擎异常）', 'PARSE_FAILED', 422, [
        { field: 'file', message: '报告无法解析，请检查文件格式与列名是否完整' },
      ]);
    }

    // 6. parse 失败（E1）：删除已写文件 → 422，不落库（AC-9：失败不产生脏数据）
    if (!parseResult.ok) {
      for (const a of archived) unlink(a.filePath).catch(() => {});
      const errors = (parseResult.error?.errors ?? ['报告解析失败']).map((e) => ({
        field: 'file',
        message: e,
      }));
      return errorResponse('报告解析失败：缺少必要列或数据为空', 'PARSE_FAILED', 422, errors);
    }

    // 7. 单事务落库（§11.1：两份报告同事务写入，保持 batchId 配对原子性）
    const consistency = parseResult.consistency ?? null;
    // spendDiffPct > 15 → warning（上传成功；analyze 时阻断 E4，REQ-001-6）
    const consistencyCheck = consistency
      ? {
          spendDiffPct: consistency.spendDiffPct ?? null,
          ordersDiffPct: consistency.ordersDiffPct ?? null,
          dateMismatch: consistency.dateMismatch ?? false,
          warning: consistency.warning ?? ((consistency.spendDiffPct ?? 0) > 15),
        }
      : null;

    const createdReports: Array<{ id: string; reportType: string; rowCount: number }> = [];
    try {
      await prisma.$transaction(async (tx) => {
        const build = (kind: 'search' | 'targeting', parsed: ParsedReportShape | undefined, archivedFile: typeof searchArchived) => {
          if (!parsed || !archivedFile) return;
          return {
            adAccountId: meta.accountId,
            uploadBatchId: batchId,
            reportType: kind === 'search' ? 'SEARCH_TERM' : 'TARGETING',
            source: 'MANUAL_UPLOAD',
            startDate: new Date(`${meta.startDate}T00:00:00Z`), // B11：UTC 零点
            endDate: new Date(`${meta.endDate}T00:00:00Z`),
            originalName: archivedFile.originalName,
            fileName: archivedFile.fileName,
            filePath: archivedFile.filePath,
            fileSize: archivedFile.fileSize,
            summary: parsed.summary as Prisma.InputJsonValue,
            rawRows: parsed.rawRows as Prisma.InputJsonValue,
            rowCount: parsed.rowCount,
            // 双报告都在时计算一致性；单份为 SQL NULL（Prisma Json? 字段用 DbNull）
            consistencyCheck:
              consistencyCheck && searchArchived && targetingArchived
                ? (consistencyCheck as Prisma.InputJsonValue)
                : Prisma.DbNull,
            analyzeStatus: 'UPLOADED',
          } satisfies Prisma.AdReportUncheckedCreateInput;
        };
        const searchData = build('search', parseResult.reports?.search, searchArchived);
        const targetingData = build('targeting', parseResult.reports?.targeting, targetingArchived);
        if (searchData) {
          const r = await tx.adReport.create({ data: searchData });
          createdReports.push({ id: r.id, reportType: r.reportType, rowCount: r.rowCount });
        }
        if (targetingData) {
          const r = await tx.adReport.create({ data: targetingData });
          createdReports.push({ id: r.id, reportType: r.reportType, rowCount: r.rowCount });
        }
      });
    } catch (error) {
      // 事务失败：整体回滚（无半截报告），清理归档文件
      for (const a of archived) unlink(a.filePath).catch(() => {});
      console.error('报告落库失败:', error);
      return errorResponse('报告保存失败', 'INTERNAL_ERROR', 500);
    }

    // 8. 审计（每份报告一条 UPLOAD，details 含 batchId/rowCount/一致性摘要，§10）
    const warnings: string[] = [];
    if (consistencyCheck) {
      if (consistencyCheck.dateMismatch) warnings.push('报告内数据日期与填写日期不一致');
      if (consistencyCheck.warning) warnings.push('双报告花费口径偏差超过 15%，分析时将阻断');
    }
    for (const r of createdReports) {
      await writeAdsAuditLog({
        action: 'UPLOAD',
        entityType: 'AdReport',
        entityId: r.id,
        userId: session.id,
        details: {
          batchId,
          files: validated.map((v) => v.originalName),
          reportType: r.reportType,
          rowCount: r.rowCount,
          consistency: consistencyCheck,
        },
        request,
      });
    }

    // 9. 201 响应（§17-6：uploadBatchId, reports, warnings）
    return createdResponse(
      {
        uploadBatchId: batchId,
        reports: createdReports,
        warnings,
        consistencyCheck,
      },
      '报告上传成功'
    );
  } catch (error) {
    console.error('报告上传失败:', error);
    return errorResponse('报告上传失败', 'INTERNAL_ERROR', 500);
  }
}
