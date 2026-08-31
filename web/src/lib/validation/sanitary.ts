// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 4: Санітарний регламент preset.
//
// Legal basis: Санітарний регламент для закладів загальної середньої освіти,
// затверджений наказом МОЗ України №2205 від 25.09.2020, чинний з 01.01.2021.
// Джерело: https://zakon.rada.gov.ua/laws/show/z1111-20
//
// Only the numeric limits explicitly stated in МОЗ №2205 are encoded here.
// The superseded ДСанПіН 5.5.2.008-01 (2001) had additional rules (max lessons
// per day, subject difficulty scale, PE distribution, no-gaps rule); those
// were dropped in the 2020 regulation and MUST NOT be reintroduced from
// memory. If a school wants them back, that is a separate "класична
// педагогіка" preset, not this one.
//
// Violations are surfaced as WARNINGS only, never blocking issues, per the
// brief: real schools breach these routinely and the завуч must still be able
// to save the timetable she is required to produce.

import type { Activity, StudentsGroup, StudentsSubgroup, StudentsYear, TimetableRules } from '../../types';
import type { PreflightIssue } from './preflight';
import { createIdOrNameIndex, resolveByIdOrName } from '@/lib/studentSetLookup';

// Додаток 8 до Санітарного регламенту (МОЗ №2205, 2020).
// Гранично допустиме тижневе навчальне навантаження, в академічних годинах.
// Two columns: 5-day school week vs 6-day school week.
// Grade 12 tracks grade 11 (регламент covers "5-11(12)" as one row).
const WEEKLY_LOAD_MAX: Record<number, { fiveDay: number; sixDay: number }> = {
  1:  { fiveDay: 20.0, sixDay: 22.5 },
  2:  { fiveDay: 22.0, sixDay: 23.0 },
  3:  { fiveDay: 23.0, sixDay: 24.0 },
  4:  { fiveDay: 23.0, sixDay: 24.0 },
  5:  { fiveDay: 28.0, sixDay: 30.0 },
  6:  { fiveDay: 31.0, sixDay: 32.0 },
  7:  { fiveDay: 32.0, sixDay: 34.0 },
  8:  { fiveDay: 33.0, sixDay: 35.0 },
  9:  { fiveDay: 33.0, sixDay: 36.0 },
  10: { fiveDay: 33.0, sixDay: 36.0 },
  11: { fiveDay: 33.0, sixDay: 36.0 },
  12: { fiveDay: 33.0, sixDay: 36.0 },
};

// Extract grade number from a class name like "5-А", "10-Б", "1А", "11 клас".
// Returns null if no leading integer 1..12 can be read — regulation only
// covers grades 1-12, so anything else is out of scope for this check.
export function gradeFromName(name: string): number | null {
  const m = name.match(/^\s*(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

export interface SanitaryInput {
  rules: TimetableRules;
  activities: Activity[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  studentsYears?: StudentsYear[];
}

// Returns warnings (never blockers) about classes exceeding the МОЗ №2205
// weekly load limits.
export function runSanitaryChecks(input: SanitaryInput): PreflightIssue[] {
  const warnings: PreflightIssue[] = [];
  const { rules, activities, studentsGroups } = input;

  // МОЗ №2205 assumes a 5- or 6-day school week; anything else is not covered.
  const isFiveDay = rules.nDaysPerWeek === 5;
  const isSixDay = rules.nDaysPerWeek === 6;
  if (!isFiveDay && !isSixDay) return warnings;

  // Reuse the same class-load counting as preflight.ts: sum durations per
  // group, counting parallel subgroup activities (same activityGroupId) once.
  const groupById = new Map(studentsGroups.map((g) => [g.id, g]));
  const groupByIdOrName = createIdOrNameIndex(studentsGroups);
  const subgroupToGroup = new Map<string, string>();
  for (const g of studentsGroups) {
    for (const sgId of g.subgroups) subgroupToGroup.set(sgId, g.id);
  }

  const perClassLoad = new Map<string, number>();
  const seenGroupIdForClass = new Map<string, Set<number>>();
  for (const a of activities) {
    if (!a.active) continue;
    const affected = new Set<string>();
    for (const setId of a.studentSetIds) {
      if (groupById.has(setId)) affected.add(setId);
      else {
        const parent = subgroupToGroup.get(setId);
        if (parent) affected.add(parent);
        else {
          // Stream activities name a whole year — spread onto every group so
          // the sanitary check never silently misses them.
          const year = resolveByIdOrName(input.studentsYears ?? [], setId);
          if (year) {
            // `year.groups` may hold ids or names — see studentSetLookup.
            for (const groupIdOrName of year.groups) {
              const group = groupByIdOrName.get(groupIdOrName);
              if (group) affected.add(group.id);
            }
          }
        }
      }
    }
    for (const gid of affected) {
      if (a.activityGroupId > 0) {
        const seen = seenGroupIdForClass.get(gid) ?? new Set<number>();
        if (seen.has(a.activityGroupId)) continue;
        seen.add(a.activityGroupId);
        seenGroupIdForClass.set(gid, seen);
      }
      perClassLoad.set(gid, (perClassLoad.get(gid) ?? 0) + a.duration);
    }
  }

  for (const [gid, load] of perClassLoad) {
    const g = groupById.get(gid);
    if (!g) continue;
    const grade = gradeFromName(g.name);
    if (grade === null) continue;
    const limits = WEEKLY_LOAD_MAX[grade];
    if (!limits) continue;
    const cap = isFiveDay ? limits.fiveDay : limits.sixDay;
    if (load > cap) {
      warnings.push({
        code: 'SANITARY_WEEKLY_OVERLOAD',
        severity: 'warning',
        entity: { kind: 'class', id: g.id, name: g.name },
        message: `Клас ${g.name}: заплановано ${load} год/тиж, гранично допустиме навантаження за МОЗ №2205 (Додаток 8) для ${grade}-го класу при ${rules.nDaysPerWeek}-денному тижні — ${cap} год. Перевищення на ${(load - cap).toFixed(1)} год.`,
      });
    }
  }

  return warnings;
}
