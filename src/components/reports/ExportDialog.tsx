/**
 * 报表导出对话框组件
 */

'use client';

import { useState } from 'react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  reportName?: string;
}

export default function ExportDialog({ isOpen, onClose, reportId, reportName }: ExportDialogProps) {
  const [format, setFormat] = useState('excel');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  async function handleExport() {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: reportId || 'all',
          format,
          filters: {}
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`✅ ${result.message}`);
        setTimeout(() => {
          onClose();
          setMessage('');
        }, 3000);
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ 导出失败，请稍后重试');
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">📥 导出报表</h2>
        
        {reportName && (
          <p className="text-sm text-gray-600 mb-4">
            当前报表：{reportName}
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">导出格式</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="excel">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
            <option value="pdf">PDF (.pdf)</option>
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
            onClick={handleExport}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '导出中...' : '确认导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
