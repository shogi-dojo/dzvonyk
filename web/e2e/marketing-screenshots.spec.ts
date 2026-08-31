// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createMarketingRozFixture,
  MARKETING_SCHOOL_NAME,
} from '../src/test/fixtures/marketingSchool';

const outputDir = path.resolve(process.cwd(), 'marketing-screenshots');
const fixturePath = path.resolve(process.cwd(), 'test-results/marketing-obriy.roz');
const screenshotNames = [
  '01-dashboard-overview',
  '02-teachers-workload',
  '03-lessons-catalog',
  '04-class-timetable',
  '05-teacher-timetable',
  '06-daily-report',
] as const;

test.beforeAll(() => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });

  for (const name of screenshotNames) {
    for (const extension of ['png', 'webp']) {
      const filePath = path.join(outputDir, `${name}.${extension}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  const fixture = createMarketingRozFixture();
  fs.writeFileSync(fixturePath, Buffer.from(fixture.bytes));
});

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dzvonyk_analytics_consent', 'denied');
    localStorage.setItem('dzvonyk_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
}

async function importMarketingSchool(page: Page) {
  await preparePage(page);
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.locator('input[accept=".roz"]').setInputFiles(fixturePath);
  const dialogTitle = page.getByText(/попередній перегляд імпорту/i);
  await expect(dialogTitle).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('dialog')).toContainText(MARKETING_SCHOOL_NAME);
  await page.getByRole('button', { name: /^імпортувати$/i }).click();
  await expect(dialogTitle).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(MARKETING_SCHOOL_NAME, { exact: true }).first()).toBeVisible();
}

async function captureScreenshot(page: Page, name: (typeof screenshotNames)[number]) {
  const pngPath = path.join(outputDir, `${name}.png`);
  const webpPath = path.join(outputDir, `${name}.webp`);

  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.caretColor = 'transparent';
  });
  await page.screenshot({ path: pngPath, animations: 'disabled' });

  try {
    execFileSync('cwebp', ['-quiet', '-q', '88', pngPath, '-o', webpPath]);
  } catch {
    // PNG remains the canonical output when cwebp is unavailable.
  }
}

async function openMatrix(page: Page, label: RegExp) {
  await page.goto('/#/timetable');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  const changeButton = page.getByRole('button', { name: /змінити/i });
  if (await changeButton.isVisible()) await changeButton.click();

  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: /переглянути розклад|показати розклад/i }).click();

  const matrix = page.getByTestId('timetable-matrix');
  await expect(matrix).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.getByTestId('matrix-lesson-card').count()).toBeGreaterThan(400);
  await expect(page.getByTestId('timetable-card')).toHaveAttribute('data-focus-mode', 'on');
}

test.describe.serial('Generate dense fictional marketing screenshots', () => {
  test('dashboard overview', async ({ page }) => {
    await importMarketingSchool(page);
    await expect(page.getByText('33', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('540', { exact: true }).first()).toBeVisible();
    await captureScreenshot(page, '01-dashboard-overview');
  });

  test('teachers and assigned workload', async ({ page }) => {
    await importMarketingSchool(page);
    await page.goto('/#/teachers');
    await expect(page.getByRole('heading', { name: 'Вчителі' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/33 усього/i)).toBeVisible();
    await expect.poll(() => page.getByRole('button', { name: 'Навантаження' }).count()).toBeGreaterThan(8);
    await captureScreenshot(page, '02-teachers-workload');
  });

  test('lessons catalog', async ({ page }) => {
    await importMarketingSchool(page);
    await page.goto('/#/activities');
    await expect(page.getByRole('heading', { name: 'Уроки' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/540 усього, 540 активних/i)).toBeVisible();

    const tagHeading = page.getByText('Типи заняття', { exact: true });
    await tagHeading.click();
    await expect.poll(() => page.getByRole('checkbox', { name: /обрати урок/i }).count()).toBe(10);
    await captureScreenshot(page, '03-lessons-catalog');
  });

  test('all classes matrix', async ({ page }) => {
    await importMarketingSchool(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);
    await expect(page.getByText(/загальна матриця розкладу \(класи\)/i)).toBeVisible();
    await captureScreenshot(page, '04-class-timetable');
  });

  test('all teachers matrix', async ({ page }) => {
    await importMarketingSchool(page);
    await openMatrix(page, /загальна матриця \(вчителі\)/i);
    await expect(page.getByText(/загальна матриця розкладу \(вчителі\)/i)).toBeVisible();
    await captureScreenshot(page, '05-teacher-timetable');
  });

  test('daily class report', async ({ page }) => {
    await importMarketingSchool(page);
    await page.goto('/#/print');
    await expect(page.getByRole('heading', { name: /друк та експорт звітів/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /по днях \(класи\)/i }).click();

    const report = page.locator('[data-print-area="true"]');
    await expect(report.getByText(/подобовий розклад уроків \(класи\)/i)).toBeVisible();
    await report.scrollIntoViewIfNeeded();
    await captureScreenshot(page, '06-daily-report');
  });

  test('all PNG outputs are substantial and distinct', async () => {
    const hashes = screenshotNames.map((name) => {
      const pngPath = path.join(outputDir, `${name}.png`);
      const bytes = fs.readFileSync(pngPath);
      expect(bytes.byteLength).toBeGreaterThan(100_000);
      return createHash('sha256').update(bytes).digest('hex');
    });

    expect(new Set(hashes).size).toBe(screenshotNames.length);
  });
});
