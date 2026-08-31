/**
 * Regression licence for stream support (institution presets, Phase 5).
 *
 * A stream is one activity attached to a whole year (or to several sets at
 * once), possibly co-taught by several teachers. The engine must expand the
 * audience through resolveStudentSetIndices (subgroup → group → year) and
 * treat every covered group as occupied — otherwise group-level activities
 * collide with the stream. These assertions pin that behaviour before the UI
 * unlocks multi-select.
 */
import { describe, it, expect } from 'vitest';
import { TimetableGenerator } from './generator';
import type {
  Activity,
  Teacher,
  TimetableRules,
  StudentsYear,
  StudentsGroup,
} from '../../types';
import { STUDENTS_GROUP, STUDENTS_YEAR } from '../../types';

describe('TimetableGenerator multi-set / multi-teacher streams', () => {
  const rules: TimetableRules = {
    id: 'rules-streams',
    mode: 0,
    institutionName: 'Тестовий університет',
    nDaysPerWeek: 5,
    nHoursPerDay: 6,
    daysOfTheWeek: Array.from({ length: 5 }, (_, i) => ({ name: `Day${i + 1}` })),
    hoursOfTheDay: Array.from({ length: 6 }, (_, i) => ({ name: `Pair${i + 1}` })),
    modified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const teacher = (id: string): Teacher => ({
    id,
    name: id,
    targetNumberOfHours: 20,
    qualifiedSubjects: [],
  });

  const group = (id: string): StudentsGroup => ({
    id,
    name: id,
    numberOfStudents: 25,
    type: STUDENTS_GROUP,
    subgroups: [],
  });

  const year: StudentsYear = {
    id: 'Year1',
    name: '1 курс',
    numberOfStudents: 75,
    type: STUDENTS_YEAR,
    groups: ['G1', 'G2', 'G3'],
    divisions: [],
    separator: '-',
  };

  const activity = (
    id: string,
    teacherIds: string[],
    studentSetIds: string[],
    duration = 1
  ): Activity => ({
    id,
    activityGroupId: 0,
    teacherIds,
    subjectId: `Subj-${id}`,
    activityTagIds: [],
    studentSetIds,
    duration,
    totalDuration: duration,
    active: true,
    computeNTotalStudents: true,
    nTotalStudents: 75,
  });

  const groups = [group('G1'), group('G2'), group('G3')];

  // studentsGroups and studentsYears are the two trailing constructor
  // parameters. The default search budget (100 recursion calls) may terminate
  // with a conflicting pair still in place; a generous budget lets the solver
  // kick conflicts and converge, which is what these assertions pin down.
  const generate = (activities: Activity[], teachers: Teacher[]) =>
    new TimetableGenerator(
      rules, activities, teachers,
      [], [], [], [],
      { maxRecursionCalls: 100000 },
      groups, [year],
    ).generate();

  it('keeps a year-wide lecture stream clear of every covered group', async () => {
    const teachers = [teacher('T1'), teacher('T2')];
    const activities: Activity[] = [
      activity('stream-lecture', ['T1'], ['Year1'], 2),
      activity('seminar-G1', ['T2'], ['G1']),
      activity('seminar-G2', ['T2'], ['G2']),
      activity('seminar-G3', ['T2'], ['G3']),
    ];

    const result = await generate(activities, teachers);

    expect(result.placedActivities).toBe(activities.length);

    // Stream slots occupy all three groups; seminars must avoid them.
    const occupied = new Map<string, string>();
    for (const alloc of result.timeAllocations) {
      const act = activities[alloc.activityIndex];
      const covered = act.studentSetIds.includes('Year1')
        ? groups.map((g) => g.id)
        : act.studentSetIds;
      for (let h = 0; h < act.duration; h++) {
        for (const setId of covered) {
          const slot = `${setId}@${alloc.day}:${alloc.hour + h}`;
          expect(occupied.has(slot) ? null : slot).toBe(slot);
          occupied.set(slot, act.id);
        }
      }
    }
  });

  it('prevents double-booking when several teachers share one activity', async () => {
    const teachers = [teacher('T1'), teacher('T2')];
    const activities: Activity[] = [
      activity('co-taught', ['T1', 'T2'], ['Year1'], 1),
      activity('t1-solo', ['T1'], ['G1']),
      activity('t2-solo', ['T2'], ['G2']),
    ];

    const result = await generate(activities, teachers);

    expect(result.placedActivities).toBe(activities.length);

    const busy = new Map<string, string>();
    for (const alloc of result.timeAllocations) {
      const act = activities[alloc.activityIndex];
      for (const teacherId of act.teacherIds) {
        const slot = `${teacherId}@${alloc.day}:${alloc.hour}`;
        expect(busy.has(slot), `${teacherId} double-booked at ${slot}`).toBe(false);
        busy.set(slot, act.id);
      }
    }
  });

  it('expands a stream attached to several explicit groups at once', async () => {
    const teachers = [teacher('T1')];
    const activities: Activity[] = [
      activity('two-group-stream', ['T1'], ['G1', 'G2'], 1),
      activity('solo-G3', ['T1'], ['G3'], 1),
    ];

    const result = await generate(activities, teachers);

    expect(result.placedActivities).toBe(activities.length);

    const stream = result.timeAllocations.find((a) => activities[a.activityIndex].id === 'two-group-stream');
    const solo = result.timeAllocations.find((a) => activities[a.activityIndex].id === 'solo-G3');
    expect(stream).toBeDefined();
    expect(solo).toBeDefined();
    // T1 teaches both, so the solo pair must not coincide with the stream.
    expect(`${solo!.day}:${solo!.hour}`).not.toBe(`${stream!.day}:${stream!.hour}`);
  });
});
