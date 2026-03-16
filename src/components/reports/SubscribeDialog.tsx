/**
 * 报表订阅对话框组件
 */

'use client';

import { useState } from 'react';

interface SubscribeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  reportName?: string;
}

export default function SubscribeDialog({ isOpen, onClose, reportId, reportName }: SubscribeDialogProps) {
  const [frequency, setFrequency] = useState('WEEKLY');
  const [email, setEmail] = useState('');
  const [format, setFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  async function handleSubscribe() {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/v1/reports/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: reportId || 'all',
          userId: 'current-user', // TODO: 从 session 获取
          frequency,
          format,
          email: email || undefined,
          isActive: true
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`✅ 订阅成功！${result.message || '系统将按时推送报表'}`);
        setTimeout(() => {
          onClose();
          setMessage('');
        }, 3000);
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ 订阅失败，请稍后重试');
      console.error('订阅失败:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">📧 设置订阅</h2>
        
        {reportName && (
          <p className="text-sm text-gray-600 mb-4">
            当前报表：{reportName}
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">订阅频率</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="DAILY">每日</option>
            <option value="WEEKLY">每周</option>
            <option value="MONTHLY">每月</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">通知方式</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="email"
                checked={notifyMethod === 'email'}
                onChange={(e) => setNotifyMethod(e.target.value)}
                className="mr-2"
              />
              📧 邮箱
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="dingtalk"
                checked={notifyMethod === 'dingtalk'}
                onChange={(e) => setNotifyMethod(e.target.value)}
                className="mr-2"
              />
              💬 钉钉
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="wechat"
                checked={notifyMethod === 'wechat'}
                onChange={(e) => setNotifyMethod(e.target.value)}
                className="mr-2"
              />
              📱 企业微信
            </label>
          </div>
        </div>

        {notifyMethod === 'email' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">接收邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="不填则使用默认邮箱"
              className="w-full p-2 border rounded"
            />
          </div>
        )}

        {notifyMethod === 'dingtalk' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">钉钉 Webhook</label>
            <input
              type="url"
              value={dingtalkWebhook}
              onChange={(e) => setDingtalkWebhook(e.target.value)}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
              className="w-full p-2 border rounded font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              在钉钉群机器人设置中获取 Webhook 地址
            </p>
          </div>
        )}

        {notifyMethod === 'wechat' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">企业微信 Webhook</label>
            <input
              type="url"
              value={dingtalkWebhook}
              onChange={(e) => setDingtalkWebhook(e.target.value)}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              className="w-full p-2 border rounded font-mono text-sm"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">报表格式</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="csv">CSV</option>
          </select>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '提交中...' : '确认订阅'}
          </button>
        </div>
      </div>
    </div>
  );
}
