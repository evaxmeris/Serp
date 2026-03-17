/**
 * 报表定时任务对话框组件
 */

'use client';

import { useState } from 'react';

interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  reportName?: string;
}

export default function ScheduleDialog({ isOpen, onClose, reportId, reportName }: ScheduleDialogProps) {
  const [taskName, setTaskName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isValid, setIsValid] = useState(true);

  if (!isOpen) return null;

  async function handleCreateSchedule() {
    setLoading(true);
    setMessage('');
    
    if (!taskName) {
      setMessage('❌ 请输入任务名称');
      return;
    }

    try {
      const response = await fetch('/api/v1/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: reportId || 'all',
          name: taskName,
          cronExpression,
          timezone,
          config: {}
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`✅ 定时任务创建成功！${result.message || ''}`);
        setTimeout(() => {
          onClose();
          setMessage('');
        }, 3000);
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ 创建失败，请稍后重试');
      console.error('创建失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const cronExamples = [
    { label: '每天 8:00', value: '0 8 * * *' },
    { label: '每周一 9:00', value: '0 9 * * 1' },
    { label: '每月 1 号 10:00', value: '0 10 1 * *' },
    { label: '每小时', value: '0 * * * *' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">⏰ 创建定时任务</h2>
        
        {reportName && (
          <p className="text-sm text-gray-600 mb-4">
            当前报表：{reportName}
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">任务名称</label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="例如：每日利润报表"
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Cron 表达式</label>
          <input
            type="text"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="0 8 * * *"
            className="w-full p-2 border rounded font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            格式：分 时 日 月 星期
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">快速选择</label>
          <div className="grid grid-cols-2 gap-2">
            {cronExamples.map((example) => (
              <button
                key={example.value}
                onClick={() => setCronExpression(example.value)}
                className={`px-3 py-2 text-sm border rounded hover:bg-gray-50 ${cronExpression === example.value ? 'bg-blue-50 border-blue-500' : ''}`}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">时区</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="Asia/Shanghai">Asia/Shanghai (北京时间)</option>
            <option value="UTC">UTC (协调世界时)</option>
            <option value="America/New_York">America/New_York (美东时间)</option>
          </select>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        {!isValid && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded text-sm">
            <strong>Cron 表达式格式：</strong>分 时 日 月 星期
            <br />
            示例：0 8 * * * （每天 8:00）
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
            onClick={handleCreateSchedule}
            disabled={loading || !taskName}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建任务'}
          </button>
        </div>
      </div>
    </div>
  );
}
