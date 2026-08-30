import { describe, it, expect } from 'vitest';
import { getUnplacedActivities } from './unplacedActivities';
import { createTestTimetableData } from './__fixtures__/timetableFixture';

describe('getUnplacedActivities', () => {
  const fixture = createTestTimetableData();

  it('returns activities not present in solution placements', () => {
    // In fixture.solution, act-1, act-2, act-3 are placed, so act-4-num and act-5-den are unplaced
    const unplaced = getUnplacedActivities({
      activities: fixture.activities,
      solution: fixture.solution,
      subjects: fixture.subjects,
      teachers: fixture.teachers,
      groups: fixture.groups,
      subgroups: fixture.subgroups,
    });

    expect(unplaced.length).toBe(2);
    const unplacedIds = unplaced.map((u) => u.activity.id);
    expect(unplacedIds).toContain('act-4-num');
    expect(unplacedIds).toContain('act-5-den');

    const act4Item = unplaced.find((u) => u.activity.id === 'act-4-num');
    expect(act4Item?.subjectName).toBe('Математика');
    expect(act4Item?.subjectCode).toBe('Ма');
    expect(act4Item?.teacherNames).toContain('Вчитель А');
    expect(act4Item?.studentNames).toContain('5-А 1 група');
    expect(act4Item?.weekParity).toBe('numerator');
  });

  it('returns all activities when solution is null or has empty placements', () => {
    const unplaced = getUnplacedActivities({
      activities: fixture.activities,
      solution: null,
      subjects: fixture.subjects,
      teachers: fixture.teachers,
      groups: fixture.groups,
      subgroups: fixture.subgroups,
    });

    expect(unplaced.length).toBe(fixture.activities.length);
  });

  it('returns empty array when all activities are placed', () => {
    const completeSolution = {
      ...fixture.solution,
      placements: fixture.activities.map((a, i) => ({
        activityId: a.id,
        day: i % 5,
        hour: (i % 7) + 1,
      })),
    };

    const unplaced = getUnplacedActivities({
      activities: fixture.activities,
      solution: completeSolution,
      subjects: fixture.subjects,
      teachers: fixture.teachers,
      groups: fixture.groups,
      subgroups: fixture.subgroups,
    });

    expect(unplaced.length).toBe(0);
  });
});
