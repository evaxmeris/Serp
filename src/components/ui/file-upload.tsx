'use client';

/**
 * 文件上传组件 — 图片上传（营业执照、身份证等）
 * 
 * Props:
 * - currentUrl: 当前已上传的图片 URL
 * - onUpload(url): 上传成功回调
 * - accept: 接受的文件类型 (默认 "image/*")
 * 
 * 限制：单文件 ≤ 500KB，仅支持 JPG/PNG/WebP
 */

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

interface FileUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  accept?: string;
}

export function FileUpload({ currentUrl, onUpload, accept = 'image/*' }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 客户端校验
    if (file.size > 500 * 1024) {
      setError('文件不能超过 500KB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG/PNG/WebP 格式');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setPreview(data.data.url);
        onUpload(data.data.url);
      } else {
        setError(data.error || '上传失败');
      }
    } catch {
      setError('网络错误，上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUpload('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative border rounded-md p-1 bg-gray-50">
          <img
            src={preview}
            alt="预览"
            className="max-h-28 object-contain rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
            title="移除"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 rounded-md p-4 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              上传中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              点击上传 (≤500KB)
            </span>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
