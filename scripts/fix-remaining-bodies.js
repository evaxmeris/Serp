/**
 * Replace NextResponse.json calls in remaining routes.
 * Handles files not covered by fix-api-response-bodies.js
 */
const fs = require('fs');
const path = require('path');

const BASE = '/Users/apple/clawd/trade-erp';

function replaceInFile(relPath, replacements) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    return false;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      const newContent = content.split(search).join(replace);
      if (newContent !== content) {
        console.log(`  Replaced in ${relPath}`);
        content = newContent;
        changed = true;
      }
    } else {
      console.log(`  SKIP (not found search) in ${relPath}`);
    }
  }
  if (changed) {
    fs.writeFileSync(fullPath, content);
  }
  return changed;
}

// ============ orders/batch-ship/route.ts ============
replaceInFile('src/app/api/orders/batch-ship/route.ts', [
  // forbidden
  [`return NextResponse.json(\n        { error: '需要发货权限' },\n        { status: 403 }\n      );`, `return forbiddenResponse('需要发货权限');`],
  // invalid orders
  [`return NextResponse.json(\n        {\n          error: \`以下订单状态不是已确认：\${invalidOrders.map((o) => o.orderNo).join(', ')}\`,\n        },\n        { status: 400 }\n      );`, `return errorResponse(\`以下订单状态不是已确认：\${invalidOrders.map((o) => o.orderNo).join(', ')}\`, 'VALIDATION_ERROR', 400);`],
  // success
  [`return NextResponse.json({\n      success: true,\n      message: \`成功发货 \${result.count} 条订单\`,\n      shippedCount: result.count,\n    });`, `return successResponse({ shippedCount: result.count }, \`成功发货 \${result.count} 条订单\`);`],
  // error
  [`return NextResponse.json(\n      { error: '发货失败：' + error.message },\n      { status: 500 }\n    );`, `return errorResponse('发货失败：' + error.message, 'INTERNAL_ERROR', 500);`],
]);

// ============ orders/batch-confirm/route.ts ============
replaceInFile('src/app/api/orders/batch-confirm/route.ts', [
  // forbidden
  [`return NextResponse.json(\n        { error: '需要销售管理权限' },\n        { status: 403 }\n      );`, `return forbiddenResponse('需要销售管理权限');`],
  // invalid orders
  [`return NextResponse.json(\n        {\n          error: \`以下订单状态不是待确认：\${invalidOrders.map((o) => o.orderNo).join(', ')}\`,\n        },\n        { status: 400 }\n      );`, `return errorResponse(\`以下订单状态不是待确认：\${invalidOrders.map((o) => o.orderNo).join(', ')}\`, 'VALIDATION_ERROR', 400);`],
  // success
  [`return NextResponse.json({\n      success: true,\n      message: \`成功确认 \${result.count} 条订单\`,\n      confirmedCount: result.count,\n    });`, `return successResponse({ confirmedCount: result.count }, \`成功确认 \${result.count} 条订单\`);`],
  // error
  [`return NextResponse.json(\n      { error: '确认失败：' + error.message },\n      { status: 500 }\n    );`, `return errorResponse('确认失败：' + error.message, 'INTERNAL_ERROR', 500);`],
]);

// ============ customers/batch-export/route.ts ============
replaceInFile('src/app/api/customers/batch-export/route.ts', [
  // auth error - keep new NextResponse for CSV content type
  [`return NextResponse.json(\n        { error: '请先登录' },\n        { status: 401 }\n      );`, `return errorResponse('请先登录', 'UNAUTHORIZED', 401);`],
  // CSV return - keep new NextResponse
  // error
  [`return NextResponse.json(\n      { error: '导出失败：' + error.message },\n      { status: 500 }\n    );`, `return errorResponse('导出失败：' + error.message, 'INTERNAL_ERROR', 500);`],
]);

// ============ customers/batch-import/route.ts ============
replaceInFile('src/app/api/customers/batch-import/route.ts', [
  // forbidden
  [`return NextResponse.json(\n        { error: '需要客户管理权限' },\n        { status: 403 },\n      );`, `return forbiddenResponse('需要客户管理权限');`],
  // batch size error
  [`return NextResponse.json(\n        {\n          error: \`单次最多导入 \${MAX_BATCH_SIZE} 条，当前 \${customers.length} 条\`,\n        },\n        { status: 400 },\n      );`, `return errorResponse(\`单次最多导入 \${MAX_BATCH_SIZE} 条，当前 \${customers.length} 条\`, 'VALIDATION_ERROR', 400);`],
  // success
  [`return NextResponse.json({\n      success: true,\n      message: \`导入完成：成功 \${successCount} 条（新增 \${createdCount}，更新 \${updatedCount}），失败 \${errors.length} 条\`,\n      results: {\n        success: successCount,\n        failed: errors.length,\n        created: createdCount,\n        updated: updatedCount,\n        errors,\n      },\n    });`, `return successResponse({ success: successCount, failed: errors.length, created: createdCount, updated: updatedCount, errors }, \`导入完成：成功 \${successCount} 条（新增 \${createdCount}，更新 \${updatedCount}），失败 \${errors.length} 条\`);`],
  // error
  [`return NextResponse.json(\n      { error: '导入失败：' + error.message },\n      { status: 500 },\n    );`, `return errorResponse('导入失败：' + error.message, 'INTERNAL_ERROR', 500);`],
]);

// ============ customers/batch-tag/route.ts ============
replaceInFile('src/app/api/customers/batch-tag/route.ts', [
  // forbidden
  [`return NextResponse.json(\n        { error: '需要客户管理权限' },\n        { status: 403 }\n      );`, `return forbiddenResponse('需要客户管理权限');`],
  // result
  [`return NextResponse.json({\n      success: false,\n      message: '批量标签功能暂未实现',\n      results,\n    });`, `return successResponse({ results }, '批量标签功能暂未实现');`],
  // error
  [`return NextResponse.json(\n      { error: '操作失败：' + error.message },\n      { status: 500 }\n    );`, `return errorResponse('操作失败：' + error.message, 'INTERNAL_ERROR', 500);`],
]);

// ============ quotations/[id]/send/route.ts ============
replaceInFile('src/app/api/quotations/[id]/send/route.ts', [
  // auth
  [`return NextResponse.json(\n        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },\n        { status: 401 }\n      );`, `return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);`],
  // not found
  [`return NextResponse.json(\n        { error: 'Quotation not found' },\n        { status: 404 }\n      );`, `return notFoundResponse('Quotation');`],
  // success
  [`return NextResponse.json({\n      success: true,\n      message: '报价单已发送',\n      quotation: updatedQuotation,\n      sentTo: validatedData.recipientEmails,\n      sentAt: new Date().toISOString(),\n    });`, `return successResponse({ quotation: updatedQuotation, sentTo: validatedData.recipientEmails, sentAt: new Date().toISOString() }, '报价单已发送');`],
  // Zod error
  [`return NextResponse.json(\n        { error: 'Validation failed' },\n        { status: 400 }\n      );`, `return errorResponse('Validation failed', 'VALIDATION_ERROR', 400);`],
  // general error
  [`return NextResponse.json(\n      { error: 'Failed to send quotation' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to send quotation', 'INTERNAL_ERROR', 500);`],
]);

// ============ products/batch-export/route.ts ============
replaceInFile('src/app/api/products/batch-export/route.ts', [
  // auth
  [`return NextResponse.json(\n        { error: '请先登录' },\n        { status: 401 }\n      );`, `return errorResponse('请先登录', 'UNAUTHORIZED', 401);`],
  // csv file - keep new NextResponse
  // error
  [`return NextResponse.json(\n      { error: '导出失败：' + error.message },\n      { status: 500 }\n    );`, `return errorResponse('导出失败：' + error.message, 'INTERNAL_ERROR', 500);`],
]);

console.log('\nDone with batch replacements.');
