import { test, expect } from '@playwright/test';

test.describe('ERP v0.4.0 核心功能测试', () => {
  
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

  // ==================== 客户管理测试 ====================
  
  test('客户管理 - 应该能打开新建客户对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/customers');
    await checkNoRuntimeError(page);
    
    // 等待页面加载完成
    await page.waitForTimeout(2000);
    
    // 点击"新增客户"按钮
    await page.getByRole('button', { name: /新增客户/ }).click();
    await page.waitForTimeout(1000);
    
    // 验证对话框打开
    await expect(page.getByRole('heading', { name: '新增客户' })).toBeVisible();
    
    console.log('✓ 客户新建对话框打开成功');
  });

  // ==================== 产品管理测试 ====================
  
  test('产品管理 - 应该能打开新建产品对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/products');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /新增产品/ }).click();
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('heading', { name: '新增产品' })).toBeVisible();
    
    console.log('✓ 产品新建对话框打开成功');
  });

  // ==================== 询盘管理测试 ====================
  
  test('询盘管理 - 应该能打开新建询盘对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/inquiries');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /新增询盘/ }).click();
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('heading', { name: '新增询盘' })).toBeVisible();
    
    console.log('✓ 询盘新建对话框打开成功');
  });

  // ==================== 报价管理测试 ====================
  
  test('报价管理 - 应该能打开新建报价对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/quotations');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /新增报价/ }).click();
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('heading', { name: '新增报价' })).toBeVisible();
    
    console.log('✓ 报价新建对话框打开成功');
  });

  // ==================== 订单管理测试 ====================
  
  test('订单管理 - 应该能打开新建订单对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/orders');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    // 订单页面使用"新增订单"按钮，但对话框标题可能是"创建销售订单"
    await page.getByRole('button', { name: /新增订单/ }).click();
    await page.waitForTimeout(2000);
    
    // 检查对话框是否打开（检查对话框常见元素）
    await expect(page.getByRole('dialog')).toBeVisible();
    
    console.log('✓ 订单新建对话框打开成功');
  });

  // ==================== 采购管理测试 ====================
  
  test('采购管理 - 应该能打开新建采购单对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/purchases');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /新增采购单/ }).click();
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('heading', { name: '新增采购单' })).toBeVisible();
    
    console.log('✓ 采购单新建对话框打开成功');
  });

  // ==================== 采购订单测试 ====================
  
  test('采购订单 - 应该能打开创建采购订单对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/purchase-orders');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: '创建采购订单' }).click();
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('heading', { name: '创建采购订单' })).toBeVisible();
    
    console.log('✓ 采购订单新建对话框打开成功');
  });

  // ==================== 供应商管理测试 ====================
  
  test('供应商管理 - 应该能打开新建供应商对话框', async ({ page }) => {
    await page.goto('http://localhost:3001/suppliers');
    await checkNoRuntimeError(page);
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /新增供应商/ }).click();
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('heading', { name: '新增供应商' })).toBeVisible();
    
    console.log('✓ 供应商新建对话框打开成功');
  });
});
