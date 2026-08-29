import { describe, expect, it } from 'vitest';
import { sumWeeklyLoad, formatWeeklyLoad, formatHours } from './weeklyLoad';
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
