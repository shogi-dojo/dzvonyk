// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * Captures the release illustration shown by the What's New dialog.
 *
 * It must show the feature being announced — the institution-type picker —
 * rather than a recycled shot of a screen that did not change. Output is
 * version-keyed so past releases keep their own image, and it is regenerated
 * from the live UI so it can never advertise a preset the release does not
 * actually ship.
 */

import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
    localStorage.setItem('dzvonyk-theme', 'light');
  });

  await page.goto('/#/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /вибір навчального року/i }).click();
  await page.getByRole('button', { name: /додати заклад освіти/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/назва закладу/i).first().fill('Ліцей №15 м. Києва');

  // Лицей is the preset this release adds, so the shot shows it chosen.
  const lyceum = dialog.getByRole('radio', { name: /ліцей/i });
  await lyceum.click();
  await expect(lyceum).toHaveAttribute('aria-checked', 'true');

  // Guard the whole point of this file: the picture must not advertise a
  // preset that is not in this release.
  await expect(dialog.getByRole('radio', { name: /університет/i })).toHaveCount(0);
  await expect(dialog.getByRole('radio')).toHaveCount(4);

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
