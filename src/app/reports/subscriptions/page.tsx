/**
 * 订阅管理页面
 * 查看和管理所有报表订阅
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Subscription {
  id: string;
  reportId: string;
  report: {
    name: string;
    code: string;
    type: string;
  };
  userId: string;
  frequency: string;
  format: string;
  email?: string;
  notifyMethod: string;
  isActive: boolean;
  nextSendAt: string;
  createdAt: string;
}

export default function SubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    try {
      const response = await fetch('/api/v1/reports/subscribe');
      const result = await response.json();
      
      if (result.success) {
        setSubscriptions(result.data);
      }
    } catch (error) {
      console.error('加载订阅列表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscription(id: string, isActive: boolean) {
    try {
      const response = await fetch(`/api/v1/reports/subscribe/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        await loadSubscriptions();
      }
    } catch (error) {
      console.error('更新订阅失败:', error);
    }
  }

  async function deleteSubscription(id: string) {
    if (!confirm('确定要删除此订阅吗？')) return;

    try {
      const response = await fetch(`/api/v1/reports/subscribe/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadSubscriptions();
      }
    } catch (error) {
      console.error('删除订阅失败:', error);
    }
  }

  const frequencyLabels: Record<string, string> = {
    DAILY: '每日',
    WEEKLY: '每周',
    MONTHLY: '每月'
  };

  const notifyMethodLabels: Record<string, string> = {
    email: '📧 邮箱',
    dingtalk: '💬 钉钉',
    wechat: '📱 企业微信'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">📧 订阅管理</h1>
          <p className="text-muted-foreground">
            管理您的报表订阅配置
          </p>
        </div>
        <Link
          href="/reports"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ← 返回报表中心
        </Link>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">暂无订阅</p>
          <Link
            href="/reports"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            创建订阅
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  报表名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  频率
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  通知方式
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  格式
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  下次发送
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{sub.report.name}</div>
                    <div className="text-sm text-gray-500">{sub.report.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {frequencyLabels[sub.frequency]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {notifyMethodLabels[sub.notifyMethod] || sub.notifyMethod}
                    {sub.email && <div className="text-xs text-gray-400">{sub.email}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sub.format.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sub.nextSendAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      sub.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {sub.isActive ? '激活' : '暂停'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => toggleSubscription(sub.id, sub.isActive)}
                      className={`mr-3 ${sub.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                    >
                      {sub.isActive ? '暂停' : '恢复'}
                    </button>
                    <button
                      onClick={() => deleteSubscription(sub.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
