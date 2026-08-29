import { describe, it, expect } from 'vitest';
import { parseROZFile } from './rozParser';
import { SyntheticRozBuilder } from './rozFixture';
import { TimetableGenerator } from './engine/generator';
import {
  buildTimetableGrid,
  buildAllClassesGrid,
  validateSlotMove,
  findSolutionConflicts,
} from './timetableGrid';
import type {
  TimeConstraint,
  ActivityPreferredStartingTimeConstraint,
  TeacherNotAvailableTimesConstraint,
  StudentsSetNotAvailableTimesConstraint,
} from '@/types';

describe('Full Cycle Integration', () => {
  it('should run full cycle: parse .roz -> add constraints -> solve -> build grids -> edit -> lock -> regenerate', async () => {
    // 1. Build synthetic .roz file
    const builder = new SyntheticRozBuilder()
      .setSchool('Ліцей №1', '2026/2027')
      .setSubjects(['Математика', 'Українська мова', 'Історія'])
      .setTeachers(['Шевченко Т.Г.', 'Франко І.Я.'])
      .setClasses(['5-А', '6-А'])
      .addLesson(1, 2, 0, 0, 0) // 5-А: Math, 2h, Shevchenko
      .addLesson(2, 2, 1, 0, 1) // 5-А: Ukrainian, 2h, Franko
      .addLesson(3, 2, 2, 1, 0) // 6-А: History, 2h, Shevchenko
      .addLesson(4, 2, 0, 1, 1); // 6-А: Math, 2h, Franko

    const buffer = builder.build();
    const parsed = parseROZFile(buffer);

    expect(parsed.file.institutionName).toBe('Ліцей №1');
    expect(parsed.file.subjects.length).toBe(3);
    expect(parsed.file.subjects[0].color).toBeDefined();
    expect(parsed.file.teachers.length).toBe(2);
    expect(parsed.file.studentsGroups.length).toBe(2);
    expect(parsed.file.activities.length).toBe(8); // 4 lessons * 2 hours each = 8 activities

    // 2. Add teacher unavailability constraint: Shevchenko unavailable on Friday
    const timeConstraints: TimeConstraint[] = [
      {
        id: 'c-basic-time',
        type: 'BasicCompulsoryTime',
        weightPercentage: 100,
        active: true,
        comments: '',
      },
      {
        id: 'c-teacher-unavail',
        type: 'TeacherNotAvailableTimes',
        teacherId: parsed.file.teachers[0].id,
        times: [
          { day: 4, hour: 0 },
          { day: 4, hour: 1 },
          { day: 4, hour: 2 },
          { day: 4, hour: 3 },
          { day: 4, hour: 4 },
          { day: 4, hour: 5 },
          { day: 4, hour: 6 },
        ],
        weightPercentage: 100,
        active: true,
        comments: 'Не працює у пʼятницю',
      } as TeacherNotAvailableTimesConstraint,
      {
        id: 'c-class-unavail',
        type: 'StudentsSetNotAvailableTimes',
        studentsSetId: parsed.file.studentsGroups[0].id,
        times: [{ day: 0, hour: 0 }],
        weightPercentage: 100,
        active: true,
        comments: 'Не вчиться в понеділок 1-й урок',
      } as StudentsSetNotAvailableTimesConstraint,
    ];

    // 3. Generate Timetable
    const generator = new TimetableGenerator(
      parsed.file,
      parsed.file.activities,
      parsed.file.teachers,
      parsed.file.studentsSubgroups,
      parsed.file.rooms,
      timeConstraints,
      [],
      { maxSeconds: 10 },
      parsed.file.studentsGroups,
      parsed.file.studentsYears
    );

    const result = await generator.generate();
    expect(result.success).toBe(true);
    expect(result.placedActivities).toBe(8);

    const solution = {
      id: 'sol-1',
      rulesId: 'rules-1',
      placements: result.timeAllocations.map((ta) => ({
        activityId: parsed.file.activities[ta.activityIndex].id,
        day: ta.day,
        hour: ta.hour,
      })),
      conflicts: [],
      isComplete: true,
      generatedAt: new Date(),
    };

    // 4. Verify no conflicts
    const conflicts = findSolutionConflicts(
      solution,
      parsed.file.activities,
      parsed.file.teachers,
      parsed.file.studentsGroups,
      parsed.file.studentsSubgroups,
      parsed.file
    );
    expect(conflicts.size).toBe(0);

    // 5. Build Class and All-Classes Grids
    const classGrid = buildTimetableGrid({
      entityId: parsed.file.studentsGroups[0].id,
      entityType: 'students',
      solution,
      rules: parsed.file,
      activities: parsed.file.activities,
      teachers: parsed.file.teachers,
      subjects: parsed.file.subjects,
      rooms: parsed.file.rooms,
    });
    expect(classGrid).not.toBeNull();

    const allClassesGrid = buildAllClassesGrid({
      solution,
      rules: parsed.file,
      activities: parsed.file.activities,
      subjects: parsed.file.subjects,
      groups: parsed.file.studentsGroups,
      rooms: parsed.file.rooms,
    });
    expect(allClassesGrid).not.toBeNull();
    expect(allClassesGrid?.groups.length).toBe(2);

    // 6. Test Slot Legality Validation
    // Moving Shevchenko's lesson to Friday (day 4) should be rejected by constraint
    const shevchenkoAct = parsed.file.activities.find((a) =>
      a.teacherIds.includes(parsed.file.teachers[0].name) ||
      a.teacherIds.includes(parsed.file.teachers[0].id)
    )!;

    const invalidMoveFriday = validateSlotMove({
      activityId: shevchenkoAct.id,
      targetDay: 4,
      targetHour: 1,
      currentSolution: solution,
      activities: parsed.file.activities,
      teachers: parsed.file.teachers,
      studentsGroups: parsed.file.studentsGroups,
      studentsSubgroups: parsed.file.studentsSubgroups,
      rooms: parsed.file.rooms,
      timeConstraints,
      rules: parsed.file,
    });
    expect(invalidMoveFriday.valid).toBe(false);
    expect(invalidMoveFriday.reason).toContain('не може викладати');

    // 7. Lock a lesson and regenerate
    const firstPlacement = solution.placements[0];
    const lockConstraint: ActivityPreferredStartingTimeConstraint = {
      id: 'lock-1',
      type: 'ActivityPreferredStartingTime',
      activityId: firstPlacement.activityId,
      day: firstPlacement.day,
      hour: firstPlacement.hour,
      permanentlyLocked: true,
      weightPercentage: 100,
      active: true,
      comments: 'Pinned lesson',
    };

    const updatedConstraints = [...timeConstraints, lockConstraint];

    const generator2 = new TimetableGenerator(
      parsed.file,
      parsed.file.activities,
      parsed.file.teachers,
      parsed.file.studentsSubgroups,
      parsed.file.rooms,
      updatedConstraints,
      [],
      { maxSeconds: 10 },
      parsed.file.studentsGroups,
      parsed.file.studentsYears
    );

    const result2 = await generator2.generate();
    expect(result2.success).toBe(true);

    // Verify pinned lesson was kept at its locked starting slot
    const lockedActIndex = parsed.file.activities.findIndex(
      (a) => a.id === firstPlacement.activityId
    );
    const newAlloc = result2.timeAllocations.find(
      (ta) => ta.activityIndex === lockedActIndex
    );
    expect(newAlloc?.day).toBe(firstPlacement.day);
    expect(newAlloc?.hour).toBe(firstPlacement.hour);
  });
});
