// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { SyntheticRozBuilder } from '../src/lib/rozFixture';
import fs from 'fs';
import path from 'path';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('ROZ Import & Dashboard Buttons E2E', () => {
  const fixturesDir = path.resolve(process.cwd(), 'e2e/fixtures');
  const rozFilePath = path.join(fixturesDir, 'synthetic-school.roz');

  test.beforeAll(() => {
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    const builder = new SyntheticRozBuilder()
      .setSchool('Гімназія Тестова', '2026/2027')
      .setSubjects(['Математика', 'Українська мова', 'Історія'])
      .setTeachers(['Шевченко Т.Г.', 'Франко І.Я.'])
      .setClasses(['5-А', '6-А'])
      .addLesson(1, 2, 0, 0, 0)
      .addLesson(2, 2, 1, 0, 1)
      .addLesson(3, 2, 2, 1, 0)
      .addLesson(4, 2, 0, 1, 1)
      .addCard(1, 1, 0)
      .addCard(1, 1, 1)
      .addCard(2, 2, 0)
      .addCard(2, 2, 1)
      .addCard(3, 4, 0)
      .addCard(3, 4, 1)
      .addCard(4, 8, 0)
      .addCard(4, 8, 1);

    fs.writeFileSync(rozFilePath, Buffer.from(builder.build()));
  });

  test('Dashboard action buttons are clickable and not blocked by overlay', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Verify "Новий розклад" button is clickable and navigates to settings
    const newScheduleBtn = page.getByRole('link', { name: /новий розклад/i });
    await expect(newScheduleBtn).toBeVisible();
    await newScheduleBtn.click();
    await expect(page).toHaveURL(/.*#\/settings/);

    // Return to dashboard
    await page.goto('/#/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Verify "Згенерувати" button is clickable and navigates to generate
    const generateBtn = page.getByRole('link', { name: 'Згенерувати', exact: true });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    await expect(page).toHaveURL(/.*#\/generate/);
  });

  test('Full E2E: Import .roz file -> Preview Dialog -> Confirm -> Timetable & Print', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Upload .roz file via file chooser or file input
    const fileInput = page.locator('input[accept=".roz"]');
    await fileInput.setInputFiles(rozFilePath);

    // Verify RozImportDialog opens
    const dialogTitle = page.getByText(/попередній перегляд імпорту/i);
    await expect(dialogTitle).toBeVisible({ timeout: 10_000 });

    // Verify preview contents
    await expect(page.getByText('Гімназія Тестова').first()).toBeVisible();

    // Click confirm button
    const confirmBtn = page.getByRole('button', { name: /^імпортувати$/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Dialog should close and success message should appear
    await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });

    // Verify dashboard reflects imported institution
    await expect(page.getByText('Гімназія Тестова').first()).toBeVisible();

    // Verify navigation to timetable
    await page.goto('/#/timetable');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Verify navigation to print
    await page.goto('/#/print');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Гімназія Тестова').first()).toBeVisible();
  });
});
