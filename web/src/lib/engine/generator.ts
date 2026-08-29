/**
 * FET Web - Timetable Generator
 * Implementation of the recursive swapping algorithm with enhanced constraint support
 */

import type {
  Activity, Teacher, Room, TimeConstraint, SpaceConstraint,
  TimetableRules, StudentsSubgroup, StudentsGroup, StudentsYear
} from '../../types';
import type {
  InternalActivity, TimeAllocation, RoomAllocation, ConflictInfo,
  GenerationConfig, GenerationResult, GenerationCallback, Matrix2D
} from './types';
import { RandomGenerator, createMatrix2D, dayFromSlot, hourFromSlot, timeSlot } from './utils';

const DEFAULT_CONFIG: GenerationConfig = {
  maxSeconds: 3600,
  maxRecursionLevel: 14,
  maxRecursionCalls: 0,
  tabuSize: 0,
};

export class TimetableGenerator {
  private config: GenerationConfig;
  private rng: RandomGenerator;
  
  private rules: TimetableRules;
  private activities: Activity[];
  private teachers: Teacher[];
  private subgroups: StudentsSubgroup[];
  private studentsGroups: StudentsGroup[];
  private studentsYears: StudentsYear[];
  private rooms: Room[];
  private timeConstraints: TimeConstraint[];
  private spaceConstraints: SpaceConstraint[];

  private subgroupShift: Map<number, 1 | 2> = new Map();
  private shift1Range: { firstHour: number; lastHour: number } | null = null;
  private shift2Range: { firstHour: number; lastHour: number } | null = null;

  // Biweekly co-occupancy. `timetableSecondary[table][idx][slot]` holds a
  // second activity index when a numerator+denominator pair share a slot.
  private teachersTimetableSecondary: number[][] = [];
  private subgroupsTimetableSecondary: number[][] = [];
  
  private nDaysPerWeek: number = 0;
  private nHoursPerDay: number = 0;
  private nHoursPerWeek: number = 0;
  private nInternalActivities: number = 0;
  private internalActivities: InternalActivity[] = [];
  
  // Index mappings - support both name and id lookup
  private teacherNameToIndex: Map<string, number> = new Map();
  private teacherIdToIndex: Map<string, number> = new Map();
  private subgroupNameToIndex: Map<string, number> = new Map();
  private subgroupIdToIndex: Map<string, number> = new Map();
  private activityIdToIndex: Map<string, number> = new Map();
  private roomIdToIndex: Map<string, number> = new Map();
  private roomNameToIndex: Map<string, number> = new Map();
  
  private teachersTimetable: Matrix2D<number> = [];
  private subgroupsTimetable: Matrix2D<number> = [];
  private roomsTimetable: Matrix2D<number> = [];
  
  private times: number[] = [];
  private roomAllocations: number[] = [];
  
  private breakTimes: Set<number> = new Set();
  private teacherNotAvailable: Map<number, Set<number>> = new Map();
  private studentsNotAvailable: Map<number, Set<number>> = new Map();
  private roomNotAvailable: Map<number, Set<number>> = new Map();
  
  // Additional constraint data
  private teacherMaxHoursDaily: Map<number, number> = new Map();
  private teacherMaxDaysPerWeek: Map<number, number> = new Map();
  private teacherMinDaysPerWeek: Map<number, number> = new Map();
  private teacherMaxGapsPerDay: Map<number, number> = new Map();
  private allTeachersMaxHoursDaily: number = -1;
  private studentsMaxHoursDaily: Map<number, number> = new Map();
  private studentsMaxGapsPerDay: Map<number, number> = new Map();
  private minDaysBetweenActivities: { activityIndices: number[]; minDays: number; consecutiveIfSameDay: boolean }[] = [];
  private activityPreferredStartingTime: Map<number, { day: number; hour: number; locked: boolean }> = new Map();
  
  // Room preferences
  private activityPreferredRoom: Map<number, { roomIdx: number; locked: boolean }> = new Map();
  private activityPreferredRooms: Map<number, number[]> = new Map();
  private subjectPreferredRoom: Map<string, number> = new Map();
  private subjectPreferredRooms: Map<string, number[]> = new Map();
  
  // Activity subject mapping for room preferences
  private activityToSubject: Map<number, string> = new Map();
  
  private permutation: number[] = [];
  
  private tabuActivities: number[] = [];
  private tabuTimes: number[] = [];
  private tabuIndex: number = 0;
  
  private placedActivities: number = 0;
  private maxPlacedActivities: number = 0;
  private startTime: number = 0;
  private abortFlag: boolean = false;
  private callback: GenerationCallback | null = null;
  
  constructor(
    rules: TimetableRules,
    activities: Activity[],
    teachers: Teacher[],
    subgroups: StudentsSubgroup[],
    rooms: Room[],
    timeConstraints: TimeConstraint[],
    spaceConstraints: SpaceConstraint[],
    config?: Partial<GenerationConfig>,
    studentsGroups: StudentsGroup[] = [],
    studentsYears: StudentsYear[] = []
  ) {
    this.rules = rules;
    this.activities = activities.filter(a => a.active);
    this.teachers = teachers;
    this.subgroups = [...(subgroups || [])];
    this.studentsGroups = studentsGroups || [];
    this.studentsYears = studentsYears || [];
    this.rooms = rooms;
    this.timeConstraints = timeConstraints.filter(c => c.active);
    this.spaceConstraints = spaceConstraints.filter(c => c.active);

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new RandomGenerator();
  }

  private findTeacherIndex(idOrName: string): number {
    let idx = this.teacherIdToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    idx = this.teacherNameToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    return -1;
  }

  private findSubgroupIndex(idOrName: string): number {
    let idx = this.subgroupIdToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    idx = this.subgroupNameToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    return -1;
  }

  private resolveStudentSetIndices(idOrName: string): number[] {
    // 1. Direct subgroup match (by id or name)
    const directIdx = this.findSubgroupIndex(idOrName);
    if (directIdx >= 0) {
      return [directIdx];
    }

    // 2. Group match (by id or name)
    const group = this.studentsGroups.find((g) => g.id === idOrName || g.name === idOrName);
    if (group) {
      const indices: number[] = [];
      for (const sgIdOrName of group.subgroups) {
        const idx = this.findSubgroupIndex(sgIdOrName);
        if (idx >= 0 && !indices.includes(idx)) {
          indices.push(idx);
        }
      }
      if (indices.length > 0) {
        return indices;
      }
      const implicitIdx =
        this.findSubgroupIndex(group.name) >= 0
          ? this.findSubgroupIndex(group.name)
          : this.findSubgroupIndex(group.id);
      if (implicitIdx >= 0) {
        return [implicitIdx];
      }
    }

    // 3. Year match (by id or name)
    const year = this.studentsYears.find((y) => y.id === idOrName || y.name === idOrName);
    if (year) {
      const indices: number[] = [];
      for (const gIdOrName of year.groups) {
        const gIndices = this.resolveStudentSetIndices(gIdOrName);
        for (const idx of gIndices) {
          if (!indices.includes(idx)) {
            indices.push(idx);
          }
        }
      }
      if (indices.length > 0) {
        return indices;
      }
    }

    return [];
  }

  private findRoomIndex(idOrName: string): number {
    let idx = this.roomIdToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    idx = this.roomNameToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    return -1;
  }

  private initialize(): void {
    this.nDaysPerWeek = this.rules.nDaysPerWeek || this.rules.daysOfTheWeek?.length || 5;
    this.nHoursPerDay = this.rules.nHoursPerDay || this.rules.hoursOfTheDay?.length || 8;
    this.nHoursPerWeek = this.nDaysPerWeek * this.nHoursPerDay;
    
    // Register implicit subgroups for groups that have no subgroups
    for (const g of this.studentsGroups) {
      if (g.subgroups.length === 0) {
        const hasIdx = this.findSubgroupIndex(g.id) >= 0 || this.findSubgroupIndex(g.name) >= 0;
        if (!hasIdx) {
          this.subgroups.push({
            id: g.id,
            name: g.name,
            numberOfStudents: g.numberOfStudents,
            type: 3,
            comments: '',
          });
        }
      }
    }
    
    // Build index mappings for both id and name
    this.teachers.forEach((t, i) => {
      this.teacherNameToIndex.set(t.name, i);
      this.teacherIdToIndex.set(t.id, i);
    });
    this.subgroups.forEach((s, i) => {
      this.subgroupIdToIndex.set(s.id, i);
      this.subgroupNameToIndex.set(s.name, i);
    });
    this.rooms.forEach((r, i) => {
      this.roomIdToIndex.set(r.id, i);
      this.roomNameToIndex.set(r.name, i);
    });
    
    // Convert activities to internal format
    this.internalActivities = this.activities.map((a, i) => {
      this.activityIdToIndex.set(a.id, i);
      this.activityToSubject.set(i, a.subjectId);
      
      const teacherIndices = a.teacherIds
        .map(idOrName => this.findTeacherIndex(idOrName))
        .filter(idx => idx >= 0);
      
      const subgroupIndices: number[] = [];
      for (const idOrName of a.studentSetIds) {
        const resolved = this.resolveStudentSetIndices(idOrName);
        for (const idx of resolved) {
          if (!subgroupIndices.includes(idx)) {
            subgroupIndices.push(idx);
          }
        }
      }
      
      const parity: 0 | 1 | 2 =
        a.weekParity === 'numerator' ? 1 :
        a.weekParity === 'denominator' ? 2 : 0;

      return {
        id: a.id,
        index: i,
        teacherIndices,
        subjectIndex: 0,
        activityTagIndices: [],
        subgroupIndices,
        duration: a.duration,
        active: a.active,
        shiftOverride: a.shiftOverride,
        weekParity: parity,
      };
    });
    
    this.nInternalActivities = this.internalActivities.length;
    
    if (this.config.maxRecursionCalls === 0) {
      this.config.maxRecursionCalls = Math.max(100, 2 * this.nInternalActivities);
    }
    if (this.config.tabuSize === 0) {
      this.config.tabuSize = Math.max(100, this.nInternalActivities * this.nHoursPerWeek);
    }
    
    const nTeachers = Math.max(1, this.teachers.length);
    const nSubgroups = Math.max(1, this.subgroups.length);
    const nRooms = Math.max(1, this.rooms.length);
    
    this.teachersTimetable = createMatrix2D(nTeachers, this.nHoursPerWeek, -1);
    this.subgroupsTimetable = createMatrix2D(nSubgroups, this.nHoursPerWeek, -1);
    this.roomsTimetable = createMatrix2D(nRooms, this.nHoursPerWeek, -1);
    this.teachersTimetableSecondary = createMatrix2D(nTeachers, this.nHoursPerWeek, -1);
    this.subgroupsTimetableSecondary = createMatrix2D(nSubgroups, this.nHoursPerWeek, -1);

    this.times = new Array(this.nInternalActivities).fill(-1);
    this.roomAllocations = new Array(this.nInternalActivities).fill(-1);

    this.tabuActivities = new Array(this.config.tabuSize).fill(-1);
    this.tabuTimes = new Array(this.config.tabuSize).fill(-1);
    this.tabuIndex = 0;

    // Precompute per-subgroup shift (from parent group)
    this.subgroupShift.clear();
    for (const g of this.studentsGroups) {
      if (!g.shift) continue;
      for (const sgIdOrName of g.subgroups) {
        const sgIdx = this.findSubgroupIndex(sgIdOrName);
        if (sgIdx >= 0) this.subgroupShift.set(sgIdx, g.shift);
      }
      const gIdx =
        this.findSubgroupIndex(g.name) >= 0
          ? this.findSubgroupIndex(g.name)
          : this.findSubgroupIndex(g.id);
      if (gIdx >= 0) this.subgroupShift.set(gIdx, g.shift);
    }
    this.shift1Range = this.rules.shifts?.shift1 ?? null;
    this.shift2Range = this.rules.shifts?.shift2 ?? null;

    this.parseConstraints();
    this.sortActivitiesByDifficulty();
  }

  // Which shift is `hour` inside, if any? Returns 1, 2, or 0 (neither/both).
  private shiftForHour(hour: number): 0 | 1 | 2 {
    if (this.shift1Range && hour >= this.shift1Range.firstHour && hour <= this.shift1Range.lastHour) return 1;
    if (this.shift2Range && hour >= this.shift2Range.firstHour && hour <= this.shift2Range.lastHour) return 2;
    return 0;
  }

  // The shift this activity is *intended* to run in for this subgroup:
  // activity's override wins; otherwise the subgroup's group's shift.
  private activityShift(activity: InternalActivity, subgroupIdx: number): 1 | 2 | undefined {
    if (activity.shiftOverride) return activity.shiftOverride;
    return this.subgroupShift.get(subgroupIdx);
  }

  // Two activities can share a slot iff one is numerator (1) and the other
  // is denominator (2). Anything involving parity 0 (every week) conflicts.
  private parityCompatible(a: 0 | 1 | 2, b: 0 | 1 | 2): boolean {
    return (a === 1 && b === 2) || (a === 2 && b === 1);
  }

  private parseConstraints(): void {
    // Parse time constraints
    for (const constraint of this.timeConstraints) {
      const c = constraint as any;
      
      switch (constraint.type) {
        case 'BreakTimes':
          if (c.times) {
            for (const time of c.times) {
              this.breakTimes.add(timeSlot(time.day, time.hour, this.nHoursPerDay));
            }
          }
          break;
          
        case 'TeacherNotAvailableTimes': {
          const teacherIdx = this.findTeacherIndex(c.teacherId);
          if (teacherIdx >= 0 && c.times) {
            if (!this.teacherNotAvailable.has(teacherIdx)) {
              this.teacherNotAvailable.set(teacherIdx, new Set());
            }
            for (const time of c.times) {
              this.teacherNotAvailable.get(teacherIdx)!.add(
                timeSlot(time.day, time.hour, this.nHoursPerDay)
              );
            }
          }
          break;
        }
          
        case 'TeacherMaxHoursDaily': {
          const maxHoursTeacherIdx = this.findTeacherIndex(c.teacherId);
          if (maxHoursTeacherIdx >= 0 && c.maxHours !== undefined) {
            this.teacherMaxHoursDaily.set(maxHoursTeacherIdx, c.maxHours);
          }
          break;
        }
          
        case 'TeachersMaxHoursDaily':
          if (c.maxHours !== undefined) {
            this.allTeachersMaxHoursDaily = c.maxHours;
          }
          break;
          
        case 'TeacherMaxDaysPerWeek': {
          const maxDaysTeacherIdx = this.findTeacherIndex(c.teacherId);
          if (maxDaysTeacherIdx >= 0 && c.maxDays !== undefined) {
            this.teacherMaxDaysPerWeek.set(maxDaysTeacherIdx, c.maxDays);
          }
          break;
        }
          
        case 'TeacherMaxGapsPerDay': {
          const gapsTeacherIdx = this.findTeacherIndex(c.teacherId);
          if (gapsTeacherIdx >= 0 && c.maxGaps !== undefined) {
            this.teacherMaxGapsPerDay.set(gapsTeacherIdx, c.maxGaps);
          }
          break;
        }

        case 'TeacherMinDaysPerWeek': {
          const minDaysTeacherIdx = this.findTeacherIndex(c.teacherId);
          if (minDaysTeacherIdx >= 0 && c.minDays !== undefined) {
            this.teacherMinDaysPerWeek.set(minDaysTeacherIdx, c.minDays);
          }
          break;
        }

        case 'StudentsSetMaxGapsPerDay':
          if (c.maxGaps !== undefined) {
            const gapsSubgroupIdxs = this.resolveStudentSetIndices(c.studentsSetId);
            for (const idx of gapsSubgroupIdxs) {
              this.studentsMaxGapsPerDay.set(idx, c.maxGaps);
            }
          }
          break;
          
        case 'StudentsSetNotAvailableTimes':
          if (c.times) {
            const notAvailSubgroupIdxs = this.resolveStudentSetIndices(c.studentsSetId);
            for (const idx of notAvailSubgroupIdxs) {
              if (!this.studentsNotAvailable.has(idx)) {
                this.studentsNotAvailable.set(idx, new Set());
              }
              for (const time of c.times) {
                this.studentsNotAvailable.get(idx)!.add(
                  timeSlot(time.day, time.hour, this.nHoursPerDay)
                );
              }
            }
          }
          break;
          
        case 'StudentsSetMaxHoursDaily':
          if (c.maxHours !== undefined) {
            const maxHoursSubgroupIdxs = this.resolveStudentSetIndices(c.studentsSetId);
            for (const idx of maxHoursSubgroupIdxs) {
              this.studentsMaxHoursDaily.set(idx, c.maxHours);
            }
          }
          break;
          
        case 'MinDaysBetweenActivities':
          if (c.activityIds && c.minDays !== undefined) {
            const activityIndices = c.activityIds
              .map((id: string) => this.activityIdToIndex.get(id))
              .filter((idx: number | undefined) => idx !== undefined) as number[];
            if (activityIndices.length > 0) {
              this.minDaysBetweenActivities.push({
                activityIndices,
                minDays: c.minDays,
                consecutiveIfSameDay: c.consecutiveIfSameDay ?? false,
              });
            }
          }
          break;
          
        case 'ActivityPreferredStartingTime': {
          const activityIdx = this.activityIdToIndex.get(c.activityId);
          if (activityIdx !== undefined && c.day !== undefined && c.hour !== undefined) {
            this.activityPreferredStartingTime.set(activityIdx, {
              day: c.day,
              hour: c.hour,
              locked: c.permanentlyLocked ?? false,
            });
          }
          break;
        }
      }
    }

    // Parse space constraints
    for (const constraint of this.spaceConstraints) {
      const c = constraint as any;
      
      switch (constraint.type) {
        case 'RoomNotAvailableTimes': {
          const roomIdx = this.findRoomIndex(c.roomId);
          if (roomIdx >= 0 && c.times) {
            if (!this.roomNotAvailable.has(roomIdx)) {
              this.roomNotAvailable.set(roomIdx, new Set());
            }
            for (const time of c.times) {
              this.roomNotAvailable.get(roomIdx)!.add(
                timeSlot(time.day, time.hour, this.nHoursPerDay)
              );
            }
          }
          break;
        }
          
        case 'ActivityPreferredRoom': {
          const prefRoomActivityIdx = this.activityIdToIndex.get(c.activityId);
          const prefRoomIdx = this.findRoomIndex(c.roomId);
          if (prefRoomActivityIdx !== undefined && prefRoomIdx >= 0) {
            this.activityPreferredRoom.set(prefRoomActivityIdx, {
              roomIdx: prefRoomIdx,
              locked: c.permanentlyLocked ?? false,
            });
          }
          break;
        }
          
        case 'ActivityPreferredRooms': {
          const prefRoomsActivityIdx = this.activityIdToIndex.get(c.activityId);
          if (prefRoomsActivityIdx !== undefined && c.roomIds) {
            const roomIndices = c.roomIds
              .map((id: string) => this.findRoomIndex(id))
              .filter((idx: number) => idx >= 0);
            if (roomIndices.length > 0) {
              this.activityPreferredRooms.set(prefRoomsActivityIdx, roomIndices);
            }
          }
          break;
        }
          
        case 'SubjectPreferredRoom': {
          const subjRoomIdx = this.findRoomIndex(c.roomId);
          if (c.subjectId && subjRoomIdx >= 0) {
            this.subjectPreferredRoom.set(c.subjectId, subjRoomIdx);
          }
          break;
        }
          
        case 'SubjectPreferredRooms':
          if (c.subjectId && c.roomIds) {
            const subjRoomIndices = c.roomIds
              .map((id: string) => this.findRoomIndex(id))
              .filter((idx: number) => idx >= 0);
            if (subjRoomIndices.length > 0) {
              this.subjectPreferredRooms.set(c.subjectId, subjRoomIndices);
            }
          }
          break;
      }
    }
  }

  private sortActivitiesByDifficulty(): void {
    const difficulties: { index: number; score: number }[] = this.internalActivities.map(a => {
      let score = 0;
      score += a.teacherIndices.length * 10;
      score += a.subgroupIndices.length * 10;
      score += a.duration * 5;
      
      // Locked activities first
      if (this.activityPreferredStartingTime.get(a.index)?.locked) {
        score += 1000;
      }
      
      for (const teacherIdx of a.teacherIndices) {
        const notAvailable = this.teacherNotAvailable.get(teacherIdx);
        if (notAvailable) {
          score += notAvailable.size;
        }
        // More constrained if teacher has max hours
        if (this.teacherMaxHoursDaily.has(teacherIdx)) {
          score += 20;
        }
      }
      
      for (const subgroupIdx of a.subgroupIndices) {
        const notAvailable = this.studentsNotAvailable.get(subgroupIdx);
        if (notAvailable) {
          score += notAvailable.size;
        }
      }
      
      // Activities in min days constraints are more constrained
      for (const minDays of this.minDaysBetweenActivities) {
        if (minDays.activityIndices.includes(a.index)) {
          score += 15 * minDays.minDays;
        }
      }
      
      return { index: a.index, score };
    });
    
    difficulties.sort((a, b) => b.score - a.score);
    this.permutation = difficulties.map(d => d.index);
  }

  private getTeacherHoursOnDay(teacherIdx: number, day: number): number {
    let hours = 0;
    for (let h = 0; h < this.nHoursPerDay; h++) {
      const slot = timeSlot(day, h, this.nHoursPerDay);
      if (this.teachersTimetable[teacherIdx] && this.teachersTimetable[teacherIdx][slot] >= 0) {
        hours++;
      }
    }
    return hours;
  }

  private countTeacherDays(teacherIdx: number): number {
    const daysWithActivities = new Set<number>();
    for (let d = 0; d < this.nDaysPerWeek; d++) {
      for (let h = 0; h < this.nHoursPerDay; h++) {
        const slot = timeSlot(d, h, this.nHoursPerDay);
        if (this.teachersTimetable[teacherIdx] && this.teachersTimetable[teacherIdx][slot] >= 0) {
          daysWithActivities.add(d);
          break;
        }
      }
    }
    return daysWithActivities.size;
  }

  private countStudentGapsOnDay(subgroupIdx: number, day: number): number {
    const row = this.subgroupsTimetable[subgroupIdx];
    if (!row) return 0;
    let first = -1;
    let last = -1;
    for (let h = 0; h < this.nHoursPerDay; h++) {
      const slot = timeSlot(day, h, this.nHoursPerDay);
      if (row[slot] >= 0) {
        if (first < 0) first = h;
        last = h;
      }
    }
    if (first < 0 || last <= first) return 0;
    let occupied = 0;
    for (let h = first; h <= last; h++) {
      const slot = timeSlot(day, h, this.nHoursPerDay);
      if (row[slot] >= 0) occupied++;
    }
    return (last - first + 1) - occupied;
  }

  private getStudentHoursOnDay(subgroupIdx: number, day: number): number {
    let hours = 0;
    for (let h = 0; h < this.nHoursPerDay; h++) {
      const slot = timeSlot(day, h, this.nHoursPerDay);
      if (this.subgroupsTimetable[subgroupIdx] && this.subgroupsTimetable[subgroupIdx][slot] >= 0) {
        hours++;
      }
    }
    return hours;
  }

  private placeActivity(activityIndex: number, slot: number): void {
    const activity = this.internalActivities[activityIndex];
    const day = dayFromSlot(slot, this.nHoursPerDay);
    const hour = hourFromSlot(slot, this.nHoursPerDay);
    
    this.times[activityIndex] = slot;
    
    for (let h = hour; h < hour + activity.duration && h < this.nHoursPerDay; h++) {
      const s = timeSlot(day, h, this.nHoursPerDay);
      
      for (const teacherIdx of activity.teacherIndices) {
        if (teacherIdx < this.teachersTimetable.length) {
          if (this.teachersTimetable[teacherIdx][s] < 0) {
            this.teachersTimetable[teacherIdx][s] = activityIndex;
          } else {
            this.teachersTimetableSecondary[teacherIdx][s] = activityIndex;
          }
        }
      }

      for (const subgroupIdx of activity.subgroupIndices) {
        if (subgroupIdx < this.subgroupsTimetable.length) {
          if (this.subgroupsTimetable[subgroupIdx][s] < 0) {
            this.subgroupsTimetable[subgroupIdx][s] = activityIndex;
          } else {
            this.subgroupsTimetableSecondary[subgroupIdx][s] = activityIndex;
          }
        }
      }
    }
  }

  private removeActivity(activityIndex: number): void {
    const activity = this.internalActivities[activityIndex];
    const slot = this.times[activityIndex];
    
    if (slot < 0) return;
    
    const day = dayFromSlot(slot, this.nHoursPerDay);
    const hour = hourFromSlot(slot, this.nHoursPerDay);
    
    this.times[activityIndex] = -1;
    
    for (let h = hour; h < hour + activity.duration && h < this.nHoursPerDay; h++) {
      const s = timeSlot(day, h, this.nHoursPerDay);
      
      for (const teacherIdx of activity.teacherIndices) {
        if (teacherIdx >= this.teachersTimetable.length) continue;
        if (this.teachersTimetable[teacherIdx][s] === activityIndex) {
          this.teachersTimetable[teacherIdx][s] = this.teachersTimetableSecondary[teacherIdx][s];
          this.teachersTimetableSecondary[teacherIdx][s] = -1;
        } else if (this.teachersTimetableSecondary[teacherIdx][s] === activityIndex) {
          this.teachersTimetableSecondary[teacherIdx][s] = -1;
        }
      }

      for (const subgroupIdx of activity.subgroupIndices) {
        if (subgroupIdx >= this.subgroupsTimetable.length) continue;
        if (this.subgroupsTimetable[subgroupIdx][s] === activityIndex) {
          this.subgroupsTimetable[subgroupIdx][s] = this.subgroupsTimetableSecondary[subgroupIdx][s];
          this.subgroupsTimetableSecondary[subgroupIdx][s] = -1;
        } else if (this.subgroupsTimetableSecondary[subgroupIdx][s] === activityIndex) {
          this.subgroupsTimetableSecondary[subgroupIdx][s] = -1;
        }
      }
    }
  }

  private checkSlotValid(activity: InternalActivity, slot: number): { 
    valid: boolean; 
    conflicts: number[];
    reason?: string;
    score?: number;
  } {
    const day = dayFromSlot(slot, this.nHoursPerDay);
    const hour = hourFromSlot(slot, this.nHoursPerDay);
    const conflicts: number[] = [];
    let score = 0; // Lower is better
    
    // Check if activity fits in the day
    if (hour + activity.duration > this.nHoursPerDay) {
      return { valid: false, conflicts: [], reason: 'Duration exceeds day' };
    }
    
    // Check locked preferred starting time
    const preferredTime = this.activityPreferredStartingTime.get(activity.index);
    if (preferredTime?.locked) {
      if (day !== preferredTime.day || hour !== preferredTime.hour) {
        return { valid: false, conflicts: [], reason: 'Locked starting time mismatch' };
      }
    }
    
    // Check min days between activities
    for (const minDaysConstraint of this.minDaysBetweenActivities) {
      if (minDaysConstraint.activityIndices.includes(activity.index)) {
        for (const otherActIdx of minDaysConstraint.activityIndices) {
          if (otherActIdx !== activity.index && this.times[otherActIdx] >= 0) {
            const otherDay = dayFromSlot(this.times[otherActIdx], this.nHoursPerDay);
            const dayDiff = Math.abs(day - otherDay);
            if (dayDiff < minDaysConstraint.minDays && dayDiff > 0) {
              return { valid: false, conflicts: [], reason: 'Min days between activities violation' };
            }
            // Same day handling
            if (dayDiff === 0 && minDaysConstraint.consecutiveIfSameDay) {
              const otherHour = hourFromSlot(this.times[otherActIdx], this.nHoursPerDay);
              const otherActivity = this.internalActivities[otherActIdx];
              // Check if they would be consecutive
              const thisEnd = hour + activity.duration;
              const otherEnd = otherHour + otherActivity.duration;
              if (!(thisEnd === otherHour || otherEnd === hour)) {
                // Not consecutive
                return { valid: false, conflicts: [], reason: 'Same day activities not consecutive' };
              }
            }
          }
        }
      }
    }
    
    // Check all time slots the activity would occupy
    for (let h = hour; h < hour + activity.duration; h++) {
      const s = timeSlot(day, h, this.nHoursPerDay);
      
      // Check break times
      if (this.breakTimes.has(s)) {
        return { valid: false, conflicts: [], reason: 'Break time' };
      }
      
      // Check teacher availability and constraints
      for (const teacherIdx of activity.teacherIndices) {
        // Check not available times
        const notAvailable = this.teacherNotAvailable.get(teacherIdx);
        if (notAvailable?.has(s)) {
          return { valid: false, conflicts: [], reason: 'Teacher not available' };
        }
        
        // Check for conflicts with other activities. Biweekly (numerator vs
        // denominator) activities may share the same slot.
        if (teacherIdx < this.teachersTimetable.length) {
          const existingActivity = this.teachersTimetable[teacherIdx][s];
          if (existingActivity >= 0 && existingActivity !== activity.index) {
            const other = this.internalActivities[existingActivity];
            if (!this.parityCompatible(activity.weekParity, other.weekParity)) {
              if (!conflicts.includes(existingActivity)) conflicts.push(existingActivity);
            }
          }
        }
      }

      // Check student availability and conflicts
      for (const subgroupIdx of activity.subgroupIndices) {
        const notAvailable = this.studentsNotAvailable.get(subgroupIdx);
        if (notAvailable?.has(s)) {
          return { valid: false, conflicts: [], reason: 'Students not available' };
        }

        if (subgroupIdx < this.subgroupsTimetable.length) {
          const existingActivity = this.subgroupsTimetable[subgroupIdx][s];
          if (existingActivity >= 0 && existingActivity !== activity.index) {
            const other = this.internalActivities[existingActivity];
            if (!this.parityCompatible(activity.weekParity, other.weekParity)) {
              if (!conflicts.includes(existingActivity)) conflicts.push(existingActivity);
            }
          }
        }
      }
    }
    
    // Soft constraint checks (for scoring, not rejection)
    // Prefer slots that maintain teacher max hours daily
    for (const teacherIdx of activity.teacherIndices) {
      const currentHours = this.getTeacherHoursOnDay(teacherIdx, day);
      const maxHours = this.teacherMaxHoursDaily.get(teacherIdx) ?? this.allTeachersMaxHoursDaily;
      if (maxHours > 0 && currentHours + activity.duration > maxHours) {
        score += 50; // Penalize but don't reject
      }
      
      // Check max days per week
      const maxDays = this.teacherMaxDaysPerWeek.get(teacherIdx);
      if (maxDays !== undefined) {
        const currentDays = this.countTeacherDays(teacherIdx);
        const hasActivityOnDay = this.getTeacherHoursOnDay(teacherIdx, day) > 0;
        if (!hasActivityOnDay && currentDays >= maxDays) {
          score += 100; // Heavy penalty for exceeding max days
        }
      }

      // Bonus for spreading work across ≥ minDays distinct days.
      // Placing on a fresh day when we're still below the floor is cheaper
      // than piling onto an already-used day.
      const minDays = this.teacherMinDaysPerWeek.get(teacherIdx);
      if (minDays !== undefined) {
        const currentDays = this.countTeacherDays(teacherIdx);
        const hasActivityOnDay = this.getTeacherHoursOnDay(teacherIdx, day) > 0;
        if (currentDays < minDays && !hasActivityOnDay) {
          score -= 40;
        } else if (currentDays < minDays && hasActivityOnDay) {
          score += 40;
        }
      }
    }
    
    // Prefer slots that maintain student max hours daily
    for (const subgroupIdx of activity.subgroupIndices) {
      const currentHours = this.getStudentHoursOnDay(subgroupIdx, day);
      const maxHours = this.studentsMaxHoursDaily.get(subgroupIdx);
      if (maxHours !== undefined && currentHours + activity.duration > maxHours) {
        score += 50;
      }

      // Penalise slots that would introduce a "вікно" beyond the class cap.
      // We simulate by tentatively marking the slot in the row, counting gaps,
      // then restoring. Cheaper than a fresh evaluator pass and matches how
      // the other soft checks look at prospective placement.
      const maxGaps = this.studentsMaxGapsPerDay.get(subgroupIdx);
      if (maxGaps !== undefined) {
        const row = this.subgroupsTimetable[subgroupIdx];
        if (row) {
          const marks: number[] = [];
          for (let h = hour; h < hour + activity.duration; h++) {
            const s = timeSlot(day, h, this.nHoursPerDay);
            if (row[s] < 0) { row[s] = activity.index; marks.push(s); }
          }
          const gaps = this.countStudentGapsOnDay(subgroupIdx, day);
          for (const s of marks) row[s] = -1;
          if (gaps > maxGaps) score += 60 * (gaps - maxGaps);
        }
      }
    }
    
    // Two-shift preference. For every subgroup this activity touches, work
    // out its intended shift (activity override or group default). If the
    // slot's hour falls outside that shift's window, penalise heavily but
    // don't forbid — an "online lesson in the opposite shift" must still be
    // placeable when the завуч explicitly overrides it.
    if (this.shift1Range || this.shift2Range) {
      const slotShift = this.shiftForHour(hour);
      for (const subgroupIdx of activity.subgroupIndices) {
        const wanted = this.activityShift(activity, subgroupIdx);
        if (wanted && slotShift !== 0 && slotShift !== wanted) {
          score += 200;
        }
      }
    }

    // Prefer earlier hours in the day (more natural schedule)
    score += hour;
    
    // Prefer starting at the preferred time (if not locked)
    if (preferredTime && !preferredTime.locked) {
      if (day === preferredTime.day && hour === preferredTime.hour) {
        score -= 30; // Bonus for matching preference
      }
    }
    
    return { valid: true, conflicts, score };
  }

  private findBestSlot(activityIndex: number): {
    slot: number;
    conflicts: number[];
  } | null {
    const activity = this.internalActivities[activityIndex];
    const slotData: { slot: number; conflictCount: number; conflicts: number[]; score: number }[] = [];
    
    for (let day = 0; day < this.nDaysPerWeek; day++) {
      for (let hour = 0; hour <= this.nHoursPerDay - activity.duration; hour++) {
        const slot = timeSlot(day, hour, this.nHoursPerDay);
        
        // Check tabu list
        let isTabu = false;
        for (let i = 0; i < Math.min(this.tabuIndex + 1, this.config.tabuSize); i++) {
          if (this.tabuActivities[i] === activityIndex && this.tabuTimes[i] === slot) {
            isTabu = true;
            break;
          }
        }
        if (isTabu) continue;
        
        const result = this.checkSlotValid(activity, slot);
        
        if (result.valid) {
          slotData.push({ 
            slot, 
            conflictCount: result.conflicts.length, 
            conflicts: result.conflicts,
            score: result.score ?? 0
          });
        }
      }
    }
    
    if (slotData.length === 0) {
      return null;
    }
    
    // Sort by: number of conflicts first, then by score
    slotData.sort((a, b) => {
      if (a.conflictCount !== b.conflictCount) {
        return a.conflictCount - b.conflictCount;
      }
      return a.score - b.score;
    });
    
    return { slot: slotData[0].slot, conflicts: slotData[0].conflicts };
  }

  private randomSwap(addedAct: number, level: number, ncalls: { value: number }): boolean {
    if (this.abortFlag) return false;
    
    ncalls.value++;
    if (ncalls.value > this.config.maxRecursionCalls) {
      return false;
    }
    
    const activityIndex = this.permutation[addedAct];
    const result = this.findBestSlot(activityIndex);
    
    if (!result) {
      return false;
    }
    
    const { slot, conflicts } = result;
    
    if (conflicts.length === 0) {
      this.placeActivity(activityIndex, slot);
      return true;
    }
    
    if (level >= this.config.maxRecursionLevel) {
      return false;
    }
    
    const removedActivities: { index: number; slot: number }[] = [];
    
    for (const conflictIdx of conflicts) {
      const oldSlot = this.times[conflictIdx];
      if (oldSlot >= 0) {
        removedActivities.push({ index: conflictIdx, slot: oldSlot });
        this.removeActivity(conflictIdx);
      }
    }
    
    this.placeActivity(activityIndex, slot);
    
    let allPlaced = true;
    for (const removed of removedActivities) {
      const permPos = this.permutation.indexOf(removed.index);
      if (permPos >= 0) {
        if (!this.randomSwap(permPos, level + 1, ncalls)) {
          allPlaced = false;
          break;
        }
      }
    }
    
    if (allPlaced) {
      return true;
    }
    
    // Restore state
    this.removeActivity(activityIndex);
    for (const removed of removedActivities) {
      this.placeActivity(removed.index, removed.slot);
    }
    
    // Add to tabu
    this.tabuActivities[this.tabuIndex] = activityIndex;
    this.tabuTimes[this.tabuIndex] = slot;
    this.tabuIndex = (this.tabuIndex + 1) % this.config.tabuSize;
    
    return false;
  }

  private allocateRooms(): RoomAllocation[] {
    const roomAllocations: RoomAllocation[] = [];
    
    if (this.rooms.length === 0) {
      return roomAllocations;
    }
    
    // Allocate rooms for each placed activity
    for (const activity of this.internalActivities) {
      if (this.times[activity.index] < 0) {
        continue; // Activity not placed
      }
      
      const slot = this.times[activity.index];
      const day = dayFromSlot(slot, this.nHoursPerDay);
      const hour = hourFromSlot(slot, this.nHoursPerDay);
      
      // Check for preferred room (locked)
      const preferredRoom = this.activityPreferredRoom.get(activity.index);
      if (preferredRoom?.locked) {
        const roomIdx = preferredRoom.roomIdx;
        let available = true;
        for (let h = hour; h < hour + activity.duration; h++) {
          const s = timeSlot(day, h, this.nHoursPerDay);
          if (this.roomsTimetable[roomIdx][s] >= 0 || this.roomNotAvailable.get(roomIdx)?.has(s)) {
            available = false;
            break;
          }
        }
        if (available) {
          this.roomAllocations[activity.index] = roomIdx;
          for (let h = hour; h < hour + activity.duration; h++) {
            const s = timeSlot(day, h, this.nHoursPerDay);
            this.roomsTimetable[roomIdx][s] = activity.index;
          }
          roomAllocations.push({
            activityIndex: activity.index,
            roomIndex: roomIdx,
          });
          continue;
        }
      }
      
      // Get list of candidate rooms
      let candidateRooms: number[] = [];
      
      // Check activity preferred rooms
      const prefRooms = this.activityPreferredRooms.get(activity.index);
      if (prefRooms && prefRooms.length > 0) {
        candidateRooms = prefRooms;
      } else if (preferredRoom) {
        candidateRooms = [preferredRoom.roomIdx];
      } else {
        // Check subject preferred rooms
        const subject = this.activityToSubject.get(activity.index);
        if (subject) {
          const subjRoomIdx = this.subjectPreferredRoom.get(subject);
          if (subjRoomIdx !== undefined) {
            candidateRooms = [subjRoomIdx];
          } else {
            const subjRooms = this.subjectPreferredRooms.get(subject);
            if (subjRooms && subjRooms.length > 0) {
              candidateRooms = subjRooms;
            }
          }
        }
      }
      
      // If no preferences, use all rooms
      if (candidateRooms.length === 0) {
        candidateRooms = Array.from({ length: this.rooms.length }, (_, i) => i);
      }
      
      // Find an available room
      for (const roomIdx of candidateRooms) {
        let available = true;
        for (let h = hour; h < hour + activity.duration; h++) {
          const s = timeSlot(day, h, this.nHoursPerDay);
          if (this.roomsTimetable[roomIdx][s] >= 0 || this.roomNotAvailable.get(roomIdx)?.has(s)) {
            available = false;
            break;
          }
        }
        if (available) {
          this.roomAllocations[activity.index] = roomIdx;
          for (let h = hour; h < hour + activity.duration; h++) {
            const s = timeSlot(day, h, this.nHoursPerDay);
            this.roomsTimetable[roomIdx][s] = activity.index;
          }
          roomAllocations.push({
            activityIndex: activity.index,
            roomIndex: roomIdx,
          });
          break;
        }
      }
    }
    
    return roomAllocations;
  }

  async generate(callback?: GenerationCallback): Promise<GenerationResult> {
    this.callback = callback || null;
    this.startTime = Date.now();
    this.abortFlag = false;
    this.placedActivities = 0;
    this.maxPlacedActivities = 0;
    
    const conflicts: ConflictInfo[] = [];
    
    try {
      this.initialize();
      
      if (this.nInternalActivities === 0) {
        return {
          success: true,
          timeAllocations: [],
          roomAllocations: [],
          conflicts: [{ activityIndex: -1, reason: 'No activities to schedule', severity: 'warning' }],
          placedActivities: 0,
          totalActivities: 0,
          elapsedTimeMs: Date.now() - this.startTime,
        };
      }
      
      let addedAct = 0;
      
      while (addedAct < this.nInternalActivities) {
        if (this.abortFlag) break;
        if (callback?.shouldStop?.()) {
          this.abortFlag = true;
          break;
        }
        
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        if (elapsedSeconds > this.config.maxSeconds) {
          conflicts.push({
            activityIndex: -1,
            reason: 'Time limit exceeded',
            severity: 'error',
          });
          break;
        }
        
        const activityIndex = this.permutation[addedAct];
        
        if (this.times[activityIndex] >= 0) {
          addedAct++;
          continue;
        }
        
        const ncalls = { value: 0 };
        const success = this.randomSwap(addedAct, 0, ncalls);
        
        if (success) {
          this.placedActivities++;
          if (this.placedActivities > this.maxPlacedActivities) {
            this.maxPlacedActivities = this.placedActivities;
          }
          
          callback?.onProgress?.(this.placedActivities, this.nInternalActivities);
        } else {
          const activity = this.internalActivities[activityIndex];
          const originalActivity = this.activities[activityIndex];
          conflicts.push({
            activityIndex,
            reason: `Could not place: ${originalActivity.subjectId} (${activity.teacherIndices.length} teachers, duration: ${activity.duration})`,
            severity: 'warning',
          });
        }
        
        addedAct++;
        
        // Yield
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Allocate rooms after time allocation
      const roomAllocations = this.allocateRooms();
      
      const timeAllocations: TimeAllocation[] = this.internalActivities
        .filter(a => this.times[a.index] >= 0)
        .map(a => ({
          activityIndex: a.index,
          day: dayFromSlot(this.times[a.index], this.nHoursPerDay),
          hour: hourFromSlot(this.times[a.index], this.nHoursPerDay),
        }));
      
      const isComplete = this.placedActivities === this.nInternalActivities;
      
      return {
        success: isComplete,
        timeAllocations,
        roomAllocations,
        conflicts,
        placedActivities: this.placedActivities,
        totalActivities: this.nInternalActivities,
        elapsedTimeMs: Date.now() - this.startTime,
      };
      
    } catch (error) {
      console.error('Generation error:', error);
      return {
        success: false,
        timeAllocations: [],
        roomAllocations: [],
        conflicts: [{
          activityIndex: -1,
          reason: `Generation error: ${error}`,
          severity: 'error',
        }],
        placedActivities: this.placedActivities,
        totalActivities: this.nInternalActivities,
        elapsedTimeMs: Date.now() - this.startTime,
      };
    }
  }

  stop(): void {
    this.abortFlag = true;
  }
}
