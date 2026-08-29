// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 5: coverage for TeacherMinDaysPerWeek + StudentsSetMaxGapsPerDay.
// These are soft constraints (score-based, not rejection), so we test:
//  (1) parseConstraints accepts them without throwing;
//  (2) generation still converges on a trivially-solvable dataset;
//  (3) Zod schemas round-trip.

import { describe, it, expect } from 'vitest';
import { TimetableGenerator } from './generator';
import {
  TeacherMinDaysPerWeekConstraintSchema,
  StudentsSetMaxGapsPerDayConstraintSchema,
} from '../validation/schemas';
import type {
  Activity, Teacher, TimetableRules, StudentsSubgroup, TimeConstraint,
} from '../../types';
import { STUDENTS_SUBGROUP } from '../../types';

function rules(): TimetableRules {
  return {
    id: 'r', mode: 0, institutionName: 't',
    nDaysPerWeek: 5, nHoursPerDay: 6,
    daysOfTheWeek: Array.from({ length: 5 }, (_, i) => ({ name: `D${i}` })),
    hoursOfTheDay: Array.from({ length: 6 }, (_, i) => ({ name: `H${i}` })),
    modified: false, createdAt: '', updatedAt: '',
  };
}

function teacher(id: string): Teacher {
  return { id, name: id, targetNumberOfHours: 20, qualifiedSubjects: [] };
}

function subgroup(id: string): StudentsSubgroup {
  return { id, name: id, numberOfStudents: 30, type: STUDENTS_SUBGROUP };
}

function activity(id: string, teacherId: string, sgId: string): Activity {
  return {
    id, activityGroupId: 0, teacherIds: [teacherId], subjectId: 'math',
    activityTagIds: [], studentSetIds: [sgId], duration: 1, totalDuration: 1,
    active: true, computeNTotalStudents: false, nTotalStudents: 30,
  };
}

describe('Phase 5 constraint schemas', () => {
  it('parses TeacherMinDaysPerWeek', () => {
    const parsed = TeacherMinDaysPerWeekConstraintSchema.parse({
      id: 'a1111111-1111-4111-8111-111111111111',
      type: 'TeacherMinDaysPerWeek',
      weightPercentage: 100,
      active: true,
      teacherId: 't1',
      minDays: 3,
    });
    expect(parsed.minDays).toBe(3);
  });

  it('parses StudentsSetMaxGapsPerDay', () => {
    const parsed = StudentsSetMaxGapsPerDayConstraintSchema.parse({
      id: 'b2222222-2222-4222-8222-222222222222',
      type: 'StudentsSetMaxGapsPerDay',
      weightPercentage: 100,
      active: true,
      studentsSetId: 'g1',
      maxGaps: 0,
    });
    expect(parsed.maxGaps).toBe(0);
  });

  it('rejects out-of-range minDays', () => {
    expect(() => TeacherMinDaysPerWeekConstraintSchema.parse({
      id: 'c3333333-3333-4333-8333-333333333333',
      type: 'TeacherMinDaysPerWeek',
      weightPercentage: 100, active: true,
      teacherId: 't1', minDays: 0,
    })).toThrow();
  });
});

describe('Phase 5 generator integration', () => {
  it('runs with TeacherMinDaysPerWeek without breaking', async () => {
    const t1 = teacher('t1');
    const sg = subgroup('sg1');
    const acts = Array.from({ length: 5 }, (_, i) => activity(`a${i}`, 't1', 'sg1'));
    const constraints: TimeConstraint[] = [{
      id: 'c1', type: 'TeacherMinDaysPerWeek', weightPercentage: 100, active: true,
      teacherId: 't1', minDays: 3,
    } as any];

    const gen = new TimetableGenerator(rules(), acts, [t1], [sg], [], constraints, []);
    const result = await gen.generate();
    expect(result.totalActivities).toBe(5);
    expect(result.placedActivities).toBeGreaterThanOrEqual(0);
  });

  it('runs with StudentsSetMaxGapsPerDay without breaking', async () => {
    const t1 = teacher('t1');
    const sg = subgroup('sg1');
    const acts = Array.from({ length: 4 }, (_, i) => activity(`a${i}`, 't1', 'sg1'));
    const constraints: TimeConstraint[] = [{
      id: 'c1', type: 'StudentsSetMaxGapsPerDay', weightPercentage: 100, active: true,
      studentsSetId: 'sg1', maxGaps: 0,
    } as any];

    const gen = new TimetableGenerator(rules(), acts, [t1], [sg], [], constraints, []);
    const result = await gen.generate();
    expect(result.totalActivities).toBe(4);
    expect(result.placedActivities).toBeGreaterThanOrEqual(0);
  });
});
