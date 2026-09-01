// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';

const ALL_ROUTES = [
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
  '/#/faq',
  '/#/about',
];

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('iPhone SE 1 (320×568)', () => {
  test('no horizontal overflow on any route', async ({ page }) => {
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        // Allow 1px for sub-pixel rounding.
        return doc.scrollWidth - window.innerWidth;
      });
      expect(overflow, `route ${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test('theme application and persistence on mobile via header menu', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);

    // Open toast / overflow menu in mobile header
    const menuBtn = page.getByTestId('mobile-header-menu-btn');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Toggle to dark mode using dropdown menu
    const darkThemeItem = page.getByRole('menuitem', { name: /темна тема/i });
    await expect(darkThemeItem).toBeVisible();
    await darkThemeItem.click();

    await expect(html).toHaveClass(/dark/);
    const darkThemeMeta = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(darkThemeMeta).toBe('#1a1510');

    // Reload and check persistence
    await page.reload();
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(html).toHaveClass(/dark/);

    // Switch back to light theme via header menu
    const menuBtnAfterReload = page.getByTestId('mobile-header-menu-btn');
    await menuBtnAfterReload.click();
    const lightThemeItem = page.getByRole('menuitem', { name: /світла тема/i });
    await lightThemeItem.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('side panel: full screen on mobile, renders all elements, and closes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    const openMenuBtn = page.getByRole('button', { name: /відкрити меню/i });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();

    const sidebar = page.locator('aside[role="navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Assert all major sections are visible inside the sidebar
    await expect(sidebar.getByRole('link', { name: /на головну/i })).toBeVisible();
    await expect(sidebar.getByText('Дзвоник')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /вибір навчального року/i })).toBeVisible();
    await expect(sidebar.locator('nav[aria-label="Primary"]')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /встановити додаток/i })).toBeVisible();

    // Wait for slide-in animation to finish settling
    await page.waitForFunction(() => {
      const el = document.querySelector('aside[role="navigation"]');
      if (!el) return false;
      return Math.round(el.getBoundingClientRect().left) >= 0;
    });

    // Verify sidebar is full screen on mobile (takes 320px width)
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    if (sidebarBox) {
      expect(Math.abs(sidebarBox.x)).toBeLessThan(1);
      expect(Math.round(sidebarBox.width)).toBe(320);
    }

    // Verify no document horizontal overflow while sidebar is open
    const overflowWithSidebar = await page.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth;
    });
    expect(overflowWithSidebar, 'Sidebar open should not cause horizontal overflow').toBeLessThanOrEqual(1);

    // Close via close button
    const closeBtn = sidebar.getByRole('button', { name: /закрити меню/i });
    await closeBtn.click();
    await expect(sidebar).toHaveClass(/-translate-x-full/);
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
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('mobile-beta-banner')).toHaveCount(0);
  });
});
