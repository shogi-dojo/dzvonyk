// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors

import { describe, it, expect } from 'vitest';
import { runPreflight, type PreflightInput } from './preflight';
import type {
  Activity, Teacher, Room, TimetableRules, StudentsGroup,
  TimeConstraint, SpaceConstraint,
} from '../../types';
import { OFFICIAL_MODE, STUDENTS_GROUP, STUDENTS_YEAR } from '../../types';

function baseRules(days = 5, hours = 8): TimetableRules {
  return {
    id: 'r1', mode: OFFICIAL_MODE, institutionName: 't',
    nDaysPerWeek: days, nHoursPerDay: hours,
    daysOfTheWeek: [], hoursOfTheDay: [],
    modified: false, createdAt: '', updatedAt: '',
  };
}

function baseTeacher(id: string, name: string): Teacher {
  return { id, name, targetNumberOfHours: 20, qualifiedSubjects: [] };
}

function baseRoom(id: string, name: string): Room {
  return { id, name, capacity: 30, isVirtual: false };
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

function baseInput(over: Partial<PreflightInput> = {}): PreflightInput {
  return {
    rules: baseRules(),
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

describe('runPreflight', () => {
  it('blocks when rules are missing', () => {
    const r = runPreflight(baseInput({ rules: null }));
    expect(r.ok).toBe(false);
    expect(r.blocking[0].code).toBe('RULES_MISSING');
  });

  it('blocks when there are zero active activities', () => {
    const r = runPreflight(baseInput());
    expect(r.ok).toBe(false);
    expect(r.blocking.some((i) => i.code === 'NO_ACTIVITIES')).toBe(true);
  });

  it('passes on a small feasible dataset', () => {
    const acts = Array.from({ length: 10 }, (_, i) => activity(`a${i}`));
    const r = runPreflight(baseInput({ activities: acts }));
    expect(r.ok).toBe(true);
    expect(r.blocking).toHaveLength(0);
  });

  it('blocks when a class needs more lessons than weekly slots', () => {
    // 5×8 = 40 slots. Give class 45 lessons.
    const acts = Array.from({ length: 45 }, (_, i) => activity(`a${i}`));
    const r = runPreflight(baseInput({ activities: acts }));
    expect(r.ok).toBe(false);
    const issue = r.blocking.find((i) => i.code === 'CLASS_OVERLOAD');
    expect(issue).toBeDefined();
    expect(issue!.entity?.name).toBe('5-А');
    expect(issue!.message).toMatch(/45.*40/);
  });

  it('warns when a class is near capacity (≥90 %)', () => {
    // 36/40 = 90 %.
    const acts = Array.from({ length: 36 }, (_, i) => activity(`a${i}`));
    const r = runPreflight(baseInput({ activities: acts }));
    expect(r.ok).toBe(true);
    expect(r.warnings.some((i) => i.code === 'CLASS_NEAR_CAPACITY')).toBe(true);
  });

  it('blocks when a teacher is overloaded relative to their available slots', () => {
    // Two teachers; teacher t2 gets 45 lessons > 40 slots.
    const teachers = [baseTeacher('t1', 'ТП-1'), baseTeacher('t2', 'ТП-2')];
    const acts = [
      ...Array.from({ length: 20 }, (_, i) =>
        activity(`a-lite-${i}`, { teacherIds: ['t1'] }),
      ),
      ...Array.from({ length: 45 }, (_, i) =>
        activity(`a-heavy-${i}`, { teacherIds: ['t2'] }),
      ),
    ];
    // Also spread across many classes so per-class doesn't trigger first.
    const groups = Array.from({ length: 3 }, (_, i) =>
      baseGroup(`g${i}`, `клас-${i}`),
    );
    acts.forEach((a, i) => (a.studentSetIds = [`g${i % 3}`]));
    const r = runPreflight(baseInput({ teachers, activities: acts, studentsGroups: groups }));
    const issue = r.blocking.find((i) => i.code === 'TEACHER_OVERLOAD');
    expect(issue).toBeDefined();
    expect(issue!.entity?.id).toBe('t2');
  });

  it('accounts for TeacherNotAvailableTimes when computing capacity', () => {
    // Teacher has 30 unavailable slots → only 10 available. 15 lessons overloads.
    const notAvail: TimeConstraint = {
      id: 'tc1', type: 'TeacherNotAvailableTimes', weightPercentage: 100, active: true,
      // @ts-expect-error extended shape used by parser
      teacherId: 't1', times: Array.from({ length: 30 }, (_, i) => ({ day: 0, hour: i })),
    };
    const acts = Array.from({ length: 15 }, (_, i) => activity(`a${i}`));
    const r = runPreflight(baseInput({ activities: acts, timeConstraints: [notAvail] }));
    const issue = r.blocking.find((i) => i.code === 'TEACHER_OVERLOAD');
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/10/);
  });

  it('warns (does not block) when a room has high subject pressure via SubjectPreferredRoom', () => {
    // 45 physics lessons, only one physics room → 40 slots.
    const acts = Array.from({ length: 45 }, (_, i) =>
      activity(`a${i}`, { subjectId: 'phys' }),
    );
    const groups = Array.from({ length: 3 }, (_, i) => baseGroup(`g${i}`, `клас-${i}`));
    acts.forEach((a, i) => (a.studentSetIds = [`g${i % 3}`]));
    const spc: SpaceConstraint = {
      id: 'sc1', type: 'SubjectPreferredRoom', weightPercentage: 100, active: true,
      // @ts-expect-error extended shape
      subjectId: 'phys', roomId: 'r1',
    };
    const teachers = Array.from({ length: 5 }, (_, i) => baseTeacher(`t${i}`, `Т${i}`));
    acts.forEach((a, i) => (a.teacherIds = [`t${i % 5}`]));
    const r = runPreflight(baseInput({
      teachers, activities: acts, studentsGroups: groups, spaceConstraints: [spc],
    }));
    expect(r.ok).toBe(true);
    expect(r.blocking).toHaveLength(0);
    const warn = r.warnings.find((i) => i.code === 'ROOM_NEAR_CAPACITY');
    expect(warn).toBeDefined();
    expect(warn!.entity?.name).toBe('К-101');
    expect(warn!.entity?.id).toBe('r1');
    // Over-subscribed by a soft preference: the message states both figures and
    // that the overflow goes to other rooms, rather than a "112 %" fill ratio.
    expect(warn!.message).toMatch(/45/);
    expect(warn!.message).toMatch(/40/);
    expect(warn!.message).toMatch(/інших аудиторіях/);
  });

  it('resolves room by name in SubjectPreferredRoom without blocking', () => {
    // Name-form roomId ('К-101') instead of id ('r1')
    const acts = Array.from({ length: 45 }, (_, i) =>
      activity(`a${i}`, { subjectId: 'phys' }),
    );
    const groups = Array.from({ length: 3 }, (_, i) => baseGroup(`g${i}`, `клас-${i}`));
    acts.forEach((a, i) => (a.studentSetIds = [`g${i % 3}`]));
    const spc: SpaceConstraint = {
      id: 'sc1', type: 'SubjectPreferredRoom', weightPercentage: 100, active: true,
      // @ts-expect-error extended shape
      subjectId: 'phys', roomId: 'К-101',
    };
    const teachers = Array.from({ length: 5 }, (_, i) => baseTeacher(`t${i}`, `Т${i}`));
    acts.forEach((a, i) => (a.teacherIds = [`t${i % 5}`]));
    const r = runPreflight(baseInput({
      teachers, activities: acts, studentsGroups: groups, spaceConstraints: [spc],
    }));
    expect(r.ok).toBe(true);
    expect(r.blocking).toHaveLength(0);
    const warn = r.warnings.find((i) => i.code === 'ROOM_NEAR_CAPACITY');
    expect(warn).toBeDefined();
    expect(warn!.entity?.id).toBe('r1');
    expect(warn!.entity?.name).toBe('К-101');
  });

  it('blocks when a room is hard over-subscribed by ActivityPreferredRoom', () => {
    // 45 lessons pinned to r1 via ActivityPreferredRoom > 40 slots
    const acts = Array.from({ length: 45 }, (_, i) => activity(`a${i}`));
    const groups = Array.from({ length: 3 }, (_, i) => baseGroup(`g${i}`, `клас-${i}`));
    acts.forEach((a, i) => (a.studentSetIds = [`g${i % 3}`]));
    const spaceConstraints: SpaceConstraint[] = acts.map((a, i) => ({
      id: `sc-${i}`, type: 'ActivityPreferredRoom', weightPercentage: 100, active: true,
      // @ts-expect-error extended shape
      activityId: a.id, roomId: 'К-101', // name-form
    }));
    const teachers = Array.from({ length: 5 }, (_, i) => baseTeacher(`t${i}`, `Т${i}`));
    acts.forEach((a, i) => (a.teacherIds = [`t${i % 5}`]));
    const r = runPreflight(baseInput({
      teachers, activities: acts, studentsGroups: groups, spaceConstraints,
    }));
    expect(r.ok).toBe(false);
    const issue = r.blocking.find((i) => i.code === 'ROOM_OVERLOAD');
    expect(issue).toBeDefined();
    expect(issue!.entity?.name).toBe('К-101');
    expect(issue!.entity?.id).toBe('r1');
    expect(issue!.message).toMatch(/45.*40/);
  });

  it('counts ActivityPreferredRoom by activity duration', () => {
    // 25 activities of duration 2 = 50 hours on 40 slots
    const acts = Array.from({ length: 25 }, (_, i) =>
      activity(`a${i}`, { duration: 2, totalDuration: 2 })
    );
    const groups = Array.from({ length: 3 }, (_, i) => baseGroup(`g${i}`, `клас-${i}`));
    acts.forEach((a, i) => (a.studentSetIds = [`g${i % 3}`]));
    const spaceConstraints: SpaceConstraint[] = acts.map((a, i) => ({
      id: `sc-${i}`, type: 'ActivityPreferredRoom', weightPercentage: 100, active: true,
      // @ts-expect-error extended shape
      activityId: a.id, roomId: 'r1',
    }));
    const teachers = Array.from({ length: 5 }, (_, i) => baseTeacher(`t${i}`, `Т${i}`));
    acts.forEach((a, i) => (a.teacherIds = [`t${i % 5}`]));
    const r = runPreflight(baseInput({
      teachers, activities: acts, studentsGroups: groups, spaceConstraints,
    }));
    expect(r.ok).toBe(false);
    const issue = r.blocking.find((i) => i.code === 'ROOM_OVERLOAD');
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/50.*40/);
  });

  it('warns on orphaned split-subject activity', () => {
    // One activity with activityGroupId=7, no pair.
    const acts = [activity('a1', { activityGroupId: 7 })];
    const r = runPreflight(baseInput({ activities: acts }));
    expect(r.warnings.some((i) => i.code === 'SPLIT_ORPHAN')).toBe(true);
  });

  describe('year-wide streams', () => {
    const makeYearInput = (over: Partial<PreflightInput> = {}): PreflightInput => {
      const groups = Array.from({ length: 5 }, (_, i) => baseGroup(`g${i + 1}`, `КН-1${i + 1}`));
      const year = {
        id: 'y1', name: '1 курс', numberOfStudents: 150,
        type: STUDENTS_YEAR, groups: ['g1', 'g2', 'g3', 'g4', 'g5'], divisions: [], separator: '-',
      };
      return baseInput({
        studentsGroups: groups,
        studentsYears: [year],
        ...over,
      });
    };

    it('spreads a stream onto every group: 5 groups × 2h = 2h per group, not 10', () => {
      const stream = activity('stream', { studentSetIds: ['y1'], duration: 2 });
      const r = runPreflight(makeYearInput({ activities: [stream], rules: baseRules(1, 2) }));
      // 1 day × 2h = 2 weekly slots; each group carries exactly the 2 stream
      // hours — at the limit, so blocking only fires if counting is wrong.
      expect(r.blocking).toHaveLength(0);

      const tight = runPreflight(makeYearInput({ activities: [stream], rules: baseRules(1, 1) }));
      const overloads = tight.blocking.filter((i) => i.code === 'CLASS_OVERLOAD');
      // Every one of the 5 groups reads 2h against a 1-slot week. A naive
      // implementation would count 10h on a single entity or miss the stream.
      expect(overloads).toHaveLength(5);
      expect(overloads.map((i) => i.entity?.name).sort()).toEqual(
        ['КН-11', 'КН-12', 'КН-13', 'КН-14', 'КН-15']
      );
    });

    it('expands stream references by year name as well as id', () => {
      const stream = activity('stream', { studentSetIds: ['1 курс'], duration: 2 });
      const r = runPreflight(makeYearInput({ activities: [stream], rules: baseRules(1, 1) }));
      expect(r.blocking.filter((i) => i.code === 'CLASS_OVERLOAD')).toHaveLength(5);
    });

    it('expands a year whose groups are listed by name (as both importers write them)', () => {
      // StudentsYear.groups is documented as holding ids, but fetParser and
      // rozParser both push group NAMES. The engine already resolves either
      // form, so preflight must too or every imported stream goes uncounted.
      const groups = Array.from({ length: 5 }, (_, i) => baseGroup(`g${i + 1}`, `КН-1${i + 1}`));
      const yearByName = {
        id: 'y1', name: '1 курс', numberOfStudents: 150, type: STUDENTS_YEAR,
        groups: ['КН-11', 'КН-12', 'КН-13', 'КН-14', 'КН-15'],
        divisions: [], separator: '-',
      };
      const stream = activity('stream', { studentSetIds: ['y1'], duration: 2 });
      const r = runPreflight(
        baseInput({
          studentsGroups: groups,
          studentsYears: [yearByName],
          activities: [stream],
          rules: baseRules(1, 1),
        })
      );
      expect(r.blocking.filter((i) => i.code === 'CLASS_OVERLOAD')).toHaveLength(5);
    });
  });
});
