// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { SyntheticRozBuilder } from '../src/lib/rozFixture';
import fs from 'fs';
import path from 'path';
import { MAX_ZOOM } from '../src/components/timetable/TimetableMatrix';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

const fixturesDir = path.resolve(process.cwd(), 'e2e/fixtures');
const rozFilePath = path.join(fixturesDir, 'matrix-school.roz');

/**
 * A small school with one deliberately unplaced lesson, so the unplaced tray has
 * something to show. Lesson 4 gets no card, which is what leaves it unplaced.
 */
test.beforeAll(() => {
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
  const builder = new SyntheticRozBuilder()
    .setSchool('Гімназія Матрична', '2026/2027')
    .setSubjects(['Математика', 'Українська мова', 'Історія'])
    .setTeachers(['Шевченко Т.Г.', 'Франко І.Я.'])
    .setClasses(['5-А', '6-А'])
    .addLesson(1, 2, 0, 0, 0)
    .addLesson(2, 2, 1, 0, 1)
    .addLesson(3, 2, 2, 1, 0)
    .addLesson(4, 1, 0, 1, 1)
    .addCard(1, 1, 0)
    .addCard(1, 1, 1)
    .addCard(2, 2, 0)
    .addCard(2, 2, 1)
    .addCard(3, 4, 0)
    .addCard(3, 4, 1);

  fs.writeFileSync(rozFilePath, Buffer.from(builder.build()));
});

async function importFixture(page: Page) {
  await page.goto('/#/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.locator('input[accept=".roz"]').setInputFiles(rozFilePath);

  const dialogTitle = page.getByText(/попередній перегляд імпорту/i);
  await expect(dialogTitle).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^імпортувати$/i }).click();
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
}

async function openMatrix(page: Page, label: RegExp) {
  await page.goto('/#/timetable');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: /переглянути розклад|показати розклад/i }).click();

  const matrix = page.getByTestId('timetable-matrix');
  await expect(matrix).toBeVisible({ timeout: 15_000 });
  return matrix;
}

test.describe('Timetable full matrix', () => {
  test('renders a two-row header, one row per class, and lesson codes', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    // Two header rows: days spanning their periods, then period numbers.
    const headerRows = matrix.locator('thead tr');
    await expect(headerRows).toHaveCount(2);

    // The corner cell spans both header rows.
    await expect(page.getByTestId('matrix-corner')).toHaveAttribute('rowspan', '2');

    // One row per class.
    const rowLabels = page.getByTestId('matrix-row-label');
    await expect(rowLabels).toHaveCount(2);
    await expect(rowLabels.first()).toContainText('5-А');

    // Lessons render as short codes, not full subject names.
    await expect(matrix.getByText('Ум', { exact: true }).first()).toBeVisible();
    await expect(matrix.getByText('Математика')).toHaveCount(0);
  });

  test('keeps the first column pinned while scrolling horizontally', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    // At fit zoom the whole week is visible, so zoom in until the grid overflows -
    // stickiness only means anything once there is something to scroll past.
    for (let i = 0; i < MAX_ZOOM; i++) {
      await page.getByTestId('zoom-in').click();
    }
    await expect
      .poll(async () => matrix.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeGreaterThan(0);

    const firstLabel = page.getByTestId('matrix-row-label').first();
    const before = await firstLabel.boundingBox();
    expect(before).not.toBeNull();

    await matrix.evaluate((el) => el.scrollBy({ left: 600 }));
    await expect
      .poll(async () => matrix.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);

    const after = await firstLabel.boundingBox();
    expect(after).not.toBeNull();
    // The sticky column must not travel with the scrolled content.
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
    await expect(firstLabel).toBeVisible();
  });

  test('lights slots green and red while a lesson is picked up', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    // Nothing is tinted before a lesson is picked up.
    await expect(page.locator('[data-verdict]')).toHaveCount(0);

    await matrix.getByText('Ум', { exact: true }).first().click();

    // Picking one up must classify every slot, both ways.
    await expect.poll(async () => page.locator('[data-verdict="valid"]').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-verdict="invalid"]').first()).toBeVisible();
  });

  test('moves a lesson into a free slot and keeps it after reload', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    const lesson = matrix.getByText('Ум', { exact: true }).first();
    const from = await lesson.locator('xpath=ancestor::td[1]').getAttribute('data-slot');
    await lesson.click();

    const target = page.locator('[data-verdict="valid"]').first();
    const to = await target.getAttribute('data-slot');
    expect(to).not.toBe(from);
    await target.click();

    const moved = page.locator(`[data-slot="${to}"]`).getByText('Ум', { exact: true }).first();
    await expect(moved).toBeVisible({ timeout: 10_000 });

    await page.reload();
    const matrixAfter = await openMatrix(page, /загальна матриця \(класи\)/i);
    await expect(
      matrixAfter.locator(`[data-slot="${to}"]`).getByText('Ум', { exact: true }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('refuses a move into a slot the grid marks red', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    const lesson = matrix.getByText('Ум', { exact: true }).first();
    const from = await lesson.locator('xpath=ancestor::td[1]').getAttribute('data-slot');
    await lesson.click();

    await page.locator('[data-verdict="invalid"]').first().click();

    // The lesson stays exactly where it was.
    await expect(
      matrix.locator(`[data-slot="${from}"]`).getByText('Ум', { exact: true }).first()
    ).toBeVisible();
  });

  test('lists lessons that have not been placed', async ({ page }) => {
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    const panel = page.getByTestId('unplaced-panel');
    await expect(panel).toBeVisible();
    // The fixture leaves lesson 4 without a card.
    await expect(page.getByTestId('unplaced-chip')).not.toHaveCount(0);
  });

  test('shows the same matrix for teachers', async ({ page }) => {
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(вчителі\)/i);

    const rowLabels = page.getByTestId('matrix-row-label');
    await expect(rowLabels).toHaveCount(2);
    await expect(rowLabels.first()).toContainText(/Шевченко|Франко/);
  });
});

test.describe('Matrix viewport and controls', () => {
  test('fits every day on screen with plain lesson numbers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);
    await page.getByTestId('focus-mode-toggle').click();

    // Period headers are lesson numbers, not clock times.
    const firstPeriod = page.locator('thead tr').nth(1).locator('th').first();
    await expect(firstPeriod).toHaveText('1');

    // All five days visible without horizontal scrolling.
    await expect(page.locator('thead tr').first().locator('th')).toHaveCount(6); // corner + 5 days
    const fits = await matrix.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fits).toBe(true);
  });

  test('zooming in trades overview for bigger cells', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    const cell = page.getByTestId('matrix-cell').first();
    const before = (await cell.boundingBox())!.width;

    await page.getByTestId('zoom-in').click();
    await expect.poll(async () => (await cell.boundingBox())!.width).toBeGreaterThan(before);

    await page.getByTestId('zoom-out').click();
    await expect.poll(async () => (await cell.boundingBox())!.width).toBe(before);
  });

  test('grid text cannot be selected while dragging', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);
    const userSelect = await matrix.evaluate((el) => getComputedStyle(el).userSelect);
    expect(userSelect).toBe('none');
  });

  test('horizontal overscroll cannot trigger browser back navigation', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);
    const behavior = await matrix.evaluate((el) => getComputedStyle(el).overscrollBehaviorX);
    expect(behavior).toBe('contain');
    const bodyBehavior = await page.evaluate(
      () => getComputedStyle(document.body).overscrollBehaviorX
    );
    expect(bodyBehavior).toBe('none');
  });
});

test.describe('Change history', () => {
  test('names the lesson and both slots after a move', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    await matrix.getByText('Ум', { exact: true }).first().click();
    await page.locator('[data-verdict="valid"]').first().click();
    await expect(page.getByTestId('lesson-details')).toBeVisible();

    // Focus mode hides the sidebar, so step out before reaching the history button.
    await page.getByTestId('focus-mode-toggle').click();
    await page.getByRole('button', { name: /історія змін/i }).first().click();

    // Not a bare "Змінено": the entry says which lesson went where.
    await expect(page.getByText(/Перенесено урок Українська мова/).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Matrix chrome', () => {
  test('opens focused, with the stats strip on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    // A matrix is for editing, so it opens focused without a second click.
    await expect(page.getByTestId('timetable-card')).toHaveAttribute('data-focus-mode', 'on');

    // The figures stay visible while focused, and carry real values.
    const stats = page.getByTestId('timetable-stats');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText(/Всього уроків:\s*[1-9]/);
  });

  test('a single-entity view still opens unfocused', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await importFixture(page);
    await page.goto('/#/timetable');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /за класами/i }).click();
    await page.getByRole('option', { name: /5-А/i }).first().click();
    await page.getByRole('button', { name: /переглянути розклад|показати розклад/i }).click();

    await expect(page.getByTestId('timetable-card')).toHaveAttribute('data-focus-mode', 'off');
  });
});

test.describe('Lesson details panel', () => {
  test('shows the clicked lesson in the bottom-left card', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    // Nothing selected yet: a prompt, not a stale card.
    const panel = page.getByTestId('lesson-details');
    await expect(panel).toHaveAttribute('data-empty', 'true');

    await matrix.getByText('Ум', { exact: true }).first().click();

    // Subject, class and teacher, as aSc shows them.
    await expect(panel).not.toHaveAttribute('data-empty', 'true');
    await expect(panel).toContainText('Українська мова');
    await expect(panel).toContainText('5-А');
    await expect(panel).toContainText('Франко');
  });

  test('clears when the lesson is deselected', async ({ page }) => {
    await importFixture(page);
    const matrix = await openMatrix(page, /загальна матриця \(класи\)/i);

    const lesson = matrix.getByText('Ум', { exact: true }).first();
    await lesson.click();
    await expect(page.getByTestId('lesson-details')).not.toHaveAttribute('data-empty', 'true');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lesson-details')).toHaveAttribute('data-empty', 'true');
  });

  test('describes an unplaced lesson picked from the tray', async ({ page }) => {
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    await page.getByTestId('unplaced-chip').first().click();
    const panel = page.getByTestId('lesson-details');
    await expect(panel).not.toHaveAttribute('data-empty', 'true');
  });
});

test.describe('Row label column', () => {
  test('shows a teacher as surname over initials', async ({ page }) => {
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(вчителі\)/i);

    // Fixture teachers are "Шевченко Т.Г." and "Франко І.Я.".
    const labels = await page.getByTestId('matrix-row-label').allInnerTexts();
    expect(labels.some((l) => /Шевченко\nТ\.Г\./.test(l))).toBe(true);
  });

  test('leaves class labels alone', async ({ page }) => {
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    const first = await page.getByTestId('matrix-row-label').first().innerText();
    expect(first.trim()).toBe('5-А');
  });

  test('column width can be dragged like a spreadsheet', async ({ page }) => {
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(вчителі\)/i);

    const label = page.getByTestId('matrix-row-label').first();
    const before = (await label.boundingBox())!.width;

    const handle = page.getByTestId('label-resize-handle');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => (await label.boundingBox())!.width).toBeGreaterThan(before + 50);

    // Double-click hands the width back to the zoom step.
    await handle.dblclick();
    await expect.poll(async () => (await label.boundingBox())!.width).toBe(before);
  });
});

test.describe('Zen / focus mode', () => {
  test('fills the screen and hides the surrounding chrome', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    // A matrix now opens focused, so step out and back in to exercise the toggle.
    const card = page.getByTestId('timetable-card');
    await expect(card).toHaveAttribute('data-focus-mode', 'on');

    await page.getByTestId('focus-mode-toggle').click();
    await expect(card).toHaveAttribute('data-focus-mode', 'off');

    await page.getByTestId('focus-mode-toggle').click();
    await expect(card).toHaveAttribute('data-focus-mode', 'on');

    // The matrix takes the whole viewport (allowing for the scrollbar gutter).
    const box = await card.boundingBox();
    const viewport = await page.evaluate(() => ({
      w: document.documentElement.clientWidth,
      h: document.documentElement.clientHeight,
    }));
    expect(box!.width).toBeGreaterThanOrEqual(viewport.w);
    expect(box!.height).toBeGreaterThanOrEqual(viewport.h);

    // ...and paints above the sidebar rather than behind it.
    const covered = await page.evaluate(() => {
      const el = document.elementFromPoint(40, 400);
      return Boolean(el?.closest('[data-testid="timetable-card"]'));
    });
    expect(covered).toBe(true);

    // Escape returns to the normal layout.
    await page.keyboard.press('Escape');
    await expect(card).toHaveAttribute('data-focus-mode', 'off');
  });

  test('leaving the grid also leaves focus mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await importFixture(page);
    await openMatrix(page, /загальна матриця \(класи\)/i);

    await expect(page.getByTestId('timetable-card')).toHaveAttribute('data-focus-mode', 'on');

    // "Змінити" returns to the view picker; it must not leave the app chrome hidden.
    await page.getByRole('button', { name: /змінити/i }).click();
    await expect
      .poll(async () => page.evaluate(() => document.body.classList.contains('matrix-focus')))
      .toBe(false);
    await expect(page.locator('aside')).toBeVisible();
  });
});

test.describe('Subject codes', () => {
  test('fills in short codes for every subject', async ({ page }) => {
    await importFixture(page);
    await page.goto('/#/subjects');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

    const autoFill = page.getByRole('button', { name: /заповнити коди автоматично/i });
    await expect(autoFill).toBeVisible();
    await autoFill.click();

    // Distinct codes, derived per word: Математика→Ма, Українська мова→Ум, Історія→Іс.
    await expect(page.getByText('Ум', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Ма', { exact: true }).first()).toBeVisible();
  });
});
