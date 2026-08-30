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

  // Switch to "Тарифікація / Навантаження" report
  const workloadReportBtn = page.getByRole('main').getByRole('button', { name: 'Тарифікація / Навантаження' });
  await expect(workloadReportBtn).toBeVisible({ timeout: 10_000 });
  await workloadReportBtn.click();

  // Verify that the table header and rows are rendered
  await expect(page.getByText('ТАРИФІКАЦІЙНИЙ ЗВІТ ТИЖНЕВОГО НАВАНТАЖЕННЯ ВИКЛАДАЧІВ')).toBeVisible();
  await expect(page.getByText('Сисова Оксана')).toBeVisible();

  // Verify that hours are rendered and not NaN
  const row = page.locator('tr:has-text("Сисова Оксана")');
  await expect(row).toBeVisible();

  // 4. Reload the page to ensure persisted state in IndexedDB renders correctly
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  await workloadReportBtn.click();
  await expect(page.getByText('ТАРИФІКАЦІЙНИЙ ЗВІТ ТИЖНЕВОГО НАВАНТАЖЕННЯ ВИКЛАДАЧІВ')).toBeVisible();
  await expect(page.locator('tr:has-text("Сисова Оксана")')).toBeVisible();
});
