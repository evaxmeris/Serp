/**
 * 出库管理模块 E2E 测试
 * Sprint 5: Phase 5 - 测试与修复
 * 
 * 测试覆盖:
 * - 创建出库单流程
 * - 编辑出库单流程
 * - 确认/取消出库单
 * - 批量操作功能
 */

import { test, expect } from '@playwright/test';

test.describe('出库管理模块 E2E 测试', () => {
  // 测试数据
  const testOrderNo = `E2E-SO-${Date.now()}`;
  let outboundOrderId: string;

  test.beforeEach(async ({ page }) => {
    // 访问出库单列表页
    await page.goto('http://localhost:3000/outbound-orders');
  });

  test.describe('创建出库单流程', () => {
    test('应该成功创建出库单', async ({ page }) => {
      // 1. 点击创建按钮
      await page.click('button:has-text("创建出库单")');
      await expect(page).toHaveURL('/outbound-orders/new');

      // 2. 搜索销售订单
      await page.fill('input[placeholder*="搜索订单号"]', 'SO-');
      await page.click('button:has-text("搜索")');
      await page.waitForTimeout(500);

      // 3. 选择销售订单
      await page.click('[role="combobox"]:first-of-type');
      await page.click('[role="option"]:first-of-type');
      await page.waitForTimeout(500);

      // 4. 修改出库数量
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.fill('5');

      // 5. 提交创建
      await page.click('button:has-text("创建出库单")');
      await page.waitForTimeout(1000);

      // 6. 验证创建成功（应该跳转到详情页）
      await expect(page).toHaveURL(/\/outbound-orders\/[^/]+$/);
      
      // 7. 验证状态为待发货
      await expect(page.locator('text=待发货')).toBeVisible();
    });

    test('应该验证必填字段', async ({ page }) => {
      await page.click('button:has-text("创建出库单")');
      
      // 不选择销售订单直接提交
      await page.click('button:has-text("创建出库单")');
      await page.waitForTimeout(500);
      
      // 应该提示错误
      await expect(page.locator('text=请选择销售订单')).toBeVisible();
    });
  });

  test.describe('编辑出库单流程', () => {
    test('应该成功编辑草稿状态的出库单', async ({ page }) => {
      // 1. 找到草稿状态的出库单
      const draftRow = page.locator('tr:has-text("草稿")').first();
      
      // 2. 点击编辑按钮
      await draftRow.locator('button[title*="编辑"]').click();
      await page.waitForTimeout(500);
      
      // 3. 验证页面标题
      await expect(page).toHaveURL(/\/outbound-orders\/[^/]+\/edit$/);
      await expect(page.locator('text=编辑出库单')).toBeVisible();
      
      // 4. 修改商品数量
      const quantityInput = page.locator('input[type="number"]').first();
      const originalValue = await quantityInput.inputValue();
      const newValue = parseInt(originalValue) + 1;
      await quantityInput.fill(newValue.toString());
      
      // 5. 保存修改
      await page.click('button:has-text("保存修改")');
      await page.waitForTimeout(1000);
      
      // 6. 验证保存成功
      await expect(page).toHaveURL(/\/outbound-orders\/[^/]+$/);
    });

    test('非草稿状态出库单不能编辑', async ({ page }) => {
      // 找到待发货状态的出库单
      const pendingRow = page.locator('tr:has-text("待发货")').first();
      
      // 点击查看详情
      await pendingRow.locator('button[title*="查看"]').click();
      await page.waitForTimeout(500);
      
      // 验证没有编辑按钮
      await expect(page.locator('text=编辑')).not.toBeVisible();
    });
  });

  test.describe('确认/取消出库单', () => {
    test('应该成功确认出库单', async ({ page }) => {
      // 1. 找到待发货状态的出库单
      const pendingRow = page.locator('tr:has-text("待发货")').first();
      
      // 2. 点击确认按钮
      await pendingRow.locator('button[title*="确认"]').click();
      await page.waitForTimeout(500);
      
      // 3. 确认对话框
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('确认要批量发货');
        await dialog.accept();
      });
      
      // 4. 验证状态变更
      await page.waitForTimeout(1000);
      await expect(page.locator('text=已发货')).toBeVisible();
    });

    test('应该成功取消出库单', async ({ page }) => {
      // 1. 找到草稿状态的出库单
      const draftRow = page.locator('tr:has-text("草稿")').first();
      
      // 2. 点击取消按钮
      await draftRow.locator('button[title*="取消"]').click();
      await page.waitForTimeout(500);
      
      // 3. 确认对话框
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('确认要取消');
        await dialog.accept();
      });
      
      // 4. 验证状态变更
      await page.waitForTimeout(1000);
      await expect(page.locator('text=已取消')).toBeVisible();
    });
  });

  test.describe('批量操作功能', () => {
    test('应该支持批量选择', async ({ page }) => {
      // 1. 点击全选复选框
      await page.locator('thead input[type="checkbox"]').click();
      await page.waitForTimeout(300);
      
      // 2. 验证显示批量操作按钮
      await expect(page.locator('text=批量确认')).toBeVisible();
      await expect(page.locator('text=批量取消')).toBeVisible();
      await expect(page.locator('text=批量导出')).toBeVisible();
      
      // 3. 验证已选择数量提示
      await expect(page.locator('text=已选择')).toBeVisible();
    });

    test('应该支持批量导出', async ({ page }) => {
      // 1. 选择一个出库单
      const firstRow = page.locator('tbody tr').first();
      await firstRow.locator('input[type="checkbox"]').click();
      await page.waitForTimeout(300);
      
      // 2. 点击批量导出
      await page.click('button:has-text("批量导出")');
      await page.waitForTimeout(1000);
      
      // 3. 验证导出提示
      await expect(page.locator('text=成功导出')).toBeVisible();
    });

    test('应该支持批量确认', async ({ page }) => {
      // 1. 选择所有待发货状态的出库单
      const pendingRows = page.locator('tr:has-text("待发货")');
      const count = await pendingRows.count();
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          await pendingRows.nth(i).locator('input[type="checkbox"]').click();
        }
        await page.waitForTimeout(300);
        
        // 2. 点击批量确认
        await page.click('button:has-text("批量确认")');
        await page.waitForTimeout(500);
        
        // 3. 确认对话框
        page.on('dialog', async dialog => {
          await dialog.accept();
        });
        
        // 4. 验证操作完成提示
        await page.waitForTimeout(1000);
        await expect(page.locator('text=批量确认完成')).toBeVisible();
      }
    });
  });

  test.describe('筛选和搜索功能', () => {
    test('应该支持状态筛选', async ({ page }) => {
      // 1. 选择状态筛选
      await page.click('[role="combobox"]:has-text("全部状态")');
      await page.click('[role="option"]:has-text("待发货")');
      await page.waitForTimeout(500);
      
      // 2. 验证只显示待发货状态
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      
      if (count > 0) {
        await expect(page.locator('text=待发货').first()).toBeVisible();
      }
    });

    test('应该支持搜索', async ({ page }) => {
      // 1. 输入搜索关键词
      await page.fill('input[placeholder*="搜索出库单号"]', 'OB-');
      await page.click('button:has-text("搜索")');
      await page.waitForTimeout(500);
      
      // 2. 验证搜索结果
      await expect(page.locator('tbody tr')).toBeVisible();
    });
  });
});
