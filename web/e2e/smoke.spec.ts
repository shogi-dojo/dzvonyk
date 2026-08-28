// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

test.describe('Дзвоник smoke tests', () => {
  test('app loads and shows dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Дзвоник|FET|Timetable/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigates to Settings and creates new rules', async ({ page }) => {
    await page.goto('/#/settings');
    const createBtn = page.getByRole('button', { name: /створити|create new/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    }
    await expect(page.getByLabel(/назва закладу|institution name/i)).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Teachers page', async ({ page }) => {
    await page.goto('/#/teachers');
    await expect(page.getByRole('button', { name: /додати вчител|add teacher/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Students page', async ({ page }) => {
    await page.goto('/#/students');
    await expect(page.getByRole('button', { name: /додати паралель|add year/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Activities page', async ({ page }) => {
    await page.goto('/#/activities');
    await expect(page.getByRole('button', { name: /додати урок|add lesson/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Constraints page', async ({ page }) => {
    await page.goto('/#/constraints');
    await expect(page.locator('body')).toBeVisible();
  });

  test('sanitary toggle is present in Settings', async ({ page }) => {
    await page.goto('/#/settings');
    const createBtn = page.getByRole('button', { name: /створити|create new/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    }
    await expect(page.getByText(/санітарн|sanitary/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shifts config appears in Settings', async ({ page }) => {
    await page.goto('/#/settings');
    const createBtn = page.getByRole('button', { name: /створити|create new/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    }
    await expect(page.getByText(/зміни|shifts/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
