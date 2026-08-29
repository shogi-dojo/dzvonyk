// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type { Hour } from '@/types';

/**
 * Bell-schedule helpers for the period editor in Settings.
 *
 * A period carries a short label in `Hour.name` (shown in the grid) and its bell
 * range in `Hour.longName` (shown in print). Both are user-editable, and the
 * завуч routinely renames periods to «1 урок» — aSc's own dialog is
 * «Дзвоники / Перейменувати періоди» — so the label cannot be assumed to be a time.
 */

const TIME = /^\d{1,2}:\d{2}$/;
const RANGE = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/;
/** A half-filled range, e.g. «08:30 –» or «– 09:15», while one field is still empty. */
const PARTIAL_START = /^(\d{1,2}:\d{2})\s*[-–—]\s*$/;
const PARTIAL_END = /^\s*[-–—]\s*(\d{1,2}:\d{2})$/;

/**
 * Narrow a string to something `<input type="time">` will accept.
 *
 * The input silently blanks any value it cannot parse, so returning a label like
 * «1 урок» here would clear the field and lose the bell time with no error.
 */
export function asTimeValue(candidate: string): string {
  const trimmed = candidate.trim();
  return TIME.test(trimmed) ? trimmed : '';
}

/** Split a period's bell range into `[start, end]`, both safe for a time input. */
export function getHourRange(hour: Hour): [string, string] {
  const longName = hour.longName || '';

  const full = longName.match(RANGE);
  if (full) return [full[1], full[2]];

  // Half-filled states have to round-trip too: the завуч types the start, and
  // that value must survive until the end is typed.
  const startOnly = longName.match(PARTIAL_START);
  if (startOnly) return [startOnly[1], ''];
  const endOnly = longName.match(PARTIAL_END);
  if (endOnly) return ['', endOnly[1]];

  // Legacy rows stored only a start time in `name`; keep it when it is one.
  return [asTimeValue(hour.name), ''];
}

/**
 * Build the `longName` for a period from its two time inputs.
 *
 * A half-filled pair keeps its dash so `getHourRange` can read the value back —
 * a bare «08:30» would be indistinguishable from a period label. Returns
 * undefined only when both fields are empty, so print falls back to the name.
 */
export function formatHourRange(start: string, end: string): string | undefined {
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} –`;
  if (end) return `– ${end}`;
  return undefined;
}

/**
 * The time label to print for a period.
 *
 * Falls back to the period name for anything that is not a complete range, so a
 * half-finished edit never reaches the printed timetable as «08:30 –».
 */
export function hourTimeLabel(hour: Hour): string {
  const [start, end] = getHourRange(hour);
  if (start && end) return `${start} – ${end}`;
  return hour.name;
}
