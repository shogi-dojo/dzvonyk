// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * The Ukrainian academic year, derived rather than hardcoded.
 *
 * It runs 1 September → 31 August, so a date in January–August belongs to the
 * year that started the previous September. Every institution used to be
 * created with a literal '2025-2026' label, which was wrong for anyone
 * creating one in a later year and silently rotted every 1 September.
 */

/** Month index (0-based) when the academic year rolls over: September. */
const ACADEMIC_YEAR_START_MONTH = 8;

/**
 * Formats the academic year containing `date`, e.g. «2026-2027».
 *
 * `date` is injectable so callers (and tests) never depend on the wall clock.
 */
export function formatAcademicYear(date: Date = new Date()): string {
  const startYear =
    date.getMonth() >= ACADEMIC_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}
