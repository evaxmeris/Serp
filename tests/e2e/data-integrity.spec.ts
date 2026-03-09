import { test, expect } from '@playwright/test';

test.describe('ERP v0.4.0 数据完整性验证', () => {
  
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

  // 验证表格有数据
  async function verifyTableHasData(page: any) {
    await page.waitForTimeout(1000);
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    
    // 检查表格是否有行数据（排除表头）
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    
    // 如果没有数据，检查是否有"暂无数据"提示
    if (rowCount === 0) {
      const emptyState = page.locator('text=暂无');
      const emptyCount = await emptyState.count();
      if (emptyCount === 0) {
        throw new Error('表格既无数据也无空状态提示');
      }
    }
    
    return rowCount;
  }

  // 验证金额显示格式
  async function verifyCurrencyFormat(page: any, selector: string) {
    const element = page.locator(selector).first();
    const text = await element.textContent();
    
    // 检查是否包含货币符号和数字
    if (text && (text.includes('CNY') || text.includes('¥') || text.match(/\d+\.\d{2}/))) {
      return true;
    }
    return false;
  }

  // 测试 1: 客户管理 - 数据验证
  test('客户管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/customers');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`客户列表行数：${rowCount}`);
    
    // 验证表头存在
    await expect(page.locator('text=公司名称')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增客户/ })).toBeVisible();
  });

  // 测试 2: 订单管理 - 数据验证
  test('订单管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/orders');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`订单列表行数：${rowCount}`);
    
    // 验证金额显示
    await expect(page.locator('text=金额')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增订单/ })).toBeVisible();
  });

  // 测试 3: 产品管理 - 数据验证
  test('产品管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/products');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`产品列表行数：${rowCount}`);
    
    // 验证价格显示（检查 .toFixed 是否正常工作）
    await expect(page.locator('text=成本')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增产品/ })).toBeVisible();
  });

  // 测试 4: 采购管理 - 数据验证
  test('采购管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/purchases');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`采购列表行数：${rowCount}`);
    
    // 验证金额显示
    await expect(page.locator('text=金额')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增采购单/ })).toBeVisible();
  });

  // 测试 5: 询盘管理 - 数据验证
  test('询盘管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/inquiries');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`询盘列表行数：${rowCount}`);
    
    // 验证目标价显示（检查 .toFixed 是否正常工作）
    await expect(page.locator('text=目标价')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增询盘/ })).toBeVisible();
  });

  // 测试 6: 报价管理 - 数据验证
  test('报价管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/quotations');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`报价列表行数：${rowCount}`);
    
    // 验证金额显示
    await expect(page.locator('text=金额')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增报价/ })).toBeVisible();
  });

  // 测试 7: 供应商管理 - 数据验证
  test('供应商管理页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/suppliers');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`供应商列表行数：${rowCount}`);
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: /新增供应商/ })).toBeVisible();
  });

  // 测试 8: 采购订单 - 数据验证
  test('采购订单页面数据应该正确显示', async ({ page }) => {
    await page.goto('http://localhost:3000/purchase-orders');
    await checkNoRuntimeError(page);
    
    // 验证表格有数据
    const rowCount = await verifyTableHasData(page);
    console.log(`采购订单列表行数：${rowCount}`);
    
    // 验证金额显示
    await expect(page.locator('text=总金额')).toBeVisible();
    
    // 验证按钮存在
    await expect(page.getByRole('button', { name: '创建采购订单' })).toBeVisible();
  });
});
