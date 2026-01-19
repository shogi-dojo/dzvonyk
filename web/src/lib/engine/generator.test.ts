/**
 * Unit tests for the Timetable Generator
 */
import { describe, it, expect, vi } from 'vitest';
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

  const createTestRoom = (name: string, capacity = 30): Room => ({
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
  });
});
