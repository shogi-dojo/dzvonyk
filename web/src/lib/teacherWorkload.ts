// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type {
  Activity,
  StudentsGroup,
  StudentsSubgroup,
  StudentsYear,
} from '@/types';
import { resolveByIdOrName } from '@/lib/studentSetLookup';

export type WorkloadWeekParity = 'both' | 'numerator' | 'denominator';

export interface WorkloadAudienceOption {
  key: string;
  kind: 'year' | 'group' | 'subgroup' | 'stream';
  name: string;
  parentName?: string;
  classCount: number;
  targetNames: string[];
}

export interface WorkloadSummaryRow {
  key: string;
  subjectName: string;
  weekParity: WorkloadWeekParity | 'mixed';
  schedule: WorkloadHoursByWeek;
  audienceKind: 'year' | 'group' | 'subgroup' | 'mixed';
  audienceName: string;
  classCount: number;
  hoursPerAudience: number;
  totalHours: number;
  activityIds: string[];
  targetNames: string[];
  manageable: boolean;
}

export interface WorkloadHoursByWeek {
  everyWeek: number;
  numerator: number;
  denominator: number;
}

function scheduleFor(parity: WorkloadWeekParity, hours: number): WorkloadHoursByWeek {
  return {
    everyWeek: parity === 'both' ? hours : 0,
    numerator: parity === 'numerator' ? hours : 0,
    denominator: parity === 'denominator' ? hours : 0,
  };
}

function parityForSchedule(schedule: WorkloadHoursByWeek): WorkloadSummaryRow['weekParity'] {
  const active = [schedule.everyWeek, schedule.numerator, schedule.denominator]
    .filter((hours) => hours > 0).length;
  if (active > 1) return 'mixed';
  if (schedule.numerator > 0) return 'numerator';
  if (schedule.denominator > 0) return 'denominator';
  return 'both';
}

/**
 * Build the audience choices used by the teacher-first workload editor.
 * A parallel expands to its classes because those lessons must be scheduled
 * separately; a class or subgroup remains one scheduling target.
 *
 * When `includeStreams` is on, each year also offers a stream: one activity
 * covering every group of the year simultaneously, counted once (classCount 1)
 * rather than multiplied per class.
 */
export function buildWorkloadAudienceOptions(
  years: StudentsYear[],
  groups: StudentsGroup[],
  subgroups: StudentsSubgroup[],
  options?: { includeStreams?: boolean }
): WorkloadAudienceOption[] {
  const audienceOptions: WorkloadAudienceOption[] = [];

  for (const year of years) {
    const yearGroups = year.groups
      .map((groupId) => resolveByIdOrName(groups, groupId))
      .filter((group): group is StudentsGroup => Boolean(group));

    if (options?.includeStreams && yearGroups.length > 0) {
      audienceOptions.push({
        key: `stream:${year.id}`,
        kind: 'stream',
        name: year.name,
        classCount: 1,
        targetNames: yearGroups.map((group) => group.name),
      });
    }

    audienceOptions.push({
      key: `year:${year.id}`,
      kind: 'year',
      name: year.name,
      classCount: yearGroups.length || 1,
      targetNames: yearGroups.length > 0 ? yearGroups.map((group) => group.name) : [year.name],
    });

    for (const group of yearGroups) {
      audienceOptions.push({
        key: `group:${group.id}`,
        kind: 'group',
        name: group.name,
        parentName: year.name,
        classCount: 1,
        targetNames: [group.name],
      });

      for (const subgroupId of group.subgroups) {
        const subgroup = resolveByIdOrName(subgroups, subgroupId);
        if (!subgroup) continue;
        audienceOptions.push({
          key: `subgroup:${subgroup.id}`,
          kind: 'subgroup',
          name: subgroup.name,
          parentName: group.name,
          classCount: 1,
          targetNames: [subgroup.name],
        });
      }
    }
  }

  // Keep orphaned sets usable after imperfect imports.
  for (const group of groups) {
    if (audienceOptions.some((option) => option.kind === 'group' && option.targetNames[0] === group.name)) continue;
    audienceOptions.push({
      key: `group:${group.id}`,
      kind: 'group',
      name: group.name,
      classCount: 1,
      targetNames: [group.name],
    });
  }
  for (const subgroup of subgroups) {
    if (audienceOptions.some((option) => option.kind === 'subgroup' && option.targetNames[0] === subgroup.name)) continue;
    audienceOptions.push({
      key: `subgroup:${subgroup.id}`,
      kind: 'subgroup',
      name: subgroup.name,
      classCount: 1,
      targetNames: [subgroup.name],
    });
  }

  return audienceOptions;
}

export interface CreateTeacherWorkloadInput {
  teacherName: string;
  subjectName: string;
  targetNames: string[];
  weeklyHours: number;
  weekParity: WorkloadWeekParity;
  idFactory: () => string;
}

/** Create one-hour activities so each weekly lesson can be placed independently. */
export function createTeacherWorkloadActivities({
  teacherName,
  subjectName,
  targetNames,
  weeklyHours,
  weekParity,
  idFactory,
}: CreateTeacherWorkloadInput): Activity[] {
  const hours = Math.max(0, Math.floor(weeklyHours));
  const parity = weekParity === 'both' ? undefined : weekParity;
  const activities: Activity[] = [];

  for (const targetName of targetNames) {
    for (let hour = 0; hour < hours; hour += 1) {
      activities.push({
        id: idFactory(),
        activityGroupId: 0,
        teacherIds: [teacherName],
        subjectId: subjectName,
        activityTagIds: [],
        studentSetIds: [targetName],
        duration: 1,
        totalDuration: 1,
        active: true,
        computeNTotalStudents: true,
        nTotalStudents: 0,
        weekParity: parity,
      });
    }
  }

  return activities;
}

export function workloadAverageHours(hours: WorkloadHoursByWeek): number {
  return hours.everyWeek + (hours.numerator + hours.denominator) / 2;
}

export interface ReplaceTeacherWorkloadInput {
  teacherName: string;
  subjectName: string;
  targetNames: string[];
  hours: WorkloadHoursByWeek;
  templates: Activity[];
  idFactory: () => string;
}

/**
 * Rebuild a summarized workload row while retaining useful advanced metadata
 * from the original activities. New ids intentionally invalidate old solution
 * placements: changing the audience or weekly pattern requires regeneration.
 */
export function createReplacementWorkloadActivities({
  teacherName,
  subjectName,
  targetNames,
  hours,
  templates,
  idFactory,
}: ReplaceTeacherWorkloadInput): Activity[] {
  const normalized: Array<{ parity: WorkloadWeekParity; count: number }> = [
    { parity: 'both', count: Math.max(0, Math.floor(hours.everyWeek)) },
    { parity: 'numerator', count: Math.max(0, Math.floor(hours.numerator)) },
    { parity: 'denominator', count: Math.max(0, Math.floor(hours.denominator)) },
  ];
  const fallbackTemplate = templates[0];
  const replacements: Activity[] = [];

  for (const targetName of targetNames) {
    const template = templates.find(
      (activity) => activity.studentSetIds.length === 1 && activity.studentSetIds[0] === targetName,
    ) ?? fallbackTemplate;

    for (const { parity, count } of normalized) {
      for (let hour = 0; hour < count; hour += 1) {
        replacements.push({
          id: idFactory(),
          activityGroupId: 0,
          teacherIds: [teacherName],
          subjectId: subjectName,
          activityTagIds: [...(template?.activityTagIds ?? [])],
          studentSetIds: [targetName],
          duration: 1,
          totalDuration: 1,
          active: true,
          computeNTotalStudents: template?.computeNTotalStudents ?? true,
          nTotalStudents: template?.nTotalStudents ?? 0,
          comments: template?.comments,
          shiftOverride: template?.shiftOverride,
          weekParity: parity === 'both' ? undefined : parity,
        });
      }
    }
  }

  return replacements;
}

interface TargetAggregate {
  key: string;
  subjectName: string;
  weekParity: WorkloadWeekParity;
  targetName: string;
  hours: number;
  activityIds: string[];
}

/**
 * Summarize a teacher's low-level activities for workload entry. Identical
 * assignments covering every class of a parallel become one row instead of
 * repeating once per class.
 */
export function summarizeTeacherWorkload(
  teacherId: string,
  teacherName: string,
  activities: Activity[],
  years: StudentsYear[],
  groups: StudentsGroup[],
  subgroups: StudentsSubgroup[],
): WorkloadSummaryRow[] {
  const teacherActivities = activities.filter(
    (activity) => activity.active && activity.teacherIds.some((id) => id === teacherId || id === teacherName),
  );
  const singleTarget = new Map<string, TargetAggregate>();
  const rows: WorkloadSummaryRow[] = [];

  for (const activity of teacherActivities) {
    const weekParity = activity.weekParity ?? 'both';
    if (activity.studentSetIds.length !== 1) {
      rows.push({
        key: `activity:${activity.id}`,
        subjectName: activity.subjectId,
        weekParity,
        schedule: scheduleFor(weekParity, activity.duration),
        audienceKind: 'mixed',
        audienceName: activity.studentSetIds.join(', '),
        classCount: 1,
        hoursPerAudience: activity.duration,
        totalHours: activity.duration,
        activityIds: [activity.id],
        targetNames: [...activity.studentSetIds],
        manageable: false,
      });
      continue;
    }

    const targetName = activity.studentSetIds[0];
    const key = `${activity.subjectId}\u0000${weekParity}\u0000${targetName}`;
    const aggregate = singleTarget.get(key) ?? {
      key,
      subjectName: activity.subjectId,
      weekParity,
      targetName,
      hours: 0,
      activityIds: [],
    };
    aggregate.hours += activity.duration;
    aggregate.activityIds.push(activity.id);
    singleTarget.set(key, aggregate);
  }

  const usedKeys = new Set<string>();
  for (const year of years) {
    const yearGroups = year.groups
      .map((groupId) => resolveByIdOrName(groups, groupId))
      .filter((group): group is StudentsGroup => Boolean(group));
    if (yearGroups.length < 2) continue;

    const signatures = new Set(
      [...singleTarget.values()]
        .filter((aggregate) => yearGroups.some((group) => group.name === aggregate.targetName))
        .map((aggregate) => `${aggregate.subjectName}\u0000${aggregate.weekParity}`),
    );

    for (const signature of signatures) {
      const [subjectName, weekParity] = signature.split('\u0000') as [string, WorkloadWeekParity];
      const matches = yearGroups.map((group) =>
        singleTarget.get(`${subjectName}\u0000${weekParity}\u0000${group.name}`),
      );
      if (matches.some((match) => !match)) continue;
      const completeMatches = matches as TargetAggregate[];
      const hoursPerAudience = completeMatches[0].hours;
      if (!completeMatches.every((match) => match.hours === hoursPerAudience)) continue;

      completeMatches.forEach((match) => usedKeys.add(match.key));
      rows.push({
        key: `year:${year.id}:${signature}`,
        subjectName,
        weekParity,
        schedule: scheduleFor(weekParity, hoursPerAudience),
        audienceKind: 'year',
        audienceName: year.name,
        classCount: yearGroups.length,
        hoursPerAudience,
        totalHours: hoursPerAudience * yearGroups.length,
        activityIds: completeMatches.flatMap((match) => match.activityIds),
        targetNames: yearGroups.map((group) => group.name),
        manageable: true,
      });
    }
  }

  const subgroupParents = new Map<string, string>();
  for (const group of groups) {
    for (const subgroupId of group.subgroups) {
      const subgroup = resolveByIdOrName(subgroups, subgroupId);
      if (subgroup) subgroupParents.set(subgroup.name, group.name);
    }
  }

  for (const aggregate of singleTarget.values()) {
    if (usedKeys.has(aggregate.key)) continue;
    const year = resolveByIdOrName(years, aggregate.targetName);
    const group = resolveByIdOrName(groups, aggregate.targetName);
    const subgroup = resolveByIdOrName(subgroups, aggregate.targetName);
    const parentName = subgroup ? subgroupParents.get(subgroup.name) : undefined;
    rows.push({
      key: aggregate.key,
      subjectName: aggregate.subjectName,
      weekParity: aggregate.weekParity,
      schedule: scheduleFor(aggregate.weekParity, aggregate.hours),
      audienceKind: year ? 'year' : group ? 'group' : subgroup ? 'subgroup' : 'mixed',
      audienceName: parentName ? `${parentName} · ${aggregate.targetName}` : aggregate.targetName,
      classCount: 1,
      hoursPerAudience: aggregate.hours,
      totalHours: aggregate.hours,
      activityIds: aggregate.activityIds,
      targetNames: [aggregate.targetName],
      manageable: true,
    });
  }

  const merged = new Map<string, WorkloadSummaryRow>();
  for (const row of rows) {
    if (!row.manageable) {
      row.hoursPerAudience = workloadAverageHours(row.schedule);
      row.totalHours = row.hoursPerAudience * row.classCount;
      merged.set(row.key, row);
      continue;
    }
    const mergeKey = `${row.subjectName}\u0000${[...row.targetNames].sort().join('\u0001')}`;
    const existing = merged.get(mergeKey);
    if (!existing) {
      const hoursPerAudience = workloadAverageHours(row.schedule);
      merged.set(mergeKey, {
        ...row,
        key: `workload:${mergeKey}`,
        hoursPerAudience,
        totalHours: hoursPerAudience * row.classCount,
      });
      continue;
    }
    existing.schedule = {
      everyWeek: existing.schedule.everyWeek + row.schedule.everyWeek,
      numerator: existing.schedule.numerator + row.schedule.numerator,
      denominator: existing.schedule.denominator + row.schedule.denominator,
    };
    existing.weekParity = parityForSchedule(existing.schedule);
    existing.hoursPerAudience = workloadAverageHours(existing.schedule);
    existing.totalHours = existing.hoursPerAudience * existing.classCount;
    existing.activityIds.push(...row.activityIds);
  }

  return [...merged.values()].sort((left, right) =>
    left.subjectName.localeCompare(right.subjectName, 'uk') ||
    left.audienceName.localeCompare(right.audienceName, 'uk') ||
    left.weekParity.localeCompare(right.weekParity),
  );
}
