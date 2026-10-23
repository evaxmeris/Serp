'use client';

/**
 * 广告域通用文件选择件（与 ui/file-upload.tsx 图片语义不同）
 *
 * 职责：xlsx/csv 双报告文件选择——受控 File 对象回传（非 URL，由
 *       ReportUploadCard 组装 multipart 一次提交），客户端预校验扩展名
 *       + ≤50MB（E9 前置），点击/拖拽选择，可移除。
 * 注意：不校验文件内容（列名探测等由后端引擎 parse 完成，E1 由后端返回）。
 */

import { useRef, useState } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtFileSize } from './shared';

export interface AdsFileUploadProps {
  /** 「搜索词报告」/「Targeting 报告」 */
  label: string;
  /** 默认 '.xlsx,.csv' */
  accept?: string;
  /** 受控：当前选中文件 */
  file: File | null;
  onChange: (f: File | null) => void;
  /** 默认 50（MB） */
  maxSizeMB?: number;
  hint?: string;
}

const EXT_WHITELIST = ['xlsx', 'csv'];

/** 客户端预校验（E1/E9 前置）：扩展名白名单 + 大小上限，不校验内容 */
function validateFile(f: File, maxSizeMB: number): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase();
  if (!ext || !EXT_WHITELIST.includes(ext)) return '仅支持 xlsx/csv 格式';
  if (f.size > maxSizeMB * 1024 * 1024) return `文件不能超过 ${maxSizeMB}MB`;
  return null;
}

export function FileUpload({
  label,
  accept = '.xlsx,.csv',
  file,
  onChange,
  maxSizeMB = 50,
  hint,
}: AdsFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 通过校验才回传；校验失败只提示不落状态（保留用户可重选） */
  const pick = (f: File | null) => {
    if (!f) return;
    const msg = validateFile(f, maxSizeMB);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    onChange(f);
  };

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>

      {file ? (
        // 已选中：文件名 + 大小 + 移除
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </div>
              <div className="text-xs text-muted-foreground">{fmtFileSize(file.size)}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={`移除${label}`}
            onClick={() => {
              onChange(null);
              setError(null);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        // 虚线拖拽区（点击触发隐藏 input）
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-5 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <FileSpreadsheet className="size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">点击选择或拖拽文件</span>
          <span className="text-xs text-muted-foreground/70">{hint ?? `xlsx/csv，≤${maxSizeMB}MB`}</span>
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 隐藏 input：每次选择后重置 value，保证重复选同一文件也能触发 onChange */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </div>
  );
}
