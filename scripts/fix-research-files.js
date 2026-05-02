/**
 * Replace NextResponse.json calls in product-research route files.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/Users/apple/clawd/trade-erp';

function replaceInFile(relPath, replacements) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.split(search).join(replace);
      console.log(`  Replaced in ${relPath}`);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(fullPath, content);
  } else {
    console.log(`  No changes in ${relPath}`);
  }
}

// ============= product-research/comparisons/route.ts =============
replaceInFile('src/app/api/product-research/comparisons/route.ts', [
  // GET success
  [`return NextResponse.json({\n      success: true,\n      data: comparisons,\n    });`, `return successResponse(comparisons);`],
  // GET error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '获取对比列表失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('获取对比列表失败', 'INTERNAL_ERROR', 500);`],
  // getComparisonDetail not found (first)
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '对比不存在' \n      },\n      { status: 404 }\n    );`, `return notFoundResponse('对比');`],
  // getComparisonDetail not found (second duplicate)
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '对比不存在' \n      },\n      { status: 404 }\n    );`, `return notFoundResponse('对比');`],
  // getComparisonDetail success
  [`return NextResponse.json({\n    success: true,\n    data: {\n      ...comparison,\n      diffAnalysis,\n    },\n  });`, `return successResponse({ ...comparison, diffAnalysis });`],
  // POST validation error - name required
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '对比名称和对比产品为必填项' \n        },\n        { status: 400 }\n      );`, `return errorResponse('对比名称和对比产品为必填项', 'VALIDATION_ERROR', 400);`],
  // POST validation error - min 2 products
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '至少需要两个产品才能进行对比' \n        },\n        { status: 400 }\n      );`, `return errorResponse('至少需要两个产品才能进行对比', 'VALIDATION_ERROR', 400);`],
  // POST validation error - products not exist
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '部分产品不存在' \n        },\n        { status: 400 }\n      );`, `return errorResponse('部分产品不存在', 'VALIDATION_ERROR', 400);`],
  // POST validation error - category not exist
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '品类不存在' \n        },\n        { status: 400 }\n      );`, `return errorResponse('品类不存在', 'VALIDATION_ERROR', 400);`],
  // POST validation error - products not in category
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '部分产品不属于指定品类' \n        },\n        { status: 400 }\n      );`, `return errorResponse('部分产品不属于指定品类', 'VALIDATION_ERROR', 400);`],
  // POST success
  [`return NextResponse.json(\n      {\n        success: true,\n        data: comparison,\n        message: '产品对比创建成功',\n      },\n      { status: 201 }\n    );`, `return createdResponse(comparison, '产品对比创建成功');`],
  // POST error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '创建产品对比失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('创建产品对比失败', 'INTERNAL_ERROR', 500);`],
  // DELETE validation - id required
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '对比 ID 为必填项' \n        },\n        { status: 400 }\n      );`, `return errorResponse('对比 ID 为必填项', 'VALIDATION_ERROR', 400);`],
  // DELETE not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '对比不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('对比');`],
  // DELETE success
  [`return NextResponse.json({\n      success: true,\n      message: '对比删除成功',\n    });`, `return successResponse(null, '对比删除成功');`],
  // DELETE error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '删除对比失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('删除对比失败', 'INTERNAL_ERROR', 500);`],
]);

// ============= product-research/templates/[id]/route.ts =============
replaceInFile('src/app/api/product-research/templates/[id]/route.ts', [
  // GET not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '属性模板不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('属性模板');`],
  // GET success
  [`return NextResponse.json({\n      success: true,\n      data: template,\n    });`, `return successResponse(template);`],
  // GET error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '获取属性模板详情失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('获取属性模板详情失败', 'INTERNAL_ERROR', 500);`],
  // PUT not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '属性模板不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('属性模板');`],
  // PUT code exists
  [`return NextResponse.json(\n          { \n            success: false, \n            error: '属性编码已存在' \n          },\n          { status: 400 }\n        );`, `return errorResponse('属性编码已存在', 'VALIDATION_ERROR', 400);`],
  // PUT options required
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '选择类型属性必须提供选项' \n        },\n        { status: 400 }\n      );`, `return errorResponse('选择类型属性必须提供选项', 'VALIDATION_ERROR', 400);`],
  // PUT success
  [`return NextResponse.json({\n      success: true,\n      data: template,\n      message: '属性模板更新成功',\n    });`, `return successResponse(template, '属性模板更新成功');`],
  // PUT error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '更新属性模板失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('更新属性模板失败', 'INTERNAL_ERROR', 500);`],
  // DELETE not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '属性模板不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('属性模板');`],
  // DELETE in use
  [`return NextResponse.json(\n        { \n          success: false, \n          error: \`该属性已被 \${totalUsage} 个产品/调研记录使用，无法删除\` \n        },\n        { status: 400 }\n      );`, `return errorResponse(\`该属性已被 \${totalUsage} 个产品/调研记录使用，无法删除\`, 'CONFLICT', 409);`],
  // DELETE success
  [`return NextResponse.json({\n      success: true,\n      message: '属性模板删除成功',\n    });`, `return successResponse(null, '属性模板删除成功');`],
  // DELETE error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '删除属性模板失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('删除属性模板失败', 'INTERNAL_ERROR', 500);`],
]);

// ============= product-research/products/[id]/route.ts =============
replaceInFile('src/app/api/product-research/products/[id]/route.ts', [
  // GET not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '产品调研不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('产品调研');`],
  // GET success
  [`return NextResponse.json({\n      success: true,\n      data: product,\n    });`, `return successResponse(product);`],
  // GET error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '获取产品调研详情失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('获取产品调研详情失败', 'INTERNAL_ERROR', 500);`],
  // PUT not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '产品调研不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('产品调研');`],
  // PUT category not found
  [`return NextResponse.json(\n          { \n            success: false, \n            error: '所属品类不存在' \n          },\n          { status: 400 }\n        );`, `return errorResponse('所属品类不存在', 'VALIDATION_ERROR', 400);`],
  // PUT success
  [`return NextResponse.json({\n      success: true,\n      data: product,\n      message: '产品调研更新成功',\n    });`, `return successResponse(product, '产品调研更新成功');`],
  // PUT error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '更新产品调研失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('更新产品调研失败', 'INTERNAL_ERROR', 500);`],
  // DELETE not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '产品调研不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('产品调研');`],
  // DELETE success
  [`return NextResponse.json({\n      success: true,\n      message: '产品调研删除成功',\n    });`, `return successResponse(null, '产品调研删除成功');`],
  // DELETE error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '删除产品调研失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('删除产品调研失败', 'INTERNAL_ERROR', 500);`],
]);

// ============= product-research/products/batch/route.ts =============
replaceInFile('src/app/api/product-research/products/batch/route.ts', [
  // success
  [`return NextResponse.json({\n      success: true,\n      data: {\n        total: createdProducts.length,\n        products: createdProducts,\n      },\n    });`, `return successResponse({ total: createdProducts.length, products: createdProducts });`],
  // error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '批量导入失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('批量导入失败', 'INTERNAL_ERROR', 500);`],
]);

// ============= product-research/products/batch-delete/route.ts =============
replaceInFile('src/app/api/product-research/products/batch-delete/route.ts', [
  // validation error
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '请选择要删除的产品' \n        },\n        { status: 400 }\n      );`, `return errorResponse('请选择要删除的产品', 'VALIDATION_ERROR', 400);`],
  // success
  [`return NextResponse.json({\n      success: true,\n      message: \`成功删除 \${ids.length} 个产品\`,\n    });`, `return successResponse(null, \`成功删除 \${ids.length} 个产品\`);`],
  // error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '批量删除失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('批量删除失败', 'INTERNAL_ERROR', 500);`],
]);

// ============= product-research/attributes/route.ts =============
replaceInFile('src/app/api/product-research/attributes/route.ts', [
  // GET validation - productId or categoryId required
  [`return NextResponse.json(\n        { \n          success: false, \n          error: 'productId 或 categoryId 至少提供一个' \n        },\n        { status: 400 }\n      );`, `return errorResponse('productId 或 categoryId 至少提供一个', 'VALIDATION_ERROR', 400);`],
  // GET success
  [`return NextResponse.json({\n      success: true,\n      data: filteredValues,\n    });`, `return successResponse(filteredValues);`],
  // GET error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '获取属性值失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('获取属性值失败', 'INTERNAL_ERROR', 500);`],
  // POST validation - productId and attributes required
  [`return NextResponse.json(\n        { \n          success: false, \n          error: 'productId 和 attributes 为必填项' \n        },\n        { status: 400 }\n      );`, `return errorResponse('productId 和 attributes 为必填项', 'VALIDATION_ERROR', 400);`],
  // POST not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '产品调研不存在' \n        },\n        { status: 404 }\n      );`, `return notFoundResponse('产品调研');`],
  // POST success
  [`return NextResponse.json({\n      success: true,\n      data: results,\n      message: \`成功保存 \${results.length} 个属性值\`,\n    });`, `return successResponse(results, \`成功保存 \${results.length} 个属性值\`);`],
  // POST error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '保存属性值失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('保存属性值失败', 'INTERNAL_ERROR', 500);`],
]);

// ============= product-research/products/route.ts =============
replaceInFile('src/app/api/product-research/products/route.ts', [
  // GET validation error
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '查询参数验证失败',\n          details: formatValidationError(queryValidation.error)\n        },\n        { status: 400 }\n      );`, `return errorResponse('查询参数验证失败: ' + formatValidationError(queryValidation.error), 'VALIDATION_ERROR', 400);`],
  // GET success
  [`return NextResponse.json({\n      success: true,\n      data: productsWithConversion,\n      pagination: {\n        page,\n        limit,\n        total,\n        totalPages: Math.ceil(total / limit),\n      },\n    });`, `return listResponse(productsWithConversion, { page, limit, total, totalPages: Math.ceil(total / limit) });`],
  // GET error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '获取产品调研列表失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('获取产品调研列表失败', 'INTERNAL_ERROR', 500);`],
  // POST category not found
  [`return NextResponse.json(\n        { \n          success: false, \n          error: '所属品类不存在' \n        },\n        { status: 400 }\n      );`, `return errorResponse('所属品类不存在', 'VALIDATION_ERROR', 400);`],
  // POST success
  [`return NextResponse.json(\n      {\n        success: true,\n        data: product,\n        message: '产品调研创建成功',\n      },\n      { status: 201 }\n    );`, `return createdResponse(product, '产品调研创建成功');`],
  // POST error
  [`return NextResponse.json(\n      { \n        success: false, \n        error: '创建产品调研失败',\n        details: error instanceof Error ? error.message : 'Unknown error'\n      },\n      { status: 500 }\n    );`, `return errorResponse('创建产品调研失败', 'INTERNAL_ERROR', 500);`],
]);

console.log('\nDone with product-research replacements.');
