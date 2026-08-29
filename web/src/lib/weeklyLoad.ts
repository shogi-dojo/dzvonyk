// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type { Activity } from '@/types';

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
    const duration = activity.duration;
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
