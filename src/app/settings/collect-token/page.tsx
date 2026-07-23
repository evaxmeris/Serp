'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Copy, RefreshCw } from 'lucide-react';

export default function CollectTokenPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/settings/collect-token').then(r => r.json()).then(data => {
      if (data.success) {
        setShowToken(false);
      }
    });
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const resp = await fetch('/api/settings/collect-token', { method: 'POST' });
    const data = await resp.json();
    setGenerating(false);
    if (data.success) {
      setToken(data.data.token);
      setShowToken(true);
    } else {
      alert('生成失败');
    }
  };

  const handleCopy = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      alert('已复制到剪贴板');
    }
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold mb-2">采集 API Token</h2>
          <p className="text-sm text-gray-500 mb-4">
            用于 Chrome 插件调用 ERP 采集接口的凭证。将此 Token 填入插件配置中。
          </p>

          {showToken && token ? (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                ⚠️ Token 仅在此显示一次，关闭后不再可见，请立即复制保存。
              </div>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-gray-100 rounded text-sm break-all">{token}</code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-4">尚未生成 Token</p>
              <Button onClick={handleGenerate} disabled={generating}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {generating ? '生成中...' : '生成新 Token'}
              </Button>
            </div>
          )}

          {!showToken && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button variant="outline" size="sm" onClick={handleGenerate}>
                <RefreshCw className="h-4 w-4 mr-1" /> 重新生成（旧 Token 将失效）
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
