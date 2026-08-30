// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { SyntheticRozBuilder } from '../src/lib/rozFixture';

const fixturesDir = path.resolve(process.cwd(), 'e2e/fixtures');
const demoRozPath = path.join(fixturesDir, 'demo-suzirya.roz');
const screenshotsDir = path.resolve(process.cwd(), 'public/faq');

test.beforeAll(() => {
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const builder = new SyntheticRozBuilder()
    .setSchool('Ліцей «Демо-Сузір’я»', '2026/2027')
    .setSubjects([
      'Українська мова',
      'Алгебра',
      'Геометрія',
      'Історія України',
      'Англійська мова',
      'Інформатика',
      'Фізика',
      'Біологія',
      'Фізична культура',
    ])
    .setTeachers([
      'Прикладенко Ірина Василівна',
      'Уявний Мирон Петрович',
      'Макетна Соломія Ігорівна',
      'Зразковий Богдан Тарасович',
      'Показова Олена Михайлівна',
      'Тестовий Назар Андрійович',
    ])
    .setClasses(['5-А', '6-А', '7-А', '8-А', '9-А', '10-А', '11-А']);

  // Add realistic lesson distribution
  builder.addLesson(1, 4, 0, 0, 0); // Укр мова
  builder.addLesson(2, 4, 1, 0, 1); // Алгебра
  builder.addLesson(3, 3, 3, 0, 2); // Історія
  builder.addLesson(4, 3, 4, 0, 3); // Англійська
  builder.addLesson(5, 2, 5, 0, 4); // Інформатика
  builder.addLesson(6, 3, 8, 0, 5); // Фізкультура

  builder.addLesson(7, 4, 0, 1, 0); // Укр мова
  builder.addLesson(8, 4, 1, 1, 1); // Алгебра
  builder.addLesson(9, 2, 7, 1, 4); // Біологія
  builder.addLesson(10, 3, 4, 1, 3); // Англійська

  builder.addLesson(11, 3, 1, 2, 1); // Алгебра
  builder.addLesson(12, 2, 2, 2, 1); // Геометрія
  builder.addLesson(13, 2, 6, 2, 5); // Фізика
  builder.addLesson(14, 3, 0, 2, 0); // Укр мова (deliberately unplaced)

  // Placed cards across week
  builder.addCard(1, 1, 0);
  builder.addCard(1, 2, 0);
  builder.addCard(1, 4, 0);
  builder.addCard(1, 8, 0);

  builder.addCard(2, 1, 1);
  builder.addCard(2, 2, 1);
  builder.addCard(2, 4, 1);
  builder.addCard(2, 8, 1);

  builder.addCard(3, 1, 2);
  builder.addCard(3, 4, 2);
  builder.addCard(3, 16, 1);

  builder.addCard(4, 2, 2);
  builder.addCard(4, 8, 2);
  builder.addCard(4, 16, 2);

  builder.addCard(5, 1, 3);
  builder.addCard(5, 4, 3);

  builder.addCard(6, 2, 3);
  builder.addCard(6, 8, 3);
  builder.addCard(6, 16, 0);

  builder.addCard(7, 1, 1);
  builder.addCard(7, 2, 1);
  builder.addCard(8, 1, 0);
  builder.addCard(9, 4, 0);
  builder.addCard(10, 8, 1);

  builder.addCard(11, 2, 0);
  builder.addCard(12, 4, 1);
  builder.addCard(13, 8, 0);

  fs.writeFileSync(demoRozPath, Buffer.from(builder.build()));
});

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dzvonyk_analytics_consent', 'declined');
    localStorage.setItem('dzvonyk_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
}

async function importDemoSchool(page: Page) {
  await preparePage(page);
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.locator('input[accept=".roz"]').setInputFiles(demoRozPath);
  const dialogTitle = page.getByText(/попередній перегляд імпорту/i);
  await expect(dialogTitle).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^імпортувати$/i }).click();
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
}

async function captureScreenshot(page: Page, name: string) {
  const pngPath = path.join(screenshotsDir, `${name}.png`);
  const webpPath = path.join(screenshotsDir, `${name}.webp`);
  await page.screenshot({ path: pngPath });

  try {
    execSync(`cwebp -q 85 "${pngPath}" -o "${webpPath}"`, { stdio: 'ignore' });
  } catch {
    // Graceful fallback if cwebp CLI is not present
  }
}

async function openMatrix(page: Page, label: RegExp) {
  await page.goto('/#/timetable');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  const changeBtn = page.getByRole('button', { name: /змінити/i });
  if (await changeBtn.isVisible()) {
    await changeBtn.click();
  }

  const optionBtn = page.getByRole('button', { name: label });
  await expect(optionBtn).toBeVisible({ timeout: 10_000 });
  await optionBtn.click();

  const viewBtn = page.getByRole('button', { name: /переглянути розклад|показати розклад/i });
  await expect(viewBtn).toBeVisible({ timeout: 10_000 });
  await viewBtn.click();

  const matrix = page.getByTestId('timetable-matrix');
  await expect(matrix).toBeVisible({ timeout: 15_000 });
  return matrix;
}

test.describe.serial('Capture 18 FAQ Walkthrough Screenshots', () => {
  test('02-roz-preview: Capture .roz preview modal', async ({ page }) => {
    await preparePage(page);
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    await page.locator('input[accept=".roz"]').setInputFiles(demoRozPath);
    const dialogTitle = page.getByText(/попередній перегляд імпорту/i);
    await expect(dialogTitle).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);

    await captureScreenshot(page, '02-roz-preview');
  });

  test('01-dashboard: Capture main dashboard', async ({ page }) => {
    await importDemoSchool(page);
    await page.waitForTimeout(400);
    await captureScreenshot(page, '01-dashboard');
  });

  test('03-settings-calendar-sanitary: Capture settings', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '03-settings-calendar-sanitary');
  });

  test('04-teachers-workload: Capture teachers workload', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/teachers');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '04-teachers-workload');
  });

  test('05-students-hierarchy: Capture students classes', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/students');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '05-students-hierarchy');
  });

  test('06-lesson-editor-parity: Capture lessons list', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/activities');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '06-lesson-editor-parity');
  });

  test('07-subject-codes-tags: Capture subjects list', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/subjects');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '07-subject-codes-tags');
  });

  test('08-rooms-buildings: Capture rooms', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/rooms');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '08-rooms-buildings');
  });

  test('09-constraints: Capture constraints', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/constraints');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '09-constraints');
  });

  test('10-generate-preflight: Capture generator & preflight', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/generate');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, '10-generate-preflight');
  });

  test('11-full-class-matrix: Capture full class matrix', async ({ page }) => {
    await importDemoSchool(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);
    await page.waitForTimeout(400);
    await captureScreenshot(page, '11-full-class-matrix');
  });

  test('12-full-teacher-matrix: Capture full teacher matrix', async ({ page }) => {
    await importDemoSchool(page);
    await openMatrix(page, /загальна матриця \(вчителі\)/i);
    await page.waitForTimeout(400);
    await captureScreenshot(page, '12-full-teacher-matrix');
  });

  test('13-drag-feedback-parity: Capture drag and slot feedback', async ({ page }) => {
    await importDemoSchool(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);
    await page.waitForTimeout(400);
    await captureScreenshot(page, '13-drag-feedback-parity');
  });

  test('14-unplaced-and-details: Capture unplaced tray and details', async ({ page }) => {
    await importDemoSchool(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    const firstLesson = page.getByTestId('matrix-lesson-card').first();
    if (await firstLesson.isVisible()) {
      await firstLesson.click();
      await page.waitForTimeout(300);
    }

    await captureScreenshot(page, '14-unplaced-and-details');
  });

  test('15-zoom-focus-labels: Capture zoom & focus controls', async ({ page }) => {
    await importDemoSchool(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);
    await page.waitForTimeout(300);

    await captureScreenshot(page, '15-zoom-focus-labels');
  });

  test('16-print-reports: Capture print preview', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/print');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);

    await captureScreenshot(page, '16-print-reports');
  });

  test('17-workspaces-checkpoints: Capture workspaces & checkpoints', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);

    await captureScreenshot(page, '17-workspaces-checkpoints');
  });

  test('18-history-account-privacy: Capture history & privacy controls', async ({ page }) => {
    await importDemoSchool(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);

    await captureScreenshot(page, '18-history-account-privacy');
  });
});
