// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FAQ_ITEMS } from './faqData';

const EXPECTED_SCREENSHOT_IDS = [
  '01-dashboard',
  '02-roz-preview',
  '03-settings-calendar-sanitary',
  '04-teachers-workload',
  '05-students-hierarchy',
  '06-lesson-editor-parity',
  '07-subject-codes-tags',
  '08-rooms-buildings',
  '09-constraints',
  '10-generate-preflight',
  '11-full-class-matrix',
  '12-full-teacher-matrix',
  '13-drag-feedback-parity',
  '14-unplaced-and-details',
  '15-zoom-focus-labels',
  '16-print-reports',
  '17-workspaces-checkpoints',
  '18-history-account-privacy',
];

describe('FAQ Screenshot Walkthrough Assets Integrity', () => {
  const faqPublicDir = path.resolve(__dirname, '../../../public/faq');

  it('contains exactly 18 expected screenshot image files on disk', () => {
    for (const id of EXPECTED_SCREENSHOT_IDS) {
      const filePath = path.join(faqPublicDir, `${id}.png`);
      expect(fs.existsSync(filePath), `Missing screenshot: ${id}.png`).toBe(true);

      const stats = fs.statSync(filePath);
      expect(stats.size, `Screenshot ${id}.png is empty or too small`).toBeGreaterThan(1000);
    }
  });

  it('ensures all FAQ items with screenshots have valid captions and alt text', () => {
    const itemsWithScreenshots = FAQ_ITEMS.filter((item) => item.screenshotId);
    expect(itemsWithScreenshots.length).toBeGreaterThan(0);

    for (const item of itemsWithScreenshots) {
      expect(EXPECTED_SCREENSHOT_IDS).toContain(item.screenshotId);
      expect(item.screenshotCaption?.trim().length).toBeGreaterThan(5);
      expect(item.screenshotAlt?.trim().length).toBeGreaterThan(5);

      const filePath = path.join(faqPublicDir, `${item.screenshotId}.png`);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
