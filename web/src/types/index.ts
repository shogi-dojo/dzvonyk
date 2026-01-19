/**
 * FET Web - Type Definitions
 * Based on the original FET (Free Timetabling Software) C++ implementation
 */

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
  subgroups: string[]; // subgroup IDs
}

export interface StudentsYear extends StudentsSet {
  type: typeof STUDENTS_YEAR;
  groups: string[]; // group IDs
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

export interface Activity {
  id: string;
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
  | StudentsSetNotAvailableTimesConstraint
  | ActivityPreferredStartingTimeConstraint
  | MinDaysBetweenActivitiesConstraint;

export type SpaceConstraint = 
  | BaseConstraint
  | RoomNotAvailableTimesConstraint
  | ActivityPreferredRoomConstraint
  | ActivityPreferredRoomsConstraint
  | SubjectPreferredRoomConstraint;

// ============ TIMETABLE DATA ============

export interface TimetableRules {
  id: string;
  mode: number;
  institutionName: string;
  comments?: string;
  
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
}
