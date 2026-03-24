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
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState('');

  if (!isOpen) return null;

  async function handleExport() {
    setLoading(true);
    setMessage('');
    setProgress(0);
    
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
        setTaskId(result.data.id);
        setMessage(`✅ ${result.message}`);
        
        // 轮询导出进度
        pollExportProgress(result.data.id);
      } else {
        setMessage(`❌ ${result.error}`);
        setLoading(false);
      }
    } catch (error) {
      setMessage('❌ 导出失败，请稍后重试');
      console.error('导出失败:', error);
      setLoading(false);
    }
  }

  async function pollExportProgress(id: string) {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/reports/export/${id}`);
        const result = await response.json();
        
        if (result.data) {
          setProgress(result.data.progress || 0);
          
          if (result.data.status === 'completed') {
            clearInterval(pollInterval);
            setMessage(`✅ 导出完成！文件大小：${formatFileSize(result.data.fileSize)}`);
            setLoading(false);
            
            // 自动下载
            if (result.data.downloadUrl) {
              window.open(result.data.downloadUrl, '_blank');
            }
            
            setTimeout(() => {
              onClose();
              setMessage('');
              setProgress(0);
            }, 3000);
          } else if (result.data.status === 'failed') {
            clearInterval(pollInterval);
            setMessage(`❌ 导出失败：${result.data.error}`);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('查询进度失败:', error);
      }
    }, 1000); // 每秒查询一次
  }

  function formatFileSize(bytes: number): string {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(2)} KB`;
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
