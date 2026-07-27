'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Star, Plus } from 'lucide-react';
import type { EditableImage, EditPageAction } from '../types';

interface ImageSectionProps {
  images: EditableImage[];
  dispatch: React.Dispatch<EditPageAction>;
}

export function ImageSection({ images, dispatch }: ImageSectionProps) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: EditableImage[] = Array.from(files).map((file, i) => ({
      type: 'gallery' as const,
      dataUrl: URL.createObjectURL(file),
      originalUrl: '',
      mimeType: file.type,
      fileName: file.name,
      sortOrder: images.length + i,
      altText: '',
      fileSize: file.size,
    }));
    dispatch({ type: 'ADD_IMAGES', images: newImages });
    e.target.value = '';
  };

  if (images.length === 0) {
    return (
      <div className="space-y-3">
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
          暂无图片
        </div>
        <div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="image-upload-input"
          />
          <Button variant="outline" size="sm" asChild>
            <label htmlFor="image-upload-input" className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" /> 添加图片
            </label>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, index) => (
          <div key={img.id || index} className="relative group">
            {img.dataUrl ? (
              <img
                src={img.dataUrl}
                alt={img.altText || ''}
                className="w-full aspect-square object-cover rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-xs">
                无数据
              </div>
            )}
            {/* 类型标签 */}
            <Badge
              variant="secondary"
              className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0"
            >
              {img.type}
            </Badge>
            {/* 主图标记 */}
            {img.type === 'main' && (
              <div className="absolute top-1.5 right-1.5">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              </div>
            )}
            {/* 操作悬停层 */}
            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {img.type !== 'main' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-yellow-300"
                  onClick={() => dispatch({ type: 'SET_MAIN_IMAGE', index })}
                  title="设为主图"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:text-red-300"
                onClick={() => dispatch({ type: 'REMOVE_IMAGE', index })}
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* 排序序号 */}
            <span className="absolute bottom-1.5 right-1.5 text-[10px] text-gray-400 bg-white/80 rounded px-1">
              #{img.sortOrder + 1}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          id="image-upload-input"
        />
        <Button variant="outline" size="sm" asChild>
          <label htmlFor="image-upload-input" className="cursor-pointer">
            <Plus className="h-4 w-4 mr-1" /> 添加图片
          </label>
        </Button>
        <span className="text-xs text-gray-400">
          {images.length} 张图片 · 点击设为主图
        </span>
      </div>
    </div>
  );
}
