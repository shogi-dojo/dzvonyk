/**
 * FET Web - Type Definitions
 * Based on the original FET (Free Timetabling Software) C++ implementation
 */

import type { InstitutionPresetId } from '@/lib/institution/presets';

// ============ CONSTANTS ============

export const OFFICIAL_MODE = 0;
export const MORNINGS_AFTERNOONS_MODE = 1;
export const BLOCK_PLANNING_MODE = 2;
export const TERMS_MODE = 3;

export const STUDENTS_YEAR = 1;
export const STUDENTS_GROUP = 2;
export const STUDENTS_SUBGROUP = 3;

export const UNALLOCATED_TIME = -1;
export const UNALLOCATED_SPACE = -1;

// ============ TEACHER ============

export interface Teacher {
  id: string;
  name: string;
  longName?: string;
  code?: string;
  targetNumberOfHours: number;
  qualifiedSubjects: string[];
  comments?: string;
}

// ============ SUBJECT ============

export interface Subject {
  id: string;
  name: string;
  longName?: string;
  code?: string;
  color?: string;
  comments?: string;
}

// ============ ACTIVITY TAG ============

export interface ActivityTag {
  id: string;
  name: string;
  longName?: string;
  code?: string;
  printable: boolean;
  comments?: string;
}

// ============ STUDENTS ============

export interface StudentsSet {
  id: string;
  name: string;
  longName?: string;
  code?: string;
  numberOfStudents: number;
  type: number; // STUDENTS_YEAR, STUDENTS_GROUP, STUDENTS_SUBGROUP
  comments?: string;
}

export interface StudentsSubgroup extends StudentsSet {
  type: typeof STUDENTS_SUBGROUP;
}

export interface StudentsGroup extends StudentsSet {
  type: typeof STUDENTS_GROUP;
  /**
   * Subgroup references — ids OR names. Despite the historical "IDs" label,
   * names are what actually get written: the Students page appends
   * `newSubgroup.name`, and both importers write names too. Resolve with
   * `@/lib/studentSetLookup`, never by id alone.
   */
  subgroups: string[];
  // Ukrainian schools often run two shifts (зміни). If set, this class attends
  // only the hours in rules.shifts[shift].{firstHour, lastHour}. Individual
  // activities may override via Activity.shiftOverride.
  shift?: 1 | 2;
}

export interface StudentsYear extends StudentsSet {
  type: typeof STUDENTS_YEAR;
  /**
   * Group references — ids OR names. See the note on
   * `StudentsGroup.subgroups`: names dominate in practice, and code that
   * matched ids only silently dropped every imported stream. Resolve with
   * `@/lib/studentSetLookup`.
   */
  groups: string[];
  divisions: string[][];
  separator: string;
}

// ============ ROOM & BUILDING ============

export interface Building {
  id: string;
  name: string;
  longName?: string;
  code?: string;
  comments?: string;
}

export interface Room {
  id: string;
  name: string;
  longName?: string;
  code?: string;
  capacity: number;
  buildingId?: string;
  isVirtual: boolean;
  realRoomsSets?: string[][]; // For virtual rooms: sets of real room names
  comments?: string;
}

// ============ ACTIVITY ============

/**
 * Display/reporting classification of an activity (lecture, seminar…).
 * Purely informational in v1: the generator never reads it. Academic presets
 * only — the UI is gated by features.activitySubtypes.
 */
export type ActivitySubtype = 'lecture' | 'seminar' | 'lab' | 'practical';

export interface Activity {
  id: string;
  fetId?: string;
  activityGroupId: number; // 0 for non-split, >0 for split activities
  teacherIds: string[];
  subjectId: string;
  activityTagIds: string[];
  studentSetIds: string[];
  duration: number;
  totalDuration: number;
  active: boolean;
  computeNTotalStudents: boolean;
  nTotalStudents: number;
  comments?: string;
  // Override the group's shift for this specific lesson (e.g. an online lesson
  // held in the opposite shift's window). Undefined = follow group.shift.
  shiftOverride?: 1 | 2;
  // Biweekly rotation. Two activities with opposite parity may share a slot.
  // Undefined or 'both' = every week (default).
  weekParity?: 'both' | 'numerator' | 'denominator';
  // See ActivitySubtype. Undefined = unclassified.
  activitySubtype?: ActivitySubtype;
}

// ============ TIME STRUCTURE ============

export interface Day {
  name: string;
  longName?: string;
}

export interface Hour {
  name: string;
  longName?: string;
}

export interface TimeSlot {
  day: number;
  hour: number;
}

// ============ CONSTRAINTS ============

export type ConstraintType = 
  // Basic
  | 'BasicCompulsoryTime'
  | 'BasicCompulsorySpace'
  // Break times
  | 'BreakTimes'
  // Teacher constraints
  | 'TeacherNotAvailableTimes'
  | 'TeacherMaxDaysPerWeek'
  | 'TeacherMinDaysPerWeek'
  | 'TeacherMaxGapsPerWeek'
  | 'TeacherMaxGapsPerDay'
  | 'TeacherMaxHoursDaily'
  | 'TeacherMinHoursDaily'
  | 'TeacherMaxHoursContinuously'
  | 'TeachersMaxDaysPerWeek'
  | 'TeachersMaxGapsPerWeek'
  | 'TeachersMaxGapsPerDay'
  | 'TeachersMaxHoursDaily'
  | 'TeachersMinHoursDaily'
  | 'TeachersMaxHoursContinuously'
  // Students constraints
  | 'StudentsSetNotAvailableTimes'
  | 'StudentsSetMaxDaysPerWeek'
  | 'StudentsSetMaxGapsPerWeek'
  | 'StudentsSetMaxGapsPerDay'
  | 'StudentsSetMaxHoursDaily'
  | 'StudentsSetMinHoursDaily'
  | 'StudentsSetMaxHoursContinuously'
  | 'StudentsSetEarlyMaxBeginningsAtSecondHour'
  | 'StudentsMaxDaysPerWeek'
  | 'StudentsMaxGapsPerWeek'
  | 'StudentsMaxGapsPerDay'
  | 'StudentsMaxHoursDaily'
  | 'StudentsMinHoursDaily'
  | 'StudentsMaxHoursContinuously'
  | 'StudentsEarlyMaxBeginningsAtSecondHour'
  // Activity constraints
  | 'ActivityPreferredStartingTime'
  | 'ActivityPreferredStartingTimes'
  | 'ActivityPreferredTimeSlots'
  | 'ActivityPreferredDay'
  | 'ActivityEndsStudentsDay'
  | 'ActivityEndsTeachersDay'
  | 'ActivitiesPreferredStartingTimes'
  | 'ActivitiesPreferredTimeSlots'
  | 'ActivitiesSameStartingTime'
  | 'ActivitiesSameStartingHour'
  | 'ActivitiesSameStartingDay'
  | 'ActivitiesNotOverlapping'
  | 'ActivitiesEndStudentsDay'
  | 'MinDaysBetweenActivities'
  | 'MaxDaysBetweenActivities'
  | 'MinGapsBetweenActivities'
  | 'TwoActivitiesConsecutive'
  | 'TwoActivitiesGrouped'
  | 'ThreeActivitiesGrouped'
  | 'TwoActivitiesOrdered'
  // Room constraints
  | 'RoomNotAvailableTimes'
  | 'ActivityPreferredRoom'
  | 'ActivityPreferredRooms'
  | 'StudentsSetHomeRoom'
  | 'StudentsSetHomeRooms'
  | 'TeacherHomeRoom'
  | 'TeacherHomeRooms'
  | 'SubjectPreferredRoom'
  | 'SubjectPreferredRooms'
  | 'SubjectActivityTagPreferredRoom'
  | 'SubjectActivityTagPreferredRooms'
  | 'ActivityTagPreferredRoom'
  | 'ActivityTagPreferredRooms';

export interface BaseConstraint {
  id: string;
  type: ConstraintType;
  weightPercentage: number;
  active: boolean;
  comments?: string;
}

// Time Constraints
export interface BreakTimesConstraint extends BaseConstraint {
  type: 'BreakTimes';
  times: TimeSlot[];
}

export interface TeacherNotAvailableTimesConstraint extends BaseConstraint {
  type: 'TeacherNotAvailableTimes';
  teacherId: string;
  times: TimeSlot[];
}

export interface TeacherMaxDaysPerWeekConstraint extends BaseConstraint {
  type: 'TeacherMaxDaysPerWeek';
  teacherId: string;
  maxDays: number;
}

export interface TeacherMinDaysPerWeekConstraint extends BaseConstraint {
  type: 'TeacherMinDaysPerWeek';
  teacherId: string;
  minDays: number;
}

export interface StudentsSetMaxGapsPerDayConstraint extends BaseConstraint {
  type: 'StudentsSetMaxGapsPerDay';
  studentsSetId: string;
  maxGaps: number;
}

export interface StudentsSetNotAvailableTimesConstraint extends BaseConstraint {
  type: 'StudentsSetNotAvailableTimes';
  studentsSetId: string;
  times: TimeSlot[];
}

export interface ActivityPreferredStartingTimeConstraint extends BaseConstraint {
  type: 'ActivityPreferredStartingTime';
  activityId: string;
  day: number;
  hour: number;
  permanentlyLocked: boolean;
}

export interface ActivityPreferredStartingTimesConstraint extends BaseConstraint {
  type: 'ActivityPreferredStartingTimes';
  activityId: string;
  times: TimeSlot[];
  permanentlyLocked?: boolean;
}

export interface MinDaysBetweenActivitiesConstraint extends BaseConstraint {
  type: 'MinDaysBetweenActivities';
  activityIds: string[];
  minDays: number;
  consecutiveIfSameDay: boolean;
}

// Space Constraints
export interface RoomNotAvailableTimesConstraint extends BaseConstraint {
  type: 'RoomNotAvailableTimes';
  roomId: string;
  times: TimeSlot[];
}

export interface ActivityPreferredRoomConstraint extends BaseConstraint {
  type: 'ActivityPreferredRoom';
  activityId: string;
  roomId: string;
  permanentlyLocked: boolean;
}

export interface ActivityPreferredRoomsConstraint extends BaseConstraint {
  type: 'ActivityPreferredRooms';
  activityId: string;
  roomIds: string[];
}

export interface SubjectPreferredRoomConstraint extends BaseConstraint {
  type: 'SubjectPreferredRoom';
  subjectId: string;
  roomId: string;
}

export type TimeConstraint = 
  | BaseConstraint
  | BreakTimesConstraint
  | TeacherNotAvailableTimesConstraint
  | TeacherMaxDaysPerWeekConstraint
  | TeacherMinDaysPerWeekConstraint
  | StudentsSetMaxGapsPerDayConstraint
  | StudentsSetNotAvailableTimesConstraint
  | ActivityPreferredStartingTimeConstraint
  | ActivityPreferredStartingTimesConstraint
  | MinDaysBetweenActivitiesConstraint;

export type SpaceConstraint = 
  | BaseConstraint
  | RoomNotAvailableTimesConstraint
  | ActivityPreferredRoomConstraint
  | ActivityPreferredRoomsConstraint
  | SubjectPreferredRoomConstraint;

/**
 * Read-only view over any constraint's optional fields.
 *
 * `TimeConstraint` / `SpaceConstraint` include bare `BaseConstraint` as a union
 * member, so TypeScript cannot narrow them by `type` alone. UI and description
 * code needs to read fields that only exist on some members. This names that
 * access explicitly instead of casting through `any` at each site.
 *
 * Prefer narrowing by `type` where possible; use this only for field reads.
 */
export type ConstraintFields = {
  readonly teacherId?: string;
  readonly studentsSetId?: string;
  readonly activityId?: string;
  readonly activityIds?: string[];
  readonly roomId?: string;
  readonly roomIds?: string[];
  readonly subjectId?: string;
  readonly maxDays?: number;
  readonly minDays?: number;
  readonly maxHours?: number;
  readonly minHours?: number;
  readonly maxGaps?: number;
  readonly day?: number;
  readonly hour?: number;
  readonly times?: TimeSlot[];
  readonly consecutiveIfSameDay?: boolean;
  readonly permanentlyLocked?: boolean;
  readonly locked?: boolean;
};

// ============ TIMETABLE DATA ============

export interface TimetableRules {
  id: string;
  mode: number;
  institutionName: string;
  comments?: string;
  // Terminology preset chosen at institution creation. Optional for legacy
  // rows; resolveInstitutionType defaults missing values to 'school'.
  institutionType?: InstitutionPresetId;
  
  // Time structure
  nDaysPerWeek: number;
  nHoursPerDay: number;
  daysOfTheWeek: Day[];
  hoursOfTheDay: Hour[];
  
  // For mornings-afternoons mode
  nRealDaysPerWeek?: number;
  nRealHoursPerDay?: number;
  
  // For terms mode
  nTerms?: number;
  nDaysPerTerm?: number;

  // Two-shift configuration. Hours are inclusive indices into hoursOfTheDay.
  // If undefined, no shift enforcement is applied.
  shifts?: {
    shift1: { firstHour: number; lastHour: number };
    shift2: { firstHour: number; lastHour: number };
  };
  
  modified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ============ SOLUTION ============

export interface ActivityPlacement {
  activityId: string;
  day: number;
  hour: number;
  roomId?: string;
  realRoomIds?: string[];
}

export interface TimetableSolution {
  id: string;
  rulesId: string;
  placements: ActivityPlacement[];
  conflicts: string[];
  isComplete: boolean;
  generatedAt: Date;
}

// ============ GENERATION STATE ============

export interface GenerationState {
  isRunning: boolean;
  isPaused: boolean;
  progress: number;
  placedActivities: number;
  totalActivities: number;
  conflicts: string[];
  startTime?: Date;
  elapsedTime: number;
  maxPlacedActivities: number;
}

// ============ APP STATE ============

export interface AppState {
  currentRulesId: string | null;
  isDarkMode: boolean;
  language: string;
}

// ============ FET FILE FORMAT ============

export interface FETFile {
  version: string;
  mode: number;
  institutionName: string;
  comments: string;
  daysOfTheWeek: Day[];
  hoursOfTheDay: Hour[];
  subjects: Subject[];
  activityTags: ActivityTag[];
  teachers: Teacher[];
  studentsYears: StudentsYear[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  activities: Activity[];
  buildings: Building[];
  rooms: Room[];
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
  shifts?: {
    shift1: { firstHour: number; lastHour: number };
    shift2: { firstHour: number; lastHour: number };
  };
}

export * from './workspace';
