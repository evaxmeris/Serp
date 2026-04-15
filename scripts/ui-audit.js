/**
 * UI 设计一致性审计脚本
 * 检查所有页面是否使用 shadcn/ui 组件
 */

const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'src', 'app');
const results = {
  compliant: [],    // 符合标准
  nonCompliant: [], // 不符合标准
  errors: []        // 检查错误
};

// 检查文件是否使用原生 HTML 控件（未使用 shadcn/ui）
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = filePath.replace(path.join(__dirname, '..', 'src', 'app') + '/', '');
  
  const issues = [];
  
  // 检查是否使用原生对话框（div.fixed.inset-0）
  if (content.includes('fixed inset-0') && !content.includes('Dialog')) {
    issues.push('使用原生对话框，未使用 <Dialog>');
  }
  
  // 检查是否使用原生按钮（button.bg-blue-500 或 button.px-4.py-2）
  const nativeButtonRegex = /<button[^>]*className=["'][^"']*(bg-blue-500|bg-red-500|px-4\s+py-2|bg-gray-300)[^"']*["']/g;
  if (nativeButtonRegex.test(content) && !content.includes('import { Button }')) {
    issues.push('使用原生按钮，未使用 <Button>');
  }
  
  // 检查是否使用原生输入框（input.border.rounded）
  const nativeInputRegex = /<input[^>]*className=["'][^"']*(border\s+rounded|border-rounded)[^"']*["']/g;
  if (nativeInputRegex.test(content) && !content.includes('import { Input }')) {
    issues.push('使用原生输入框，未使用 <Input>');
  }
  
  // 检查是否使用原生卡片（div.bg-white.rounded-lg）
  const nativeCardRegex = /<div[^>]*className=["'][^"']*(bg-white\s+rounded-lg|bg-white\s+border)[^"']*["']/g;
  if (nativeCardRegex.test(content) && !content.includes('import { Card }')) {
    issues.push('使用原生卡片，未使用 <Card>');
  }
  
  // 检查是否使用原生表格（table 标签）
  if (content.includes('<table') && !content.includes('import { Table }')) {
    issues.push('使用原生表格，未使用 <Table>');
  }
  
  // 检查是否使用原生选择框（select.border.rounded）
  const nativeSelectRegex = /<select[^>]*className=["'][^"']*border[^"']*["']/g;
  if (nativeSelectRegex.test(content) && !content.includes('import { Select }')) {
    issues.push('使用原生选择框，未使用 <Select>');
  }
  
  // 检查是否使用原生复选框（input[type="checkbox"]）
  if (content.includes('type="checkbox"') && !content.includes('import { Checkbox }')) {
    issues.push('使用原生复选框，未使用 <Checkbox>');
  }
  
  // 检查是否使用原生文本域（textarea.border.rounded）
  const nativeTextareaRegex = /<textarea[^>]*className=["'][^"']*border[^"']*["']/g;
  if (nativeTextareaRegex.test(content) && !content.includes('import { Textarea }')) {
    issues.push('使用原生文本域，未使用 <Textarea>');
  }
  
  // 检查是否使用原生标签（label.block）
  const nativeLabelRegex = /<label[^>]*className=["'][^"']*block[^"']*["']/g;
  if (nativeLabelRegex.test(content) && !content.includes('import { Label }')) {
    issues.push('使用原生标签，未使用 <Label>');
  }
  
  // 检查是否使用原生徽章（span.text-xs）
  const nativeBadgeRegex = /<span[^>]*className=["'][^"']*(text-xs\s+px-2|bg-blue-100|bg-green-100|bg-yellow-100|bg-red-100)[^"']*["']/g;
  if (nativeBadgeRegex.test(content) && !content.includes('import { Badge }')) {
    issues.push('使用原生徽章，未使用 <Badge>');
  }
  
  return {
    path: relativePath,
    issues,
    isCompliant: issues.length === 0
  };
}

// 递归查找所有 page.tsx 文件
function findPageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        findPageFiles(filePath, fileList);
      }
    } else if (file === 'page.tsx') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 主函数
console.log('🔍 开始 UI 设计一致性审计...\n');

const pageFiles = findPageFiles(appDir);
console.log(`找到 ${pageFiles.length} 个页面\n`);

pageFiles.forEach(filePath => {
  try {
    const result = checkFile(filePath);
    if (result.isCompliant) {
      results.compliant.push(result.path);
    } else {
      results.nonCompliant.push(result);
    }
  } catch (error) {
    results.errors.push({
      path: filePath.replace(appDir + '/', ''),
      error: error.message
    });
  }
});

// 输出结果
console.log('✅ 符合标准的页面 (' + results.compliant.length + '):');
results.compliant.forEach(p => console.log('  ✓', p));

console.log('\n❌ 不符合标准的页面 (' + results.nonCompliant.length + '):');
results.nonCompliant.forEach(r => {
  console.log('\n  ✗', r.path);
  r.issues.forEach(issue => console.log('    -', issue));
});

if (results.errors.length > 0) {
  console.log('\n⚠️ 检查错误 (' + results.errors.length + '):');
  results.errors.forEach(e => console.log('  !', e.path, '-', e.error));
}

// 生成报告
const report = `# UI 设计一致性审计报告

**生成时间:** ${new Date().toISOString()}
**检查范围:** trade-erp/src/app 所有页面

## 统计

- 总页面数：${pageFiles.length}
- 符合标准：${results.compliant.length} (${(results.compliant.length / pageFiles.length * 100).toFixed(1)}%)
- 不符合标准：${results.nonCompliant.length} (${(results.nonCompliant.length / pageFiles.length * 100).toFixed(1)}%)

## 不符合标准的页面

${results.nonCompliant.map(r => `### ${r.path}

${r.issues.map(i => `- ${i}`).join('\n')}
`).join('\n')}

## 符合标准的页面

${results.compliant.map(p => `- ${p}`).join('\n')}
`;

const reportPath = path.join(__dirname, '..', 'docs', 'ui-audit-report-' + new Date().toISOString().split('T')[0] + '.md');
fs.writeFileSync(reportPath, report);
console.log('\n📄 报告已保存到:', reportPath);
