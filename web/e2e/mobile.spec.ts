// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

const ROUTES = [
  '/#/',
  '/#/teachers',
  '/#/subjects',
  '/#/students',
  '/#/activities',
  '/#/rooms',
  '/#/constraints',
  '/#/generate',
  '/#/timetable',
  '/#/settings',
];

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('iPhone SE 1 (320×568)', () => {
  test('no horizontal overflow on any route', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        // Allow 1px for sub-pixel rounding.
        return doc.scrollWidth - window.innerWidth;
      });
      expect(overflow, `route ${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test('Settings: keyboard shortcuts card fits viewport', async ({ page }) => {
    await page.goto('/#/settings');
    const heading = page.getByText(/Гарячі клавіші/).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const box = await heading.boundingBox();
    expect(box, 'heading should have a bounding box').not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320 + 1);
    }
  });

  test('mobile beta banner shows, dismisses, and stays dismissed', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    const banner = page.getByTestId('mobile-beta-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });

    await banner.getByRole('button').click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('mobile-beta-banner')).toHaveCount(0);
  });
});
