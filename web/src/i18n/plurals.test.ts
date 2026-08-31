// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import i18n from './index';
import uk from './uk.json';

// Count keys normalized onto i18next plurals. Each must provide all four
// Ukrainian cardinal forms so presets can override every shape of the number.
const PLURAL_KEYS = [
  'dashboard.institution.solutionMeta',
  'dashboard.import.success',
  'timetable.activitiesMeta',
  'generate.history.lessonsCount',
  'generate.lastSolution.placed',
  'students.studentsCount',
  'students.groupsCount',
  'rooms.roomsInBuilding',
  'constraints.descriptions.minDaysBetween',
  'timeConstraints.descriptions.minDaysBetween',
  'timeConstraints.descriptions.sameStart',
  'timeConstraints.descriptions.notOverlapping',
  'rozImport.skippedLessons',
  'rozImport.duplicateNamesResolved',
  'rozImport.droppedCards',
] as const;

function lookup(dotted: string): unknown {
  return dotted.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    uk,
  );
}

describe('uk.json plural count keys', () => {
  it('provides all four Ukrainian cardinal forms for every pluralized count key', () => {
    for (const key of PLURAL_KEYS) {
      for (const suffix of ['one', 'few', 'many', 'other']) {
        const value = lookup(`${key}_${suffix}`);
        expect(value, `${key}_${suffix} is missing`).toBeTypeOf('string');
        expect(value as string, `${key}_${suffix} lost its count placeholder`).toContain('{{count}}');
      }
      expect(lookup(key), `${key} must not keep a bare fallback`).toBeUndefined();
    }
  });

  it('resolves singular, paucal, plural and fractional counts through i18next', () => {
    expect(i18n.t('students.studentsCount', { count: 1 })).toBe('1 учень');
    expect(i18n.t('students.studentsCount', { count: 3 })).toBe('3 учні');
    expect(i18n.t('students.studentsCount', { count: 11 })).toBe('11 учнів');
    expect(i18n.t('generate.history.lessonsCount', { count: 2 })).toBe('2 уроки');
    expect(i18n.t('generate.history.lessonsCount', { count: 40 })).toBe('40 уроків');
    expect(i18n.t('generate.history.lessonsCount', { count: 1.5 })).toBe('1.5 уроків');
  });
});
