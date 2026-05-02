/**
 * Replace all remaining NextResponse.json() calls in non-v1, non-debug/health route files.
 * Uses the api-response.ts helper functions.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/Users/apple/clawd/trade-erp';

// Map of file patterns to replace
// Each entry: [filePath, replacements] where replacements is array of [searchText, replaceText]
const replacements = {
  // ============= users/[id]/permissions/route.ts =============
  'src/app/api/users/[id]/permissions/route.ts': [
    // not found
    [`return NextResponse.json({ error: 'User not found' }, { status: 404 });`, `return notFoundResponse('User');`],
    // success
    [`return NextResponse.json({\n      data: permissions,\n      grouped: groupedPermissions,\n      permissionCodes: permissions.map(p => p.name),\n    });`, `return successResponse({ data: permissions, grouped: groupedPermissions, permissionCodes: permissions.map(p => p.name) });`],
    // error
    [`return NextResponse.json(\n      { error: 'Failed to fetch permissions' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch permissions', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= users/[id]/roles/route.ts =============
  'src/app/api/users/[id]/roles/route.ts': [
    // POST not found
    [`return NextResponse.json({ error: 'User not found' }, { status: 404 });`, `return notFoundResponse('User');`],
    // POST success
    [`return NextResponse.json({\n      data: roles,\n      message: 'Roles updated successfully',\n    });`, `return successResponse({ data: roles }, 'Roles updated successfully');`],
    // POST error
    [`return NextResponse.json(\n      { error: 'Failed to assign roles' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to assign roles', 'INTERNAL_ERROR', 500);`],
    // GET not found
    [`return NextResponse.json({ error: 'User not found' }, { status: 404 });`, `return notFoundResponse('User');`],
    // GET success
    [`return NextResponse.json({ data: roles });`, `return successResponse({ data: roles });`],
    // GET error
    [`return NextResponse.json(\n      { error: 'Failed to fetch roles' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch roles', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= permissions/[id]/route.ts =============
  'src/app/api/permissions/[id]/route.ts': [
    // GET not found
    [`return NextResponse.json({ error: 'Permission not found' }, { status: 404 });`, `return notFoundResponse('Permission');`],
    // GET success
    [`return NextResponse.json({ data: permission });`, `return successResponse({ data: permission });`],
    // GET error
    [`return NextResponse.json(\n      { error: 'Failed to fetch permission' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch permission', 'INTERNAL_ERROR', 500);`],
    // PUT success
    [`return NextResponse.json({ data: permission });`, `return successResponse({ data: permission });`],
    // PUT error
    [`return NextResponse.json(\n      { error: 'Failed to update permission' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to update permission', 'INTERNAL_ERROR', 500);`],
    // DELETE not found
    [`return NextResponse.json({ error: 'Permission not found' }, { status: 404 });`, `return notFoundResponse('Permission');`],
    // DELETE conflict
    [`return NextResponse.json(\n        {\n          error: 'Cannot delete permission assigned to roles',\n          roleCount: permission.roles.length,\n        },\n        { status: 400 }\n      );`, `return validationErrorResponse([{ field: 'permission', message: 'Cannot delete permission assigned to roles' }]);`],
    // DELETE success
    [`return NextResponse.json({ success: true });`, `return successResponse(null, 'Permission deleted');`],
    // DELETE error
    [`return NextResponse.json(\n      { error: 'Failed to delete permission' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to delete permission', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= permissions/init/route.ts =============
  'src/app/api/permissions/init/route.ts': [
    // POST success
    [`return NextResponse.json({\n      message: 'Initialization completed',\n      createdPermissions,\n      createdRoles,\n      totalPermissions: defaultPermissions.length,\n      totalRoles: defaultRoles.length,\n    });`, `return successResponse({ message: 'Initialization completed', createdPermissions, createdRoles, totalPermissions: defaultPermissions.length, totalRoles: defaultRoles.length });`],
    // POST error
    [`return NextResponse.json(\n      { error: 'Failed to initialize permissions', details: String(error) },\n      { status: 500 }\n    );`, `return errorResponse('Failed to initialize permissions', 'INTERNAL_ERROR', 500);`],
    // GET success
    [`return NextResponse.json({\n      initialized: permissionCount > 0 && roleCount > 0,\n      permissionCount,\n      roleCount,\n      defaultPermissionsCount: defaultPermissions.length,\n      defaultRolesCount: defaultRoles.length,\n    });`, `return successResponse({ initialized: permissionCount > 0 && roleCount > 0, permissionCount, roleCount, defaultPermissionsCount: defaultPermissions.length, defaultRolesCount: defaultRoles.length });`],
    // GET error
    [`return NextResponse.json(\n      { error: 'Failed to check status' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to check status', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= products/[id]/attributes/route.ts =============
  'src/app/api/products/[id]/attributes/route.ts': [
    // success
    [`return NextResponse.json({\n      success: true,\n      data: attributes,\n    });`, `return successResponse(attributes);`],
    // error
    [`return NextResponse.json(\n      { error: 'Failed to fetch product attributes' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch product attributes', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= roles/create/route.ts =============
  'src/app/api/roles/create/route.ts': [
    // conflict
    [`return NextResponse.json(\n        { error: 'Role with this name already exists' },\n        { status: 400 }\n      );`, `return errorResponse('Role with this name already exists', 'CONFLICT', 409);`],
    // success
    [`return NextResponse.json({ data: role }, { status: 201 });`, `return createdResponse(role, 'Role created successfully');`],
    // error
    [`return NextResponse.json(\n      { error: 'Failed to create role' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to create role', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= suppliers/[id]/route.ts =============
  'src/app/api/suppliers/[id]/route.ts': [
    // GET not found
    [`return NextResponse.json(\n        { error: 'Supplier not found' },\n        { status: 404 }\n      );`, `return notFoundResponse('Supplier');`],
    // GET success
    [`return NextResponse.json(supplier);`, `return successResponse(supplier);`],
    // GET error
    [`return NextResponse.json(\n      { error: 'Failed to fetch supplier' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch supplier', 'INTERNAL_ERROR', 500);`],
    // PUT success
    [`return NextResponse.json(supplier);`, `return successResponse(supplier);`],
    // PUT error
    [`return NextResponse.json(\n      { error: 'Failed to update supplier' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to update supplier', 'INTERNAL_ERROR', 500);`],
    // DELETE error
    [`return NextResponse.json(\n      { error: 'Failed to delete supplier' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to delete supplier', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= dashboard/overview/route.ts =============
  'src/app/api/dashboard/overview/route.ts': [
    // success inside withCache
    [`return NextResponse.json({\n        success: true,\n        data: responseData,\n      });`, `return successResponse(responseData);`],
    // error
    [`return NextResponse.json(\n      { success: false, error: 'Failed to fetch dashboard data' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch dashboard data', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= dashboard/orders/route.ts =============
  'src/app/api/dashboard/orders/route.ts': [
    // success
    [`return NextResponse.json({\n      success: true,\n      data: responseData,\n    });`, `return successResponse(responseData);`],
    // error
    [`return NextResponse.json(\n      { success: false, error: 'Failed to fetch order data' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch order data', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= dashboard/sales/route.ts =============
  'src/app/api/dashboard/sales/route.ts': [
    // success
    [`return NextResponse.json({\n      success: true,\n      data: responseData,\n    });`, `return successResponse(responseData);`],
    // error
    [`return NextResponse.json(\n      { success: false, error: 'Failed to fetch sales data' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch sales data', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= dashboard/products/route.ts =============
  'src/app/api/dashboard/products/route.ts': [
    // success
    [`return NextResponse.json({\n      success: true,\n      data: responseData,\n    });`, `return successResponse(responseData);`],
    // error
    [`return NextResponse.json(\n      { success: false, error: 'Failed to fetch product data' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch product data', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= dashboard/customers/route.ts =============
  'src/app/api/dashboard/customers/route.ts': [
    // success
    [`return NextResponse.json({\n      success: true,\n      data: responseData,\n    });`, `return successResponse(responseData);`],
    // error
    [`return NextResponse.json(\n      { success: false, error: 'Failed to fetch customer data' },\n      { status: 500 }\n    );`, `return errorResponse('Failed to fetch customer data', 'INTERNAL_ERROR', 500);`],
  ],

  // ============= inquiries/[id]/convert-to-quotation/route.ts =============
  'src/app/api/inquiries/[id]/convert-to-quotation/route.ts': [
    // ZodError catch
    [`return NextResponse.json(\n        { error: '请求参数验证失败' },\n        { status: 400 }\n      );`, `return errorResponse('请求参数验证失败', 'VALIDATION_ERROR', 400);`],
  ],
};

// Now process each file
for (const [relPath, fileReplacements] of Object.entries(replacements)) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;
  
  for (const [search, replace] of fileReplacements) {
    // Check if the old version still exists (since some might have already been replaced)
    if (content.includes(search)) {
      // Replace all occurrences
      const newContent = content.split(search).join(replace);
      if (newContent !== content) {
        content = newContent;
        changed = true;
        console.log(`  Replaced in ${relPath}`);
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(fullPath, content);
  }
}

console.log('\nDone with specific file replacements.');
