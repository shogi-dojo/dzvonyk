// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * The immutability rule for the institution type, in one place.
 *
 * The type shapes data (bell schedule, feature gates), not just labels, so it
 * cannot change once the workspace holds any entity. Both the Dashboard card
 * (whether to render at all) and the workspace manager (whether to accept the
 * write) gate on this same function.
 */
export interface InstitutionEntityCounts {
  teachers: number;
  subjects: number;
  activityTags: number;
  studentsYears: number;
  studentsGroups: number;
  studentsSubgroups: number;
  activities: number;
  buildings: number;
  rooms: number;
  timeConstraints: number;
  spaceConstraints: number;
  solutions: number;
}

export function canChangeInstitutionType(counts: InstitutionEntityCounts): boolean {
  return Object.values(counts).every((count) => count === 0);
}
