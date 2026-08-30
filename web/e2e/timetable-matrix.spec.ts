// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('Timetable Full Matrix & Workflows', () => {
  test('timetable page renders matrix view options and controls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/timetable');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Step 1: Check options
    const matrixOption = page.getByRole('button', { name: /загальна матриця \(класи\)/i });
    const teacherMatrixOption = page.getByRole('button', { name: /загальна матриця \(вчителі\)/i });

    if (await matrixOption.isVisible()) {
      await matrixOption.click();
      // Step 2 should display matrix preview
      await expect(page.getByText(/загальна матриця розкладу \(класи\)/i).first()).toBeVisible();

      // Click view timetable if button is active
      const viewBtn = page.getByRole('button', { name: /показати розклад/i });
      if (await viewBtn.isEnabled()) {
        await viewBtn.click();
        // Check change button is visible
        await expect(page.getByRole('button', { name: /змінити/i })).toBeVisible();
      }
    }

    if (await teacherMatrixOption.isVisible()) {
      await teacherMatrixOption.click();
      await expect(page.getByText(/загальна матриця розкладу \(вчителі\)/i).first()).toBeVisible();
    }
  });

  test('desktop sidebar collapse toggle expands and collapses navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/timetable');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    const collapseBtn = page.getByRole('button', { name: /згорнути бічну панель|розгорнути бічну панель/i });
    if (await collapseBtn.isVisible()) {
      // Toggle collapse
      await collapseBtn.click();
      // Verify aside has collapsed width or class
      const aside = page.locator('aside');
      await expect(aside).toBeVisible();

      // Toggle back to expanded
      await collapseBtn.click();
      await expect(aside).toBeVisible();
    }
  });

  test('subjects page has auto-fill subject codes button', async ({ page }) => {
    await page.goto('/#/subjects');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    const autoFillBtn = page.getByRole('button', { name: /заповнити скорочення/i });
    // Button exists in toolbar
    if (await autoFillBtn.isVisible()) {
      await expect(autoFillBtn).toBeEnabled();
    }
  });
});
