import { describe, it, expect } from 'vitest';
import {
  resolveSubgroupNames,
  activitiesShareStudents,
  findSolutionConflicts,
  validateSlotMove,
  buildTimetableGrid,
  buildAllClassesGrid,
} from './timetableGrid';
import { createTestTimetableData } from './__fixtures__/timetableFixture';

describe('timetableGrid', () => {
  describe('resolveSubgroupNames', () => {
    const { groups, subgroups, years } = createTestTimetableData();

    it('resolves direct subgroup by id or name', () => {
      expect(resolveSubgroupNames('sg-5a-1', groups, subgroups, years)).toEqual(['5-А 1 група']);
      expect(resolveSubgroupNames('5-А 1 група', groups, subgroups, years)).toEqual(['5-А 1 група']);
    });

    it('resolves group with subgroups to all its subgroup names', () => {
      expect(resolveSubgroupNames('g-5a', groups, subgroups, years)).toEqual([
        '5-А 1 група',
        '5-А 2 група',
      ]);
      expect(resolveSubgroupNames('5-А', groups, subgroups, years)).toEqual([
        '5-А 1 група',
        '5-А 2 група',
      ]);
    });

    it('resolves group without subgroups to its own name', () => {
      expect(resolveSubgroupNames('g-5b', groups, subgroups, years)).toEqual(['5-Б']);
      expect(resolveSubgroupNames('5-Б', groups, subgroups, years)).toEqual(['5-Б']);
    });

    it('resolves year to all subgroups of its constituent groups', () => {
      expect(resolveSubgroupNames('y-5', groups, subgroups, years)).toEqual([
        '5-А 1 група',
        '5-А 2 група',
        '5-Б',
      ]);
      expect(resolveSubgroupNames('5 клас', groups, subgroups, years)).toEqual([
        '5-А 1 група',
        '5-А 2 група',
        '5-Б',
      ]);
    });

    it('falls back to input identifier if not matched', () => {
      expect(resolveSubgroupNames('unknown-id', groups, subgroups, years)).toEqual(['unknown-id']);
    });
  });

  describe('activitiesShareStudents', () => {
    const { groups, subgroups, years, activities } = createTestTimetableData();

    it('returns true when both activities target the exact same class', () => {
      const act1 = activities[0]; // 5-A
      const act2 = activities[1]; // 5-A
      expect(activitiesShareStudents(act1, act2, groups, subgroups, years)).toBe(true);
    });

    it('returns false when activities target distinct classes', () => {
      const act1 = activities[0]; // 5-A
      const act3 = activities[2]; // 5-B
      expect(activitiesShareStudents(act1, act3, groups, subgroups, years)).toBe(false);
    });

    it('returns true when one activity is for entire class and other is for a subgroup of that class', () => {
      const wholeClassAct = activities[0]; // 5-A
      const subgroupAct = activities[3];   // 5-A 1 група
      expect(activitiesShareStudents(wholeClassAct, subgroupAct, groups, subgroups, years)).toBe(true);
    });

    it('returns false when activities are for two different subgroups of the same class', () => {
      const sg1Act = activities[3]; // 5-A 1 група
      const sg2Act = { ...activities[3], id: 'act-sg2', studentSetIds: ['5-А 2 група'] };
      expect(activitiesShareStudents(sg1Act, sg2Act, groups, subgroups, years)).toBe(false);
    });
  });

  describe('findSolutionConflicts', () => {
    const fixture = createTestTimetableData();

    it('returns empty conflicts map for a valid non-overlapping solution', () => {
      const conflicts = findSolutionConflicts(
        fixture.solution,
        fixture.activities,
        fixture.teachers,
        fixture.groups,
        fixture.subgroups,
        fixture.rules
      );
      expect(conflicts.size).toBe(0);
    });

    it('detects teacher clash when the same teacher is scheduled simultaneously', () => {
      const clashingSolution = {
        ...fixture.solution,
        placements: [
          { activityId: 'act-1', day: 0, hour: 1 }, // Teacher A (5-A)
          // act-4-num also has Teacher A
          { activityId: 'act-4-num', day: 0, hour: 1 },
        ],
      };

      const conflicts = findSolutionConflicts(
        clashingSolution,
        fixture.activities,
        fixture.teachers,
        fixture.groups,
        fixture.subgroups,
        fixture.rules
      );

      expect(conflicts.has('act-1')).toBe(true);
      expect(conflicts.has('act-4-num')).toBe(true);
      expect(conflicts.get('act-1')?.[0]).toContain('Накладка вчителя');
    });

    it('detects student clash when same students are scheduled simultaneously', () => {
      const clashingSolution = {
        ...fixture.solution,
        placements: [
          { activityId: 'act-1', day: 0, hour: 1 }, // 5-A (Teacher A)
          { activityId: 'act-2', day: 0, hour: 1 }, // 5-A (Teacher B)
        ],
      };

      const conflicts = findSolutionConflicts(
        clashingSolution,
        fixture.activities,
        fixture.teachers,
        fixture.groups,
        fixture.subgroups,
        fixture.rules
      );

      expect(conflicts.has('act-1')).toBe(true);
      expect(conflicts.has('act-2')).toBe(true);
      expect(conflicts.get('act-1')?.[0]).toContain('Накладка класу');
    });

    it('detects room clash when different activities use same room simultaneously', () => {
      const clashingSolution = {
        ...fixture.solution,
        placements: [
          { activityId: 'act-1', day: 0, hour: 1, roomId: 'r-101' }, // 5-A, Teacher A
          { activityId: 'act-3', day: 0, hour: 1, roomId: 'r-101' }, // 5-B, Teacher C
        ],
      };

      const conflicts = findSolutionConflicts(
        clashingSolution,
        fixture.activities,
        fixture.teachers,
        fixture.groups,
        fixture.subgroups,
        fixture.rules
      );

      expect(conflicts.has('act-1')).toBe(true);
      expect(conflicts.has('act-3')).toBe(true);
      expect(conflicts.get('act-1')?.[0]).toContain('Накладка кабінету');
    });

    it('permits simultaneous numerator and denominator placements for same subgroup without conflict', () => {
      const alternatingSolution = {
        ...fixture.solution,
        placements: [
          { activityId: 'act-4-num', day: 0, hour: 1 }, // 5-A 1 група, Teacher A, numerator
          { activityId: 'act-5-den', day: 0, hour: 1 }, // 5-A 1 група, Teacher B, denominator
        ],
      };

      const conflicts = findSolutionConflicts(
        alternatingSolution,
        fixture.activities,
        fixture.teachers,
        fixture.groups,
        fixture.subgroups,
        fixture.rules
      );

      expect(conflicts.size).toBe(0);
    });
  });

  describe('validateSlotMove', () => {
    const fixture = createTestTimetableData();

    it('validates a valid move into an open slot within shift bounds', () => {
      const res = validateSlotMove({
        activityId: 'act-1',
        targetDay: 1,
        targetHour: 3,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });

      expect(res.valid).toBe(true);
    });

    it('rejects moves outside the grid boundaries', () => {
      const outOfDay = validateSlotMove({
        activityId: 'act-1',
        targetDay: 5, // 0..4 allowed
        targetHour: 2,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(outOfDay.valid).toBe(false);
      expect(outOfDay.reason).toContain('виходить за межі');

      const outOfHour = validateSlotMove({
        activityId: 'act-3', // duration: 2
        targetDay: 2,
        targetHour: 8, // 8 + 2 = 10 > 9
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(outOfHour.valid).toBe(false);
      expect(outOfHour.reason).toContain('виходить за межі');
    });

    it('rejects moves outside the group shift range', () => {
      // 5-A is in shift 1 (periods 1-8, index 0-7). Hour index 8 (period 9) is outside shift 1.
      const shift1Violation = validateSlotMove({
        activityId: 'act-1',
        targetDay: 1,
        targetHour: 8,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(shift1Violation.valid).toBe(false);
      expect(shift1Violation.reason).toContain('1-ю зміною');

      // 5-B is in shift 2 (periods 2-9, index 1-8). Hour index 0 (period 1) is outside shift 2.
      const shift2Violation = validateSlotMove({
        activityId: 'act-3',
        targetDay: 1,
        targetHour: 0,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(shift2Violation.valid).toBe(false);
      expect(shift2Violation.reason).toContain('2-ю зміною');
    });

    it('rejects moves violating TeacherNotAvailableTimes', () => {
      // Teacher A is unavailable Friday period 1 (day 4, hour 0)
      const res = validateSlotMove({
        activityId: 'act-1',
        targetDay: 4,
        targetHour: 0,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('не може викладати в цей час');
    });

    it('rejects moves violating StudentsSetNotAvailableTimes', () => {
      // 5-A is unavailable Monday period 1 (day 0, hour 0)
      const res = validateSlotMove({
        activityId: 'act-1',
        targetDay: 0,
        targetHour: 0,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Клас не навчається в цей час');
    });

    it('rejects moves clashing with another placed activity for the same teacher or student group', () => {
      // act-2 (Teacher B, 5-A) is at day 1, hour 2
      // moving act-1 (5-A) to day 1, hour 2 causes student clash
      const studentClash = validateSlotMove({
        activityId: 'act-1',
        targetDay: 1,
        targetHour: 2,
        currentSolution: fixture.solution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });
      expect(studentClash.valid).toBe(false);
      expect(studentClash.reason).toContain('вже має інший урок');
    });

    it('demonstrates unhandled parity in validateSlotMove (BUG: fixed in task 5)', () => {
      // act-5-den is placed at day 1, hour 2 in solution
      const paritySolution = {
        ...fixture.solution,
        placements: [{ activityId: 'act-5-den', day: 1, hour: 2 }],
      };

      // Moving act-4-num (numerator) to same slot as act-5-den (denominator)
      // BUG: Currently validateSlotMove ignores weekParity and flags a false student clash.
      const result = validateSlotMove({
        activityId: 'act-4-num',
        targetDay: 1,
        targetHour: 2,
        currentSolution: paritySolution,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
        rules: fixture.rules,
      });

      // Assert current buggy behavior: returns valid: false instead of valid: true
      expect(result.valid).toBe(false);
    });
  });

  describe('buildTimetableGrid', () => {
    const fixture = createTestTimetableData();

    it('builds teacher grid correctly with spanned multi-hour slots', () => {
      const grid = buildTimetableGrid({
        entityId: 'Вчитель В',
        entityType: 'teachers',
        solution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        subjects: fixture.subjects,
        rooms: fixture.rooms,
      });

      expect(grid).not.toBeNull();
      // rules: 9 hours x 5 days
      expect(grid?.length).toBe(9);
      expect(grid?.[0].length).toBe(5);

      // act-3 is placed at day 2 (Wed), hour 1, duration 2
      const cell1 = grid?.[1][2];
      expect(Array.isArray(cell1)).toBe(true);
      if (Array.isArray(cell1)) {
        expect(cell1[0].activityId).toBe('act-3');
        expect(cell1[0].duration).toBe(2);
      }

      // Spanned cell at hour 2, day 2
      const cell2 = grid?.[2][2];
      expect(cell2).toBe('spanned');
    });

    it('builds students grid correctly for a class', () => {
      const grid = buildTimetableGrid({
        entityId: '5-А',
        entityType: 'students',
        solution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        subjects: fixture.subjects,
        rooms: fixture.rooms,
      });

      expect(grid).not.toBeNull();
      // act-1 is at day 0 (Mon), hour 1
      const cell = grid?.[1][0];
      expect(Array.isArray(cell)).toBe(true);
      if (Array.isArray(cell)) {
        expect(cell[0].activityId).toBe('act-1');
        expect(cell[0].subject).toBe('Математика');
        expect(cell[0].room).toBe('101');
      }
    });

    it('attaches lock and conflict information', () => {
      const lockedIds = new Set(['act-1']);
      const conflictsMap = new Map([['act-1', ['Накладка']]]);

      const grid = buildTimetableGrid({
        entityId: '5-А',
        entityType: 'students',
        solution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        subjects: fixture.subjects,
        rooms: fixture.rooms,
        lockedActivityIds: lockedIds,
        conflictsMap,
      });

      const cell = grid?.[1][0];
      if (Array.isArray(cell)) {
        expect(cell[0].locked).toBe(true);
        expect(cell[0].conflicts).toEqual(['Накладка']);
      }
    });
  });

  describe('buildAllClassesGrid', () => {
    const fixture = createTestTimetableData();

    it('builds sorted class rows and places cells in correct group columns', () => {
      const grid = buildAllClassesGrid({
        solution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        subjects: fixture.subjects,
        groups: fixture.groups,
        subgroups: fixture.subgroups,
        rooms: fixture.rooms,
      });

      expect(grid).not.toBeNull();
      expect(grid?.groups.map((g) => g.name)).toEqual(['5-А', '5-Б']);
      // 5 days x 9 hours = 45 rows
      expect(grid?.rows.length).toBe(45);

      // Row 1 (day 0, hour 1): 5-A has act-1 (index 0), 5-B has null (index 1)
      const monHour1Row = grid?.rows.find((r) => r.day === 0 && r.hour === 1);
      expect(monHour1Row).toBeDefined();
      expect(monHour1Row?.cells[0]?.[0].activityId).toBe('act-1');
      expect(monHour1Row?.cells[1]).toBeNull();
    });
  });
});
