'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/card';

export default function TranslationSettingsPage() {
  const [form, setForm] = useState({ provider: 'deepseek', apiKey: '', model: 'deepseek-chat' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/translation').then(r => r.json()).then(data => {
      if (data.success && data.data) {
        setForm(data.data);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const resp = await fetch('/api/settings/translation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await resp.json();
    setSaving(false);
    alert(data.success ? '保存成功' : '保存失败');
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold mb-4">AI 翻译配置</h2>
          <p className="text-sm text-gray-500 mb-4">配置后，在产品编辑页可使用"AI 翻译"按钮自动翻译标题和描述。</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">服务商</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={form.provider}
                onChange={e => setForm({ ...form, provider: e.target.value })}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">API Key</label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">模型</label>
              <Input
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="deepseek-chat / gpt-4o-mini"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
