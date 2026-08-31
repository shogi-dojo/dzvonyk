// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Captures the release illustration shown by the What's New dialog.
 *
 * It must show the feature being announced — the institution-type picker —
 * rather than a recycled marketing shot of a screen that did not change.
 * Output is version-keyed so past releases keep their own image.
 */
const outputDir = path.resolve(process.cwd(), 'public/whats-new');
// Read package.json directly: importing src/lib/version pulls a JSON module
// that Playwright's loader refuses without an import attribute.
const APP_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
).version;

test('captures the institution type picker for the release note', async ({ page }) => {
  fs.mkdirSync(outputDir, { recursive: true });

  await page.addInitScript(() => {
    localStorage.setItem('dzvonyk_analytics_consent', 'denied');
    localStorage.setItem('dzvonyk_theme', 'light');
  });

  await page.goto('/#/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // Open the workspace dropdown, then the "add institution" dialog.
  await page.getByRole('button', { name: /вибір навчального року/i }).click();
  await page.getByRole('button', { name: /додати заклад освіти/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/назва закладу/i).fill('Національний університет');
  // Select the university preset so the shot shows the picker in use.
  await dialog.getByRole('radio', { name: /університет/i }).click();
  await expect(dialog.getByRole('radio', { name: /університет/i })).toHaveAttribute('aria-checked', 'true');

  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.caretColor = 'transparent';
  });

  const pngPath = path.join(outputDir, `${APP_VERSION}.png`);
  const webpPath = path.join(outputDir, `${APP_VERSION}.webp`);
  await dialog.screenshot({ path: pngPath, animations: 'disabled' });

  try {
    execFileSync('cwebp', ['-quiet', '-q', '88', pngPath, '-o', webpPath]);
  } catch {
    // PNG remains the canonical output when cwebp is unavailable.
  }

  expect(fs.statSync(pngPath).size).toBeGreaterThan(1000);
});
