'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Globe, Languages, AlertTriangle, CheckCircle, X } from 'lucide-react';

const TABS = ['基本信息', '描述与SEO', '图片管理', '变体管理', '发布记录'];

interface ProductDetail {
  id: string;
  source: string;
  sourceUrl: string;
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
  pipelineStatus: string;
  woocommerceId: number | null;
  woocommerceUrl: string | null;
  productId: string | null;
  publishError: string | null;
  collectedAt: string;
  images: any[];
  variants: any[];
  attributes: any[];
  publishLogs: any[];
}

export default function CollectedProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<any>({});
  const [syncDialog, setSyncDialog] = useState(false);
  const [syncAfterSave, setSyncAfterSave] = useState(false);

  useEffect(() => {
    fetch(`/api/collected-products/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setProduct(data.data);
          setForm(data.data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateField = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const wasPublished = product?.pipelineStatus === 'published';
      const keyFields = ['title', 'titleEn', 'description', 'descriptionEn', 'price', 'sku'];
      const keyChanged = keyFields.some(f => form[f] !== (product as any)[f]);

      const resp = await fetch(`/api/collected-products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();

      if (data.success) {
        setProduct((prev: any) => ({ ...prev, ...form }));
        if (wasPublished && keyChanged) {
          setSyncDialog(true);
        } else {
          alert('保存成功');
        }
      } else {
        alert('保存失败: ' + (data.message || '未知错误'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const resp = await fetch(`/api/collected-products/${id}/publish`, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      alert('发布成功');
      router.refresh();
    } else {
      alert('发布失败: ' + (data.data?.publishError || data.message || '未知错误'));
    }
  };

  const handleConvert = async () => {
    const resp = await fetch(`/api/collected-products/${id}/convert`, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      updateField('productId', data.data.productId);
      alert('已转为正式产品');
    } else {
      alert('转正失败');
    }
  };

  const handleTranslate = async () => {
    const resp = await fetch(`/api/collected-products/${id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: ['title', 'description', 'shortDescription'] }),
    });
    const data = await resp.json();
    if (data.success) {
      setForm((prev: any) => ({ ...prev, ...data.data }));
      alert('翻译完成，请检查后保存');
    } else {
      alert('翻译失败: ' + (data.message || '请检查翻译配置'));
    }
  };

  const handleSync = async () => {
    setSyncDialog(false);
    const resp = await fetch(`/api/collected-products/${id}/publish`, { method: 'POST' });
    const data = await resp.json();
    alert(data.success ? '同步到 WooCommerce 成功' : '同步失败');
    router.refresh();
  };

  if (loading) return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <div className="text-center py-12 text-gray-400">加载中...</div>
    </div>
  );

  if (!product) return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <div className="text-center py-12 text-red-500">产品不存在</div>
    </div>
  );

  const canPublish = form.pipelineStatus === 'ready' || form.pipelineStatus === 'error';
  const isPublished = form.pipelineStatus === 'published';

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/collected-products')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 返回列表
          </Button>
          <h1 className="text-lg font-semibold truncate max-w-md">
            {form.titleEn || form.title}
          </h1>
          {product.pipelineStatus && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              product.pipelineStatus === 'published' ? 'bg-green-100 text-green-700' :
              product.pipelineStatus === 'error' ? 'bg-red-100 text-red-700' :
              product.pipelineStatus === 'ready' ? 'bg-cyan-100 text-cyan-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {product.pipelineStatus}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTranslate} title="AI 翻译">
            <Languages className="h-4 w-4 mr-1" /> AI 翻译
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? '保存中...' : '保存'}
          </Button>
          {canPublish && (
            <Button size="sm" onClick={handlePublish}>
              <Globe className="h-4 w-4 mr-1" /> 发布到独立站
            </Button>
          )}
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === i
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: 基本信息 */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">标题</label>
              <Input value={form.title || ''} onChange={e => updateField('title', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">英文标题</label>
              <Input value={form.titleEn || ''} onChange={e => updateField('titleEn', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">短描述</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={3}
                value={form.shortDescription || ''}
                onChange={e => updateField('shortDescription', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">品牌</label>
                <Input value={form.brand || ''} onChange={e => updateField('brand', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">SKU</label>
                <Input value={form.sku || ''} onChange={e => updateField('sku', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">售价</label>
                <Input type="number" step="0.01" value={form.price || ''} onChange={e => updateField('price', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">划线价</label>
                <Input type="number" step="0.01" value={form.compareAtPrice || ''} onChange={e => updateField('compareAtPrice', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">币种</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  value={form.currency || 'USD'}
                  onChange={e => updateField('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">库存数量</label>
              <Input type="number" value={form.stockQuantity || ''} onChange={e => updateField('stockQuantity', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">来源</label>
                <Input value={product.source} disabled className="bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">来源链接</label>
                <a href={product.sourceUrl} target="_blank" className="text-blue-600 text-sm underline block truncate">{product.sourceUrl}</a>
              </div>
            </div>
            {/* 属性 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">属性</label>
              {product.attributes?.map((attr: any, i: number) => (
                <div key={attr.id || i} className="flex gap-2 mb-1">
                  <Input className="w-1/3 text-xs" value={attr.name} placeholder="属性名" readOnly />
                  <Input className="w-2/3 text-xs" value={attr.value} placeholder="属性值" readOnly />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 描述与SEO */}
      {activeTab === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">详细描述</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              rows={12}
              value={form.description || ''}
              onChange={e => updateField('description', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">英文描述</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              rows={12}
              value={form.descriptionEn || ''}
              onChange={e => updateField('descriptionEn', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">SEO 标题</label>
              <Input value={form.metaTitle || ''} onChange={e => updateField('metaTitle', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">SEO 描述</label>
              <Input value={form.metaDescription || ''} onChange={e => updateField('metaDescription', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL 别名</label>
              <Input value={form.urlSlug || ''} onChange={e => updateField('urlSlug', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 图片管理 */}
      {activeTab === 2 && (
        <div>
          {product.images?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">暂无图片</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {product.images.map((img: any) => (
                <div key={img.id} className="relative group">
                  {img.dataUrl ? (
                    <img
                      src={img.dataUrl}
                      alt={img.altText || ''}
                      className="w-full h-32 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-gray-300">
                      无数据
                    </div>
                  )}
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs bg-black/50 text-white">
                    {img.type}
                  </span>
                  {img.sortOrder === 0 && <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs bg-blue-500 text-white">主图</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: 变体管理 */}
      {activeTab === 3 && (
        <div>
          {product.variants?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">无变体（单一规格产品）</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">规格</th>
                  <th className="pb-2">价格</th>
                  <th className="pb-2">库存</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((v: any) => (
                  <tr key={v.id} className="border-b border-gray-100">
                    <td className="py-2">{v.sku || '-'}</td>
                    <td className="py-2">
                      {v.options ? JSON.stringify(v.options) : '-'}
                    </td>
                    <td className="py-2">{v.price ? `$${v.price}` : '-'}</td>
                    <td className="py-2">{v.stock ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 5: 发布记录 */}
      {activeTab === 4 && (
        <div className="space-y-3">
          {product.woocommerceId && (
            <div className="p-3 bg-green-50 rounded-md text-sm">
              <CheckCircle className="h-4 w-4 inline text-green-600 mr-1" />
              WooCommerce ID: {product.woocommerceId}
              {product.woocommerceUrl && (
                <a href={product.woocommerceUrl} target="_blank" className="ml-2 text-blue-600 underline">打开</a>
              )}
            </div>
          )}
          {product.publishError && (
            <div className="p-3 bg-red-50 rounded-md text-sm">
              <AlertTriangle className="h-4 w-4 inline text-red-600 mr-1" />
              上次错误: {product.publishError}
            </div>
          )}
          <div className="text-xs text-gray-500 mb-2">发布历史</div>
          {product.publishLogs?.length === 0 ? (
            <div className="text-center py-4 text-gray-400">暂无发布记录</div>
          ) : (
            product.publishLogs?.map((log: any) => (
              <div key={log.id} className="flex items-center gap-2 text-sm p-2 border border-gray-100 rounded">
                <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {log.status === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <span className="text-gray-500">{log.action}</span>
                <span className="text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString()}</span>
                {log.woocommerceId && <span className="text-gray-400">ID: {log.woocommerceId}</span>}
                {log.durationMs && <span className="text-gray-400">{log.durationMs}ms</span>}
                {log.errorMessage && <span className="text-red-500 text-xs truncate">{log.errorMessage}</span>}
              </div>
            ))
          )}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-200">
        {!product.productId && (
          <Button variant="outline" size="sm" onClick={handleConvert}>
            转为正式产品
          </Button>
        )}
        {canPublish && (
          <Button size="sm" onClick={handlePublish}>
            <Globe className="h-4 w-4 mr-1" /> 发布到 WooCommerce
          </Button>
        )}
        {product.productId && (
          <span className="text-xs text-gray-400 ml-2">
            已关联正式产品 ID: {product.productId}
          </span>
        )}
      </div>

      {/* 同步弹窗 */}
      {syncDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-2">产品已发布</h3>
            <p className="text-sm text-gray-600 mb-1">此产品已在 WooCommerce 上发布，检测到以下字段已修改：</p>
            <ul className="text-sm text-gray-700 mb-4 ml-4 list-disc">
              {['title', 'titleEn', 'description', 'descriptionEn', 'price', 'sku']
                .filter(f => form[f] !== (product as any)[f])
                .map(f => <li key={f}>{f}</li>)}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setSyncDialog(false); alert('已保存到 ERP'); }}>
                仅保存到 ERP
              </Button>
              <Button onClick={handleSync}>
                保存并同步到独立站
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
