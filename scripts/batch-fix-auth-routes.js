#!/usr/bin/env node
/**
 * 批量修复 API 路由 - NextAuth v4 兼容
 * 将所有 `import { auth } from '@/lib/auth-config'` 改为 `import { getServerSession } from 'next-auth'`
 */

const fs = require('fs');
const path = require('path');

// 找到所有使用 auth 的 API 路由
function findApiRoutes(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.')) {
      files.push(...findApiRoutes(fullPath));
    } else if (item === 'route.ts' && !fullPath.includes('[...nextauth]')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('import { auth } from \'@/lib/auth-config\'')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function fixRoute(filePath) {
  console.log(`修复: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 替换 import 语句
  content = content.replace(
    /import\s*\{\s*auth\s*\}\s*from\s*['"]@\/lib\/auth-config['"];/g,
    'import { getServerSession } from \'next-auth\';\nimport authOptions from \'@/lib/auth-config\';'
  );
  
  // 替换 await auth()
  content = content.replace(
    /const\s+session\s*=\s*await\s*auth\(\);/g,
    'const session = await getServerSession(authOptions);'
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ 完成: ${filePath}`);
}

function main() {
  console.log('🔧 开始批量修复 API 路由...\n');
  
  const srcDir = path.join(process.cwd(), 'src', 'app');
  const files = findApiRoutes(srcDir);
  
  console.log(`找到 ${files.length} 个文件需要修复\n`);
  
  for (const file of files) {
    fixRoute(file);
  }
  
  console.log(`\n🎉 批量修复完成！共修复 ${files.length} 个文件`);
}

main();
