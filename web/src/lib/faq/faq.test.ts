// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { FAQ_CATEGORIES, FAQ_ITEMS, resolveFaqItem } from './faqData';
import { searchFAQ, normalizeSearchString } from './faqSearch';
import { searchFAQ as searchWithPreset } from './faqSearch';

describe('FAQ Knowledge Base Catalog', () => {
  it('contains all 7 required categories', () => {
    expect(FAQ_CATEGORIES.map((c) => c.id)).toEqual([
      'start',
      'entities',
      'constraints',
      'timetable',
      'interface',
      'print_export',
      'workspaces',
    ]);
  });

  it('contains at least 39 questions across all categories', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(39);
  });

  it('ensures every question belongs to a valid category and has non-empty fields', () => {
    const validCategoryIds = new Set(FAQ_CATEGORIES.map((c) => c.id));

    for (const item of FAQ_ITEMS) {
      expect(validCategoryIds.has(item.categoryId)).toBe(true);
      expect(item.id.trim().length).toBeGreaterThan(0);
      expect(item.question.trim().length).toBeGreaterThan(5);
      expect(item.answer.trim().length).toBeGreaterThan(15);
      expect(item.keywords.length).toBeGreaterThan(0);
    }
  });

  it('has unique question IDs', () => {
    const ids = FAQ_ITEMS.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('FAQ Search Engine', () => {
  it('normalizes search terms and apostrophes correctly', () => {
    expect(normalizeSearchString("п'ять")).toBe("п'ять");
    expect(normalizeSearchString("п’ять")).toBe("п'ять");
    expect(normalizeSearchString("ПʼЯТЬ")).toBe("п'ять");
    expect(normalizeSearchString('   РОЗКЛАД  ')).toBe('розклад');
  });

  it('returns all items when query is empty and category is all', () => {
    const results = searchFAQ();
    expect(results.length).toBe(FAQ_ITEMS.length);
  });

  it('filters by category correctly', () => {
    const startItems = searchFAQ({ categoryId: 'start' });
    expect(startItems.length).toBeGreaterThan(0);
    expect(startItems.every((item) => item.categoryId === 'start')).toBe(true);

    const timetableItems = searchFAQ({ categoryId: 'timetable' });
    expect(timetableItems.length).toBeGreaterThan(0);
    expect(timetableItems.every((item) => item.categoryId === 'timetable')).toBe(true);
  });

  it('finds items by question text keywords with high ranking', () => {
    const results = searchFAQ({ query: 'чисельник' });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (item) =>
          item.question.toLowerCase().includes('чисельник') ||
          item.answer.toLowerCase().includes('чисельник')
      )
    ).toBe(true);
  });

  it('finds items by specialized keywords (roz, fet, санітарні)', () => {
    const rozResults = searchFAQ({ query: 'roz' });
    expect(rozResults.length).toBeGreaterThan(0);
    expect(rozResults.some((item) => item.id === 'start-import-roz')).toBe(true);

    const sanitaryResults = searchFAQ({ query: 'санітарні' });
    expect(sanitaryResults.length).toBeGreaterThan(0);
    expect(sanitaryResults.some((item) => item.id === 'constraints-sanitary-rules')).toBe(true);

    const dailyReportResults = searchFAQ({ query: 'по днях' });
    expect(dailyReportResults.some((item) => item.id === 'print-daily-matrix-reports')).toBe(true);
  });

  it('combines category filtering and search query', () => {
    const results = searchFAQ({ categoryId: 'start', query: 'офлайн' });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('start-offline-pwa');
  });

  it('returns empty array when no match is found', () => {
    const results = searchFAQ({ query: 'неіснуючеслово12345xyz' });
    expect(results).toEqual([]);
  });
});


describe('FAQ per-preset overrides', () => {
  it('resolves the base item untouched for school when no override applies', () => {
    const item = FAQ_ITEMS.find((i) => i.id === 'entities-students-hierarchy')!;
    expect(resolveFaqItem(item, 'school')).toBe(item);
    expect(resolveFaqItem(item, 'gymnasium')).toBe(item);
  });

  it('returns academic prose for university and college, keeping identity fields', () => {
    const item = FAQ_ITEMS.find((i) => i.id === 'entities-students-hierarchy')!;
    for (const preset of ['university', 'college'] as const) {
      const resolved = resolveFaqItem(item, preset);
      expect(resolved.id).toBe(item.id);
      expect(resolved.categoryId).toBe(item.categoryId);
      expect(resolved.question).toContain('груп');
      expect(resolved.question).not.toContain('класи');
      expect(resolved.answer).toContain('Курс');
      expect(resolved.keywords).toContain('студенти');
    }
  });

  it('explains the sanitary check is disabled for academic presets', () => {
    const item = FAQ_ITEMS.find((i) => i.id === 'constraints-sanitary-rules')!;
    expect(resolveFaqItem(item, 'university').question).toContain('Чи застосовується');
    expect(resolveFaqItem(item, 'university').answer).toContain('вимкена');
  });

  it('search ranks items resolved in the preset terminology', () => {
    const schoolResults = searchFAQ({ query: 'вчитель навантаження' });
    expect(schoolResults.some((i) => i.id === 'entities-teacher-workload')).toBe(true);

    const academicResults = searchWithPreset({ query: 'викладач навантаження', preset: 'university' });
    expect(academicResults.some((i) => i.id === 'entities-teacher-workload')).toBe(true);
  });

  it('keeps every override partial: base prose fills the gaps', () => {
    for (const item of FAQ_ITEMS) {
      for (const override of Object.values(item.overrides ?? {})) {
        expect(override.question === undefined || override.question.length > 10).toBe(true);
        expect(override.answer === undefined || override.answer.length > 30).toBe(true);
      }
    }
  });
});
