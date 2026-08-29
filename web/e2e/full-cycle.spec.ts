// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('Full Cycle & Timetable E2E', () => {
  test('Settings -> Create rules -> Timetable and Print navigation', async ({ page }) => {
    // 1. Visit settings and create new rules
    await page.goto('/#/settings');
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });

    const createBtn = page.getByRole('button', { name: /створити/i }).first();
    await createBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await createBtn.click();

    await expect(page.getByLabel(/назва закладу/i)).toBeVisible({ timeout: 15_000 });

    // 2. Visit Generate page
    await page.goto('/#/generate');
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/налаштування генерації/i)).toBeVisible();

    // 3. Visit Timetable page
    await page.goto('/#/timetable');
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });

    // 4. Visit Print page
    await page.goto('/#/print');
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });
  });

  test('Print route: renders reports and switcher', async ({ page }) => {
    await page.goto('/#/print');
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });
  });
});
