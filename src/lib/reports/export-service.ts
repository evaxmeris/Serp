/**
 * 报表导出服务
 * 支持 Excel、PDF、CSV 格式导出
 */

import { saveAs } from 'file-saver';

/**
 * 导出数据类型
 */
export interface ExportData {
  headers: string[];
  rows: any[][];
  filename: string;
  title?: string;
}

/**
 * 导出为 CSV 文件
 */
export async function exportToCSV(data: ExportData) {
  const { headers, rows, filename } = data;
  
  // 生成 CSV 内容
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // 处理特殊字符
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','))
  ].join('\n');
  
  // 创建 Blob 并下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}.csv`);
  
  return true;
}

/**
 * 导出为 Excel 文件（简化版，使用表格 HTML）
 */
export async function exportToExcel(data: ExportData) {
  const { headers, rows, filename, title } = data;
  
  // 生成 Excel 兼容的 HTML 表格
  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${filename}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        ${title ? `<div class="title">${title}</div>` : ''}
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  // 创建 Blob 并下载
  const blob = new Blob([htmlContent], { 
    type: 'application/vnd.ms-excel;charset=utf-8' 
  });
  saveAs(blob, `${filename}.xls`);
  
  return true;
}

/**
 * 导出为 PDF 文件（简化版，使用打印）
 */
export async function exportToPDF(data: ExportData) {
  const { headers, rows, filename, title } = data;
  
  // 创建打印窗口
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('请允许弹出窗口以进行 PDF 导出');
    return false;
  }
  
  printWindow.document.write(`
    <html>
      <head>
        <title>${title || filename}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
          }
          body { font-family: Arial, sans-serif; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
          .date { color: #666; margin-bottom: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        ${title ? `<div class="title">${title}</div>` : ''}
        <div class="date">生成时间：${new Date().toLocaleString('zh-CN')}</div>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  
  // 延迟打印以确保内容加载
  setTimeout(() => {
    printWindow.print();
    // printWindow.close();
  }, 250);
  
  return true;
}

/**
 * 通用导出函数
 */
export async function exportReport(
  data: ExportData,
  format: 'excel' | 'pdf' | 'csv'
) {
  try {
    switch (format) {
      case 'excel':
        return await exportToExcel(data);
      case 'pdf':
        return await exportToPDF(data);
      case 'csv':
        return await exportToCSV(data);
      default:
        throw new Error(`不支持的导出格式：${format}`);
    }
  } catch (error) {
    console.error('导出失败:', error);
    throw error;
  }
}
