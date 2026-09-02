// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('can switch institution type from Dashboard card in empty workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // When workspace is empty, the change card should be visible
  const changeCardTitle = page.getByText(/це не школа\?/i);
  await expect(changeCardTitle).toBeVisible({ timeout: 10_000 });

  // Click on "Коледж" preset card
  const collegeBtn = page.getByRole('radio', { name: /коледж/i });
  await expect(collegeBtn).toBeVisible();
  await collegeBtn.click();

  // Click "Застосувати тип" button
  const applyBtn = page.getByRole('button', { name: /застосувати тип/i });
  await expect(applyBtn).toBeVisible();
  await applyBtn.click();

  // Sidebar navigation and UI should now use College terminology
  const aside = page.locator('aside').first();
  await expect(aside.getByRole('link', { name: /викладачі/i })).toBeVisible({ timeout: 10_000 });
  await expect(aside.getByRole('link', { name: /студенти/i })).toBeVisible({ timeout: 10_000 });
});

test('college preset has academic bells in settings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // Switch to college
  const collegeBtn = page.getByRole('radio', { name: /коледж/i });
  if (await collegeBtn.isVisible()) {
    await collegeBtn.click();
    await page.getByRole('button', { name: /застосувати тип/i }).click();
  }

  // Click "Новий розклад" to navigate to Settings
  await page.getByRole('link', { name: /новий розклад/i }).click();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });

  // Create rules
  const createBtn = page.getByRole('button', { name: /створити/i }).first();
  if (await createBtn.isVisible()) {
    await createBtn.click();
  }

  // In College, periods title is "Пари дня"
  await expect(page.getByText(/пари дня/i)).toBeVisible({ timeout: 10_000 });
});
