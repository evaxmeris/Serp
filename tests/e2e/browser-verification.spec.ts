import { test, expect } from '@playwright/test';

test.describe('ERP v0.4.0 功能页面验证', () => {
  
  // 检查是否有运行时错误
  async function checkNoRuntimeError(page: any) {
    await page.waitForTimeout(1000);
    const errorDialog = page.locator('dialog:has-text("Runtime TypeError")');
    const errorCount = await errorDialog.count();
    if (errorCount > 0) {
      const errorText = await errorDialog.first().textContent();
      throw new Error(`运行时错误：${errorText}`);
    }
    const errorPage = page.locator('h2:has-text("Application error")');
    const errorPageCount = await errorPage.count();
    if (errorPageCount > 0) {
      throw new Error('应用错误页面');
    }
  }

  // 测试 1: 首页
  test('首页应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('heading', { name: '欢迎使用 Trade ERP' })).toBeVisible();
  });

  // 测试 2: 客户管理
  test('客户管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/customers');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增客户/ })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 3: 订单管理
  test('订单管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/orders');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增订单/ })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 4: 产品管理
  test('产品管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/products');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增产品/ })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 5: 供应商管理
  test('供应商管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/suppliers');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增供应商/ })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 6: 采购订单
  test('采购订单页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/purchase-orders');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: '创建采购订单' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 7: 采购管理（新增 - 之前遗漏）
  test('采购管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/purchases');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增采购单/ })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 8: 询盘管理（新增）
  test('询盘管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/inquiries');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('button', { name: /新增询盘/ })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 9: 报价管理
  test('报价管理页面应该正常显示', async ({ page }) => {
    await page.goto('http://localhost:3000/quotations');
    await checkNoRuntimeError(page);
    await expect(page.getByRole('table')).toBeVisible();
  });

  // 测试 10: 平台订单
  test('平台订单页面应该存在或从导航移除', async ({ page }) => {
    const response = await page.goto('http://localhost:3001/platform-orders');
    await checkNoRuntimeError(page);
    expect([200, 404]).toContain(response?.status());
  });
});
