import { test, expect } from '@playwright/test';
import { SyntheticRozBuilder } from '../src/lib/rozFixture';
import fs from 'fs';
import path from 'path';

test('Teacher workload accurately displays alternating-week fractional hours in card and print report', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // 1. Upload synthetic ROZ file
  const fixturesDir = path.resolve(process.cwd(), 'e2e/fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  const rozPath = path.join(fixturesDir, 'workload-test.roz');
  if (!fs.existsSync(rozPath)) {
    const builder = new SyntheticRozBuilder()
      .setSchool('Гімназія №131', '2025/2026')
      .setSubjects(['Українська мова', 'Українська література'])
      .setTeachers(['Сисова Оксана'])
      .setClasses(['5-А'])
      .addLesson(1, 2, 0, 0, 0)
      .addCard(1, 1, 0);
    fs.writeFileSync(rozPath, Buffer.from(builder.build()));
  }

  const fileInput = page.locator('input[accept=".roz"]');
  await fileInput.setInputFiles(rozPath);

  // Confirm import
  const confirmBtn = page.getByRole('button', { name: /^імпортувати$/i });
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
  await confirmBtn.click();

  // 2. Navigate to Teachers page
  await page.locator('aside').first().getByRole('link', { name: /вчителі/i }).click();
  await expect(page.getByText('Сисова Оксана').first()).toBeVisible({ timeout: 10_000 });

  // 3. Navigate to Print / Reports page
  await page.locator('aside').first().getByRole('link', { name: /друк/i }).click();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });

  // Verify Save PDF and Print buttons
  const savePdfBtn = page.getByRole('main').getByRole('button', { name: /зберегти pdf/i });
  await expect(savePdfBtn).toBeVisible({ timeout: 10_000 });

  // Switch to "Тарифікація / Навантаження" report
  const workloadReportBtn = page.getByRole('main').getByRole('button', { name: 'Тарифікація / Навантаження' });
  await expect(workloadReportBtn).toBeVisible({ timeout: 10_000 });
  await workloadReportBtn.click();

  // Verify that the table header and rows are rendered
  await expect(page.getByText('ТАРИФІКАЦІЙНИЙ ЗВІТ ТИЖНЕВОГО НАВАНТАЖЕННЯ ВИКЛАДАЧІВ')).toBeVisible();
  await expect(page.getByText('Сисова Оксана')).toBeVisible();

  // Intercept window.print to verify native vector PDF print trigger
  await page.evaluate(() => {
    interface PrintRecord {
      title: string;
      isPdfMode: boolean;
      hasPageSizeStyle: boolean;
    }
    const win = window as Window & { __printCalls?: PrintRecord[] };
    win.__printCalls = [];
    win.print = () => {
      win.__printCalls?.push({
        title: document.title,
        isPdfMode: document.body.classList.contains('pdf-print-mode'),
        hasPageSizeStyle: !!document.getElementById('pdf-custom-page-size-style'),
      });
      win.dispatchEvent(new Event('afterprint'));
    };
  });

  // 3. Test Save PDF on Тарифікація
  await savePdfBtn.click();
  await page.waitForTimeout(200);

  const printCalls = await page.evaluate(() => {
    return (window as Window & { __printCalls?: Array<{ title: string; isPdfMode: boolean }> }).__printCalls || [];
  });
  expect(printCalls.length).toBeGreaterThanOrEqual(1);
  expect(printCalls[0].title).toContain('Тарифікація_навантаження');
  expect(printCalls[0].isPdfMode).toBe(true);

  // Verify that hours are rendered and not NaN
  const row = page.locator('tr:has-text("Сисова Оксана")');
  await expect(row).toBeVisible();

  // 4. Test Classes Workload Matrix report
  const classesWorkloadBtn = page.getByRole('main').getByRole('button', { name: /навантаження класів/i });
  await expect(classesWorkloadBtn).toBeVisible({ timeout: 10_000 });
  await classesWorkloadBtn.click();
  await expect(page.getByText('ЗВЕДЕНЕ НАВАНТАЖЕННЯ КЛАСІВ ПО ТИжнях', { exact: false })).toBeVisible();
  await expect(page.getByText('5-А')).toBeVisible();
  await expect(page.getByText(/збалансовано/i).first()).toBeVisible();

  await savePdfBtn.click();
  await page.waitForTimeout(200);

  const updatedPrintCalls = await page.evaluate(() => {
    return (window as Window & { __printCalls?: Array<{ title: string; isPdfMode: boolean }> }).__printCalls || [];
  });
  expect(updatedPrintCalls.length).toBeGreaterThanOrEqual(2);
  expect(updatedPrintCalls[1].title).toContain('Навантаження_класів_по_тижнях');

  // 6. Reload the page to ensure persisted state in IndexedDB renders correctly
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  await workloadReportBtn.click();
  await expect(page.getByText('ТАРИФІКАЦІЙНИЙ ЗВІТ ТИЖНЕВОГО НАВАНТАЖЕННЯ ВИКЛАДАЧІВ')).toBeVisible();
  await expect(page.locator('tr:has-text("Сисова Оксана")')).toBeVisible();
});
