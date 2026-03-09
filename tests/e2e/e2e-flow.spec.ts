import { test, expect } from '@playwright/test';

test.describe('ERP v0.4.0 E2E 流程测试', () => {
  
  // 检查运行时错误
  async function checkNoRuntimeError(page: any) {
    await page.waitForTimeout(1000);
    const errorDialog = page.locator('dialog:has-text("Runtime TypeError")');
    const errorCount = await errorDialog.count();
    if (errorCount > 0) {
      const errorText = await errorDialog.first().textContent();
      throw new Error(`运行时错误：${errorText}`);
    }
  }

  // ==================== 询盘→报价→订单流程测试 ====================
  
  test('E2E 流程 - 询盘到报价到订单完整流程', async ({ page }) => {
    console.log('\n=== 开始 E2E 流程测试 ===\n');
    
    // 步骤 1: 访问询盘管理
    console.log('步骤 1: 访问询盘管理页面');
    await page.goto('http://localhost:3001/inquiries');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增询盘/ })).toBeVisible();
    console.log('✓ 询盘管理页面加载成功\n');

    // 步骤 2: 访问报价管理
    console.log('步骤 2: 访问报价管理页面');
    await page.goto('http://localhost:3001/quotations');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增报价/ })).toBeVisible();
    console.log('✓ 报价管理页面加载成功\n');

    // 步骤 3: 访问订单管理
    console.log('步骤 3: 访问订单管理页面');
    await page.goto('http://localhost:3001/orders');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增订单/ })).toBeVisible();
    console.log('✓ 订单管理页面加载成功\n');

    // 步骤 4: 验证订单新建页面无错误
    console.log('步骤 4: 验证订单新建页面');
    await page.goto('http://localhost:3001/orders/new');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(3000);
    
    // 验证页面无运行时错误（检查对话框）
    const errorDialog = page.locator('dialog:has-text("Runtime")');
    const errorCount = await errorDialog.count();
    if (errorCount === 0) {
      console.log('✓ 订单新建页面无运行时错误\n');
    }

    console.log('=== E2E 流程测试完成 ===\n');
  });

  // ==================== 采购流程测试 ====================
  
  test('E2E 流程 - 采购管理到采购订单流程', async ({ page }) => {
    console.log('\n=== 开始采购流程测试 ===\n');
    
    // 步骤 1: 访问采购管理
    console.log('步骤 1: 访问采购管理页面');
    await page.goto('http://localhost:3001/purchases');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增采购单/ })).toBeVisible();
    console.log('✓ 采购管理页面加载成功\n');

    // 步骤 2: 访问采购订单
    console.log('步骤 2: 访问采购订单页面');
    await page.goto('http://localhost:3001/purchase-orders');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: '创建采购订单' })).toBeVisible();
    console.log('✓ 采购订单页面加载成功\n');

    // 步骤 3: 验证采购订单新建页面无错误
    console.log('步骤 3: 验证采购订单新建页面');
    await page.goto('http://localhost:3001/purchase-orders/new');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(3000);
    
    // 验证页面无运行时错误
    const errorDialog = page.locator('dialog:has-text("Runtime")');
    const errorCount = await errorDialog.count();
    if (errorCount === 0) {
      console.log('✓ 采购订单新建页面无运行时错误\n');
    }

    console.log('=== 采购流程测试完成 ===\n');
  });

  // ==================== 供应商管理流程测试 ====================
  
  test('E2E 流程 - 供应商管理到采购流程', async ({ page }) => {
    console.log('\n=== 开始供应商流程测试 ===\n');
    
    // 步骤 1: 访问供应商管理
    console.log('步骤 1: 访问供应商管理页面');
    await page.goto('http://localhost:3001/suppliers');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增供应商/ })).toBeVisible();
    console.log('✓ 供应商管理页面加载成功\n');

    // 步骤 2: 验证供应商详情页面
    console.log('步骤 2: 验证供应商列表');
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    console.log('✓ 供应商列表显示正常\n');

    console.log('=== 供应商流程测试完成 ===\n');
  });
});
