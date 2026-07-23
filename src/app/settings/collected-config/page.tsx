'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckCircle, XCircle, Copy, RefreshCw, Globe, Languages, Download } from 'lucide-react';

const TABS = [
  { key: 'woocommerce', label: 'WooCommerce 配置', icon: Globe },
  { key: 'translation', label: '翻译配置', icon: Languages },
  { key: 'token', label: '采集 Token', icon: Download },
];

export default function CollectedConfigPage() {
  const [activeTab, setActiveTab] = useState('woocommerce');

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold mb-4">采集配置</h2>

          {/* Tab 导航 */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* WooCommerce 配置 */}
          {activeTab === 'woocommerce' && <WooCommerceTab />}

          {/* 翻译配置 */}
          {activeTab === 'translation' && <TranslationTab />}

          {/* 采集 Token */}
          {activeTab === 'token' && <TokenTab />}
        </CardHeader>
      </Card>
    </div>
  );
}

function WooCommerceTab() {
  const [form, setForm] = useState({ name: '', url: '', consumerKey: '', consumerSecret: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle');

  useEffect(() => {
    fetch('/api/settings/woocommerce').then(r => r.json()).then(data => {
      if (data.success && data.data?.length > 0) {
        const c = data.data[0];
        setForm({ name: c.name || '', url: c.url || '', consumerKey: '', consumerSecret: '' });
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const resp = await fetch('/api/settings/woocommerce', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await resp.json();
    setSaving(false);
    alert(data.success ? '保存成功' : '保存失败');
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    try {
      const auth = btoa(`${form.consumerKey}:${form.consumerSecret}`);
      const resp = await fetch(`${form.url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=1`, {
        headers: { 'Authorization': `Basic ${auth}` },
      });
      setTestResult(resp.ok ? 'success' : 'fail');
    } catch { setTestResult('fail'); }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">配置 WooCommerce API 凭证后，可在采集管理的编辑页将产品发布到独立站。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">店铺名称</label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：QEVORIA 独立站" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">店铺网址</label>
          <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://yourstore.com" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Consumer Key</label>
          <Input value={form.consumerKey} onChange={e => setForm({ ...form, consumerKey: e.target.value })} placeholder="ck_..." />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Consumer Secret</label>
          <Input type="password" value={form.consumerSecret} onChange={e => setForm({ ...form, consumerSecret: e.target.value })} placeholder="cs_..." />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleTest} disabled={testing}>{testing ? '测试中...' : '测试连接'}</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存配置'}</Button>
      </div>
      {testResult !== 'idle' && (
        <div className={`flex items-center gap-2 text-sm ${testResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {testResult === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {testResult === 'success' ? '连接成功' : '连接失败，请检查凭证'}
        </div>
      )}
    </div>
  );
}

function TranslationTab() {
  const [form, setForm] = useState({ provider: 'deepseek', apiKey: '', model: 'deepseek-chat' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/translation').then(r => r.json()).then(data => {
      if (data.success && data.data) setForm(data.data);
    });
  }, []);

  const handleSave = async () => {
    if (!form.apiKey) { alert('API Key 为必填项'); return; }
    setSaving(true);
    const resp = await fetch('/api/settings/translation', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await resp.json();
    setSaving(false);
    alert(data.success ? '保存成功' : '保存失败');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">配置后，在产品编辑页可使用"AI 翻译"按钮自动翻译标题和描述。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">服务商</label>
          <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value={form.provider}
            onChange={e => setForm({ ...form, provider: e.target.value })}>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">模型</label>
          <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="deepseek-chat" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">API Key</label>
        <Input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." />
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存配置'}</Button>
    </div>
  );
}

function TokenTab() {
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    const resp = await fetch('/api/settings/collect-token', { method: 'POST' });
    const data = await resp.json();
    setGenerating(false);
    if (data.success) { setToken(data.data.token); setShowToken(true); }
    else alert('生成失败');
  };

  const handleCopy = async () => {
    if (token) { await navigator.clipboard.writeText(token); alert('已复制'); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">用于 Chrome 插件调用 ERP 采集接口的凭证。生成后填入插件设置的 API Token 中。</p>

      {showToken && token ? (
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
            ⚠️ Token 仅在此显示一次，关闭后不再可见，请立即复制保存。
          </div>
          <div className="flex gap-2">
            <code className="flex-1 p-3 bg-gray-800 text-green-300 rounded-md text-sm font-mono break-all select-all">{token}</code>
            <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-4 w-4" /></Button>
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={handleGenerate}>
              <RefreshCw className="h-4 w-4 mr-1" /> 重新生成
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Button onClick={handleGenerate} disabled={generating}>
            <RefreshCw className="h-4 w-4 mr-1" />{generating ? '生成中...' : '生成新 Token'}
          </Button>
        </div>
      )}
    </div>
  );
}
