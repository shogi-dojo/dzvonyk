import { test, expect } from '@playwright/test';
import { SyntheticRozBuilder } from '../src/lib/rozFixture';
import fs from 'fs';
import path from 'path';

test('Daily matrix print reports (teachers and classes) export multi-page vector PDFs without horizontal clipping', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // 1. Upload synthetic ROZ file with school, teachers, classes, and lessons
  const rozPath = testInfo.outputPath('daily-matrix-test.roz');
  fs.mkdirSync(path.dirname(rozPath), { recursive: true });
  const builder = new SyntheticRozBuilder()
    .setSchool('Гімназія №131', '2025/2026')
    .setSubjects(['Українська мова', 'Математика'])
    .setTeachers(['Сисова Оксана Василівна'])
    .setClasses(['5-А'])
    .addLesson(1, 2, 0, 0, 0)
    .addCard(1, 1, 1);
  fs.writeFileSync(rozPath, Buffer.from(builder.build()));

  const fileInput = page.locator('input[accept=".roz"]');
  await fileInput.setInputFiles(rozPath);

  // Confirm import
  const confirmBtn = page.getByRole('button', { name: /^імпортувати$/i });
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
  await confirmBtn.click();

  // 2. Navigate to Print / Reports page
  await page.locator('aside').first().getByRole('link', { name: /друк/i }).click();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  const savePdfBtn = page.getByRole('main').getByRole('button', { name: /зберегти pdf/i });
  await expect(savePdfBtn).toBeVisible({ timeout: 10_000 });

  // Intercept window.print to record print parameters
  await page.evaluate(() => {
    interface PrintRecord {
      title: string;
      isPdfMode: boolean;
      hasPageSizeStyle: boolean;
      pageWidth: number;
      bodyWidth: number;
    }
    const win = window as Window & { __printCalls?: PrintRecord[] };
    win.__printCalls = [];
    win.print = () => {
      win.__printCalls?.push({
        title: document.title,
        isPdfMode: document.body.classList.contains('pdf-print-mode'),
        hasPageSizeStyle: !!document.getElementById('pdf-custom-page-size-style'),
        pageWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      });
      win.dispatchEvent(new Event('afterprint'));
    };
  });

  // 3. Test "По днях (Вчителі)" report
  const dailyTeachersBtn = page.getByRole('main').getByRole('button', { name: /по днях \(вчителі\)/i });
  await expect(dailyTeachersBtn).toBeVisible({ timeout: 10_000 });
  await dailyTeachersBtn.click();

  // Verify header and day titles in print preview
  await expect(page.getByText('ПОДОБОВИЙ РОЗКЛАД УРОКІВ (ВЧИТЕЛІ)')).toBeVisible();
  await expect(page.getByText('РОЗКЛАД УРОКІВ — ПОНЕДІЛОК').first()).toBeVisible();
  await expect(page.getByText('Сисова').first()).toBeVisible();

  // Trigger Save PDF
  await savePdfBtn.click();
  await page.waitForTimeout(200);

  const teacherPrintCalls = await page.evaluate(() => {
    return (window as Window & {
      __printCalls?: Array<{
        title: string;
        isPdfMode: boolean;
        hasPageSizeStyle: boolean;
        pageWidth: number;
        bodyWidth: number;
      }>;
    }).__printCalls || [];
  });

  expect(teacherPrintCalls.length).toBeGreaterThanOrEqual(1);
  expect(teacherPrintCalls[0].title).toContain('Розклад_по_днях_учителі');
  expect(teacherPrintCalls[0].isPdfMode).toBe(true);
  expect(teacherPrintCalls[0].hasPageSizeStyle).toBe(true);
  expect(teacherPrintCalls[0].bodyWidth).toBeLessThanOrEqual(teacherPrintCalls[0].pageWidth);

  // 4. Test "По днях (Класи)" report
  const dailyClassesBtn = page.getByRole('main').getByRole('button', { name: /по днях \(класи\)/i });
  await expect(dailyClassesBtn).toBeVisible({ timeout: 10_000 });
  await dailyClassesBtn.click();

  // Verify header and class matrix in print preview
  await expect(page.getByText('ПОДОБОВИЙ РОЗКЛАД УРОКІВ (КЛАСИ)')).toBeVisible();
  await expect(page.getByText('5-А').first()).toBeVisible();

  // Trigger Save PDF
  await savePdfBtn.click();
  await page.waitForTimeout(200);

  const updatedPrintCalls = await page.evaluate(() => {
    return (window as Window & {
      __printCalls?: Array<{
        title: string;
        isPdfMode: boolean;
        hasPageSizeStyle: boolean;
        pageWidth: number;
        bodyWidth: number;
      }>;
    }).__printCalls || [];
  });

  expect(updatedPrintCalls.length).toBeGreaterThanOrEqual(2);
  expect(updatedPrintCalls[1].title).toContain('Розклад_по_днях_класи');
  expect(updatedPrintCalls[1].isPdfMode).toBe(true);
  expect(updatedPrintCalls[1].hasPageSizeStyle).toBe(true);
  expect(updatedPrintCalls[1].bodyWidth).toBeLessThanOrEqual(updatedPrintCalls[1].pageWidth);
});
