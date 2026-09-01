// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * The university/college release, exercised end to end in a real browser.
 *
 * Everything here has unit coverage already; what it did not have was a run
 * against actual IndexedDB, an actual i18next language switch and the actual
 * Dexie upgrade path. The Dexie v2 -> v3 migration in particular had never
 * executed outside a fake-indexeddb shim, which is the single most dangerous
 * gap in the branch.
 *
 * Seeding is done with a .fet file rather than the .roz used by the marketing
 * screenshots: .roz is a school-only binary with no notion of courses, groups
 * or streams.
 */

import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  createUniversityFetFixture,
  UNIVERSITY_NAME,
} from '../src/test/fixtures/universityFaculty';

const outputDir = path.resolve(process.cwd(), 'marketing-screenshots');
const fixturePath = path.resolve(process.cwd(), 'test-results/university-faculty.fet');
const fixture = createUniversityFetFixture();

test.beforeAll(() => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, fixture.xml, 'utf-8');
});

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dzvonyk_analytics_consent', 'denied');
    localStorage.setItem('dzvonyk_theme', 'light');
  });
}

async function capture(page: Page, name: string) {
  const pngPath = path.join(outputDir, `${name}.png`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.caretColor = 'transparent';
  });
  await page.screenshot({ path: pngPath, animations: 'disabled' });
  try {
    execFileSync('cwebp', ['-quiet', '-q', '88', pngPath, '-o', path.join(outputDir, `${name}.webp`)]);
  } catch {
    // PNG remains the canonical output when cwebp is unavailable.
  }
  expect(fs.statSync(pngPath).size).toBeGreaterThan(20_000);
}

/**
 * Creates an institution of the given type through the real creation dialog.
 * This is the only place the type can ever be chosen, so the test must use it
 * rather than writing the field directly.
 */
async function createInstitution(page: Page, name: string, presetLabel: RegExp) {
  await page.goto('/#/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /вибір навчального року/i }).click();
  await page.getByRole('button', { name: /додати заклад освіти/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/назва закладу/i).fill(name);

  const radio = dialog.getByRole('radio', { name: presetLabel });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');

  await dialog.getByRole('button', { name: /^створити$/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
}

async function importFaculty(page: Page) {
  await page.goto('/#/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[accept=".fet,.xml"]').first().setInputFiles(fixturePath);
  await expect(page.getByText(/успішно імпортовано/i)).toBeVisible({ timeout: 20_000 });
}

test.describe.serial('University and college institution types', () => {
  // ---------------------------------------------------------------- 1 ------
  test('a university speaks пари, викладачі and студенти, with 95-minute bells', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, UNIVERSITY_NAME, /^університет/i);

    // Navigation must switch terminology, not just one page.
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByText('Викладачі', { exact: true })).toBeVisible();
    await expect(nav.getByText('Студенти', { exact: true })).toBeVisible();
    await expect(nav.getByText('Пари', { exact: true })).toBeVisible();
    await expect(nav.getByText('Аудиторії', { exact: true })).toBeVisible();

    // And the school words must be gone, not merely shadowed.
    await expect(nav.getByText('Вчителі', { exact: true })).toHaveCount(0);
    await expect(nav.getByText('Уроки', { exact: true })).toHaveCount(0);

    // The bell schedule is data, not labels: 6 pairs of 95 minutes.
    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    const hourNames = await page.evaluate(async () => {
      const request = indexedDB.open('FETDatabase');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rules: Record<string, unknown>[] = await new Promise((resolve, reject) => {
        const tx = db.transaction('rules', 'readonly').objectStore('rules').getAll();
        tx.onsuccess = () => resolve(tx.result);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      const row = rules[0] as { hoursOfTheDay?: { name: string }[]; institutionType?: string };
      return { hours: row?.hoursOfTheDay?.map((h) => h.name) ?? [], type: row?.institutionType };
    });

    expect(hourNames.type).toBe('university');
    expect(hourNames.hours).toHaveLength(6);
    expect(hourNames.hours[0]).toMatch(/пара/);

    await capture(page, 'university-01-settings');
  });

  test('a university hides the school-only sanitary and shift settings', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, UNIVERSITY_NAME, /^університет/i);

    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // МОЗ №2205 governs school pupils only; two-shift teaching likewise.
    await expect(page.getByText(/санітарн/i)).toHaveCount(0);
    await expect(page.getByText(/двозмінне навчання/i)).toHaveCount(0);
  });

  test('a college speaks пари too, but with its own 80-minute bells', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, 'Фаховий коледж «Просвіта»', /^коледж/i);

    const nav = page.getByRole('navigation').first();
    await expect(nav.getByText('Викладачі', { exact: true })).toBeVisible();
    await expect(nav.getByText('Пари', { exact: true })).toBeVisible();

    const stored = await page.evaluate(async () => {
      const request = indexedDB.open('FETDatabase');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rules: Record<string, unknown>[] = await new Promise((resolve, reject) => {
        const tx = db.transaction('rules', 'readonly').objectStore('rules').getAll();
        tx.onsuccess = () => resolve(tx.result);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return rules[0] as { institutionType?: string; hoursOfTheDay?: { name: string }[] };
    });

    expect(stored.institutionType).toBe('college');
    expect(stored.hoursOfTheDay).toHaveLength(6);
  });

  test('a school keeps saying уроки and вчителі, and keeps its sanitary settings', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, 'Ліцей №4', /^школа/i);

    const nav = page.getByRole('navigation').first();
    await expect(nav.getByText('Вчителі', { exact: true })).toBeVisible();
    await expect(nav.getByText('Уроки', { exact: true })).toBeVisible();
    await expect(nav.getByText('Кабінети', { exact: true })).toBeVisible();

    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/санітарн/i).first()).toBeVisible();
  });

  // ---------------------------------------------------------------- 2 ------
  test('an existing pre-branch database migrates in place and stays a school', async ({ page }) => {
    await preparePage(page);

    // Build a genuine schema-v2 database — the shape shipped before this
    // branch — and let the app perform the real v2 -> v3 upgrade on open.
    await page.addInitScript(() => {
      // A real pre-branch profile holds rules and timetable data but no
      // School row of its own: the guest school is materialised by the v2
      // upgrade itself. Seeding one by hand would test a shape that never
      // shipped, so this writes only what a v1/v2 user actually had.
      (window as unknown as { __legacySeed: Promise<void> }).__legacySeed = new Promise<void>(
        (resolve, reject) => {
          const open = indexedDB.open('FETDatabase', 2);

          open.onupgradeneeded = () => {
            const db = open.result;
            for (const store of ['rules', 'teachers', 'subjects']) {
              if (!db.objectStoreNames.contains(store)) {
                db.createObjectStore(store, { keyPath: 'id' });
              }
            }
          };

          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(['rules', 'teachers', 'subjects'], 'readwrite');
            // No institutionType anywhere: exactly the pre-branch shape.
            tx.objectStore('rules').put({
              id: 'legacy-rules-1',
              mode: 0,
              institutionName: 'Стара школа №7',
              nDaysPerWeek: 5,
              nHoursPerDay: 7,
              daysOfTheWeek: [{ name: 'Понеділок' }],
              hoursOfTheDay: [{ name: '1 урок' }, { name: '2 урок' }],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            tx.objectStore('teachers').put({ id: 'legacy-teacher-1', name: 'Іваненко І. І.' });
            tx.objectStore('subjects').put({ id: 'legacy-subject-1', name: 'Українська мова' });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => reject(tx.error);
          };

          open.onerror = () => reject(open.error);
        }
      );
    });

    await page.goto('/#/');
    await page.waitForFunction(
      () => (window as unknown as { __legacySeed?: Promise<void> }).__legacySeed !== undefined
    );
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });

    // The upgrade must have backfilled 'school' on both mirrors...
    const migrated = await page.evaluate(async () => {
      const request = indexedDB.open('FETDatabase');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const read = <T,>(store: string): Promise<T[]> =>
        new Promise((resolve, reject) => {
          const req = db.transaction(store, 'readonly').objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result as T[]);
          req.onerror = () => reject(req.error);
        });
      const [rules, schools, teachers, subjects] = await Promise.all([
        read<{ id: string; institutionType?: string; institutionName?: string }>('rules'),
        read<{ id: string; name: string; institutionType?: string }>('schools'),
        read<{ id: string; name: string }>('teachers'),
        read<{ id: string; name: string }>('subjects'),
      ]);
      const version = db.version;
      db.close();
      return { rules, schools, teachers, subjects, version };
    });

    const legacyRules = migrated.rules.find((r) => r.id === 'legacy-rules-1');

    // Dexie multiplies its declared version by 10, so v3 reads back as 30.
    expect(migrated.version).toBe(30);

    // Both mirrors are backfilled: the rules row that already existed, and
    // the guest school the v2 upgrade materialised from it.
    expect(legacyRules?.institutionType).toBe('school');
    expect(migrated.schools).toHaveLength(1);
    expect(migrated.schools[0]?.institutionType).toBe('school');
    expect(migrated.schools[0]?.name).toBe('Стара школа №7');

    // ...without losing anything that was already there.
    expect(legacyRules?.institutionName).toBe('Стара школа №7');
    expect(migrated.teachers.some((t) => t.name === 'Іваненко І. І.')).toBe(true);
    expect(migrated.subjects.some((s) => s.name === 'Українська мова')).toBe(true);

    // This profile has pre-existing data, so it is exactly the audience the
    // What's New modal targets — it greets the upgrade and covers the nav.
    // Its appearing here is the first-run guard working, not a stray dialog.
    const whatsNew = page.getByRole('dialog');
    await expect(whatsNew.getByText(/що нового в дзвонику/i)).toBeVisible({ timeout: 15_000 });
    await capture(page, 'university-02-whats-new-on-upgrade');
    // Escape rather than a click: the dialog's open animation can still be
    // running, which makes the button resolve but not yet accept a click.
    await page.keyboard.press('Escape');
    await expect(whatsNew).not.toBeVisible({ timeout: 15_000 });

    // And behind it the UI still speaks school.
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByText('Вчителі', { exact: true })).toBeVisible();
    await expect(nav.getByText('Уроки', { exact: true })).toBeVisible();

    await capture(page, 'university-03-migrated-school');
  });

  // ---------------------------------------------------------------- 3 ------
  test('a checkpoint saved in a university restores as a university', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, UNIVERSITY_NAME, /^університет/i);
    await importFaculty(page);

    await page.goto('/#/settings');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    // Save a checkpoint, then confirm it round-trips the type. A snapshot
    // carries rules but not the School, so this is the path where a dropped
    // institutionType would silently turn a university back into a school.
    await page.getByRole('button', { name: /зберегти версію/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').first().fill('Після імпорту факультету');
    await dialog.getByRole('button', { name: /зберегти|створити/i }).last().click();
    await expect(dialog).not.toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Після імпорту факультету')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^відновити$/i }).first().click();
    await page.waitForTimeout(2_000);

    const afterRestore = await page.evaluate(async () => {
      const request = indexedDB.open('FETDatabase');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rules: { institutionType?: string }[] = await new Promise((resolve, reject) => {
        const req = db.transaction('rules', 'readonly').objectStore('rules').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return rules[0]?.institutionType;
    });

    expect(afterRestore).toBe('university');

    const nav = page.getByRole('navigation').first();
    await expect(nav.getByText('Пари', { exact: true })).toBeVisible();
  });

  // ---------------------------------------------------------------- 4 ------
  test('the What’s New modal appears once a workspace has data, then stays dismissed', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, UNIVERSITY_NAME, /^університет/i);
    await importFaculty(page);

    // The first-run guard suppresses the modal on an empty profile, so it can
    // only be observed after data exists. Clearing the marker mimics a user
    // who had the app before this release.
    await page.evaluate(() => localStorage.removeItem('dzvonyk.whatsNew.lastSeenVersion'));
    await page.reload();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText(/що нового в дзвонику/i)).toBeVisible();

    await capture(page, 'university-04-whats-new');

    await dialog.getByRole('button', { name: /гаразд/i }).click();
    await expect(dialog).not.toBeVisible();

    // Dismissal is written on close, so a reload must not bring it back.
    const marker = await page.evaluate(() =>
      localStorage.getItem('dzvonyk.whatsNew.lastSeenVersion')
    );
    expect(marker).toBeTruthy();

    await page.reload();
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/що нового в дзвонику/i)).toHaveCount(0);
  });

  // ---------------------------------------------------------------- 5 ------
  test('a stream lecture counts once for the lecturer and once per group in preflight', async ({ page }) => {
    await preparePage(page);
    await createInstitution(page, UNIVERSITY_NAME, /^університет/i);
    await importFaculty(page);

    await page.goto('/#/activities');
    await expect(page.getByRole('heading', { name: 'Пари' })).toBeVisible({ timeout: 15_000 });

    // The fixture's first-course lecture addresses five groups at once.
    const streamStats = await page.evaluate(async () => {
      const request = indexedDB.open('FETDatabase');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const activities: { teacherIds: string[]; studentSetIds: string[]; subjectId: string }[] =
        await new Promise((resolve, reject) => {
          const req = db.transaction('activities', 'readonly').objectStore('activities').getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      db.close();

      const streams = activities.filter((a) => a.studentSetIds.length > 1);
      const largest = streams.reduce(
        (a, b) => (b.studentSetIds.length > a.studentSetIds.length ? b : a),
        streams[0]
      );
      return {
        total: activities.length,
        streamCount: streams.length,
        largestGroups: largest?.studentSetIds.length ?? 0,
        largestTeachers: largest?.teacherIds.length ?? 0,
      };
    });

    expect(streamStats.total).toBe(fixture.stats.activities);
    expect(streamStats.streamCount).toBe(fixture.stats.streamLectures);
    expect(streamStats.largestGroups).toBe(5);
    // One activity, one lecturer: the stream is taught once, not five times.
    expect(streamStats.largestTeachers).toBe(1);

    await capture(page, 'university-05-activities-streams');

    // The workload panel must report the stream as a single obligation.
    await page.goto('/#/teachers');
    await expect(page.getByRole('heading', { name: 'Викладачі' })).toBeVisible({ timeout: 15_000 });
    await capture(page, 'university-06-lecturers-workload');
  });
});
