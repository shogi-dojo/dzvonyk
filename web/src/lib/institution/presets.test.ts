// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  INSTITUTION_PRESETS,
  buildDefaultHours,
  isInstitutionPresetId,
} from './presets';

describe('institution presets', () => {
  it('exposes exactly the four supported presets (school, gymnasium, lyceum, college)', () => {
    expect(Object.keys(INSTITUTION_PRESETS).sort()).toEqual(
      ['college', 'gymnasium', 'lyceum', 'school'],
    );
    expect(isInstitutionPresetId('school')).toBe(true);
    expect(isInstitutionPresetId('gymnasium')).toBe(true);
    expect(isInstitutionPresetId('lyceum')).toBe(true);
    expect(isInstitutionPresetId('college')).toBe(true);
    expect(isInstitutionPresetId('university')).toBe(false);
    expect(isInstitutionPresetId(42)).toBe(false);
  });

  it('keeps gymnasium and lyceum on school terminology, bells, and sanitary rules', () => {
    const school = INSTITUTION_PRESETS.school;
    for (const id of ['gymnasium', 'lyceum'] as const) {
      const preset = INSTITUTION_PRESETS[id];
      expect(preset.locale).toBe(school.locale);
      expect(preset.features.sanitaryChecks).toBe(true);
      expect(preset.features.shifts).toBe(true);
      expect(preset.features.streams).toBe(false);
      expect(preset.features.activitySubtypes).toBe(false);
      expect(preset.defaults).toEqual(school.defaults);
      expect(preset.hourNameUnit).toBe('урок');
    }
  });

  it('configures college with academic terminology, activity subtypes, and streams off', () => {
    const college = INSTITUTION_PRESETS.college;
    expect(college.locale).toBe('uk-college');
    expect(college.features.sanitaryChecks).toBe(false);
    expect(college.features.shifts).toBe(false);
    expect(college.features.streams).toBe(false);
    expect(college.features.activitySubtypes).toBe(true);
    expect(college.hourNameUnit).toBe('пара');
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
    expect('7 урок'.match(INSTITUTION_PRESETS.school.lessonLabelPattern)![1]).toBe('7');
    expect('3 пара'.match(INSTITUTION_PRESETS.college.lessonLabelPattern)![1]).toBe('3');
    expect('2 пари'.match(INSTITUTION_PRESETS.college.lessonLabelPattern)![1]).toBe('2');
    expect('08:30'.match(INSTITUTION_PRESETS.school.lessonLabelPattern)).toBeNull();
  });
});
