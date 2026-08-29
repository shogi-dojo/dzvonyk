// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { describe, expect, it } from 'vitest';
import {
  buildWorkloadAudienceOptions,
  createReplacementWorkloadActivities,
  createTeacherWorkloadActivities,
  summarizeTeacherWorkload,
  workloadAverageHours,
} from './teacherWorkload';
import {
  STUDENTS_GROUP,
  STUDENTS_SUBGROUP,
  STUDENTS_YEAR,
  type Activity,
  type StudentsGroup,
  type StudentsSubgroup,
  type StudentsYear,
} from '@/types';

const groups: StudentsGroup[] = ['5-А', '5-Б', '5-В'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
  numberOfStudents: 25,
  type: STUDENTS_GROUP,
  subgroups: index === 0 ? ['sg1', 'sg2'] : [],
}));

const years: StudentsYear[] = [{
  id: 'y5',
  name: '5',
  numberOfStudents: 75,
  type: STUDENTS_YEAR,
  groups: groups.map((group) => group.id),
  divisions: [],
  separator: '-',
}];

const subgroups: StudentsSubgroup[] = ['5-А / 1 група', '5-А / 2 група'].map((name, index) => ({
  id: `sg${index + 1}`,
  name,
  numberOfStudents: 12,
  type: STUDENTS_SUBGROUP,
}));

describe('teacher workload flow', () => {
  it('expands a parallel audience into its classes', () => {
    const options = buildWorkloadAudienceOptions(years, groups, subgroups);
    const parallel = options.find((option) => option.key === 'year:y5');

    expect(parallel).toMatchObject({
      kind: 'year',
      classCount: 3,
      targetNames: ['5-А', '5-Б', '5-В'],
    });
    expect(options.find((option) => option.key === 'subgroup:sg1')).toMatchObject({
      parentName: '5-А',
      targetNames: ['5-А / 1 група'],
    });
  });

  it('creates independently schedulable lessons for every class and weekly hour', () => {
    let id = 0;
    const activities = createTeacherWorkloadActivities({
      teacherName: 'Олена Вчитель',
      subjectName: 'Українська мова',
      targetNames: ['5-А', '5-Б', '5-В'],
      weeklyHours: 3,
      weekParity: 'both',
      idFactory: () => `a${++id}`,
    });

    expect(activities).toHaveLength(9);
    expect(activities.every((activity) => activity.duration === 1)).toBe(true);
    expect(activities.filter((activity) => activity.studentSetIds[0] === '5-Б')).toHaveLength(3);
    expect(activities.every((activity) => activity.weekParity === undefined)).toBe(true);
  });

  it('shows regular and numerator hours as one average parallel workload row', () => {
    let id = 0;
    const regular = createTeacherWorkloadActivities({
      teacherName: 'Олена Вчитель',
      subjectName: 'Українська мова',
      targetNames: groups.map((group) => group.name),
      weeklyHours: 3,
      weekParity: 'both',
      idFactory: () => `regular-${++id}`,
    });
    const numerator = createTeacherWorkloadActivities({
      teacherName: 'Олена Вчитель',
      subjectName: 'Українська мова',
      targetNames: groups.map((group) => group.name),
      weeklyHours: 1,
      weekParity: 'numerator',
      idFactory: () => `numerator-${++id}`,
    });

    const summary = summarizeTeacherWorkload(
      't1',
      'Олена Вчитель',
      [...regular, ...numerator],
      years,
      groups,
      subgroups,
    );

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      audienceKind: 'year',
      audienceName: '5',
      classCount: 3,
      weekParity: 'mixed',
      schedule: { everyWeek: 3, numerator: 1, denominator: 0 },
      hoursPerAudience: 3.5,
      totalHours: 10.5,
    });
  });

  it('does not collapse incomplete parallel assignments', () => {
    const activity = (id: string, target: string): Activity => ({
      id,
      activityGroupId: 0,
      teacherIds: ['Олена Вчитель'],
      subjectId: 'Українська мова',
      activityTagIds: [],
      studentSetIds: [target],
      duration: 1,
      totalDuration: 1,
      active: true,
      computeNTotalStudents: true,
      nTotalStudents: 25,
    });

    const summary = summarizeTeacherWorkload(
      't1',
      'Олена Вчитель',
      [activity('a1', '5-А'), activity('a2', '5-Б')],
      years,
      groups,
      subgroups,
    );

    expect(summary.map((row) => row.audienceName)).toEqual(['5-А', '5-Б']);
  });

  it('replaces two weekly lessons with a 1.5-hour weekly pattern', () => {
    const template = createTeacherWorkloadActivities({
      teacherName: 'Олена Вчитель',
      subjectName: 'Інформатика',
      targetNames: ['8-А'],
      weeklyHours: 2,
      weekParity: 'both',
      idFactory: () => crypto.randomUUID(),
    }).map((activity) => ({ ...activity, activityTagIds: ['Комп’ютерний клас'] }));
    let id = 0;
    const hours = { everyWeek: 1, numerator: 1, denominator: 0 };
    const replacements = createReplacementWorkloadActivities({
      teacherName: 'Олена Вчитель',
      subjectName: 'Інформатика',
      targetNames: ['8-А'],
      hours,
      templates: template,
      idFactory: () => `replacement-${++id}`,
    });

    expect(workloadAverageHours(hours)).toBe(1.5);
    expect(replacements).toHaveLength(2);
    expect(replacements.map((activity) => activity.weekParity)).toEqual([undefined, 'numerator']);
    expect(replacements.every((activity) => activity.activityTagIds[0] === 'Комп’ютерний клас')).toBe(true);
    expect(replacements.every((activity) => !template.some((old) => old.id === activity.id))).toBe(true);
  });
});
