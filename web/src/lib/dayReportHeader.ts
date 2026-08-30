// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type { TimetableRules } from '@/types';
import { hourTimeLabel } from './bellSchedule';
import { formatTimetableLessonLabel } from './timetableLabels';

export interface DayReportHeaderCell {
  lessonLabel: string;
  timeLabel: string | null;
}

export interface DayReportHeaderRow {
  label: string | null;
  cells: DayReportHeaderCell[];
}

/**
 * Default shift names. Print output is hardcoded Ukrainian (as in printDocument.ts),
 * while the UI passes translated labels through `options`.
 */
export const DEFAULT_SHIFT1_LABEL = 'I зміна';
export const DEFAULT_SHIFT2_LABEL = 'II зміна';

export interface DayReportHeaderOptions {
  shift1Label?: string;
  shift2Label?: string;
}

export interface DayReportHeader {
  lessonNumbers: number[];
  shiftRows: DayReportHeaderRow[];
}

/**
 * Builds the structured header definition for daily timetable reports.
 * If shifts are configured in rules, returns two shift rows with bell schedule
 * time labels populated only within each shift's active range [firstHour, lastHour].
 * Without shifts, returns a single row with label: null and all time labels filled.
 */
export function buildDayReportHeader(
  rules: TimetableRules,
  options: DayReportHeaderOptions = {}
): DayReportHeader {
  const {
    shift1Label = DEFAULT_SHIFT1_LABEL,
    shift2Label = DEFAULT_SHIFT2_LABEL,
  } = options;

  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;
  const lessonNumbers = Array.from({ length: nHours }, (_, i) => i + 1);

  if (rules.shifts?.shift1 || rules.shifts?.shift2) {
    const shiftRows: DayReportHeaderRow[] = [];

    if (rules.shifts.shift1) {
      shiftRows.push({
        label: shift1Label,
        cells: Array.from({ length: nHours }, (_, h) => ({
          lessonLabel: formatTimetableLessonLabel(h + 1),
          timeLabel:
            h >= rules.shifts!.shift1.firstHour && h <= rules.shifts!.shift1.lastHour
              ? hourTimeLabel(rules.hoursOfTheDay?.[h] ?? { name: `${h + 1}` })
              : null,
        })),
      });
    }

    if (rules.shifts.shift2) {
      shiftRows.push({
        label: shift2Label,
        cells: Array.from({ length: nHours }, (_, h) => ({
          lessonLabel: formatTimetableLessonLabel(h + 1),
          timeLabel:
            h >= rules.shifts!.shift2.firstHour && h <= rules.shifts!.shift2.lastHour
              ? hourTimeLabel(rules.hoursOfTheDay?.[h] ?? { name: `${h + 1}` })
              : null,
        })),
      });
    }

    return {
      lessonNumbers,
      shiftRows,
    };
  }

  return {
    lessonNumbers,
    shiftRows: [
      {
        label: null,
        cells: Array.from({ length: nHours }, (_, h) => ({
          lessonLabel: formatTimetableLessonLabel(h + 1),
          timeLabel: hourTimeLabel(rules.hoursOfTheDay?.[h] ?? { name: `${h + 1}` }),
        })),
      },
    ],
  };
}
