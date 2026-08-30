// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

// Fail fast on any uncaught page error — regressions in module init should
// break the build rather than hide behind a green route render.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('Дзвоник smoke tests', () => {
  test('app loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Layout main content should render on every page.
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar account actions stay inside the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    const sidebar = page.locator('aside');
    const toolbar = page.getByTestId('sidebar-account-toolbar');
    const signIn = toolbar.getByRole('button', { name: /увійти/i });
    await expect(signIn).toBeVisible();

    const [sidebarBox, toolbarBox, signInBox] = await Promise.all([
      sidebar.boundingBox(),
      toolbar.boundingBox(),
      signIn.boundingBox(),
    ]);
    expect(sidebarBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(signInBox).not.toBeNull();
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x);
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(
      sidebarBox!.x + sidebarBox!.width
    );
    expect(signInBox!.x + signInBox!.width).toBeLessThanOrEqual(
      sidebarBox!.x + sidebarBox!.width
    );
  });

  test('all routes render without crashing', async ({ page }) => {
    const routes = [
      '/#/',
      '/#/teachers',
      '/#/subjects',
      '/#/students',
      '/#/activities',
      '/#/rooms',
      '/#/constraints',
      '/#/generate',
      '/#/timetable',
      '/#/print',
      '/#/settings',
      '/#/about',
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('Settings: create new rules reveals institution field', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Two create-new buttons may exist (header + empty state); click the first.
    const createBtn = page.getByRole('button', { name: /створити/i }).first();
    await createBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await createBtn.click();

    await expect(page.getByLabel(/назва закладу/i)).toBeVisible({ timeout: 15_000 });
    // Phase 5b + Phase 4 cards should appear once rules exist.
    await expect(page.getByText('Санітарні норми')).toBeVisible();
    await expect(page.getByText('Зміни', { exact: true }).first()).toBeVisible();
  });
});
