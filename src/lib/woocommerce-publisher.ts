/**
 * WooCommerce 发布服务
 * 
 * 使用原生 fetch 调用 WooCommerce REST API，无外部依赖。
 */

import { cleanProductHtml } from './html-cleaner';

interface WooCommerceConfig {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface PublishResult {
  success: boolean;
  woocommerceId?: number;
  woocommerceUrl?: string;
  error?: string;
  requestData?: any;
  responseData?: any;
  durationMs: number;
}

export class WooCommercePublisher {
  private baseUrl: string;
  private auth: string;

  constructor(config: WooCommerceConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    // WooCommerce REST API 支持 Basic Auth (consumer key:consumer secret)
    this.auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  }

  private get apiBase() {
    return `${this.baseUrl}/wp-json/wc/v3`;
  }

  /**
   * 创建产品到 WooCommerce
   */
  async create(product: any): Promise<PublishResult> {
    const startTime = Date.now();
    try {
      const productData = await this.buildProductData(product, false);
      const resp = await fetch(`${this.apiBase}/products`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(productData),
      });
      const body = await resp.json();
      const durationMs = Date.now() - startTime;

      if (resp.ok && body.id) {
        // 如果有多规格，创建变体
        if (product.variants?.length > 0) {
          await this.createVariations(body.id, product);
        }
        return {
          success: true,
          woocommerceId: body.id,
          woocommerceUrl: body.permalink || null,
          requestData: productData,
          responseData: body,
          durationMs,
        };
      }
      return {
        success: false,
        error: body.message || JSON.stringify(body),
        requestData: productData,
        responseData: body,
        durationMs,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 更新已有产品到 WooCommerce
   */
  async update(product: any): Promise<PublishResult> {
    const startTime = Date.now();
    try {
      const productData = await this.buildProductData(product, true);
      const resp = await fetch(`${this.apiBase}/products/${product.woocommerceId}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(productData),
      });
      const body = await resp.json();
      const durationMs = Date.now() - startTime;

      if (resp.ok && body.id) {
        return {
          success: true,
          woocommerceId: body.id,
          woocommerceUrl: body.permalink || null,
          requestData: productData,
          responseData: body,
          durationMs,
        };
      }
      return {
        success: false,
        error: body.message || JSON.stringify(body),
        requestData: productData,
        responseData: body,
        durationMs,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${this.auth}`,
    };
  }

  /**
   * 构建 WooCommerce 产品数据
   */
  private async buildProductData(product: any, isUpdate: boolean): Promise<any> {
    const data: any = {
      name: product.titleEn || product.title,
      type: product.variants?.length > 0 ? 'variable' : 'simple',
      status: 'publish',
    };

    if (product.descriptionEn) data.description = cleanProductHtml(product.descriptionEn, product.source);
    else if (product.description) data.description = cleanProductHtml(product.description, product.source);

    if (product.shortDescription) data.short_description = product.shortDescription;
    if (product.sku) data.sku = product.sku;
    if (product.price) data.regular_price = String(product.price);
    if (product.compareAtPrice) data.sale_price = String(product.compareAtPrice);
    if (product.weight) data.weight = String(product.weight);

    if (product.length || product.width || product.height) {
      data.dimensions = {
        length: product.length ? String(product.length) : '',
        width: product.width ? String(product.width) : '',
        height: product.height ? String(product.height) : '',
      };
    }

    // 元数据
    data.meta_data = [
      { key: '_collected_from', value: product.source || '' },
      { key: '_collected_source_url', value: product.sourceUrl || '' },
    ];
    if (product.productId) {
      data.meta_data.push({ key: '_erp_product_id', value: product.productId });
    }

    // 分类
    if (product.woocommerceCategoryId) {
      data.categories = [{ id: product.woocommerceCategoryId }];
    }

    // 标签
    if (product.tags?.length > 0) {
      data.tags = product.tags.map((t: string) => ({ name: t }));
    }

    // 图片（仅首次创建时上传）
    if (!isUpdate && product.images?.length > 0) {
      const images = await this.uploadImages(product.images);
      if (images.length > 0) {
        data.images = images;
      }
    }

    // 属性（用于变体）
    if (product.variants?.length > 0) {
      data.attributes = this.extractVariantAttributes(product.variants);
    }

    return data;
  }

  /**
   * 提取变体属性
   */
  private extractVariantAttributes(variants: any[]): any[] {
    const attrMap = new Map<string, Set<string>>();
    for (const v of variants) {
      if (v.options) {
        const opts = typeof v.options === 'string' ? JSON.parse(v.options) : v.options;
        if (Array.isArray(opts)) {
          for (const opt of opts) {
            if (!attrMap.has(opt.name)) attrMap.set(opt.name, new Set());
            attrMap.get(opt.name)!.add(opt.value);
          }
        }
      }
    }
    return Array.from(attrMap.entries()).map(([name, values]) => ({
      name,
      options: Array.from(values),
      variation: true,
    }));
  }

  /**
   * 创建变体
   */
  private async createVariations(parentId: number, product: any): Promise<void> {
    for (const v of product.variants) {
      const opts = typeof v.options === 'string' ? JSON.parse(v.options) : v.options;
      const attributes = Array.isArray(opts)
        ? opts.map((o: any) => ({ name: o.name, option: o.value }))
        : [];

      const variationData: any = {
        sku: v.sku || undefined,
        regular_price: v.price ? String(v.price) : undefined,
        attributes,
      };

      await fetch(`${this.apiBase}/products/${parentId}/variations`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(variationData),
      });
    }
  }

  /**
   * 上传图片到 WordPress 媒体库
   */
  private async uploadImages(images: any[]): Promise<any[]> {
    const results: any[] = [];

    for (const img of images) {
      if (!img.data) continue;

      try {
        const buffer = Buffer.from(img.data);
        const filename = img.fileName || `product_${Date.now()}_${img.sortOrder || 0}.jpg`;

        const blob = new Blob([buffer], { type: img.mimeType || 'image/jpeg' });

        const resp = await fetch(`${this.baseUrl}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
          body: blob,
        });

        if (resp.ok) {
          const mediaData = await resp.json();
          results.push({ id: mediaData.id, position: img.sortOrder || 0 });
        }
      } catch (e) {
        console.error(`Image upload failed:`, e);
      }
    }

    return results;
  }
}
