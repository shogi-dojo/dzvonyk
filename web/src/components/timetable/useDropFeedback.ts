import { useState, useMemo, useEffect, useCallback } from 'react';
import type {
  Activity,
  Teacher,
  Room,
  StudentsGroup,
  StudentsSubgroup,
  StudentsYear,
  TimeConstraint,
  TimetableRules,
  TimetableSolution,
} from '@/types';
import { validateSlotMove } from '@/lib/timetableGrid';
import type { DropFeedback } from './TimetableMatrix';

export interface UseDropFeedbackParams {
  currentSolution: TimetableSolution | null;
  rules: TimetableRules | null;
  activities: Activity[];
  teachers: Teacher[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  studentsYears?: StudentsYear[];
  rooms: Room[];
  timeConstraints: TimeConstraint[];
}

export function computeSlotVerdicts(
  activityId: string,
  params: {
    currentSolution: TimetableSolution;
    rules: TimetableRules;
    activities: Activity[];
    teachers: Teacher[];
    studentsGroups: StudentsGroup[];
    studentsSubgroups: StudentsSubgroup[];
    studentsYears?: StudentsYear[];
    rooms: Room[];
    timeConstraints: TimeConstraint[];
  }
): Map<string, { valid: boolean; reason?: string }> {
  const {
    currentSolution,
    rules,
    activities,
    teachers,
    studentsGroups,
    studentsSubgroups,
    studentsYears = [],
    rooms,
    timeConstraints,
  } = params;

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;
  const verdicts = new Map<string, { valid: boolean; reason?: string }>();

  for (let d = 0; d < nDays; d++) {
    for (let h = 0; h < nHours; h++) {
      const res = validateSlotMove({
        activityId,
        targetDay: d,
        targetHour: h,
        currentSolution,
        activities,
        teachers,
        studentsGroups,
        studentsSubgroups,
        studentsYears,
        rooms,
        timeConstraints,
        rules,
      });

      verdicts.set(`${d}|${h}`, { valid: res.valid, reason: res.reason });
    }
  }

  return verdicts;
}

export function useDropFeedback(params: UseDropFeedbackParams) {
  const {
    currentSolution,
    rules,
    activities,
    teachers,
    studentsGroups,
    studentsSubgroups,
    studentsYears = [],
    rooms,
    timeConstraints,
  } = params;

  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);

  const beginDrag = useCallback((activityId: string) => {
    setActiveActivityId(activityId);
  }, []);

  const endDrag = useCallback(() => {
    setActiveActivityId(null);
  }, []);

  const toggleSelect = useCallback((activityId: string) => {
    setActiveActivityId((prev) => (prev === activityId ? null : activityId));
  }, []);

  // Mark the document while a lesson is in hand so global CSS can kill text
  // selection everywhere, not just inside the grid.
  useEffect(() => {
    document.body.classList.toggle('matrix-dragging', Boolean(activeActivityId));
    return () => document.body.classList.remove('matrix-dragging');
  }, [activeActivityId]);

  // Handle Escape key to cancel drag or selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endDrag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [endDrag]);

  const dropFeedback = useMemo<DropFeedback | null>(() => {
    if (!activeActivityId || !currentSolution || !rules) {
      return null;
    }

    const verdicts = computeSlotVerdicts(activeActivityId, {
      currentSolution,
      rules,
      activities,
      teachers,
      studentsGroups,
      studentsSubgroups,
      studentsYears,
      rooms,
      timeConstraints,
    });

    return {
      activeActivityId,
      verdicts,
    };
  }, [
    activeActivityId,
    currentSolution,
    rules,
    activities,
    teachers,
    studentsGroups,
    studentsSubgroups,
    studentsYears,
    rooms,
    timeConstraints,
  ]);

  return {
    activeActivityId,
    dropFeedback,
    beginDrag,
    endDrag,
    toggleSelect,
    setActiveActivityId,
  };
}
