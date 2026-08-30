import type { Activity, Teacher, Room, Subject, TimetableRules, TimetableSolution, StudentsYear, StudentsGroup, StudentsSubgroup, TimeConstraint, ConstraintFields } from '@/types';
import { deriveSubjectCode } from './subjectCodes';

export interface CellData {
  activityId: string;
  subject: string;
  subjectCode?: string;
  subjectColor?: string;
  teachers: string[];
  students: string[];
  room?: string;
  duration: number;
  activityTags: string[];
  weekParity?: Activity['weekParity'];
  locked?: boolean;
  conflicts?: string[];
}

export type GridCell = CellData[] | 'spanned' | null;

export type ViewType = 'teachers' | 'students' | 'rooms' | 'all-classes';

/**
 * Helper to resolve all subgroup names/ids for a given student set identifier.
 */
export function resolveSubgroupNames(
  idOrName: string,
  groups: StudentsGroup[],
  subgroups: StudentsSubgroup[],
  years: StudentsYear[] = []
): string[] {
  const sg = subgroups.find((s) => s.id === idOrName || s.name === idOrName);
  if (sg) return [sg.name];

  const group = groups.find((g) => g.id === idOrName || g.name === idOrName);
  if (group) {
    if (group.subgroups.length > 0) {
      return group.subgroups;
    }
    return [group.name];
  }

  const year = years.find((y) => y.id === idOrName || y.name === idOrName);
  if (year) {
    const res: string[] = [];
    for (const gName of year.groups) {
      const g = groups.find((grp) => grp.id === gName || grp.name === gName);
      if (g) {
        if (g.subgroups.length > 0) res.push(...g.subgroups);
        else res.push(g.name);
      }
    }
    return res;
  }

  return [idOrName];
}

/**
 * Checks if two activities share any student subgroup or group.
 */
export function activitiesShareStudents(
  actA: Activity,
  actB: Activity,
  groups: StudentsGroup[],
  subgroups: StudentsSubgroup[],
  years: StudentsYear[] = []
): boolean {
  const setsA = new Set<string>();
  for (const s of actA.studentSetIds) {
    for (const sub of resolveSubgroupNames(s, groups, subgroups, years)) {
      setsA.add(sub);
    }
  }

  for (const s of actB.studentSetIds) {
    for (const sub of resolveSubgroupNames(s, groups, subgroups, years)) {
      if (setsA.has(sub)) return true;
    }
  }

  return false;
}

/**
 * Checks if two activities have alternating biweekly parities (numerator + denominator).
 * Two activities with compatible parity may share the same time slot without clashing.
 */
export function parityCompatible(
  a: { weekParity?: Activity['weekParity'] },
  b: { weekParity?: Activity['weekParity'] }
): boolean {
  const pA = a.weekParity || 'both';
  const pB = b.weekParity || 'both';
  return (
    (pA === 'numerator' && pB === 'denominator') ||
    (pA === 'denominator' && pB === 'numerator')
  );
}

/**
 * Finds all clashes and conflicts across placements in a solution.
 */
export function findSolutionConflicts(
  solution: TimetableSolution,
  activities: Activity[],
  teachers: Teacher[],
  groups: StudentsGroup[],
  subgroups: StudentsSubgroup[],
  _rules?: TimetableRules
): Map<string, string[]> {
  const conflictsMap = new Map<string, string[]>();
  const addConflict = (actId: string, reason: string) => {
    const list = conflictsMap.get(actId) || [];
    if (!list.includes(reason)) {
      list.push(reason);
      conflictsMap.set(actId, list);
    }
  };

  const actMap = new Map(activities.map((a) => [a.id, a]));

  for (let i = 0; i < solution.placements.length; i++) {
    const p1 = solution.placements[i];
    const a1 = actMap.get(p1.activityId);
    if (!a1) continue;

    for (let j = i + 1; j < solution.placements.length; j++) {
      const p2 = solution.placements[j];
      const a2 = actMap.get(p2.activityId);
      if (!a2) continue;

      // Check time overlap
      if (p1.day !== p2.day) continue;
      const a1End = p1.hour + (a1.duration || 1);
      const a2End = p2.hour + (a2.duration || 1);
      const overlaps = Math.max(p1.hour, p2.hour) < Math.min(a1End, a2End);
      if (!overlaps) continue;
      if (parityCompatible(a1, a2)) continue;

      // 1. Teacher clash
      const commonTeachers = a1.teacherIds.filter((t1) =>
        a2.teacherIds.some((t2) => t1 === t2)
      );
      if (commonTeachers.length > 0) {
        const msg = `Накладка вчителя (${commonTeachers.join(', ')})`;
        addConflict(a1.id, msg);
        addConflict(a2.id, msg);
      }

      // 2. Student clash
      if (activitiesShareStudents(a1, a2, groups, subgroups)) {
        const msg = `Накладка класу / групи`;
        addConflict(a1.id, msg);
        addConflict(a2.id, msg);
      }

      // 3. Room clash
      if (p1.roomId && p2.roomId && p1.roomId === p2.roomId) {
        const msg = `Накладка кабінету`;
        addConflict(a1.id, msg);
        addConflict(a2.id, msg);
      }
    }
  }

  return conflictsMap;
}

export interface SlotValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
}

/**
 * Validates moving an activity to a target slot.
 */
export function validateSlotMove(params: {
  activityId: string;
  targetDay: number;
  targetHour: number;
  currentSolution: TimetableSolution;
  activities: Activity[];
  teachers: Teacher[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  studentsYears?: StudentsYear[];
  rooms: Room[];
  timeConstraints: TimeConstraint[];
  rules: TimetableRules;
}): SlotValidationResult {
  const {
    activityId,
    targetDay,
    targetHour,
    currentSolution,
    activities,
    teachers,
    studentsGroups,
    studentsSubgroups,
    studentsYears = [],
    rooms,
    timeConstraints,
    rules,
  } = params;

  const activity = activities.find((a) => a.id === activityId);
  if (!activity) {
    return { valid: false, reason: 'Урок не знайдено' };
  }

  const duration = activity.duration || 1;

  // 1. Slot bounds
  if (
    targetDay < 0 ||
    targetDay >= rules.nDaysPerWeek ||
    targetHour < 0 ||
    targetHour + duration > rules.nHoursPerDay
  ) {
    return { valid: false, reason: 'Слот виходить за межі сітки розкладу' };
  }

  // 2. Shift bounds check
  for (const sId of activity.studentSetIds) {
    const group = studentsGroups.find((g) => g.id === sId || g.name === sId);
    if (group?.shift) {
      const shiftRange =
        group.shift === 1 ? rules.shifts?.shift1 : rules.shifts?.shift2;
      if (shiftRange) {
        if (
          targetHour < shiftRange.firstHour ||
          targetHour + duration - 1 > shiftRange.lastHour
        ) {
          return {
            valid: false,
            reason: `Поза ${group.shift}-ю зміною класу (${shiftRange.firstHour + 1}–${shiftRange.lastHour + 1} уроки)`,
          };
        }
      }
    }
  }

  // 3. Teacher unavailability constraints
  for (const c of timeConstraints) {
    if (!c.active) continue;
    if (c.type === 'TeacherNotAvailableTimes' && (c as ConstraintFields).teacherId && Array.isArray((c as ConstraintFields).times)) {
      const rawTid = (c as ConstraintFields).teacherId;
      const isMyTeacher = activity.teacherIds.some(
        (tid) => tid === rawTid || teachers.some((t) => (t.id === rawTid || t.name === rawTid) && (t.id === tid || t.name === tid))
      );
      if (isMyTeacher) {
        const times = (c as ConstraintFields).times as { day: number; hour: number }[];
        for (let h = 0; h < duration; h++) {
          if (times.some((t) => t.day === targetDay && t.hour === targetHour + h)) {
            const tObj = teachers.find((t) => t.id === rawTid || t.name === rawTid);
            return {
              valid: false,
              reason: `Вчитель ${tObj?.name || rawTid} не може викладати в цей час`,
            };
          }
        }
      }
    }
  }

  // 4. Student set unavailability constraints
  for (const c of timeConstraints) {
    if (!c.active) continue;
    if (c.type === 'StudentsSetNotAvailableTimes' && (c as ConstraintFields).studentsSetId && Array.isArray((c as ConstraintFields).times)) {
      const rawSid = (c as ConstraintFields).studentsSetId ?? '';
      const groupSubgroups = resolveSubgroupNames(rawSid, studentsGroups, studentsSubgroups, studentsYears);
      const activitySubgroups = activity.studentSetIds.flatMap((sid) =>
        resolveSubgroupNames(sid, studentsGroups, studentsSubgroups, studentsYears)
      );
      const match = groupSubgroups.some((sg) => activitySubgroups.includes(sg));
      if (match) {
        const times = (c as ConstraintFields).times as { day: number; hour: number }[];
        for (let h = 0; h < duration; h++) {
          if (times.some((t) => t.day === targetDay && t.hour === targetHour + h)) {
            return {
              valid: false,
              reason: `Клас не навчається в цей час`,
            };
          }
        }
      }
    }
  }

  // 5. Clashes with other placed activities
  const actMap = new Map(activities.map((a) => [a.id, a]));
  for (const p of currentSolution.placements) {
    if (p.activityId === activityId) continue;
    if (p.day !== targetDay) continue;

    const otherAct = actMap.get(p.activityId);
    if (!otherAct) continue;

    const otherEnd = p.hour + (otherAct.duration || 1);
    const myEnd = targetHour + duration;
    const overlaps = Math.max(targetHour, p.hour) < Math.min(myEnd, otherEnd);
    if (!overlaps) continue;
    if (parityCompatible(activity, otherAct)) continue;

    // Check teacher clash
    const commonTeachers = activity.teacherIds.filter((t1) =>
      otherAct.teacherIds.some((t2) => t1 === t2)
    );
    if (commonTeachers.length > 0) {
      return {
        valid: false,
        reason: `Вчитель ${commonTeachers.join(', ')} вже має урок у цей час`,
      };
    }

    // Check student clash
    if (activitiesShareStudents(activity, otherAct, studentsGroups, studentsSubgroups, studentsYears)) {
      return {
        valid: false,
        reason: `Клас або підгрупа вже має інший урок у цей час`,
      };
    }

    // Check room clash
    const myPlacement = currentSolution.placements.find((pl) => pl.activityId === activityId);
    if (myPlacement?.roomId && p.roomId && myPlacement.roomId === p.roomId) {
      const rObj = rooms.find((r) => r.id === p.roomId || r.name === p.roomId);
      return {
        valid: false,
        reason: `Кабінет ${rObj?.name || p.roomId} вже зайнятий у цей час`,
      };
    }
  }

  return { valid: true };
}

/**
 * Builds a 2D timetable grid (hours × days) for a single entity (teacher, class/subgroup, or room).
 */
export function buildTimetableGrid(params: {
  entityId: string;
  entityType: ViewType;
  solution: TimetableSolution | null;
  rules: TimetableRules | null;
  activities: Activity[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  lockedActivityIds?: Set<string>;
  conflictsMap?: Map<string, string[]>;
}): GridCell[][] | null {
  const {
    entityId,
    entityType,
    solution,
    rules,
    activities,
    teachers,
    subjects,
    rooms,
    lockedActivityIds = new Set(),
    conflictsMap = new Map(),
  } = params;

  if (!solution || !rules) return null;

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;

  const grid: GridCell[][] = Array.from({ length: nHours }, () =>
    Array(nDays).fill(null)
  );

  const actMap = new Map(activities.map((a) => [a.id, a]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const subNameMap = new Map(subjects.map((s) => [s.name, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const teacherNameMap = new Map(teachers.map((t) => [t.name, t]));

  for (const placement of solution.placements) {
    const activity = actMap.get(placement.activityId);
    if (!activity) continue;

    let shouldInclude = false;

    if (entityType === 'teachers') {
      const teacher = teacherMap.get(entityId) || teacherNameMap.get(entityId);
      if (
        teacher &&
        activity.teacherIds.some((tid) => tid === teacher.name || tid === teacher.id)
      ) {
        shouldInclude = true;
      }
    } else if (entityType === 'students') {
      if (
        activity.studentSetIds.some(
          (sid) => sid === entityId || sid.includes(entityId) || entityId.includes(sid)
        )
      ) {
        shouldInclude = true;
      }
    } else if (entityType === 'rooms') {
      const room = roomMap.get(entityId) || rooms.find((r) => r.name === entityId);
      if (
        room &&
        (placement.roomId === room.id || placement.roomId === room.name)
      ) {
        shouldInclude = true;
      }
    }

    if (!shouldInclude) continue;

    const subjectObj = subMap.get(activity.subjectId) || subNameMap.get(activity.subjectId);
    const subjectName = subjectObj?.name || activity.subjectId;
    const subjectCode = subjectObj?.code || deriveSubjectCode(subjectName);
    const roomObj = placement.roomId ? roomMap.get(placement.roomId) || rooms.find((r) => r.name === placement.roomId) : undefined;

    const entry: CellData = {
      activityId: activity.id,
      subject: subjectName,
      subjectCode,
      subjectColor: subjectObj?.color,
      teachers: activity.teacherIds,
      students: activity.studentSetIds,
      room: roomObj?.name,
      duration: activity.duration || 1,
      activityTags: activity.activityTagIds || [],
      weekParity: activity.weekParity,
      locked: lockedActivityIds.has(activity.id),
      conflicts: conflictsMap.get(activity.id),
    };

    if (placement.hour < nHours && placement.day < nDays) {
      const currentCell = grid[placement.hour][placement.day];
      if (Array.isArray(currentCell)) {
        currentCell.push(entry);
      } else {
        grid[placement.hour][placement.day] = [entry];
      }

      for (let h = 1; h < (activity.duration || 1); h++) {
        const spanHour = placement.hour + h;
        if (spanHour < nHours) {
          grid[spanHour][placement.day] = 'spanned';
        }
      }
    }
  }

  return grid;
}

export interface AllClassesRow {
  day: number;
  dayName: string;
  hour: number;
  hourName: string;
  cells: (CellData[] | null)[];
}

export interface AllClassesGrid {
  groups: StudentsGroup[];
  rows: AllClassesRow[];
}

/**
 * Builds a consolidated matrix of all classes (rows: day × period, columns: classes).
 */
export function buildAllClassesGrid(params: {
  solution: TimetableSolution | null;
  rules: TimetableRules | null;
  activities?: Activity[];
  teachers?: Teacher[];
  subjects?: Subject[];
  groups?: StudentsGroup[];
  subgroups?: StudentsSubgroup[];
  rooms?: Room[];
  lockedActivityIds?: Set<string>;
  conflictsMap?: Map<string, string[]>;
}): AllClassesGrid | null {
  const {
    solution,
    rules,
    activities = [],
    subjects = [],
    groups = [],
    rooms = [],
    lockedActivityIds = new Set(),
    conflictsMap = new Map(),
  } = params;

  if (!solution || !rules) return null;

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }));
  const actMap = new Map(activities.map((a) => [a.id, a]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const subNameMap = new Map(subjects.map((s) => [s.name, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  // Index placements by [day][hour][groupIndex]
  const cellMatrix: (CellData[] | null)[][][] = Array.from(
    { length: nDays },
    () =>
      Array.from({ length: nHours }, () =>
        Array.from({ length: sortedGroups.length }, () => null)
      )
  );

  for (const placement of solution.placements) {
    const activity = actMap.get(placement.activityId);
    if (!activity) continue;

    const subjectObj = subMap.get(activity.subjectId) || subNameMap.get(activity.subjectId);
    const subjectName = subjectObj?.name || activity.subjectId;
    const subjectCode = subjectObj?.code || deriveSubjectCode(subjectName);
    const roomObj = placement.roomId ? roomMap.get(placement.roomId) || rooms.find((r) => r.name === placement.roomId) : undefined;

    const entry: CellData = {
      activityId: activity.id,
      subject: subjectName,
      subjectCode,
      subjectColor: subjectObj?.color,
      teachers: activity.teacherIds,
      students: activity.studentSetIds,
      room: roomObj?.name,
      duration: activity.duration || 1,
      activityTags: activity.activityTagIds || [],
      weekParity: activity.weekParity,
      locked: lockedActivityIds.has(activity.id),
      conflicts: conflictsMap.get(activity.id),
    };

    // Find which groups this activity targets
    sortedGroups.forEach((group, gIdx) => {
      const isTarget = activity.studentSetIds.some((sid) => {
        if (sid === group.id || sid === group.name) return true;
        if (group.subgroups.includes(sid)) return true;
        return false;
      });

      if (isTarget && placement.day < nDays && placement.hour < nHours) {
        const existing = cellMatrix[placement.day][placement.hour][gIdx];
        if (existing) {
          existing.push(entry);
        } else {
          cellMatrix[placement.day][placement.hour][gIdx] = [entry];
        }
      }
    });
  }

  const rows: AllClassesRow[] = [];
  rules.daysOfTheWeek.forEach((day, dIdx) => {
    rules.hoursOfTheDay.forEach((hour, hIdx) => {
      rows.push({
        day: dIdx,
        dayName: day.name,
        hour: hIdx,
        hourName: hour.name,
        cells: cellMatrix[dIdx][hIdx],
      });
    });
  });

  return {
    groups: sortedGroups,
    rows,
  };
}

export interface MatrixRow {
  id: string;
  label: string;
  sublabel?: string;
  availableSlots?: (d: number, h: number) => boolean;
}

export interface DayHourMatrix {
  rows: MatrixRow[];
  cells: Map<string, CellData[]>; // key: `${rowId}|${day}|${hour}`
  nDays: number;
  nHours: number;
}

/**
 * Builds a flat string-keyed day-hour matrix for all classes.
 * Rows represent classes, columns represent days × periods.
 */
export function buildClassDayHourMatrix(params: {
  solution: TimetableSolution | null;
  rules: TimetableRules | null;
  activities?: Activity[];
  teachers?: Teacher[];
  subjects?: Subject[];
  groups?: StudentsGroup[];
  subgroups?: StudentsSubgroup[];
  rooms?: Room[];
  lockedActivityIds?: Set<string>;
  conflictsMap?: Map<string, string[]>;
}): DayHourMatrix | null {
  const {
    solution,
    rules,
    activities = [],
    subjects = [],
    groups = [],
    rooms = [],
    lockedActivityIds = new Set(),
    conflictsMap = new Map(),
  } = params;

  if (!solution || !rules) return null;

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;

  const sortedGroups = [...groups].sort((a, b) =>
    a.name.localeCompare(b.name, 'uk', { numeric: true })
  );

  const rows: MatrixRow[] = sortedGroups.map((group) => {
    let availableSlots: ((d: number, h: number) => boolean) | undefined;
    if (group.shift === 1 && rules.shifts?.shift1) {
      const { firstHour, lastHour } = rules.shifts.shift1;
      availableSlots = (_d, h) => h >= firstHour && h <= lastHour;
    } else if (group.shift === 2 && rules.shifts?.shift2) {
      const { firstHour, lastHour } = rules.shifts.shift2;
      availableSlots = (_d, h) => h >= firstHour && h <= lastHour;
    }

    return {
      id: group.id,
      label: group.name,
      sublabel: group.shift ? `${group.shift}-а зміна` : undefined,
      availableSlots,
    };
  });

  const actMap = new Map(activities.map((a) => [a.id, a]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const subNameMap = new Map(subjects.map((s) => [s.name, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  // Build precomputed studentSetId -> rowId[] index
  const studentSetToRowIds = new Map<string, string[]>();
  for (const group of sortedGroups) {
    const groupKeys = [group.id, group.name, ...group.subgroups];
    for (const key of groupKeys) {
      const existing = studentSetToRowIds.get(key) || [];
      if (!existing.includes(group.id)) {
        existing.push(group.id);
        studentSetToRowIds.set(key, existing);
      }
    }
  }

  const cells = new Map<string, CellData[]>();

  for (const placement of solution.placements) {
    if (placement.day >= nDays || placement.hour >= nHours) continue;

    const activity = actMap.get(placement.activityId);
    if (!activity) continue;

    const subjectObj = subMap.get(activity.subjectId) || subNameMap.get(activity.subjectId);
    const subjectName = subjectObj?.name || activity.subjectId;
    const subjectCode = subjectObj?.code || deriveSubjectCode(subjectName);
    const roomObj = placement.roomId
      ? roomMap.get(placement.roomId) || rooms.find((r) => r.name === placement.roomId)
      : undefined;

    const entry: CellData = {
      activityId: activity.id,
      subject: subjectName,
      subjectCode,
      subjectColor: subjectObj?.color,
      teachers: activity.teacherIds,
      students: activity.studentSetIds,
      room: roomObj?.name,
      duration: activity.duration || 1,
      activityTags: activity.activityTagIds || [],
      weekParity: activity.weekParity,
      locked: lockedActivityIds.has(activity.id),
      conflicts: conflictsMap.get(activity.id),
    };

    // Find all target rows for this activity
    const targetRowIds = new Set<string>();
    for (const sid of activity.studentSetIds) {
      const matchingRowIds = studentSetToRowIds.get(sid);
      if (matchingRowIds) {
        for (const rId of matchingRowIds) {
          targetRowIds.add(rId);
        }
      } else {
        for (const group of sortedGroups) {
          if (sid === group.id || sid === group.name || group.subgroups.includes(sid)) {
            targetRowIds.add(group.id);
          }
        }
      }
    }

    for (const rowId of targetRowIds) {
      const cellKey = `${rowId}|${placement.day}|${placement.hour}`;
      const list = cells.get(cellKey) || [];
      list.push(entry);
      cells.set(cellKey, list);
    }
  }

  return {
    rows,
    cells,
    nDays,
    nHours,
  };
}

/**
 * Builds a flat string-keyed day-hour matrix for all teachers.
 * Rows represent teachers, columns represent days × periods.
 */
export function buildTeacherDayHourMatrix(params: {
  solution: TimetableSolution | null;
  rules: TimetableRules | null;
  activities?: Activity[];
  teachers?: Teacher[];
  subjects?: Subject[];
  groups?: StudentsGroup[];
  subgroups?: StudentsSubgroup[];
  rooms?: Room[];
  timeConstraints?: TimeConstraint[];
  lockedActivityIds?: Set<string>;
  conflictsMap?: Map<string, string[]>;
}): DayHourMatrix | null {
  const {
    solution,
    rules,
    activities = [],
    teachers = [],
    subjects = [],
    rooms = [],
    timeConstraints = [],
    lockedActivityIds = new Set(),
    conflictsMap = new Map(),
  } = params;

  if (!solution || !rules) return null;

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;

  const sortedTeachers = [...teachers].sort((a, b) =>
    a.name.localeCompare(b.name, 'uk', { numeric: true })
  );

  const rows: MatrixRow[] = sortedTeachers.map((teacher) => {
    let availableSlots: ((d: number, h: number) => boolean) | undefined;

    const unavailTimes: { day: number; hour: number }[] = [];
    for (const c of timeConstraints) {
      if (!c.active) continue;
      if (c.type === 'TeacherNotAvailableTimes' && (c as ConstraintFields).teacherId) {
        const rawTid = (c as ConstraintFields).teacherId;
        if (rawTid === teacher.id || rawTid === teacher.name) {
          const times = (c as ConstraintFields).times as { day: number; hour: number }[];
          if (Array.isArray(times)) {
            unavailTimes.push(...times);
          }
        }
      }
    }

    if (unavailTimes.length > 0) {
      availableSlots = (d, h) => !unavailTimes.some((t) => t.day === d && t.hour === h);
    }

    return {
      id: teacher.id,
      label: teacher.name,
      sublabel: teacher.code,
      availableSlots,
    };
  });

  const actMap = new Map(activities.map((a) => [a.id, a]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const subNameMap = new Map(subjects.map((s) => [s.name, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const teacherIdentToRowId = new Map<string, string>();
  for (const teacher of sortedTeachers) {
    teacherIdentToRowId.set(teacher.id, teacher.id);
    teacherIdentToRowId.set(teacher.name, teacher.id);
  }

  const cells = new Map<string, CellData[]>();

  for (const placement of solution.placements) {
    if (placement.day >= nDays || placement.hour >= nHours) continue;

    const activity = actMap.get(placement.activityId);
    if (!activity) continue;

    const subjectObj = subMap.get(activity.subjectId) || subNameMap.get(activity.subjectId);
    const subjectName = subjectObj?.name || activity.subjectId;
    const subjectCode = subjectObj?.code || deriveSubjectCode(subjectName);
    const roomObj = placement.roomId
      ? roomMap.get(placement.roomId) || rooms.find((r) => r.name === placement.roomId)
      : undefined;

    const entry: CellData = {
      activityId: activity.id,
      subject: subjectName,
      subjectCode,
      subjectColor: subjectObj?.color,
      teachers: activity.teacherIds,
      students: activity.studentSetIds,
      room: roomObj?.name,
      duration: activity.duration || 1,
      activityTags: activity.activityTagIds || [],
      weekParity: activity.weekParity,
      locked: lockedActivityIds.has(activity.id),
      conflicts: conflictsMap.get(activity.id),
    };

    const targetRowIds = new Set<string>();
    for (const tid of activity.teacherIds) {
      const rowId = teacherIdentToRowId.get(tid);
      if (rowId) {
        targetRowIds.add(rowId);
      }
    }

    for (const rowId of targetRowIds) {
      const cellKey = `${rowId}|${placement.day}|${placement.hour}`;
      const list = cells.get(cellKey) || [];
      list.push(entry);
      cells.set(cellKey, list);
    }
  }

  return {
    rows,
    cells,
    nDays,
    nHours,
  };
}

