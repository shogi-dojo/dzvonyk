// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type { Activity, Teacher, Subject, StudentsGroup } from '@/types';

/**
 * Weekly load split by week parity.
 *
 * Ukrainian schools run half-lessons («половинки»): a lesson held only on
 * numerator weeks (чисельник) or only on denominator weeks (знаменник). A завуч
 * checks load per week and as an average — «в один тиждень 28, в іншому 27,
 * в середньому 27,5» — so a single integer cannot represent it.
 */
export interface WeeklyLoad {
  /** Hours on numerator weeks (чисельник). */
  numerator: number;
  /** Hours on denominator weeks (знаменник). */
  denominator: number;
  /** Mean across the two weeks; the half-integer the завуч quotes. */
  average: number;
  /** True when the two weeks differ, i.e. half-lessons are involved. */
  alternates: boolean;
}

export const EMPTY_LOAD: WeeklyLoad = {
  numerator: 0,
  denominator: 0,
  average: 0,
  alternates: false,
};

function toLoad(numerator: number, denominator: number): WeeklyLoad {
  return {
    numerator,
    denominator,
    average: (numerator + denominator) / 2,
    alternates: numerator !== denominator,
  };
}

/** Sum activity durations into a numerator/denominator pair. */
export function sumWeeklyLoad(activities: Iterable<Activity>): WeeklyLoad {
  let numerator = 0;
  let denominator = 0;
  for (const activity of activities) {
    if (!activity.active) continue;
    const duration = activity.duration || 1;
    // Undefined parity means the lesson runs every week, so it lands in both.
    if (activity.weekParity === 'numerator') numerator += duration;
    else if (activity.weekParity === 'denominator') denominator += duration;
    else {
      numerator += duration;
      denominator += duration;
    }
  }
  return toLoad(numerator, denominator);
}

/**
 * Format a load for display: «27,5» alone, or «27,5 (28/27)» when the weeks
 * differ. Ukrainian uses a comma as the decimal separator.
 */
export function formatWeeklyLoad(load: WeeklyLoad): string {
  const average = formatHours(load.average);
  if (!load.alternates) return average;
  return `${average} (${formatHours(load.numerator)}/${formatHours(load.denominator)})`;
}

/** Render an hour count without a trailing «,0» on whole numbers. */
export function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

export interface TeacherWorkloadSubjectItem {
  subjectId: string;
  subjectName: string;
  classesSummary: string; // e.g. "5-А (3,5), 5-Б (4), 6-А (4)"
  subjectLoad: WeeklyLoad;
  averageHours: number;
  formattedHours: string;
}

export interface TeacherWorkloadRow {
  index: number;
  id: string;
  name: string;
  longName?: string;
  code?: string;
  subjects: TeacherWorkloadSubjectItem[];
  totalLoad: WeeklyLoad;
  averageHours: number;
  targetHours?: number;
}

/**
 * Computes an itemized tariffication report breakdown for each teacher:
 * lists each distinct subject taught, the breakdown of classes with hours per class,
 * and individual subject load alongside overall teacher total.
 */
export function computeTeacherWorkloadReportData(params: {
  teachers: Teacher[];
  activities: Activity[];
  subjects: Subject[];
}): { rows: TeacherWorkloadRow[]; totalSchoolHours: number } {
  const { teachers, activities, subjects } = params;
  const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  const subMap = new Map(subjects.map((s) => [s.id, s]));

  const rows: TeacherWorkloadRow[] = sortedTeachers.map((teacher, index) => {
    const teacherActs = activities.filter(
      (a) => a.active && (a.teacherIds.includes(teacher.id) || a.teacherIds.includes(teacher.name))
    );

    // Group activities by subject
    const subjMap = new Map<string, Activity[]>();
    for (const act of teacherActs) {
      const list = subjMap.get(act.subjectId) || [];
      list.push(act);
      subjMap.set(act.subjectId, list);
    }

    const subjectItems: TeacherWorkloadSubjectItem[] = [];

    if (subjMap.size === 0) {
      subjectItems.push({
        subjectId: '',
        subjectName: '—',
        classesSummary: '—',
        subjectLoad: EMPTY_LOAD,
        averageHours: 0,
        formattedHours: '0',
      });
    } else {
      // Sort subjects alphabetically by Ukrainian name
      const sortedSubjectIds = Array.from(subjMap.keys()).sort((idA, idB) => {
        const nameA = subMap.get(idA)?.name || idA;
        const nameB = subMap.get(idB)?.name || idB;
        return nameA.localeCompare(nameB, 'uk');
      });

      for (const subjId of sortedSubjectIds) {
        const acts = subjMap.get(subjId) || [];
        const subjName = subMap.get(subjId)?.name || subjId;
        const subjLoad = sumWeeklyLoad(acts);

        // Group by distinct class / studentSet combination
        const classActsMap = new Map<string, Activity[]>();
        for (const act of acts) {
          const classKey = act.studentSetIds.join(', ') || '—';
          const list = classActsMap.get(classKey) || [];
          list.push(act);
          classActsMap.set(classKey, list);
        }

        const sortedClassKeys = Array.from(classActsMap.keys()).sort((a, b) => a.localeCompare(b, 'uk', { numeric: true }));
        const classBreakdowns = sortedClassKeys.map((cls) => {
          const clsActs = classActsMap.get(cls) || [];
          const clsLoad = sumWeeklyLoad(clsActs);
          return `${cls} (${formatWeeklyLoad(clsLoad)})`;
        });

        subjectItems.push({
          subjectId: subjId,
          subjectName: subjName,
          classesSummary: classBreakdowns.join(', ') || '—',
          subjectLoad: subjLoad,
          averageHours: subjLoad.average,
          formattedHours: formatWeeklyLoad(subjLoad),
        });
      }
    }

    const totalLoad = sumWeeklyLoad(teacherActs);

    return {
      index: index + 1,
      id: teacher.id,
      name: teacher.name,
      longName: teacher.longName,
      code: teacher.code,
      subjects: subjectItems,
      totalLoad,
      averageHours: totalLoad.average,
      targetHours: teacher.targetNumberOfHours,
    };
  });

  const totalSchoolHours = rows.reduce((sum, r) => sum + r.averageHours, 0);

  return { rows, totalSchoolHours };
}

export interface ClassWeeklyLoadSummary {
  id: string;
  name: string;
  longName?: string;
  load: WeeklyLoad;
  numerator: number;
  denominator: number;
  average: number;
  isBalanced: boolean;
  difference: number;
  formattedLoad: string;
  subjectsCount: number;
  activitiesCount: number;
}

/**
 * Computes weekly workload summaries for all classes (grades/groups)
 * comparing Numerator vs Denominator parity to identify parity imbalances.
 */
export function computeAllClassesWeeklyLoad(
  groups: StudentsGroup[],
  activities: Activity[]
): {
  classes: ClassWeeklyLoadSummary[];
  totalNumerator: number;
  totalDenominator: number;
  totalAverage: number;
} {
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }));

  const classes: ClassWeeklyLoadSummary[] = sortedGroups.map((group) => {
    const classActs = activities.filter(
      (a) =>
        a.active &&
        a.studentSetIds.some(
          (sid) => sid === group.id || sid === group.name || sid.startsWith(`${group.name},`) || sid.startsWith(`${group.name} `)
        )
    );

    const load = sumWeeklyLoad(classActs);
    const difference = Math.abs(load.numerator - load.denominator);
    const isBalanced = difference === 0;

    const uniqueSubjects = new Set(classActs.map((a) => a.subjectId));

    return {
      id: group.id,
      name: group.name,
      longName: group.longName,
      load,
      numerator: load.numerator,
      denominator: load.denominator,
      average: load.average,
      isBalanced,
      difference,
      formattedLoad: formatWeeklyLoad(load),
      subjectsCount: uniqueSubjects.size,
      activitiesCount: classActs.length,
    };
  });

  const totalNumerator = classes.reduce((sum, c) => sum + c.numerator, 0);
  const totalDenominator = classes.reduce((sum, c) => sum + c.denominator, 0);
  const totalAverage = classes.reduce((sum, c) => sum + c.average, 0);

  return {
    classes,
    totalNumerator,
    totalDenominator,
    totalAverage,
  };
}
