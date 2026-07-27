'use client';

import { useReducer, useCallback } from 'react';
import type {
  EditPageState,
  EditPageAction,
  ProductFormData,
  ProductDetail,
  EditableImage,
  EditableAttribute,
  EditableVariant,
} from '../types';

const initialFormData: ProductFormData = {
  title: '', titleEn: '', brand: '', sku: '', source: '', sourceUrl: '', sourceId: null,
  images: [],
  price: null, compareAtPrice: null, currency: 'USD', stockQuantity: null,
  attributes: [],
  variants: [],
  shortDescription: '', description: '', descriptionEn: '',
  weight: null, length: null, width: null, height: null,
  shippingClass: '', hsCode: '',
  pipelineStatus: 'collected',
  woocommerceId: null, woocommerceUrl: null, productId: null,
  publishError: null, collectedAt: '',
  certifications: [], tags: [],
  metaTitle: '', metaDescription: '', urlSlug: '',
  woocommerceCategoryId: null,
};

const initialState: EditPageState = {
  product: null,
  form: initialFormData,
  loading: true,
  saving: false,
  publishing: false,
  translating: false,
  error: null,
  toastMessage: null,
  toastType: null,
  sidePanelCollapsed: false,
  dragActive: false,
};

function editPageReducer(state: EditPageState, action: EditPageAction): EditPageState {
  switch (action.type) {
    // === 初始化 ===
    case 'INIT_PRODUCT':
      return {
        ...state,
        product: action.payload,
        form: mapProductToForm(action.payload),
        loading: false,
        error: null,
      };

    // === 通用字段 ===
    case 'UPDATE_FIELD':
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
      };

    // === 图片 ===
    case 'REORDER_IMAGE': {
      const images = [...state.form.images];
      const [moved] = images.splice(action.fromIndex, 1);
      images.splice(action.toIndex, 0, moved);
      const reordered = images.map((img, i) => ({
        ...img,
        sortOrder: i,
        type: i === 0 ? 'main' as const : (img.type === 'main' ? 'gallery' as const : img.type),
      }));
      return { ...state, form: { ...state.form, images: reordered } };
    }
    case 'REMOVE_IMAGE': {
      let images = state.form.images.filter((_, i) => i !== action.index);
      if (images.length > 0 && images[0].type !== 'main') {
        images = images.map((img, i) => i === 0 ? { ...img, type: 'main' as const } : img);
      }
      return { ...state, form: { ...state.form, images } };
    }
    case 'ADD_IMAGES':
      return {
        ...state,
        form: {
          ...state.form,
          images: [
            ...state.form.images,
            ...action.images.map((img, i) => ({
              ...img,
              sortOrder: state.form.images.length + i,
            })),
          ],
        },
      };
    case 'SET_MAIN_IMAGE': {
      const images = state.form.images.map((img, i) => ({
        ...img,
        type: i === action.index ? 'main' as const : (img.type === 'main' ? 'gallery' as const : img.type),
      }));
      return { ...state, form: { ...state.form, images } };
    }
    case 'UPDATE_IMAGE': {
      const images = state.form.images.map((img, i) =>
        i === action.index ? { ...img, [action.field]: action.value } : img
      );
      return { ...state, form: { ...state.form, images } };
    }

    // === 属性 ===
    case 'UPDATE_ATTRIBUTE': {
      const attributes = state.form.attributes.map((attr, i) =>
        i === action.index ? { ...attr, [action.field]: action.value } : attr
      );
      return { ...state, form: { ...state.form, attributes } };
    }
    case 'ADD_ATTRIBUTE':
      return {
        ...state,
        form: {
          ...state.form,
          attributes: [
            ...state.form.attributes,
            { name: '', value: '', unit: '', sortOrder: state.form.attributes.length },
          ],
        },
      };
    case 'DELETE_ATTRIBUTE': {
      const attributes = state.form.attributes
        .filter((_, i) => i !== action.index)
        .map((a, i) => ({ ...a, sortOrder: i }));
      return { ...state, form: { ...state.form, attributes } };
    }
    case 'REORDER_ATTRIBUTES': {
      const attrs = [...state.form.attributes];
      const [moved] = attrs.splice(action.fromIndex, 1);
      attrs.splice(action.toIndex, 0, moved);
      return {
        ...state,
        form: { ...state.form, attributes: attrs.map((a, i) => ({ ...a, sortOrder: i })) },
      };
    }

    // === 变体 ===
    case 'UPDATE_VARIANT': {
      const variants = state.form.variants.map((v, i) =>
        i === action.index ? { ...v, [action.field]: action.value } : v
      );
      return { ...state, form: { ...state.form, variants } };
    }
    case 'ADD_VARIANT':
      return {
        ...state,
        form: {
          ...state.form,
          variants: [
            ...state.form.variants,
            { sku: '', price: null, stock: null, options: [] },
          ],
        },
      };
    case 'DELETE_VARIANT': {
      const variants = state.form.variants.filter((_, i) => i !== action.index);
      return { ...state, form: { ...state.form, variants } };
    }
    case 'SET_VARIANTS':
      return { ...state, form: { ...state.form, variants: action.variants } };
    case 'UPDATE_VARIANT_OPTION': {
      const variants = state.form.variants.map((v, i) => {
        if (i !== action.index) return v;
        const options = v.options.map((opt, oi) =>
          oi === action.optionIndex ? { ...opt, [action.field]: action.value } : opt
        );
        return { ...v, options };
      });
      return { ...state, form: { ...state.form, variants } };
    }
    case 'SET_VARIANT_GROUPS': {
      const combinations = generateCombinations(action.groups);
      const variants: EditableVariant[] = combinations.map((combo, i) => ({
        sku: `VAR-${String(i + 1).padStart(3, '0')}`,
        price: state.form.price,
        stock: 0,
        options: combo,
      }));
      return { ...state, form: { ...state.form, variants } };
    }

    // === 认证 ===
    case 'TOGGLE_CERT': {
      const certs = getCertsFromState(state.form);
      const newCerts = certs.includes(action.cert)
        ? certs.filter(c => c !== action.cert)
        : [...certs, action.cert];
      return applyCertsToState(state, newCerts);
    }
    case 'ADD_CERT': {
      const certs = getCertsFromState(state.form);
      if (!certs.includes(action.name)) {
        return applyCertsToState(state, [...certs, action.name]);
      }
      return state;
    }
    case 'REMOVE_CERT': {
      const certs = getCertsFromState(state.form).filter(c => c !== action.name);
      return applyCertsToState(state, certs);
    }

    // === UI ===
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SAVING':
      return { ...state, saving: action.payload };
    case 'SET_PUBLISHING':
      return { ...state, publishing: action.payload };
    case 'SET_TRANSLATING':
      return { ...state, translating: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_TOAST':
      return { ...state, toastMessage: action.message, toastType: action.toastType };
    case 'CLEAR_TOAST':
      return { ...state, toastMessage: null, toastType: null };
    case 'APPLY_TRANSLATION':
      return {
        ...state,
        form: { ...state.form, ...action.payload },
      };
    case 'TOGGLE_SIDE_PANEL':
      return { ...state, sidePanelCollapsed: !state.sidePanelCollapsed };
    case 'SET_DRAG_ACTIVE':
      return { ...state, dragActive: action.payload };

    default:
      return state;
  }
}

/** 将 ProductDetail API 响应映射为表单数据 */
function mapProductToForm(product: ProductDetail): ProductFormData {
  return {
    title: product.title || '',
    titleEn: product.titleEn || '',
    brand: product.brand || '',
    sku: product.sku || '',
    source: product.source || '',
    sourceUrl: product.sourceUrl || '',
    sourceId: product.sourceId || null,
    images: (product.images || []).map((img: any, i: number) => ({
      id: img.id,
      type: img.type || (i === 0 ? 'main' : 'gallery'),
      dataUrl: img.dataUrl || '',
      originalUrl: img.originalUrl || '',
      mimeType: img.mimeType || 'image/jpeg',
      fileName: img.fileName || `image_${i + 1}.jpg`,
      sortOrder: img.sortOrder ?? i,
      altText: img.altText || '',
      fileSize: img.fileSize,
      width: img.width,
      height: img.height,
    })),
    price: product.price ? Number(product.price) : null,
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    currency: product.currency || 'USD',
    stockQuantity: product.stockQuantity ?? null,
    attributes: (product.attributes || []).map((a: any, i: number) => ({
      id: a.id,
      name: a.name || '',
      value: a.value || '',
      unit: a.unit || '',
      sortOrder: a.sortOrder ?? i,
    })),
    variants: (product.variants || []).map((v: any) => ({
      id: v.id,
      sku: v.sku || '',
      price: v.price ? Number(v.price) : null,
      stock: v.stock ?? null,
      options: v.options || [],
      imageId: v.imageId,
    })),
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    descriptionEn: product.descriptionEn || '',
    weight: product.weight ? Number(product.weight) : null,
    length: product.length ? Number(product.length) : null,
    width: product.width ? Number(product.width) : null,
    height: product.height ? Number(product.height) : null,
    shippingClass: product.shippingClass || '',
    hsCode: product.hsCode || '',
    pipelineStatus: product.pipelineStatus || 'collected',
    woocommerceId: product.woocommerceId ?? null,
    woocommerceUrl: product.woocommerceUrl || null,
    productId: product.productId || null,
    publishError: product.publishError || null,
    collectedAt: product.collectedAt || '',
    certifications: product.certifications || [],
    tags: product.tags || [],
    metaTitle: product.metaTitle || '',
    metaDescription: product.metaDescription || '',
    urlSlug: product.urlSlug || '',
    woocommerceCategoryId: product.woocommerceCategoryId ?? null,
  };
}

/** 生成笛卡尔积组合 */
function generateCombinations(
  groups: { name: string; values: string[] }[]
): { name: string; value: string }[][] {
  if (groups.length === 0) return [];
  const result: { name: string; value: string }[][] = [];
  function backtrack(index: number, current: { name: string; value: string }[]) {
    if (index === groups.length) {
      result.push([...current]);
      return;
    }
    for (const val of groups[index].values) {
      current.push({ name: groups[index].name, value: val });
      backtrack(index + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

function getCertsFromState(form: ProductFormData): string[] {
  return form.certifications || [];
}

function applyCertsToState(state: EditPageState, certs: string[]): EditPageState {
  return {
    ...state,
    form: { ...state.form, certifications: certs },
  };
}

export function useEditForm() {
  const [state, dispatch] = useReducer(editPageReducer, initialState);

  const loadProduct = useCallback(async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const resp = await fetch(`/api/collected-products/${id}`);
      const data = await resp.json();
      if (data.success && data.data) {
        dispatch({ type: 'INIT_PRODUCT', payload: data.data });
      } else {
        dispatch({ type: 'SET_ERROR', payload: '产品不存在' });
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: '加载失败: ' + (e as Error).message });
    }
  }, []);

  const handleSave = useCallback(async (id: string) => {
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      const resp = await fetch(`/api/collected-products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.form),
      });
      const data = await resp.json();
      if (data.success) {
        dispatch({ type: 'SET_TOAST', message: '保存成功', toastType: 'success' });
        dispatch({ type: 'UPDATE_FIELD', field: 'pipelineStatus', value: 'ready' as any });
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: data.message || '保存失败' });
        return false;
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: '保存失败' });
      return false;
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.form]);

  const handleTranslate = useCallback(async (id: string) => {
    dispatch({ type: 'SET_TRANSLATING', payload: true });
    try {
      const resp = await fetch(`/api/collected-products/${id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: ['title', 'description', 'shortDescription'] }),
      });
      const data = await resp.json();
      if (data.success) {
        dispatch({ type: 'APPLY_TRANSLATION', payload: data.data });
        dispatch({ type: 'SET_TOAST', message: '翻译完成，请检查后保存', toastType: 'success' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: data.message || '翻译失败' });
      }
    } finally {
      dispatch({ type: 'SET_TRANSLATING', payload: false });
    }
  }, []);

  const handlePublish = useCallback(async (id: string) => {
    dispatch({ type: 'SET_PUBLISHING', payload: true });
    try {
      // 先保存
      const saved = await handleSave(id);
      if (!saved) return false;

      const resp = await fetch(`/api/collected-products/${id}/publish`, {
        method: 'POST',
      });
      const data = await resp.json();
      if (data.success) {
        dispatch({
          type: 'APPLY_TRANSLATION',
          payload: {
            pipelineStatus: 'published' as any,
            woocommerceId: data.data?.woocommerceId ?? null,
            woocommerceUrl: data.data?.woocommerceUrl ?? null,
          },
        });
        dispatch({ type: 'SET_TOAST', message: '发布成功', toastType: 'success' });
        return true;
      } else {
        const errMsg = data.data?.publishError || '发布失败';
        dispatch({ type: 'SET_ERROR', payload: errMsg });
        return false;
      }
    } finally {
      dispatch({ type: 'SET_PUBLISHING', payload: false });
    }
  }, [handleSave]);

  const handleConvert = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`/api/collected-products/${id}/convert`, {
        method: 'POST',
      });
      const data = await resp.json();
      if (data.success) {
        dispatch({ type: 'UPDATE_FIELD', field: 'productId' as any, value: data.data.productId });
        dispatch({ type: 'SET_TOAST', message: '已转为正式产品', toastType: 'success' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: '转正失败' });
      }
    } catch {
      dispatch({ type: 'SET_ERROR', payload: '转正失败' });
    }
  }, []);

  const isDirty = state.product
    ? JSON.stringify(state.form) !== JSON.stringify(mapProductToForm(state.product))
    : false;

  return {
    state,
    dispatch,
    loadProduct,
    handleSave,
    handleTranslate,
    handlePublish,
    handleConvert,
    isDirty,
  };
}
