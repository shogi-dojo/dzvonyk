// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * The institution-type release, exercised in a real browser.
 *
 * The type can only ever be chosen in two places — the creation dialog and the
 * Dashboard card for a still-empty workspace — so both are driven here rather
 * than writing the field directly. The terminology and bell-schedule
 * assertions read the stored rules as well as the rendered UI, because a
 * preset that only changes labels would be a bug: it changes data too.
 */

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const APP_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
).version;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  // The version must be passed in: the init script body runs in the browser,
  // where a Node-scope constant is not defined.
  await page.addInitScript((version) => {
    localStorage.setItem('dzvonyk_analytics_consent', 'denied');
    // Marking THIS version as seen keeps the release modal shut. Storing any
    // other version would open it, and an open Radix modal sets aria-hidden
    // on #root — every role-based locator below would then find nothing, even
    // though the page itself renders correctly.
    localStorage.setItem('dzvonyk.whatsNew.lastSeenVersion', version);
  }, APP_VERSION);
});

/** Reads the materialised rules row straight out of IndexedDB. */
async function readRules(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('FETDatabase');
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows: { institutionType?: string; hoursOfTheDay?: { name: string }[] }[] =
      await new Promise((resolve, reject) => {
        const req = db.transaction('rules', 'readonly').objectStore('rules').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    db.close();
    return rows[0];
  });
}

/**
 * Reads the active School row. `School.institutionType` is the source of
 * truth; `TimetableRules.institutionType` only mirrors it so snapshots stay
 * portable, and a workspace with no timetable yet has no rules row to mirror
 * into.
 */
async function readSchools(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('FETDatabase');
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows: { name: string; institutionType?: string }[] = await new Promise(
      (resolve, reject) => {
        const req = db.transaction('schools', 'readonly').objectStore('schools').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return rows;
  });
}

/** Creates an institution through the real dialog — the only place type is chosen. */
async function createInstitution(page: Page, name: string, presetLabel: RegExp) {
  await page.goto('/#/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /вибір навчального року/i }).click();
  await page.getByRole('button', { name: /додати заклад освіти/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/назва закладу/i).first().fill(name);

  const radio = dialog.getByRole('radio', { name: presetLabel });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');

  await dialog.getByRole('button', { name: /^створити$/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
}

test.describe('Institution type presets', () => {
  test('the creation dialog offers exactly the four presets this release ships', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /вибір навчального року/i }).click();
    await page.getByRole('button', { name: /додати заклад освіти/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio')).toHaveCount(4);
    for (const label of [/школа/i, /гімназія/i, /ліцей/i, /коледж/i]) {
      await expect(dialog.getByRole('radio', { name: label })).toBeVisible();
    }
    // Streams ship in a later release; the picker must not advertise them.
    await expect(dialog.getByRole('radio', { name: /університет/i })).toHaveCount(0);

    // School is the default, so an untouched dialog still creates something sane.
    await expect(dialog.getByRole('radio', { name: /школа/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  test('a lyceum speaks school terminology and keeps the sanitary settings', async ({ page }) => {
    await createInstitution(page, 'Ліцей №15 м. Києва', /ліцей/i);

    const nav = page.locator('aside').first();
    await expect(nav.getByRole('link', { name: /вчител/i })).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole('link', { name: /^уроки\s/i })).toBeVisible();

    const rules = await readRules(page);
    expect(rules?.institutionType).toBe('lyceum');
    expect(rules?.hoursOfTheDay).toHaveLength(7);
    expect(rules?.hoursOfTheDay?.[0].name).toMatch(/урок/);

    // МОЗ №2205 governs загальна середня освіта, which includes the lyceum.
    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/санітарн/i).first()).toBeVisible();
  });

  test('a gymnasium is a school in everything but name', async ({ page }) => {
    await createInstitution(page, 'Гімназія №1', /гімназія/i);

    const rules = await readRules(page);
    expect(rules?.institutionType).toBe('gymnasium');
    expect(rules?.hoursOfTheDay).toHaveLength(7);
    expect(rules?.hoursOfTheDay?.[0].name).toMatch(/урок/);

    const nav = page.locator('aside').first();
    await expect(nav.getByRole('link', { name: /вчител/i })).toBeVisible({ timeout: 10_000 });
  });

  test('a college speaks пари and викладачі on 80-minute bells', async ({ page }) => {
    await createInstitution(page, 'Фаховий коледж «Просвіта»', /коледж/i);

    const nav = page.locator('aside').first();
    await expect(nav.getByRole('link', { name: /викладачі/i })).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole('link', { name: /студенти/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^пари\s/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /аудиторії/i })).toBeVisible();

    const rules = await readRules(page);
    expect(rules?.institutionType).toBe('college');
    expect(rules?.hoursOfTheDay).toHaveLength(6);
    expect(rules?.hoursOfTheDay?.[0].name).toMatch(/пара/);
  });

  test('a college hides the school-only sanitary and shift settings', async ({ page }) => {
    await createInstitution(page, 'Фаховий коледж «Просвіта»', /коледж/i);

    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Both are school-education concepts and must not reach a college.
    await expect(page.getByText(/санітарн/i)).toHaveCount(0);
    await expect(page.getByText(/двозмінне навчання/i)).toHaveCount(0);
  });

  test('the Dashboard card retypes a workspace while it is still empty', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/це не школа\?/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('radio', { name: /коледж/i }).click();
    await page.getByRole('button', { name: /застосувати тип/i }).click();

    const nav = page.locator('aside').first();
    await expect(nav.getByRole('link', { name: /викладачі/i })).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole('link', { name: /студенти/i })).toBeVisible();

    const schools = await readSchools(page);
    expect(schools.some((school) => school.institutionType === 'college')).toBe(true);
  });
});
