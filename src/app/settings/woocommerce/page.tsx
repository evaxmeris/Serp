'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';

export default function WooCommerceSettingsPage() {
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
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await resp.json();
    setSaving(false);
    alert(data.success ? '保存成功' : '保存失败: ' + data.message);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    try {
      // 使用 WooCommerce API 测试连接
      const auth = btoa(`${form.consumerKey}:${form.consumerSecret}`);
      const resp = await fetch(`${form.url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=1`, {
        headers: { 'Authorization': `Basic ${auth}` },
      });
      setTestResult(resp.ok ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    }
    setTesting(false);
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold mb-4">WooCommerce 独立站配置</h2>
          <div className="space-y-4">
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
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? '测试中...' : '测试连接'}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存配置'}
              </Button>
            </div>
            {testResult !== 'idle' && (
              <div className={`flex items-center gap-2 text-sm ${testResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {testResult === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult === 'success' ? '连接成功' : '连接失败，请检查凭证'}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
