/**
 * Internal types for the timetable generation engine
 */

export interface InternalActivity {
  id: string;
  index: number;
  teacherIndices: number[];
  subjectIndex: number;
  activityTagIndices: number[];
  subgroupIndices: number[];
  duration: number;
  active: boolean;
}

export interface TimeAllocation {
  activityIndex: number;
  day: number;
  hour: number;
}

export interface RoomAllocation {
  activityIndex: number;
  roomIndex: number;
  realRoomIndices?: number[];
}

export interface ConflictInfo {
  activityIndex: number;
  reason: string;
  severity: 'error' | 'warning';
}

export interface GenerationConfig {
  maxSeconds: number;
  maxRecursionLevel: number;
  maxRecursionCalls: number;
  tabuSize: number;
}

export interface GenerationResult {
  success: boolean;
  timeAllocations: TimeAllocation[];
  roomAllocations: RoomAllocation[];
  conflicts: ConflictInfo[];
  placedActivities: number;
  totalActivities: number;
  elapsedTimeMs: number;
}

export interface GenerationCallback {
  onProgress?: (placed: number, total: number) => void;
  onActivityPlaced?: (activityIndex: number, day: number, hour: number) => void;
  onConflict?: (conflict: ConflictInfo) => void;
  shouldStop?: () => boolean;
}

// Matrix types for internal computations
export type Matrix1D<T> = T[];
export type Matrix2D<T> = T[][];
export type Matrix3D<T> = T[][][];

// Constraint evaluation result
export interface ConstraintFitness {
  satisfied: boolean;
  weight: number;
  conflictingActivities: number[];
}
