'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Save,
  Globe,
  Languages,
  Loader2,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionDivider } from './SectionDivider';

import { BasicInfoSection } from './sections/BasicInfoSection';
import { ImageSection } from './sections/ImageSection';
import { PriceSection } from './sections/PriceSection';
import { AttributesSection } from './sections/AttributesSection';
import { VariantsSection } from './sections/VariantsSection';
import { DescriptionSection } from './sections/DescriptionSection';
import { ShippingSection } from './sections/ShippingSection';
import { SupplierSection } from './sections/SupplierSection';
import { CertificationSection } from './sections/CertificationSection';

import { PipelineStatus } from './sidepanel/PipelineStatus';
import { CollectedInfo } from './sidepanel/CollectedInfo';
import { PublishHistory } from './sidepanel/PublishHistory';

import type { EditPageState, EditPageAction, ProductDetail, ProductFormData } from './types';

interface EditPageLayoutProps {
  state: EditPageState;
  dispatch: React.Dispatch<EditPageAction>;
  id: string;
  onSave: () => void;
  onTranslate: () => void;
  onPublish: () => void;
  onConvert: () => void;
  onBack: () => void;
  onRefresh: () => void;
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'published': return 'bg-green-100 text-green-700 border-green-200';
    case 'error': return 'bg-red-100 text-red-700 border-red-200';
    case 'ready': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    case 'discarded': return 'bg-gray-100 text-gray-400 border-gray-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function EditPageLayout({
  state,
  dispatch,
  id,
  onSave,
  onTranslate,
  onPublish,
  onConvert,
  onBack,
  onRefresh,
}: EditPageLayoutProps) {
  const { form, product, loading, saving, publishing, translating, error, toastMessage, toastType } = state;
  const canPublish = form.pipelineStatus === 'ready' || form.pipelineStatus === 'error';
  const isPublished = form.pipelineStatus === 'published';

  // Loading state
  if (loading) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">加载中...</span>
        </div>
      </div>
    );
  }

  // Error state (no product)
  if (!product && error) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 返回列表
          </Button>
        </div>
        <div className="text-center py-12">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      {/* ===== 顶栏操作区 ===== */}
      <div className="sticky top-0 z-10 bg-white pb-4 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 border-b border-gray-100 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-1" /> 返回
            </Button>
            <h1 className="text-base font-semibold truncate max-w-md">
              {form.titleEn || form.title || '无标题'}
            </h1>
            {form.pipelineStatus && (
              <Badge variant="outline" className={`text-xs shrink-0 ${getStatusBadgeClasses(form.pipelineStatus)}`}>
                {form.pipelineStatus}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              title="刷新"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onTranslate}
              disabled={translating}
            >
              <Languages className="h-4 w-4 mr-1" />
              {translating ? '翻译中...' : 'AI 翻译'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? '保存中...' : '保存'}
            </Button>
            {canPublish && (
              <Button size="sm" onClick={onPublish} disabled={publishing}>
                <Globe className="h-4 w-4 mr-1" />
                {publishing ? '发布中...' : '发布'}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {!form.productId && (
                  <DropdownMenuItem onClick={onConvert}>
                    转为正式产品
                  </DropdownMenuItem>
                )}
                {isPublished && (
                  <DropdownMenuItem onClick={onPublish}>
                    同步到独立站
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ===== Toast 消息 ===== */}
      {(toastMessage || error) && (
        <div
          className={`mb-4 px-4 py-2 rounded-md text-sm flex items-center gap-2 ${
            toastType === 'error' || (error && !toastMessage)
              ? 'bg-red-50 text-red-700'
              : toastType === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {toastType === 'success' ? '✅' : '⚠️'}
          <span>{toastMessage || error}</span>
          <button
            className="ml-auto text-xs hover:opacity-70"
            onClick={() => {
              dispatch({ type: 'CLEAR_TOAST' });
              dispatch({ type: 'SET_ERROR', payload: null });
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ===== 主内容区：左侧表单 + 右侧面板 ===== */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ----- 左侧表单 (2/3) ----- */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Section 1: 基本信息 */}
          <SectionDivider title="1. 基本信息" icon="📋" />
          <BasicInfoSection form={form} dispatch={dispatch} product={product} />

          {/* Section 2: 产品图片 */}
          <SectionDivider title="2. 产品图片" icon="🖼️" />
          <ImageSection images={form.images} dispatch={dispatch} />

          {/* Section 3: 价格信息 */}
          <SectionDivider title="3. 价格信息" icon="💲" />
          <PriceSection form={form} dispatch={dispatch} product={product} />

          {/* Section 4: 规格属性 */}
          <SectionDivider title="4. 规格属性" icon="🏷️" />
          <AttributesSection attributes={form.attributes} dispatch={dispatch} />

          {/* Section 5: 变体/规格 */}
          <SectionDivider title="5. 变体/规格" icon="🔀" />
          <VariantsSection variants={form.variants} dispatch={dispatch} />

          {/* Section 6: 描述详情 */}
          <SectionDivider title="6. 描述详情" icon="📝" />
          <DescriptionSection form={form} dispatch={dispatch} />

          {/* Section 7: 物流信息 */}
          <SectionDivider title="7. 物流信息" icon="🚚" />
          <ShippingSection form={form} dispatch={dispatch} />

          {/* Section 8: 供应商信息 */}
          <SectionDivider title="8. 供应商信息" icon="🏢" />
          <SupplierSection form={form} dispatch={dispatch} product={product} />

          {/* Section 9: 认证信息 */}
          <SectionDivider title="9. 认证信息" icon="✅" />
          <CertificationSection
            certifications={form.certifications}
            dispatch={dispatch}
          />

          {/* 底部操作栏 */}
          <div className="flex items-center gap-2 pt-6 pb-12 border-t border-gray-200 mt-8">
            {!form.productId && (
              <Button variant="outline" size="sm" onClick={onConvert}>
                转为正式产品
              </Button>
            )}
            {canPublish && (
              <Button size="sm" onClick={onPublish} disabled={publishing}>
                <Globe className="h-4 w-4 mr-1" />
                {publishing ? '发布中...' : '发布到独立站'}
              </Button>
            )}
            {form.productId && (
              <span className="text-xs text-gray-400 ml-2">
                已关联正式产品 ID: {form.productId}
              </span>
            )}
          </div>
        </div>

        {/* ----- 右侧状态面板 (1/3) ----- */}
        <aside className="w-full lg:w-80 xl:w-96 lg:sticky lg:top-20 lg:self-start max-lg:border-t max-lg:pt-4 max-lg:mt-4">
          <div className="space-y-6">
            <Separator className="lg:hidden" />
            <PipelineStatus status={form.pipelineStatus} />
            <Separator />
            <CollectedInfo product={product} />
            <Separator />
            <PublishHistory product={product} />
          </div>
        </aside>
      </div>
    </div>
  );
}
