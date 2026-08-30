import { describe, expect, it } from 'vitest';
import {
  sumWeeklyLoad,
  formatWeeklyLoad,
  formatHours,
  computeTeacherWorkloadReportData,
  computeAllClassesWeeklyLoad,
} from './weeklyLoad';
import { calculateTeacherAssignedLoad } from './validation/preflight';
import type { Activity, Teacher } from '@/types';

const lesson = (id: string, weekParity?: Activity['weekParity']): Activity => ({
  id,
  activityGroupId: 0,
  teacherIds: ['t1'],
  subjectId: 'Українська мова',
  activityTagIds: [],
  studentSetIds: ['6-Б'],
  duration: 1,
  totalDuration: 1,
  active: true,
  computeNTotalStudents: true,
  nTotalStudents: 0,
  weekParity,
});

describe('weeklyLoad', () => {
  it('counts a full lesson in both weeks', () => {
    expect(sumWeeklyLoad([lesson('a')])).toEqual({
      numerator: 1,
      denominator: 1,
      average: 1,
      alternates: false,
    });
  });

  it('counts a half-lesson in one week only', () => {
    expect(sumWeeklyLoad([lesson('a', 'numerator')])).toMatchObject({
      numerator: 1,
      denominator: 0,
      average: 0.5,
      alternates: true,
    });
  });

  // The case from the call: «у Ларисе Георгіївни 27,5 годин — в один тиждень 28,
  // в іншому 27». 27 full lessons plus one numerator half-lesson.
  it('produces 28/27 with an average of 27,5', () => {
    const activities = [
      ...Array.from({ length: 27 }, (_, i) => lesson(`full-${i}`)),
      lesson('half', 'numerator'),
    ];
    const load = sumWeeklyLoad(activities);
    expect(load.numerator).toBe(28);
    expect(load.denominator).toBe(27);
    expect(load.average).toBe(27.5);
    expect(formatWeeklyLoad(load)).toBe('27,5 (28/27)');
  });

  it('balances when the halves sit in opposite weeks', () => {
    const load = sumWeeklyLoad([lesson('n', 'numerator'), lesson('d', 'denominator')]);
    expect(load).toMatchObject({ numerator: 1, denominator: 1, alternates: false });
    expect(formatWeeklyLoad(load)).toBe('1');
  });

  it('ignores inactive lessons', () => {
    expect(sumWeeklyLoad([{ ...lesson('a'), active: false }]).average).toBe(0);
  });

  it('formats hours with a comma and no trailing zero', () => {
    expect(formatHours(27)).toBe('27');
    expect(formatHours(27.5)).toBe('27,5');
  });
});

describe('calculateTeacherAssignedLoad', () => {
  const teachers: Teacher[] = [
    { id: 't1', name: 'Лариса Георгіївна', targetNumberOfHours: 0, qualifiedSubjects: [] },
  ];

  it('splits a teacher load by week and keys it by id and name', () => {
    const activities = [
      ...Array.from({ length: 27 }, (_, i) => lesson(`full-${i}`)),
      lesson('half', 'numerator'),
    ];
    const loads = calculateTeacherAssignedLoad(teachers, activities);
    expect(loads.get('t1')).toMatchObject({ numerator: 28, denominator: 27, average: 27.5 });
    expect(loads.get('Лариса Георгіївна')).toBe(loads.get('t1'));
  });

  it('resolves activities that reference a teacher by name', () => {
    const byName = { ...lesson('a'), teacherIds: ['Лариса Георгіївна'] };
    expect(calculateTeacherAssignedLoad(teachers, [byName]).get('t1')?.average).toBe(1);
  });
});

describe('computeTeacherWorkloadReportData', () => {
  it('groups lessons itemized by subject and breakdown of classes with accurate hours', () => {
    const teachers: Teacher[] = [
      { id: 't1', name: 'Сисова Оксана', targetNumberOfHours: 30, qualifiedSubjects: [] },
    ];
    const subjects = [
      { id: 's1', name: 'Українська мова' },
      { id: 's2', name: 'Українська література' },
    ];
    const activities: Activity[] = [
      { ...lesson('a1'), teacherIds: ['t1'], subjectId: 's1', studentSetIds: ['5-А'], duration: 3 },
      { ...lesson('a2', 'numerator'), teacherIds: ['t1'], subjectId: 's1', studentSetIds: ['5-А'], duration: 1 }, // 3.5 hrs
      { ...lesson('a3'), teacherIds: ['t1'], subjectId: 's1', studentSetIds: ['5-Б'], duration: 4 },
      { ...lesson('a4'), teacherIds: ['t1'], subjectId: 's2', studentSetIds: ['6-А'], duration: 2 },
    ];

    const { rows, totalSchoolHours } = computeTeacherWorkloadReportData({
      teachers,
      activities,
      subjects,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Сисова Оксана');
    expect(rows[0].subjects).toHaveLength(2);

    const mowa = rows[0].subjects.find((s) => s.subjectName === 'Українська мова');
    expect(mowa?.classesSummary).toContain('5-А (3,5 (4/3))');
    expect(mowa?.classesSummary).toContain('5-Б (4)');
    expect(mowa?.formattedHours).toBe('7,5 (8/7)');

    const lit = rows[0].subjects.find((s) => s.subjectName === 'Українська література');
    expect(lit?.classesSummary).toBe('6-А (2)');
    expect(lit?.formattedHours).toBe('2');

    expect(rows[0].totalLoad.average).toBe(9.5);
    expect(totalSchoolHours).toBe(9.5);
  });
});

describe('computeAllClassesWeeklyLoad', () => {
  it('computes numerator, denominator, and parity balance status for each class', () => {
    const groups = [
      { id: 'g1', name: '5-А', studentIds: [] },
      { id: 'g2', name: '5-Б', studentIds: [] },
    ];
    const activities: Activity[] = [
      { ...lesson('a1'), studentSetIds: ['5-А'], duration: 30 },
      { ...lesson('a2', 'numerator'), studentSetIds: ['5-А'], duration: 1 }, // 30.5 (31/30)
      { ...lesson('a3'), studentSetIds: ['5-Б'], duration: 30 }, // 30 (30/30)
    ];

    const data = computeAllClassesWeeklyLoad(groups, activities);
    expect(data.classes).toHaveLength(2);

    const c5a = data.classes.find((c) => c.name === '5-А');
    expect(c5a?.numerator).toBe(31);
    expect(c5a?.denominator).toBe(30);
    expect(c5a?.average).toBe(30.5);
    expect(c5a?.isBalanced).toBe(false);
    expect(c5a?.difference).toBe(1);

    const c5b = data.classes.find((c) => c.name === '5-Б');
    expect(c5b?.numerator).toBe(30);
    expect(c5b?.denominator).toBe(30);
    expect(c5b?.isBalanced).toBe(true);
  });
});
