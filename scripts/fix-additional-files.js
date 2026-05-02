/**
 * Fix remaining files with import { NextResponse } from 'next/server'
 * These are files not covered by the previous scripts.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/Users/apple/clawd/trade-erp';

function fixFile(relPath, addImports, replacements) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;

  // Remove NextResponse from import, keep type NextRequest if needed
  const newImport = content.includes('type NextRequest') 
    ? 'import type { NextRequest } from \'next/server\';'
    : '';
  
  if (content.includes("import { NextResponse } from 'next/server'")) {
    content = content.replace(/import \{ NextResponse \} from ['"]next\/server['"];\n/, newImport ? newImport + '\n' : '');
    changed = true;
  }
  if (content.includes("import { NextResponse, type NextRequest } from 'next/server'")) {
    content = content.replace(/import \{ NextResponse, type NextRequest \} from ['"]next\/server['"];/, "import type { NextRequest } from 'next/server'");
    changed = true;
  }

  // Add api-response import
  if (!content.includes('@/lib/api-response')) {
    if (content.includes("from '@/lib/auth-unified'")) {
      content = content.replace(
        /(from ['"]@\/lib\/auth-unified['"])/,
        `$1\nimport { ${addImports.join(', ')} } from '@/lib/api-response'`
      );
    } else {
      // Add after top comment block or first import
      content = content.replace(
        /(import .+ from ['"][^'"]+['"];?\n)/,
        `$1import { ${addImports.join(', ')} } from '@/lib/api-response';\n`
      );
    }
    changed = true;
  }

  // Apply replacements
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.split(search).join(replace);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content);
    console.log(`Fixed: ${relPath}`);
  } else {
    console.log(`No changes: ${relPath}`);
  }
}

// orders/batch-ship already fixed
// orders/batch-confirm already fixed

// products/batch-delete/route.ts
fixFile('src/app/api/products/batch-delete/route.ts', ['errorResponse', 'successResponse'], [
  [`return NextResponse.json(\n        { error: '请选择要删除的产品' },\n        { status: 400 }
      );`, `return errorResponse('请选择要删除的产品', 'VALIDATION_ERROR', 400);`],
  [`return NextResponse.json({ success: true, message: '批量删除成功' });`, `return successResponse(null, '批量删除成功');`],
  [`return NextResponse.json(\n      { error: '删除失败' },\n      { status: 500 }
    );`, `return errorResponse('删除失败', 'INTERNAL_ERROR', 500);`],
]);

// products/batch-import/route.ts
fixFile('src/app/api/products/batch-import/route.ts', ['errorResponse', 'successResponse'], [
  [`return NextResponse.json(\n        { error: '需要产品管理权限' },\n        { status: 403 }
      );`, `return errorResponse('需要产品管理权限', 'FORBIDDEN', 403);`],
  [`return NextResponse.json(\n        { error: '至少选择一个产品' },\n        { status: 400 }
      );`, `return errorResponse('至少选择一个产品', 'VALIDATION_ERROR', 400);`],
  [`return NextResponse.json({\n      success: true,\n      message: '批量导入成功',\n    });`, `return successResponse(null, '批量导入成功');`],
  [`return NextResponse.json(\n      { error: '批量导入失败' },\n      { status: 500 }
    );`, `return errorResponse('批量导入失败', 'INTERNAL_ERROR', 500);`],
]);

// purchases/[id]/route.ts
fixFile('src/app/api/purchases/[id]/route.ts', ['errorResponse', 'successResponse', 'notFoundResponse'], [
  [`return NextResponse.json(\n        { error: '采购单不存在' },\n        { status: 404 }
      );`, `return notFoundResponse('采购单');`],
  [`return NextResponse.json(\n        { error: '采购单状态不允许删除' },\n        { status: 400 }
      );`, `return errorResponse('采购单状态不允许删除', 'VALIDATION_ERROR', 400);`],
  [`return NextResponse.json({ success: true });`, `return successResponse(null, '删除成功');`],
  [`return NextResponse.json(\n      { error: '操作失败' },\n      { status: 500 }
    );`, `return errorResponse('操作失败', 'INTERNAL_ERROR', 500);`],
]);

// purchases/route.ts
fixFile('src/app/api/purchases/route.ts', ['errorResponse', 'successResponse'], [
  [`return NextResponse.json(\n        { error: '请先登录' },\n        { status: 401 }
      );`, `return errorResponse('请先登录', 'UNAUTHORIZED', 401);`],
  [`return NextResponse.json({ data: purchases });`, `return successResponse({ data: purchases });`],
  [`return NextResponse.json(\n      { error: '获取采购单列表失败' },\n      { status: 500 }
    );`, `return errorResponse('获取采购单列表失败', 'INTERNAL_ERROR', 500);`],
  [`return NextResponse.json({ data: purchase }, { status: 201 });`, `return createdResponse(purchase);`],
  [`return NextResponse.json({ success: true });`, `return successResponse(null, '创建成功');`],
  [`return NextResponse.json(\n      { error: '创建采购单失败' },\n      { status: 500 }
    );`, `return errorResponse('创建采购单失败', 'INTERNAL_ERROR', 500);`],
]);

// roles/[id]/route.ts
fixFile('src/app/api/roles/[id]/route.ts', ['errorResponse', 'successResponse', 'notFoundResponse'], [
  [`return NextResponse.json({ error: 'Role not found' }, { status: 404 });`, `return notFoundResponse('Role');`],
  [`return NextResponse.json({ data: role });`, `return successResponse({ data: role });`],
  [`return NextResponse.json(\n      { error: 'Failed to fetch role' },\n      { status: 500 }
    );`, `return errorResponse('Failed to fetch role', 'INTERNAL_ERROR', 500);`],
  [`return NextResponse.json({ error: 'Role name already exists' }, { status: 400 });`, `return errorResponse('Role name already exists', 'VALIDATION_ERROR', 400);`],
  [`return NextResponse.json({ success: true });`, `return successResponse(null, 'Role deleted');`],
  [`return NextResponse.json(\n      { error: 'Cannot delete role assigned to users' },\n      { status: 400 }
    );`, `return errorResponse('Cannot delete role assigned to users', 'VALIDATION_ERROR', 400);`],
  [`return NextResponse.json(\n      { error: 'Failed to update role' },\n      { status: 500 }
    );`, `return errorResponse('Failed to update role', 'INTERNAL_ERROR', 500);`],
  [`return NextResponse.json(\n      { error: 'Failed to delete role' },\n      { status: 500 }
    );`, `return errorResponse('Failed to delete role', 'INTERNAL_ERROR', 500);`],
]);

// roles/[id]/permissions/route.ts
fixFile('src/app/api/roles/[id]/permissions/route.ts', ['errorResponse', 'successResponse', 'notFoundResponse'], [
  [`return NextResponse.json({ error: 'Role not found' }, { status: 404 });`, `return notFoundResponse('Role');`],
  [`return NextResponse.json({ data: permissions });`, `return successResponse({ data: permissions });`],
  [`return NextResponse.json(\n      { error: 'Failed to fetch permissions' },\n      { status: 500 }
    );`, `return errorResponse('Failed to fetch permissions', 'INTERNAL_ERROR', 500);`],
  [`return NextResponse.json({ success: true });`, `return successResponse(null, 'Permissions updated');`],
  [`return NextResponse.json(\n      { error: 'Failed to update permissions' },\n      { status: 500 }
    );`, `return errorResponse('Failed to update permissions', 'INTERNAL_ERROR', 500);`],
]);

console.log('\nAll additional files fixed.');
