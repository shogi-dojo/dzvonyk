import { describe, it, expect } from 'vitest';
import {
  buildClassDayHourMatrix,
  buildTeacherDayHourMatrix,
} from './timetableGrid';
import { computeSlotVerdicts } from '@/components/timetable/useDropFeedback';
import type {
  Activity,
  Teacher,
  Subject,
  StudentsGroup,
  StudentsSubgroup,
  StudentsYear,
  Room,
  TimeConstraint,
  TimetableRules,
  TimetableSolution,
} from '@/types';

function createGymnasiumScaleFixture() {
  const nDays = 5;
  const nHours = 9;

  const rules: TimetableRules = {
    institutionName: 'Гімназія № 131',
    nDaysPerWeek: nDays,
    daysOfTheWeek: [
      { name: 'Понеділок' },
      { name: 'Вівторок' },
      { name: 'Середа' },
      { name: 'Четвер' },
      { name: 'Пʼятниця' },
    ],
    nHoursPerDay: nHours,
    hoursOfTheDay: Array.from({ length: nHours }, (_, i) => ({ name: String(i + 1) })),
  };

  const teachers: Teacher[] = Array.from({ length: 50 }, (_, i) => ({
    id: `teacher-${i + 1}`,
    name: `Вчитель ${i + 1}`,
    targetHours: 18,
  }));

  const subjects: Subject[] = Array.from({ length: 20 }, (_, i) => ({
    id: `subject-${i + 1}`,
    name: `Предмет ${i + 1}`,
    code: `Пр${i + 1}`,
    color: '#3b82f6',
  }));

  const years: StudentsYear[] = Array.from({ length: 7 }, (_, i) => ({
    name: `${i + 5} клас`,
    groups: [`${i + 5}-А`, `${i + 5}-Б`],
  }));

  const groups: StudentsGroup[] = [];
  const subgroups: StudentsSubgroup[] = [];

  for (let grade = 5; grade <= 11; grade++) {
    for (const letter of ['А', 'Б', 'В'].slice(0, grade === 11 ? 2 : 3)) {
      const gName = `${grade}-${letter}`;
      const sg1 = `${gName} 1 група`;
      const sg2 = `${gName} 2 група`;

      groups.push({
        id: `group-${gName}`,
        name: gName,
        shift: grade >= 9 ? 2 : 1,
        subgroups: [sg1, sg2],
      });

      subgroups.push({ id: `subgroup-${sg1}`, name: sg1 });
      subgroups.push({ id: `subgroup-${sg2}`, name: sg2 });
    }
  }

  const rooms: Room[] = Array.from({ length: 30 }, (_, i) => ({
    id: `room-${i + 1}`,
    name: `Каб. ${100 + i}`,
    capacity: 35,
  }));

  const timeConstraints: TimeConstraint[] = [];

  // Generate 659 activities
  const activities: Activity[] = [];
  const placements: { activityId: string; day: number; hour: number }[] = [];

  for (let i = 0; i < 659; i++) {
    const actId = `act-${i + 1}`;
    const group = groups[i % groups.length];
    const teacher = teachers[i % teachers.length];
    const subject = subjects[i % subjects.length];
    const parity = i % 10 === 0 ? 'numerator' : i % 10 === 1 ? 'denominator' : 'both';

    activities.push({
      id: actId,
      subjectId: subject.id,
      teacherIds: [teacher.id],
      studentSetIds: [group.id],
      duration: 1,
      totalHours: 1,
      activityTags: [],
      weekParity: parity,
    });

    const day = (i * 2 + 1) % nDays;
    const hour = (i * 3 + 2) % nHours;
    placements.push({ activityId: actId, day, hour });
  }

  const solution: TimetableSolution = {
    id: 'sol-gymnasium-131',
    name: 'Розклад гімназії',
    generatedAt: '2026-08-30T10:00:00.000Z',
    isComplete: true,
    fitness: 100,
    placements,
  };

  return {
    rules,
    teachers,
    subjects,
    years,
    groups,
    subgroups,
    rooms,
    timeConstraints,
    activities,
    solution,
  };
}

describe('timetableGrid performance guard (scale: 659 activities)', () => {
  const fixture = createGymnasiumScaleFixture();

  it('buildClassDayHourMatrix completes in < 150ms', () => {
    const start = performance.now();
    const matrix = buildClassDayHourMatrix({
      solution: fixture.solution,
      rules: fixture.rules,
      activities: fixture.activities,
      teachers: fixture.teachers,
      subjects: fixture.subjects,
      groups: fixture.groups,
      subgroups: fixture.subgroups,
      rooms: fixture.rooms,
      lockedActivityIds: new Set(),
      conflictsMap: new Map(),
    });
    const elapsed = performance.now() - start;

    expect(matrix.rows.length).toBe(fixture.groups.length);
    expect(elapsed).toBeLessThan(150);
  });

  it('buildTeacherDayHourMatrix completes in < 150ms', () => {
    const start = performance.now();
    const matrix = buildTeacherDayHourMatrix({
      solution: fixture.solution,
      rules: fixture.rules,
      activities: fixture.activities,
      teachers: fixture.teachers,
      subjects: fixture.subjects,
      groups: fixture.groups,
      subgroups: fixture.subgroups,
      rooms: fixture.rooms,
      lockedActivityIds: new Set(),
      conflictsMap: new Map(),
    });
    const elapsed = performance.now() - start;

    expect(matrix.rows.length).toBe(fixture.teachers.length);
    expect(elapsed).toBeLessThan(150);
  });

  it('computeSlotVerdicts across all 45 slots completes in < 150ms', () => {
    const start = performance.now();
    const verdicts = computeSlotVerdicts('act-1', {
      currentSolution: fixture.solution,
      rules: fixture.rules,
      activities: fixture.activities,
      teachers: fixture.teachers,
      studentsGroups: fixture.groups,
      studentsSubgroups: fixture.subgroups,
      studentsYears: fixture.years,
      rooms: fixture.rooms,
      timeConstraints: fixture.timeConstraints,
    });
    const elapsed = performance.now() - start;

    expect(verdicts.size).toBe(45);
    expect(elapsed).toBeLessThan(150);
  });

  it('sustains rapid drag operations with average time < 30ms', () => {
    const iterations = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const actId = `act-${(i * 17) % fixture.activities.length + 1}`;
      computeSlotVerdicts(actId, {
        currentSolution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
      });
    }

    const avgTime = (performance.now() - start) / iterations;
    expect(avgTime).toBeLessThan(30);
  });
});
