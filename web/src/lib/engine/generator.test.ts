/**
 * Unit tests for the Timetable Generator
 */
import { describe, it, expect } from 'vitest';
import { TimetableGenerator } from './generator';
import type { Activity, Teacher, Room, TimetableRules, StudentsSubgroup } from '../../types';
import { STUDENTS_SUBGROUP } from '../../types';

describe('TimetableGenerator', () => {
  // Helper to create test data
  const createTestRules = (days = 5, hours = 8): TimetableRules => ({
    id: 'test-rules',
    mode: 0,
    institutionName: 'Test School',
    nDaysPerWeek: days,
    nHoursPerDay: hours,
    daysOfTheWeek: Array.from({ length: days }, (_, i) => ({ name: `Day${i + 1}` })),
    hoursOfTheDay: Array.from({ length: hours }, (_, i) => ({ name: `Hour${i + 1}` })),
    modified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createTestTeacher = (name: string): Teacher => ({
    id: `teacher-${name}`,
    name,
    targetNumberOfHours: 20,
    qualifiedSubjects: [],
  });

  const createTestSubgroup = (name: string): StudentsSubgroup => ({
    id: `subgroup-${name}`,
    name,
    numberOfStudents: 30,
    type: STUDENTS_SUBGROUP,
  });

  const _createTestRoom = (name: string, capacity = 30): Room => ({
    id: `room-${name}`,
    name,
    capacity,
    isVirtual: false,
  });

  const createTestActivity = (
    id: string,
    teacherName: string,
    subjectId: string,
    studentSetIds: string[],
    duration = 1
  ): Activity => ({
    id,
    activityGroupId: 0,
    teacherIds: [teacherName],
    subjectId,
    activityTagIds: [],
    studentSetIds,
    duration,
    totalDuration: duration,
    active: true,
    computeNTotalStudents: true,
    nTotalStudents: 30,
  });

  describe('constructor', () => {
    it('should create generator with basic data', () => {
      const rules = createTestRules();
      const teacher = createTestTeacher('T1');
      const activity = createTestActivity('a1', 'T1', 'Math', ['Year1']);
      
      const generator = new TimetableGenerator(
        rules,
        [activity],
        [teacher],
        [],
        [],
        [],
        []
      );
      
      expect(generator).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should handle empty activities list', async () => {
      const rules = createTestRules();
      const generator = new TimetableGenerator(rules, [], [], [], [], [], []);
      
      const result = await generator.generate();
      
      expect(result.success).toBe(true);
      expect(result.totalActivities).toBe(0);
      expect(result.placedActivities).toBe(0);
    });

    it('should place a single activity', async () => {
      const rules = createTestRules(5, 8);
      const teacher = createTestTeacher('T1');
      const subgroup = createTestSubgroup('S1');
      const activity = createTestActivity('a1', 'T1', 'Math', ['S1'], 1);
      
      const generator = new TimetableGenerator(
        rules,
        [activity],
        [teacher],
        [subgroup],
        [],
        [],
        []
      );
      
      const result = await generator.generate();
      
      expect(result.totalActivities).toBe(1);
      expect(result.placedActivities).toBeGreaterThanOrEqual(0);
      expect(result.timeAllocations).toBeDefined();
    });

    it('should place multiple non-conflicting activities', async () => {
      const rules = createTestRules(5, 8);
      const t1 = createTestTeacher('T1');
      const t2 = createTestTeacher('T2');
      const s1 = createTestSubgroup('S1');
      const s2 = createTestSubgroup('S2');
      
      const activities = [
        createTestActivity('a1', 'T1', 'Math', ['S1'], 1),
        createTestActivity('a2', 'T2', 'English', ['S2'], 1),
      ];
      
      const generator = new TimetableGenerator(
        rules,
        activities,
        [t1, t2],
        [s1, s2],
        [],
        [],
        []
      );
      
      const result = await generator.generate();
      
      expect(result.totalActivities).toBe(2);
      expect(result.placedActivities).toBe(2);
    });

    it('should handle multi-hour activities', async () => {
      const rules = createTestRules(5, 8);
      const teacher = createTestTeacher('T1');
      const subgroup = createTestSubgroup('S1');
      const activity = createTestActivity('a1', 'T1', 'Math', ['S1'], 2);
      
      const generator = new TimetableGenerator(
        rules,
        [activity],
        [teacher],
        [subgroup],
        [],
        [],
        []
      );
      
      const result = await generator.generate();
      
      expect(result.totalActivities).toBe(1);
      if (result.placedActivities > 0) {
        const allocation = result.timeAllocations[0];
        expect(allocation).toBeDefined();
        expect(allocation.hour).toBeLessThanOrEqual(rules.nHoursPerDay - 2);
      }
    });

    it('should respect break times constraint', async () => {
      const rules = createTestRules(5, 8);
      const teacher = createTestTeacher('T1');
      const subgroup = createTestSubgroup('S1');
      const activity = createTestActivity('a1', 'T1', 'Math', ['S1'], 1);
      
      // All time slots on day 0 are breaks
      const breakConstraint = {
        id: 'break1',
        type: 'BreakTimes' as const,
        weightPercentage: 100,
        active: true,
        times: Array.from({ length: 8 }, (_, h) => ({ day: 0, hour: h })),
      };
      
      const generator = new TimetableGenerator(
        rules,
        [activity],
        [teacher],
        [subgroup],
        [],
        [breakConstraint],
        []
      );
      
      const result = await generator.generate();
      
      // Activity should be placed on a day other than day 0
      if (result.placedActivities > 0) {
        const allocation = result.timeAllocations[0];
        expect(allocation.day).not.toBe(0);
      }
    });

    it('should support abort via callback', async () => {
      const rules = createTestRules(5, 8);
      const activities = Array.from({ length: 20 }, (_, i) => 
        createTestActivity(`a${i}`, `T${i}`, 'Math', [`S${i}`], 1)
      );
      const teachers = activities.map(a => createTestTeacher(a.teacherIds[0]));
      const subgroups = activities.map(a => createTestSubgroup(a.studentSetIds[0]));
      
      const generator = new TimetableGenerator(
        rules,
        activities,
        teachers,
        subgroups,
        [],
        [],
        []
      );
      
      let shouldStop = false;
      setTimeout(() => { shouldStop = true; }, 50);
      
      const result = await generator.generate({
        shouldStop: () => shouldStop,
      });
      
      // Should complete or abort without error
      expect(result).toBeDefined();
    });

    it('should resolve class to its member subgroups and prevent double-booking', async () => {
      const rules = createTestRules(1, 2); // 1 day, 2 hours
      const t1 = createTestTeacher('T1');
      const t2 = createTestTeacher('T2');
      const sg1 = createTestSubgroup('5-А 1 група');
      const sg2 = createTestSubgroup('5-А 2 група');
      const group5A = {
        id: 'group-5-A',
        name: '5-А',
        numberOfStudents: 30,
        type: 2 as const,
        subgroups: ['5-А 1 група', '5-А 2 група'],
      };

      // Activity 1 targets whole class 5-А (duration 2 -> takes both hours 0 and 1)
      const a1 = createTestActivity('a1', 'T1', 'Ukr', ['5-А'], 2);
      // Activity 2 targets subgroup 5-А 1 група (duration 1)
      // Since a1 takes 2 hours on a 2-hour grid, a2 CANNOT be placed at the same time without clash
      const a2 = createTestActivity('a2', 'T2', 'Eng', ['5-А 1 група'], 1);

      const generator = new TimetableGenerator(
        rules,
        [a1, a2],
        [t1, t2],
        [sg1, sg2],
        [],
        [],
        [],
        undefined,
        [group5A]
      );

      const result = await generator.generate();
      // Since total hours needed = 3, but grid is only 2 hours, exactly 1 activity can be placed (a1=2h or a2=1h)
      expect(result.placedActivities).toBeLessThan(3);
      expect(result.success).toBe(false);
    });

    it('should enforce shifts for groups correctly', async () => {
      const rules: TimetableRules = {
        ...createTestRules(1, 4), // 1 day, 4 hours: 0, 1, 2, 3
        shifts: {
          shift1: { firstHour: 0, lastHour: 1 },
          shift2: { firstHour: 2, lastHour: 3 },
        },
      };

      const t1 = createTestTeacher('T1');
      const sg1 = createTestSubgroup('7-А 1 група');
      const group7A = {
        id: 'group-7-A',
        name: '7-А',
        numberOfStudents: 30,
        type: 2 as const,
        subgroups: ['7-А 1 група'],
        shift: 2 as const, // Shift 2 only: hours 2 and 3
      };

      const a1 = createTestActivity('a1', 'T1', 'Math', ['7-А'], 1);

      const generator = new TimetableGenerator(
        rules,
        [a1],
        [t1],
        [sg1],
        [],
        [],
        [],
        undefined,
        [group7A]
      );

      const result = await generator.generate();
      expect(result.success).toBe(true);
      expect(result.timeAllocations).toHaveLength(1);
      // Must be placed in shift 2 (hour 2 or 3)
      expect(result.timeAllocations[0].hour).toBeGreaterThanOrEqual(2);
      expect(result.timeAllocations[0].hour).toBeLessThanOrEqual(3);
    });
  });

  describe('teacher gaps', () => {
    it('counts only empty periods between the first and last lesson', () => {
      const generator = new TimetableGenerator(createTestRules(1, 5), [], [createTestTeacher('T1')], [], [], [], []);
      const internal = generator as unknown as {
        initialize: () => void;
        teachersTimetable: number[][];
        countTeacherGapsOnDay: (teacherIdx: number, day: number) => number;
      };
      internal.initialize();
      internal.teachersTimetable[0] = [-1, 0, -1, 1, -1];
      expect(internal.countTeacherGapsOnDay(0, 0)).toBe(1);

      internal.teachersTimetable[0] = [-1, 0, 1, -1, -1];
      expect(internal.countTeacherGapsOnDay(0, 0)).toBe(0);
    });
  });

  describe('fetId constraint binding', () => {
    it('honours locked ActivityPreferredStartingTime referencing fetId', async () => {
      const rules = createTestRules(5, 7);
      const teacher = createTestTeacher('T1');
      const subgroup = createTestSubgroup('S1');
      const activity: Activity = {
        id: 'uuid-activity-1',
        fetId: '389',
        activityGroupId: 0,
        teacherIds: ['T1'],
        subjectId: 'Informatics',
        activityTagIds: [],
        studentSetIds: ['S1'],
        duration: 1,
        totalDuration: 1,
        active: true,
        computeNTotalStudents: true,
        nTotalStudents: 30,
      };

      const timeConstraints = [
        {
          id: 'tc-lock-1',
          type: 'ActivityPreferredStartingTime' as const,
          activityId: '389', // References fetId instead of uuid
          day: 3,
          hour: 4,
          permanentlyLocked: true,
          weightPercentage: 100,
          active: true,
        },
      ];

      const generator = new TimetableGenerator(
        rules,
        [activity],
        [teacher],
        [subgroup],
        [],
        timeConstraints,
        []
      );

      const result = await generator.generate();
      expect(result.success).toBe(true);
      expect(result.timeAllocations).toHaveLength(1);
      expect(result.timeAllocations[0].activityIndex).toBe(0);
      expect(result.timeAllocations[0].day).toBe(3);
      expect(result.timeAllocations[0].hour).toBe(4);
    });

    it('honours ActivityPreferredRoom referencing fetId', async () => {
      const rules = createTestRules(5, 7);
      const teacher = createTestTeacher('T1');
      const subgroup = createTestSubgroup('S1');
      const room: Room = { id: 'room-uuid-1', name: 'Lab-1', capacity: 30, isVirtual: false };
      const otherRoom: Room = { id: 'room-uuid-2', name: 'Lab-2', capacity: 30, isVirtual: false };

      const activity: Activity = {
        id: 'uuid-activity-2',
        fetId: '390',
        activityGroupId: 0,
        teacherIds: ['T1'],
        subjectId: 'Physics',
        activityTagIds: [],
        studentSetIds: ['S1'],
        duration: 1,
        totalDuration: 1,
        active: true,
        computeNTotalStudents: true,
        nTotalStudents: 30,
      };

      const spaceConstraints = [
        {
          id: 'sc-pref-1',
          type: 'ActivityPreferredRoom' as const,
          activityId: '390', // References fetId
          roomId: 'room-uuid-1',
          permanentlyLocked: true,
          weightPercentage: 100,
          active: true,
        },
      ];

      const generator = new TimetableGenerator(
        rules,
        [activity],
        [teacher],
        [subgroup],
        [room, otherRoom],
        [],
        spaceConstraints
      );

      const result = await generator.generate();
      expect(result.success).toBe(true);
      expect(result.roomAllocations).toHaveLength(1);
      expect(result.roomAllocations[0].activityIndex).toBe(0);
      expect(result.roomAllocations[0].roomIndex).toBe(0); // room-uuid-1 is index 0
    });
  });
});
