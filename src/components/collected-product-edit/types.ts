/** 编辑页完整状态 */
export interface EditPageState {
  // 从 API 加载的原始产品数据（用于比较 dirty）
  product: ProductDetail | null;

  // 编辑中的表单数据
  form: ProductFormData;

  // UI 状态
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  translating: boolean;
  error: string | null;
  toastMessage: string | null;
  toastType: 'success' | 'error' | null;
  sidePanelCollapsed: boolean;
  dragActive: boolean;
}

/** 表单数据结构 */
export interface ProductFormData {
  // Section 1: 基本信息
  title: string;
  titleEn: string;
  brand: string;
  sku: string;
  source: string;
  sourceUrl: string;
  sourceId: string | null;

  // Section 2: 图片
  images: EditableImage[];

  // Section 3: 价格
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  stockQuantity: number | null;

  // Section 4: 属性
  attributes: EditableAttribute[];

  // Section 5: 变体
  variants: EditableVariant[];

  // Section 6: 描述
  shortDescription: string;
  description: string;
  descriptionEn: string;

  // Section 7: 物流
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shippingClass: string;
  hsCode: string;

  // 管线状态
  pipelineStatus: string;
  woocommerceId: number | null;
  woocommerceUrl: string | null;
  productId: string | null;
  publishError: string | null;
  collectedAt: string;

  // 认证列表
  certifications: string[];
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  urlSlug: string;
  woocommerceCategoryId: number | null;
}

export interface EditableImage {
  id?: string;
  type: 'main' | 'gallery' | 'detail';
  dataUrl: string;
  originalUrl: string;
  mimeType: string;
  fileName: string;
  sortOrder: number;
  altText: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface EditableAttribute {
  id?: string;
  name: string;
  value: string;
  unit: string;
  sortOrder: number;
}

export interface EditableVariant {
  id?: string;
  sku: string;
  price: number | null;
  stock: number | null;
  options: { name: string; value: string }[];
  imageId?: string;
}

/** API 返回的完整产品详情 */
export interface ProductDetail {
  id: string;
  source: string;
  sourceUrl: string;
  sourceId: string | null;
  title: string;
  titleEn: string | null;
  shortDescription: string | null;
  description: string | null;
  descriptionEn: string | null;
  brand: string | null;
  sku: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  stockQuantity: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shippingClass: string | null;
  hsCode: string | null;
  pipelineStatus: string;
  woocommerceId: number | null;
  woocommerceUrl: string | null;
  productId: string | null;
  publishError: string | null;
  collectedAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  publishLogs: PublishLog[];
  rawData: Record<string, any> | null;
  metaTitle?: string;
  metaDescription?: string;
  urlSlug?: string;
  tags?: string[];
  woocommerceCategoryId?: number | null;
  certifications?: string[];
}

export interface ProductImage {
  id: string;
  type: 'main' | 'gallery' | 'detail';
  dataUrl: string;
  originalUrl: string;
  mimeType: string;
  fileName: string;
  sortOrder: number;
  altText: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  price: number | null;
  stock: number | null;
  options: { name: string; value: string }[];
  imageId?: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  sortOrder: number;
}

export interface PublishLog {
  id: string;
  action: string;
  status: string;
  woocommerceId?: number;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
}

export type EditPageAction =
  // 初始化
  | { type: 'INIT_PRODUCT'; payload: ProductDetail }

  // 通用字段更新
  | { type: 'UPDATE_FIELD'; field: keyof ProductFormData; value: any }

  // Section 2: 图片
  | { type: 'REORDER_IMAGE'; fromIndex: number; toIndex: number }
  | { type: 'REMOVE_IMAGE'; index: number }
  | { type: 'ADD_IMAGES'; images: EditableImage[] }
  | { type: 'SET_MAIN_IMAGE'; index: number }
  | { type: 'UPDATE_IMAGE'; index: number; field: string; value: any }

  // Section 4: 属性
  | { type: 'UPDATE_ATTRIBUTE'; index: number; field: 'name' | 'value' | 'unit'; value: string }
  | { type: 'ADD_ATTRIBUTE' }
  | { type: 'DELETE_ATTRIBUTE'; index: number }
  | { type: 'REORDER_ATTRIBUTES'; fromIndex: number; toIndex: number }

  // Section 5: 变体
  | { type: 'UPDATE_VARIANT'; index: number; field: 'sku' | 'price' | 'stock'; value: any }
  | { type: 'UPDATE_VARIANT_OPTION'; index: number; optionIndex: number; field: 'name' | 'value'; value: string }
  | { type: 'ADD_VARIANT' }
  | { type: 'DELETE_VARIANT'; index: number }
  | { type: 'SET_VARIANTS'; variants: EditableVariant[] }
  | { type: 'SET_VARIANT_GROUPS'; groups: { name: string; values: string[] }[] }

  // Section 9: 认证
  | { type: 'TOGGLE_CERT'; cert: string }
  | { type: 'ADD_CERT'; name: string }
  | { type: 'REMOVE_CERT'; name: string }

  // UI 控制
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_PUBLISHING'; payload: boolean }
  | { type: 'SET_TRANSLATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TOAST'; message: string; toastType: 'success' | 'error' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'APPLY_TRANSLATION'; payload: Partial<ProductFormData> }
  | { type: 'TOGGLE_SIDE_PANEL' }
  | { type: 'SET_DRAG_ACTIVE'; payload: boolean };

export const PIPELINE_STEPS = [
  { key: 'collected', label: '已采集', step: 0 },
  { key: 'organizing', label: '梳理中', step: 1 },
  { key: 'ready', label: '已就绪', step: 2 },
  { key: 'published', label: '已发布', step: 3 },
] as const;

export const DEFAULT_CERTIFICATIONS = ['FDA', 'MSDS', 'GMP', 'ISO', 'COA'] as const;

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD $' },
  { value: 'CNY', label: 'CNY ¥' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
  { value: 'JPY', label: 'JPY ¥' },
] as const;
