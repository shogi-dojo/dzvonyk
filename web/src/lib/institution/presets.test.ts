// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  INSTITUTION_PRESETS,
  buildDefaultHours,
  isInstitutionPresetId,
} from './presets';

describe('institution presets', () => {
  it('exposes exactly the four supported presets', () => {
    expect(Object.keys(INSTITUTION_PRESETS).sort()).toEqual(
      ['college', 'gymnasium', 'school', 'university'],
    );
    expect(isInstitutionPresetId('university')).toBe(true);
    expect(isInstitutionPresetId('lyceum')).toBe(false);
    expect(isInstitutionPresetId(42)).toBe(false);
  });

  it('keeps gymnasium on school terminology and sanitary rules', () => {
    const school = INSTITUTION_PRESETS.school;
    const gymnasium = INSTITUTION_PRESETS.gymnasium;
    expect(gymnasium.locale).toBe(school.locale);
    expect(gymnasium.features.sanitaryChecks).toBe(true);
    expect(gymnasium.features.shifts).toBe(true);
    expect(gymnasium.features.streams).toBe(false);
  });

  it('unlocks academic features only for college and university', () => {
    for (const id of ['college', 'university'] as const) {
      const preset = INSTITUTION_PRESETS[id];
      expect(preset.features.sanitaryChecks).toBe(false);
      expect(preset.features.shifts).toBe(false);
      expect(preset.features.streams).toBe(true);
      expect(preset.features.activitySubtypes).toBe(true);
    }
    expect(INSTITUTION_PRESETS.school.features.streams).toBe(false);
    expect(INSTITUTION_PRESETS.gymnasium.features.activitySubtypes).toBe(false);
  });

  describe('buildDefaultHours bell arithmetic', () => {
    it('builds the 5×7 school bell schedule with a long break after slot 3', () => {
      const hours = buildDefaultHours(INSTITUTION_PRESETS.school);
      expect(hours).toHaveLength(7);
      expect(hours[0]).toEqual({ name: '1 урок', longName: '08:30 - 09:15' });
      // 11:05 end of slot 3 + 20-minute long break
      expect(hours[3].longName).toBe('11:25 - 12:10');
      expect(hours.map((h) => h.name)).toEqual([
        '1 урок', '2 урок', '3 урок', '4 урок', '5 урок', '6 урок', '7 урок',
      ]);
      // Ten-minute breaks elsewhere: slot 2 starts 10 minutes after slot 1 ends.
      expect(hours[1].longName).toBe('09:25 - 10:10');
      expect(hours[6].longName).toBe('14:10 - 14:55');
    });

    it('builds 80-minute college periods with plain 10-minute breaks', () => {
      const hours = buildDefaultHours(INSTITUTION_PRESETS.college);
      expect(hours).toHaveLength(6);
      expect(hours[0].longName).toBe('08:30 - 09:50');
      expect(hours[1].longName).toBe('10:00 - 11:20');
      expect(hours[5].longName).toBe('16:00 - 17:20');
      expect(hours[2].name).toBe('3 пара');
    });

    it('builds 95-minute university pairs (2×45 + 5)', () => {
      const hours = buildDefaultHours(INSTITUTION_PRESETS.university);
      expect(hours).toHaveLength(6);
      expect(hours[0]).toEqual({ name: '1 пара', longName: '08:30 - 10:05' });
      expect(hours[1].longName).toBe('10:15 - 11:50');
      expect(hours[3].longName).toBe('13:45 - 15:20');
      expect(hours[5]).toEqual({ name: '6 пара', longName: '17:15 - 18:50' });
    });
  });

  it('parses its own default hour names with its lesson label pattern', () => {
    for (const preset of Object.values(INSTITUTION_PRESETS)) {
      const hours = buildDefaultHours(preset);
      for (const [index, hour] of hours.entries()) {
        const match = hour.name.match(preset.lessonLabelPattern);
        expect(match, `${preset.id} cannot parse «${hour.name}»`).not.toBeNull();
        expect(Number(match![1])).toBe(index + 1);
      }
    }
  });

  it('still parses legacy school labels with the academic pattern check in place', () => {
    // Academic presets must not be confused by legacy «1 урок» hour names
    // imported from school snapshots — and vice versa.
    expect('7 урок'.match(INSTITUTION_PRESETS.school.lessonLabelPattern)![1]).toBe('7');
    expect('3 пара'.match(INSTITUTION_PRESETS.university.lessonLabelPattern)![1]).toBe('3');
    expect('2 пари'.match(INSTITUTION_PRESETS.university.lessonLabelPattern)![1]).toBe('2');
    expect('08:30'.match(INSTITUTION_PRESETS.school.lessonLabelPattern)).toBeNull();
  });
});
