// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { SyntheticRozBuilder } from '../src/lib/rozFixture';
import fs from 'fs';
import path from 'path';

/**
 * Institution details onboarding.
 *
 * Production data was dominated by default names («Нова школа», «Default
 * Institution») because the app seeded them and never asked. These tests pin
 * the two halves of the fix: the app no longer invents a name, and the name
 * the user does give reaches the printed schedule — including the director,
 * which the approval block used to fill with the institution's own name.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('a fresh install has no fabricated institution name and prompts for one', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // The guest school is seeded nameless, so no invented name is on screen.
  await expect(page.getByRole('main')).not.toContainText('Нова школа');
  await expect(page.getByRole('main')).not.toContainText('Моя школа');
  await expect(page.getByRole('main')).not.toContainText('Default Institution');

  // Instead the dashboard asks for a real one.
  const prompt = page.getByText('Як називається ваш заклад?');
  await expect(prompt).toBeVisible({ timeout: 10_000 });

  const nameInput = page.getByRole('main').getByLabel('Назва закладу');
  await nameInput.fill('Ліцей №15 м. Києва');
  await page.getByRole('main').getByRole('button', { name: /^зберегти$/i }).click();

  // Saving replaces the prompt with the real name, shown in the card and the
  // sidebar switcher.
  await expect(prompt).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole('main')).toContainText('Ліцей №15 м. Києва');
  await expect(page.locator('aside').first()).toContainText('Ліцей №15 м. Києва');
});

test('the director prints in the approval block instead of the institution name', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // Import a timetable so the print page has something to render.
  const rozPath = testInfo.outputPath('institution-details.roz');
  fs.mkdirSync(path.dirname(rozPath), { recursive: true });
  const builder = new SyntheticRozBuilder()
    .setSchool('Гімназія №131', '2025/2026')
    .setSubjects(['Українська мова'])
    .setTeachers(['Сисова Оксана'])
    .setClasses(['5-А'])
    .addLesson(1, 2, 0, 0, 0)
    .addCard(1, 1, 1);
  fs.writeFileSync(rozPath, Buffer.from(builder.build()));

  await page.locator('input[accept=".roz"]').setInputFiles(rozPath);
  const confirmBtn = page.getByRole('button', { name: /^імпортувати$/i });
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
  await confirmBtn.click();

  // Set a director in Settings.
  await page.locator('aside').first().getByRole('link', { name: /налаштування/i }).click();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });

  const director = page.getByLabel(/^Директор/);
  await expect(director).toBeVisible({ timeout: 10_000 });
  await director.fill('Шевченко І. І.');
  await page.getByLabel(/^Адреса/).fill('м. Київ, вул. Шевченка, 1');
  await page.getByRole('main').getByRole('button', { name: /зберегти/i }).first().click();

  // The printed header must name the director, not the institution.
  await page.locator('aside').first().getByRole('link', { name: /друк/i }).click();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });

  const printArea = page.locator('.print-area, [data-print-area]').first();
  const scope = (await printArea.count()) > 0 ? printArea : page.getByRole('main');

  await expect(scope).toContainText('Директор Шевченко І. І.', { timeout: 10_000 });
  await expect(scope).not.toContainText('Директор Гімназія №131');
});
