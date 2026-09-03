// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * Resolving a student set that may be referenced by id OR by name.
 *
 * FET-derived data is not consistent about this. `StudentsYear.groups` and
 * `StudentsGroup.subgroups` are typed as id arrays, but both importers write
 * NAMES into them (see fetParser's parseStudentsYears and rozParser), while
 * data created inside the app writes ids. The engine has always accepted
 * either form; anything that walks the same references must do the same or it
 * silently drops every imported timetable's streams and splits.
 *
 * Keeping this in one place is deliberate: three separate copies of this rule
 * had already drifted apart, and the copy that only matched ids made imported
 * stream activities invisible to the capacity checks.
 */

export interface IdentifiableSet {
  id: string;
  name: string;
}

/**
 * Linear lookup — for one-off resolution where building an index would cost
 * more than the scan.
 */
export function resolveByIdOrName<T extends IdentifiableSet>(
  values: T[],
  idOrName: string,
): T | undefined {
  return values.find((value) => value.id === idOrName || value.name === idOrName);
}

/**
 * An index for resolving many references against the same collection, e.g.
 * inside a per-activity loop. Ids win over names, so a group named after
 * another group's id can never shadow it.
 */
export function createIdOrNameIndex<T extends IdentifiableSet>(values: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const value of values) {
    if (!index.has(value.name)) index.set(value.name, value);
  }
  for (const value of values) {
    index.set(value.id, value);
  }
  return index;
}
