/**
 * Constraint evaluation functions for timetable generation
 */

import type { InternalActivity, ConstraintFitness, Matrix2D } from './types';
import { dayFromSlot, hourFromSlot } from './utils';

/**
 * Evaluates basic compulsory time constraints
 * - No teacher can have two activities at the same time
 * - No student group can have two activities at the same time
 */
export function evaluateBasicCompulsoryTime(
  activity: InternalActivity,
  slot: number,
  hoursPerDay: number,
  teachersTimetable: Matrix2D<number>,
  subgroupsTimetable: Matrix2D<number>,
  _placedActivities: Map<number, { slot: number; duration: number }>
): ConstraintFitness {
  const conflictingActivities: number[] = [];
  const day = dayFromSlot(slot, hoursPerDay);
  const hour = hourFromSlot(slot, hoursPerDay);

  // Check all hours the activity would occupy
  for (let h = hour; h < hour + activity.duration; h++) {
    // Check teacher conflicts
    for (const teacherIndex of activity.teacherIndices) {
      const existingActivity = teachersTimetable[teacherIndex][day * hoursPerDay + h];
      if (existingActivity >= 0 && existingActivity !== activity.index) {
        if (!conflictingActivities.includes(existingActivity)) {
          conflictingActivities.push(existingActivity);
        }
      }
    }

    // Check subgroup conflicts
    for (const subgroupIndex of activity.subgroupIndices) {
      const existingActivity = subgroupsTimetable[subgroupIndex][day * hoursPerDay + h];
      if (existingActivity >= 0 && existingActivity !== activity.index) {
        if (!conflictingActivities.includes(existingActivity)) {
          conflictingActivities.push(existingActivity);
        }
      }
    }
  }

  return {
    satisfied: conflictingActivities.length === 0,
    weight: 100, // Basic compulsory has full weight
    conflictingActivities,
  };
}

/**
 * Evaluates break times constraint
 */
export function evaluateBreakTimes(
  activity: InternalActivity,
  slot: number,
  hoursPerDay: number,
  breakTimes: Set<number>
): ConstraintFitness {
  const hour = hourFromSlot(slot, hoursPerDay);
  const day = dayFromSlot(slot, hoursPerDay);

  for (let h = hour; h < hour + activity.duration; h++) {
    const timeSlot = day * hoursPerDay + h;
    if (breakTimes.has(timeSlot)) {
      return {
        satisfied: false,
        weight: 100,
        conflictingActivities: [],
      };
    }
  }

  return {
    satisfied: true,
    weight: 100,
    conflictingActivities: [],
  };
}

/**
 * Evaluates teacher not available times constraint
 */
export function evaluateTeacherNotAvailable(
  activity: InternalActivity,
  slot: number,
  hoursPerDay: number,
  teacherNotAvailable: Map<number, Set<number>>
): ConstraintFitness {
  const hour = hourFromSlot(slot, hoursPerDay);
  const day = dayFromSlot(slot, hoursPerDay);

  for (const teacherIndex of activity.teacherIndices) {
    const notAvailableTimes = teacherNotAvailable.get(teacherIndex);
    if (notAvailableTimes) {
      for (let h = hour; h < hour + activity.duration; h++) {
        const timeSlot = day * hoursPerDay + h;
        if (notAvailableTimes.has(timeSlot)) {
          return {
            satisfied: false,
            weight: 100,
            conflictingActivities: [],
          };
        }
      }
    }
  }

  return {
    satisfied: true,
    weight: 100,
    conflictingActivities: [],
  };
}

/**
 * Evaluates students set not available times constraint
 */
export function evaluateStudentsNotAvailable(
  activity: InternalActivity,
  slot: number,
  hoursPerDay: number,
  studentsNotAvailable: Map<number, Set<number>>
): ConstraintFitness {
  const hour = hourFromSlot(slot, hoursPerDay);
  const day = dayFromSlot(slot, hoursPerDay);

  for (const subgroupIndex of activity.subgroupIndices) {
    const notAvailableTimes = studentsNotAvailable.get(subgroupIndex);
    if (notAvailableTimes) {
      for (let h = hour; h < hour + activity.duration; h++) {
        const timeSlot = day * hoursPerDay + h;
        if (notAvailableTimes.has(timeSlot)) {
          return {
            satisfied: false,
            weight: 100,
            conflictingActivities: [],
          };
        }
      }
    }
  }

  return {
    satisfied: true,
    weight: 100,
    conflictingActivities: [],
  };
}

/**
 * Evaluates preferred starting time constraint
 */
export function evaluatePreferredStartingTime(
  activityIndex: number,
  slot: number,
  hoursPerDay: number,
  preferredTimes: Map<number, { day: number; hour: number; weight: number }[]>
): ConstraintFitness {
  const preferred = preferredTimes.get(activityIndex);
  if (!preferred || preferred.length === 0) {
    return { satisfied: true, weight: 0, conflictingActivities: [] };
  }

  const day = dayFromSlot(slot, hoursPerDay);
  const hour = hourFromSlot(slot, hoursPerDay);

  for (const pref of preferred) {
    if (pref.day === day && pref.hour === hour) {
      return { satisfied: true, weight: pref.weight, conflictingActivities: [] };
    }
  }

  // Not at a preferred time
  const maxWeight = Math.max(...preferred.map(p => p.weight));
  return {
    satisfied: maxWeight < 100,
    weight: maxWeight,
    conflictingActivities: [],
  };
}

/**
 * Evaluates room not available times constraint
 */
export function evaluateRoomNotAvailable(
  roomIndex: number,
  slot: number,
  duration: number,
  hoursPerDay: number,
  roomNotAvailable: Map<number, Set<number>>
): ConstraintFitness {
  const hour = hourFromSlot(slot, hoursPerDay);
  const day = dayFromSlot(slot, hoursPerDay);
  const notAvailableTimes = roomNotAvailable.get(roomIndex);
  
  if (!notAvailableTimes) {
    return { satisfied: true, weight: 100, conflictingActivities: [] };
  }

  for (let h = hour; h < hour + duration; h++) {
    const timeSlot = day * hoursPerDay + h;
    if (notAvailableTimes.has(timeSlot)) {
      return {
        satisfied: false,
        weight: 100,
        conflictingActivities: [],
      };
    }
  }

  return { satisfied: true, weight: 100, conflictingActivities: [] };
}

/**
 * Evaluates min days between activities constraint
 */
export function evaluateMinDaysBetween(
  activityIndex: number,
  slot: number,
  hoursPerDay: number,
  minDaysConstraints: Map<number, { otherActivities: number[]; minDays: number; weight: number }[]>,
  activitySlots: Map<number, number>
): ConstraintFitness {
  const constraints = minDaysConstraints.get(activityIndex);
  if (!constraints) {
    return { satisfied: true, weight: 0, conflictingActivities: [] };
  }

  const day = dayFromSlot(slot, hoursPerDay);
  const conflictingActivities: number[] = [];
  let minWeight = 0;

  for (const constraint of constraints) {
    for (const otherIndex of constraint.otherActivities) {
      if (otherIndex === activityIndex) continue;
      
      const otherSlot = activitySlots.get(otherIndex);
      if (otherSlot !== undefined && otherSlot >= 0) {
        const otherDay = dayFromSlot(otherSlot, hoursPerDay);
        const dayDiff = Math.abs(day - otherDay);
        
        if (dayDiff < constraint.minDays) {
          if (!conflictingActivities.includes(otherIndex)) {
            conflictingActivities.push(otherIndex);
          }
          minWeight = Math.max(minWeight, constraint.weight);
        }
      }
    }
  }

  return {
    satisfied: conflictingActivities.length === 0 || minWeight < 100,
    weight: minWeight,
    conflictingActivities,
  };
}

/**
 * Counts the number of constraint violations for a potential placement
 */
export function countConstraintViolations(
  activity: InternalActivity,
  slot: number,
  hoursPerDay: number,
  nDaysPerWeek: number,
  teachersTimetable: Matrix2D<number>,
  subgroupsTimetable: Matrix2D<number>,
  breakTimes: Set<number>,
  teacherNotAvailable: Map<number, Set<number>>,
  studentsNotAvailable: Map<number, Set<number>>
): { violations: number; conflictingActivities: number[] } {
  const hour = hourFromSlot(slot, hoursPerDay);

  // Check if activity fits in the day
  if (hour + activity.duration > hoursPerDay) {
    return { violations: Infinity, conflictingActivities: [] };
  }

  let violations = 0;
  const conflictingActivities: number[] = [];

  // Check break times
  const breakResult = evaluateBreakTimes(activity, slot, hoursPerDay, breakTimes);
  if (!breakResult.satisfied) {
    violations += 1000; // High penalty for break time violation
  }

  // Check teacher availability
  const teacherResult = evaluateTeacherNotAvailable(activity, slot, hoursPerDay, teacherNotAvailable);
  if (!teacherResult.satisfied) {
    violations += 1000;
  }

  // Check student availability
  const studentResult = evaluateStudentsNotAvailable(activity, slot, hoursPerDay, studentsNotAvailable);
  if (!studentResult.satisfied) {
    violations += 1000;
  }

  // Check basic compulsory (conflicts with other activities)
  const compulsoryResult = evaluateBasicCompulsoryTime(
    activity, slot, hoursPerDay, teachersTimetable, subgroupsTimetable, new Map()
  );
  violations += compulsoryResult.conflictingActivities.length;
  conflictingActivities.push(...compulsoryResult.conflictingActivities);

  return { violations, conflictingActivities };
}
