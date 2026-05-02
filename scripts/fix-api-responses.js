/**
 * Fix remaining API routes to use api-response.ts helper functions.
 * 
 * This script handles all replacement patterns.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/Users/apple/clawd/trade-erp';

// Files that already import from api-response and need remaining NextResponse.json calls replaced
const filesWithImport = [
  // Already has errorResponse import
  { file: 'src/app/api/users/[id]/permissions/route.ts', imports: ['errorResponse', 'successResponse', 'notFoundResponse'] },
  { file: 'src/app/api/users/[id]/roles/route.ts', imports: ['errorResponse', 'successResponse', 'notFoundResponse'] },
  { file: 'src/app/api/permissions/[id]/route.ts', imports: ['errorResponse', 'successResponse', 'notFoundResponse', 'validationErrorResponse'] },
  { file: 'src/app/api/permissions/init/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/products/[id]/attributes/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/roles/create/route.ts', imports: ['errorResponse', 'successResponse', 'forbiddenResponse'] },
  { file: 'src/app/api/suppliers/[id]/route.ts', imports: ['errorResponse', 'successResponse', 'notFoundResponse', 'conflictResponse'] },
  { file: 'src/app/api/dashboard/overview/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/dashboard/orders/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/dashboard/sales/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/dashboard/products/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/dashboard/customers/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/inquiries/[id]/convert-to-quotation/route.ts', imports: ['successResponse', 'errorResponse', 'notFoundResponse'] },
];

// Files without any api-response imports
const filesWithoutImport = [
  { file: 'src/app/api/orders/batch-ship/route.ts', imports: ['errorResponse', 'successResponse', 'forbiddenResponse'] },
  { file: 'src/app/api/orders/batch-confirm/route.ts', imports: ['errorResponse', 'successResponse', 'forbiddenResponse'] },
  { file: 'src/app/api/customers/batch-export/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/customers/batch-import/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/customers/batch-tag/route.ts', imports: ['errorResponse', 'successResponse'] },
  { file: 'src/app/api/quotations/[id]/send/route.ts', imports: ['errorResponse', 'successResponse', 'notFoundResponse'] },
  { file: 'src/app/api/products/batch-export/route.ts', imports: ['errorResponse', 'successResponse'] },
];

// Product-research files (all have errorResponse already imported)
const researchFiles = [
  'src/app/api/product-research/comparisons/route.ts',
  'src/app/api/product-research/templates/[id]/route.ts',
  'src/app/api/product-research/products/[id]/route.ts',
  'src/app/api/product-research/products/batch/route.ts',
  'src/app/api/product-research/products/batch-delete/route.ts',
  'src/app/api/product-research/attributes/route.ts',
  'src/app/api/product-research/products/route.ts',
];

function addImport(content, imports) {
  // Replace the existing import line if errorResponse is already there
  const existingImportRegex = /import \{ errorResponse \} from ['"]@\/lib\/api-response['"]/;
  if (existingImportRegex.test(content)) {
    // Add new imports to the existing one
    content = content.replace(
      existingImportRegex,
      `import { errorResponse, ${imports.filter(i => i !== 'errorResponse').join(', ')} } from '@/lib/api-response'`
    );
  } else {
    // Add import after auth-unified import or at top of file
    content = content.replace(
      /(import .+ from ['"]@\/lib\/auth-unified['"];?\n)/,
      `$1import { ${imports.join(', ')} } from '@/lib/api-response';\n`
    );
  }
  return content;
}

function removeNextResponseImport(content) {
  // Remove `import { NextResponse } from 'next/server'` but keep `import type { NextRequest } from 'next/server'`
  content = content.replace(/import \{ NextResponse \} from ['"]next\/server['"];\n/, '');
  content = content.replace(/import \{ NextResponse, type (NextRequest) \} from ['"]next\/server['"];\n/, "import type { $1 } from 'next/server';\n");
  return content;
}

function fixFile(filePath, imports) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // Remove NextResponse from import
  content = removeNextResponseImport(content);
  
  // Add api-response imports if not already present
  if (imports && !content.includes('@/lib/api-response')) {
    content = addImport(content, imports);
  } else if (imports) {
    // Already has some imports, make sure all needed ones are there
    // This is handled on a per-file basis
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated imports: ${filePath}`);
  }
  
  return content;
}

// Helper to replace patterned responses
function replaceAll(content, search, replacement) {
  while (content.includes(search)) {
    content = content.replace(search, replacement);
  }
  return content;
}

// ============== Process files ==============

// 1. Process files without api-response import (need full rewrite)
for (const entry of filesWithoutImport) {
  const fullPath = path.join(BASE, entry.file);
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Add import
  content = removeNextResponseImport(content);
  content = addImport(content, entry.imports);
  
  fs.writeFileSync(fullPath, content);
  console.log(`Updated imports: ${entry.file}`);
}

// 2. Process files with existing api-response imports (just adjust imports)
for (const entry of [...filesWithImport, ...researchFiles.map(f => ({ file: f, imports: ['errorResponse', 'successResponse', 'notFoundResponse', 'validationErrorResponse', 'createdResponse'] }))]) {
  const fullPath = path.join(BASE, entry.file);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${entry.file}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Remove NextResponse from import
  content = removeNextResponseImport(content);
  
  // Make sure all needed imports are present
  if (entry.imports) {
    // Check which imports exist
    for (const imp of entry.imports) {
      if (!content.includes(imp)) {
        // Add to existing import line
        content = content.replace(
          /import \{ ([^}]+) \} from ['"]@\/lib\/api-response['"]/,
          (match, existing) => {
            const existingList = existing.split(',').map(s => s.trim());
            if (!existingList.includes(imp)) {
              existingList.push(imp);
            }
            return `import { ${existingList.join(', ')} } from '@/lib/api-response'`;
          }
        );
      }
    }
  }
  
  fs.writeFileSync(fullPath, content);
  console.log(`Updated imports: ${entry.file}`);
}

console.log('\nAll import fixups complete. Now individual NextResponse.json replacements need to be done per file.');
