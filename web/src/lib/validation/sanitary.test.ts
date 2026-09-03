// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors

import { describe, it, expect } from 'vitest';
import { runSanitaryChecks, gradeFromName } from './sanitary';
import { runPreflight, type PreflightInput } from './preflight';
import type {
  Activity, Teacher, Room, TimetableRules, StudentsGroup,
} from '../../types';
import { OFFICIAL_MODE, STUDENTS_GROUP } from '../../types';

function baseRules(days = 5, hours = 8): TimetableRules {
  return {
    id: 'r1', mode: OFFICIAL_MODE, institutionName: 't',
    nDaysPerWeek: days, nHoursPerDay: hours,
    daysOfTheWeek: [], hoursOfTheDay: [],
    modified: false, createdAt: '', updatedAt: '',
  };
}

function baseGroup(id: string, name: string): StudentsGroup {
  return { id, name, numberOfStudents: 30, type: STUDENTS_GROUP, subgroups: [] };
}

function activity(id: string, opts: Partial<Activity> = {}): Activity {
  return {
    id, activityGroupId: 0, teacherIds: ['t1'], subjectId: 's1',
    activityTagIds: [], studentSetIds: ['g1'], duration: 1, totalDuration: 1,
    active: true, computeNTotalStudents: false, nTotalStudents: 30,
    ...opts,
  };
}

function baseTeacher(id: string, name: string): Teacher {
  return { id, name, targetNumberOfHours: 20, qualifiedSubjects: [] };
}

function baseRoom(id: string, name: string): Room {
  return { id, name, capacity: 30, isVirtual: false };
}

function pfInput(over: Partial<PreflightInput> = {}): PreflightInput {
  return {
    rules: baseRules(5, 8),
    activities: [],
    teachers: [baseTeacher('t1', 'ТП-1')],
    rooms: [baseRoom('r1', 'К-101')],
    studentsGroups: [baseGroup('g1', '5-А')],
    studentsSubgroups: [],
    timeConstraints: [],
    spaceConstraints: [],
    ...over,
  };
}

describe('gradeFromName', () => {
  it.each([
    ['5-А', 5], ['10-Б', 10], ['1-В', 1], ['11 клас', 11], ['12-А', 12],
    ['4А', 4], ['   7-Г', 7],
  ])('%s → %d', (name, expected) => {
    expect(gradeFromName(name)).toBe(expected);
  });

  it.each(['English', '', '0-А', '13-А', 'A-5', 'спец-клас'])(
    'rejects %s',
    (name) => { expect(gradeFromName(name)).toBeNull(); },
  );
});

describe('runSanitaryChecks', () => {
  it('warns when grade 5 exceeds 28 h on a 5-day week', () => {
    // Grade 5, 5-day cap = 28. Give 30 lessons.
    const acts = Array.from({ length: 30 }, (_, i) => activity(`a${i}`));
    const warnings = runSanitaryChecks({
      rules: baseRules(5, 8),
      activities: acts,
      studentsGroups: [baseGroup('g1', '5-А')],
      studentsSubgroups: [],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('SANITARY_WEEKLY_OVERLOAD');
    expect(warnings[0].message).toMatch(/5-А/);
    expect(warnings[0].message).toMatch(/28/);
  });

  it('does not warn when at or below the cap', () => {
    // Grade 5, 5-day cap = 28. Give 28 lessons.
    const acts = Array.from({ length: 28 }, (_, i) => activity(`a${i}`));
    const warnings = runSanitaryChecks({
      rules: baseRules(5, 8),
      activities: acts,
      studentsGroups: [baseGroup('g1', '5-А')],
      studentsSubgroups: [],
    });
    expect(warnings).toHaveLength(0);
  });

  it('uses the 6-day column when nDaysPerWeek === 6', () => {
    // Grade 5, 6-day cap = 30. 30 lessons → OK; 31 → warn.
    const okActs = Array.from({ length: 30 }, (_, i) => activity(`a${i}`));
    const badActs = Array.from({ length: 31 }, (_, i) => activity(`a${i}`));
    expect(runSanitaryChecks({
      rules: baseRules(6, 8),
      activities: okActs,
      studentsGroups: [baseGroup('g1', '5-А')],
      studentsSubgroups: [],
    })).toHaveLength(0);
    expect(runSanitaryChecks({
      rules: baseRules(6, 8),
      activities: badActs,
      studentsGroups: [baseGroup('g1', '5-А')],
      studentsSubgroups: [],
    })).toHaveLength(1);
  });

  it('skips groups whose name has no grade prefix', () => {
    const acts = Array.from({ length: 40 }, (_, i) => activity(`a${i}`));
    const warnings = runSanitaryChecks({
      rules: baseRules(5, 8),
      activities: acts,
      studentsGroups: [baseGroup('g1', 'Спецклас')],
      studentsSubgroups: [],
    });
    expect(warnings).toHaveLength(0);
  });

  it('skips when week length is not 5 or 6 days', () => {
    const acts = Array.from({ length: 40 }, (_, i) => activity(`a${i}`));
    const warnings = runSanitaryChecks({
      rules: baseRules(7, 8),
      activities: acts,
      studentsGroups: [baseGroup('g1', '5-А')],
      studentsSubgroups: [],
    });
    expect(warnings).toHaveLength(0);
  });

  it('is opt-in via runPreflight({ sanitaryMode: true })', () => {
    const acts = Array.from({ length: 30 }, (_, i) => activity(`a${i}`));
    const off = runPreflight(pfInput({ activities: acts }));
    expect(off.warnings.some((w) => w.code === 'SANITARY_WEEKLY_OVERLOAD')).toBe(false);

    const on = runPreflight(pfInput({ activities: acts, sanitaryMode: true }));
    expect(on.warnings.some((w) => w.code === 'SANITARY_WEEKLY_OVERLOAD')).toBe(true);
  });
});

describe('sanitary feature gate contract', () => {
  // A «1 курс» group would parse as grade 1 via gradeFromName. For academic
  // presets the check is gated off at the call site — this pins the pure
  // contract: no gate input, no warnings, whatever the class is named.
  const academicGroup = { id: 'g1', name: '1 курс', numberOfStudents: 90, type: 2 as const, subgroups: [] };

  const overLoaded: Activity[] = Array.from({ length: 40 }, (_, i) => ({
    id: `a${i}`,
    activityGroupId: 0,
    teacherIds: ['t1'],
    subjectId: 's1',
    activityTagIds: [],
    studentSetIds: ['g1'],
    duration: 1,
    totalDuration: 1,
    active: true,
    computeNTotalStudents: false,
    nTotalStudents: 0,
  }));

  it('still computes school warnings for a school preset with a named class', () => {
    const warnings = runSanitaryChecks({
      rules: baseRules(5, 7),
      activities: overLoaded,
      studentsGroups: [academicGroup as never],
      studentsSubgroups: [],
    });
    expect(warnings.some((w) => w.code === 'SANITARY_WEEKLY_OVERLOAD')).toBe(true);
  });
});
