/**
 * Zod Validation Schemas for FET Web
 * Provides runtime type validation for data structures
 */

import { z } from 'zod';

// ============ CONSTANTS ============

export const OFFICIAL_MODE = 0;
export const MORNINGS_AFTERNOONS_MODE = 1;
export const BLOCK_PLANNING_MODE = 2;
export const TERMS_MODE = 3;

export const STUDENTS_YEAR = 1;
export const STUDENTS_GROUP = 2;
export const STUDENTS_SUBGROUP = 3;

// ============ BASE SCHEMAS ============

export const TeacherSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  longName: z.string().optional(),
  code: z.string().optional(),
  targetNumberOfHours: z.number().min(0).default(0),
  qualifiedSubjects: z.array(z.string()).default([]),
  comments: z.string().optional(),
});

export const SubjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  longName: z.string().optional(),
  code: z.string().optional(),
  comments: z.string().optional(),
});

export const ActivityTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  longName: z.string().optional(),
  code: z.string().optional(),
  printable: z.boolean().default(true),
  comments: z.string().optional(),
});

export const StudentsSetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  longName: z.string().optional(),
  code: z.string().optional(),
  numberOfStudents: z.number().min(0).default(0),
  type: z.number(),
  comments: z.string().optional(),
});

export const StudentsSubgroupSchema = StudentsSetSchema.extend({
  type: z.literal(STUDENTS_SUBGROUP),
});

export const StudentsGroupSchema = StudentsSetSchema.extend({
  type: z.literal(STUDENTS_GROUP),
  subgroups: z.array(z.string()).default([]),
  shift: z.union([z.literal(1), z.literal(2)]).optional(),
});

export const StudentsYearSchema = StudentsSetSchema.extend({
  type: z.literal(STUDENTS_YEAR),
  groups: z.array(z.string()).default([]),
  divisions: z.array(z.array(z.string())).default([]),
  separator: z.string().default(' '),
});

export const BuildingSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  longName: z.string().optional(),
  code: z.string().optional(),
  comments: z.string().optional(),
});

export const RoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  longName: z.string().optional(),
  code: z.string().optional(),
  capacity: z.number().min(1).default(30),
  buildingId: z.string().optional(),
  isVirtual: z.boolean().default(false),
  realRoomsSets: z.array(z.array(z.string())).optional(),
  comments: z.string().optional(),
});

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  activityGroupId: z.number().default(0),
  teacherIds: z.array(z.string()).min(1, 'At least one teacher is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  activityTagIds: z.array(z.string()).default([]),
  studentSetIds: z.array(z.string()).default([]),
  duration: z.number().min(1).default(1),
  totalDuration: z.number().min(1).default(1),
  active: z.boolean().default(true),
  computeNTotalStudents: z.boolean().default(true),
  nTotalStudents: z.number().min(0).default(0),
  comments: z.string().optional(),
  shiftOverride: z.union([z.literal(1), z.literal(2)]).optional(),
  weekParity: z.enum(['both', 'numerator', 'denominator']).optional(),
});

export const DaySchema = z.object({
  name: z.string().min(1),
  longName: z.string().optional(),
});

export const HourSchema = z.object({
  name: z.string().min(1),
  longName: z.string().optional(),
});

export const TimeSlotSchema = z.object({
  day: z.number().min(0),
  hour: z.number().min(0),
});

// ============ CONSTRAINT TYPES ============

export const ConstraintTypeSchema = z.enum([
  'BasicCompulsoryTime',
  'BasicCompulsorySpace',
  'BreakTimes',
  'TeacherNotAvailableTimes',
  'TeacherMaxDaysPerWeek',
  'TeacherMinDaysPerWeek',
  'TeacherMaxGapsPerWeek',
  'TeacherMaxGapsPerDay',
  'TeacherMaxHoursDaily',
  'TeacherMinHoursDaily',
  'TeacherMaxHoursContinuously',
  'TeachersMaxDaysPerWeek',
  'TeachersMaxGapsPerWeek',
  'TeachersMaxGapsPerDay',
  'TeachersMaxHoursDaily',
  'TeachersMinHoursDaily',
  'TeachersMaxHoursContinuously',
  'StudentsSetNotAvailableTimes',
  'StudentsSetMaxDaysPerWeek',
  'StudentsSetMaxGapsPerWeek',
  'StudentsSetMaxGapsPerDay',
  'StudentsSetMaxHoursDaily',
  'StudentsSetMinHoursDaily',
  'StudentsSetMaxHoursContinuously',
  'StudentsSetEarlyMaxBeginningsAtSecondHour',
  'StudentsMaxDaysPerWeek',
  'StudentsMaxGapsPerWeek',
  'StudentsMaxGapsPerDay',
  'StudentsMaxHoursDaily',
  'StudentsMinHoursDaily',
  'StudentsMaxHoursContinuously',
  'StudentsEarlyMaxBeginningsAtSecondHour',
  'ActivityPreferredStartingTime',
  'ActivityPreferredStartingTimes',
  'ActivityPreferredTimeSlots',
  'ActivityPreferredDay',
  'ActivityEndsStudentsDay',
  'ActivityEndsTeachersDay',
  'ActivitiesPreferredStartingTimes',
  'ActivitiesPreferredTimeSlots',
  'ActivitiesSameStartingTime',
  'ActivitiesSameStartingHour',
  'ActivitiesSameStartingDay',
  'ActivitiesNotOverlapping',
  'ActivitiesEndStudentsDay',
  'MinDaysBetweenActivities',
  'MaxDaysBetweenActivities',
  'MinGapsBetweenActivities',
  'TwoActivitiesConsecutive',
  'TwoActivitiesGrouped',
  'ThreeActivitiesGrouped',
  'TwoActivitiesOrdered',
  'RoomNotAvailableTimes',
  'ActivityPreferredRoom',
  'ActivityPreferredRooms',
  'StudentsSetHomeRoom',
  'StudentsSetHomeRooms',
  'TeacherHomeRoom',
  'TeacherHomeRooms',
  'SubjectPreferredRoom',
  'SubjectPreferredRooms',
]);

export const BaseConstraintSchema = z.object({
  id: z.string().uuid(),
  type: ConstraintTypeSchema,
  weightPercentage: z.number().min(0).max(100).default(100),
  active: z.boolean().default(true),
  comments: z.string().optional(),
});

export const BreakTimesConstraintSchema = BaseConstraintSchema.extend({
  type: z.literal('BreakTimes'),
  times: z.array(TimeSlotSchema),
});

export const TeacherNotAvailableTimesConstraintSchema = BaseConstraintSchema.extend({
  type: z.literal('TeacherNotAvailableTimes'),
  teacherId: z.string().min(1),
  times: z.array(TimeSlotSchema),
});

export const TeacherMaxDaysPerWeekConstraintSchema = BaseConstraintSchema.extend({
  type: z.literal('TeacherMaxDaysPerWeek'),
  teacherId: z.string().min(1),
  maxDays: z.number().min(1).max(7),
});

export const TeacherMinDaysPerWeekConstraintSchema = BaseConstraintSchema.extend({
  type: z.literal('TeacherMinDaysPerWeek'),
  teacherId: z.string().min(1),
  minDays: z.number().min(1).max(7),
});

export const StudentsSetMaxGapsPerDayConstraintSchema = BaseConstraintSchema.extend({
  type: z.literal('StudentsSetMaxGapsPerDay'),
  studentsSetId: z.string().min(1),
  maxGaps: z.number().min(0).max(20),
});

// ============ RULES SCHEMA ============

export const TimetableRulesSchema = z.object({
  id: z.string().uuid(),
  mode: z.number().min(0).max(3).default(0),
  institutionName: z.string().min(1, 'Institution name is required'),
  comments: z.string().optional(),
  institutionType: z.enum(['school', 'gymnasium', 'college', 'university']).optional(),
  nDaysPerWeek: z.number().min(1).max(7).default(5),
  nHoursPerDay: z.number().min(1).max(24).default(8),
  daysOfTheWeek: z.array(DaySchema),
  hoursOfTheDay: z.array(HourSchema),
  nRealDaysPerWeek: z.number().optional(),
  nRealHoursPerDay: z.number().optional(),
  nTerms: z.number().optional(),
  nDaysPerTerm: z.number().optional(),
  shifts: z.object({
    shift1: z.object({ firstHour: z.number().min(0), lastHour: z.number().min(0) }),
    shift2: z.object({ firstHour: z.number().min(0), lastHour: z.number().min(0) }),
  }).optional(),
  modified: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============ TYPE EXPORTS ============

export type Teacher = z.infer<typeof TeacherSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type ActivityTag = z.infer<typeof ActivityTagSchema>;
export type StudentsYear = z.infer<typeof StudentsYearSchema>;
export type StudentsGroup = z.infer<typeof StudentsGroupSchema>;
export type StudentsSubgroup = z.infer<typeof StudentsSubgroupSchema>;
export type Building = z.infer<typeof BuildingSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Day = z.infer<typeof DaySchema>;
export type Hour = z.infer<typeof HourSchema>;
export type TimeSlot = z.infer<typeof TimeSlotSchema>;
export type TimetableRules = z.infer<typeof TimetableRulesSchema>;

// ============ VALIDATION HELPERS ============

export function validateTeacher(data: unknown): Teacher {
  return TeacherSchema.parse(data);
}

export function validateSubject(data: unknown): Subject {
  return SubjectSchema.parse(data);
}

export function validateRoom(data: unknown): Room {
  return RoomSchema.parse(data);
}

export function validateActivity(data: unknown): Activity {
  return ActivitySchema.parse(data);
}

export function validateRules(data: unknown): TimetableRules {
  return TimetableRulesSchema.parse(data);
}

// Safe validation that returns result or null
export function safeValidateTeacher(data: unknown): Teacher | null {
  const result = TeacherSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeValidateSubject(data: unknown): Subject | null {
  const result = SubjectSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeValidateRoom(data: unknown): Room | null {
  const result = RoomSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeValidateActivity(data: unknown): Activity | null {
  const result = ActivitySchema.safeParse(data);
  return result.success ? result.data : null;
}

// Get validation errors
export function getValidationErrors<T>(schema: z.ZodSchema<T>, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
}
