/**
 * FET Web - Timetable Generator
 * Implementation of the recursive swapping algorithm
 */

import type { 
  Activity, Teacher, Room, TimeConstraint, SpaceConstraint,
  TimetableRules, StudentsSubgroup
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
  private rooms: Room[];
  private timeConstraints: TimeConstraint[];
  private spaceConstraints: SpaceConstraint[];
  
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
    config?: Partial<GenerationConfig>
  ) {
    this.rules = rules;
    this.activities = activities.filter(a => a.active);
    this.teachers = teachers;
    this.subgroups = subgroups || [];
    this.rooms = rooms;
    this.timeConstraints = timeConstraints.filter(c => c.active);
    this.spaceConstraints = spaceConstraints.filter(c => c.active);
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new RandomGenerator();
  }

  private findTeacherIndex(idOrName: string): number {
    // Try by ID first
    let idx = this.teacherIdToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    // Try by name
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

  private findRoomIndex(idOrName: string): number {
    let idx = this.roomIdToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    idx = this.roomNameToIndex.get(idOrName);
    if (idx !== undefined) return idx;
    return -1;
  }

  private initialize(): void {
    this.nDaysPerWeek = this.rules.nDaysPerWeek;
    this.nHoursPerDay = this.rules.nHoursPerDay;
    this.nHoursPerWeek = this.nDaysPerWeek * this.nHoursPerDay;
    
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
      
      // Map teacher ids/names to indices
      const teacherIndices = a.teacherIds
        .map(idOrName => this.findTeacherIndex(idOrName))
        .filter(idx => idx >= 0);
      
      // Map student set ids/names to indices
      const subgroupIndices = a.studentSetIds
        .map(idOrName => this.findSubgroupIndex(idOrName))
        .filter(idx => idx >= 0);
      
      return {
        id: a.id,
        index: i,
        teacherIndices,
        subjectIndex: 0,
        activityTagIndices: [],
        subgroupIndices,
        duration: a.duration,
        active: a.active,
      };
    });
    
    this.nInternalActivities = this.internalActivities.length;
    
    if (this.config.maxRecursionCalls === 0) {
      this.config.maxRecursionCalls = Math.max(100, 2 * this.nInternalActivities);
    }
    if (this.config.tabuSize === 0) {
      this.config.tabuSize = Math.max(100, this.nInternalActivities * this.nHoursPerWeek);
    }
    
    // Initialize timetables
    const nTeachers = Math.max(1, this.teachers.length);
    const nSubgroups = Math.max(1, this.subgroups.length);
    const nRooms = Math.max(1, this.rooms.length);
    
    this.teachersTimetable = createMatrix2D(nTeachers, this.nHoursPerWeek, -1);
    this.subgroupsTimetable = createMatrix2D(nSubgroups, this.nHoursPerWeek, -1);
    this.roomsTimetable = createMatrix2D(nRooms, this.nHoursPerWeek, -1);
    
    this.times = new Array(this.nInternalActivities).fill(-1);
    this.roomAllocations = new Array(this.nInternalActivities).fill(-1);
    
    this.tabuActivities = new Array(this.config.tabuSize).fill(-1);
    this.tabuTimes = new Array(this.config.tabuSize).fill(-1);
    this.tabuIndex = 0;
    
    this.parseConstraints();
    this.sortActivitiesByDifficulty();
  }

  private parseConstraints(): void {
    for (const constraint of this.timeConstraints) {
      switch (constraint.type) {
        case 'BreakTimes':
          const breakConstraint = constraint as any;
          if (breakConstraint.times) {
            for (const time of breakConstraint.times) {
              this.breakTimes.add(timeSlot(time.day, time.hour, this.nHoursPerDay));
            }
          }
          break;
          
        case 'TeacherNotAvailableTimes':
          const teacherConstraint = constraint as any;
          const teacherIdx = this.findTeacherIndex(teacherConstraint.teacherId);
          if (teacherIdx >= 0 && teacherConstraint.times) {
            if (!this.teacherNotAvailable.has(teacherIdx)) {
              this.teacherNotAvailable.set(teacherIdx, new Set());
            }
            for (const time of teacherConstraint.times) {
              this.teacherNotAvailable.get(teacherIdx)!.add(
                timeSlot(time.day, time.hour, this.nHoursPerDay)
              );
            }
          }
          break;
          
        case 'StudentsSetNotAvailableTimes':
          const studentsConstraint = constraint as any;
          const subgroupIdx = this.findSubgroupIndex(studentsConstraint.studentsSetId);
          if (subgroupIdx >= 0 && studentsConstraint.times) {
            if (!this.studentsNotAvailable.has(subgroupIdx)) {
              this.studentsNotAvailable.set(subgroupIdx, new Set());
            }
            for (const time of studentsConstraint.times) {
              this.studentsNotAvailable.get(subgroupIdx)!.add(
                timeSlot(time.day, time.hour, this.nHoursPerDay)
              );
            }
          }
          break;
      }
    }

    for (const constraint of this.spaceConstraints) {
      if (constraint.type === 'RoomNotAvailableTimes') {
        const roomConstraint = constraint as any;
        const roomIdx = this.findRoomIndex(roomConstraint.roomId);
        if (roomIdx >= 0 && roomConstraint.times) {
          if (!this.roomNotAvailable.has(roomIdx)) {
            this.roomNotAvailable.set(roomIdx, new Set());
          }
          for (const time of roomConstraint.times) {
            this.roomNotAvailable.get(roomIdx)!.add(
              timeSlot(time.day, time.hour, this.nHoursPerDay)
            );
          }
        }
      }
    }
  }

  private sortActivitiesByDifficulty(): void {
    const difficulties: { index: number; score: number }[] = this.internalActivities.map(a => {
      let score = 0;
      score += a.teacherIndices.length * 10;
      score += a.subgroupIndices.length * 10;
      score += a.duration * 5;
      
      for (const teacherIdx of a.teacherIndices) {
        const notAvailable = this.teacherNotAvailable.get(teacherIdx);
        if (notAvailable) {
          score += notAvailable.size;
        }
      }
      
      for (const subgroupIdx of a.subgroupIndices) {
        const notAvailable = this.studentsNotAvailable.get(subgroupIdx);
        if (notAvailable) {
          score += notAvailable.size;
        }
      }
      
      return { index: a.index, score };
    });
    
    difficulties.sort((a, b) => b.score - a.score);
    this.permutation = difficulties.map(d => d.index);
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
          this.teachersTimetable[teacherIdx][s] = activityIndex;
        }
      }
      
      for (const subgroupIdx of activity.subgroupIndices) {
        if (subgroupIdx < this.subgroupsTimetable.length) {
          this.subgroupsTimetable[subgroupIdx][s] = activityIndex;
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
        if (teacherIdx < this.teachersTimetable.length && 
            this.teachersTimetable[teacherIdx][s] === activityIndex) {
          this.teachersTimetable[teacherIdx][s] = -1;
        }
      }
      
      for (const subgroupIdx of activity.subgroupIndices) {
        if (subgroupIdx < this.subgroupsTimetable.length &&
            this.subgroupsTimetable[subgroupIdx][s] === activityIndex) {
          this.subgroupsTimetable[subgroupIdx][s] = -1;
        }
      }
    }
  }

  private checkSlotValid(activity: InternalActivity, slot: number): { 
    valid: boolean; 
    conflicts: number[];
    reason?: string;
  } {
    const day = dayFromSlot(slot, this.nHoursPerDay);
    const hour = hourFromSlot(slot, this.nHoursPerDay);
    const conflicts: number[] = [];
    
    // Check if activity fits in the day
    if (hour + activity.duration > this.nHoursPerDay) {
      return { valid: false, conflicts: [], reason: 'Duration exceeds day' };
    }
    
    // Check all time slots the activity would occupy
    for (let h = hour; h < hour + activity.duration; h++) {
      const s = timeSlot(day, h, this.nHoursPerDay);
      
      // Check break times
      if (this.breakTimes.has(s)) {
        return { valid: false, conflicts: [], reason: 'Break time' };
      }
      
      // Check teacher availability and conflicts
      for (const teacherIdx of activity.teacherIndices) {
        // Check not available times
        const notAvailable = this.teacherNotAvailable.get(teacherIdx);
        if (notAvailable?.has(s)) {
          return { valid: false, conflicts: [], reason: 'Teacher not available' };
        }
        
        // Check for conflicts with other activities
        if (teacherIdx < this.teachersTimetable.length) {
          const existingActivity = this.teachersTimetable[teacherIdx][s];
          if (existingActivity >= 0 && existingActivity !== activity.index) {
            if (!conflicts.includes(existingActivity)) {
              conflicts.push(existingActivity);
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
            if (!conflicts.includes(existingActivity)) {
              conflicts.push(existingActivity);
            }
          }
        }
      }
    }
    
    return { valid: true, conflicts };
  }

  private findBestSlot(activityIndex: number): {
    slot: number;
    conflicts: number[];
  } | null {
    const activity = this.internalActivities[activityIndex];
    const slotData: { slot: number; conflictCount: number; conflicts: number[] }[] = [];
    
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
            conflicts: result.conflicts 
          });
        }
      }
    }
    
    if (slotData.length === 0) {
      return null;
    }
    
    // Sort by number of conflicts (prefer slots with fewer conflicts)
    slotData.sort((a, b) => a.conflictCount - b.conflictCount);
    
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
      
      const timeAllocations: TimeAllocation[] = this.internalActivities
        .filter(a => this.times[a.index] >= 0)
        .map(a => ({
          activityIndex: a.index,
          day: dayFromSlot(this.times[a.index], this.nHoursPerDay),
          hour: hourFromSlot(this.times[a.index], this.nHoursPerDay),
        }));
      
      const roomAllocations: RoomAllocation[] = [];
      
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
