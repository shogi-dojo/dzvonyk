// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import i18n from '@/i18n';

/**
 * Legacy school pattern for numbered period names written into
 * `hoursOfTheDay[].name`. Kept as a permanent fallback so names authored
 * before institution presets (or imported from school snapshots) still parse
 * inside every workspace.
 */
export const SCHOOL_LESSON_LABEL = /^(\d+)\s*(?:ур\.?|урок)$/iu;

export function formatTimetableDayLabel(dayName: string, compact = false): string {
  const label = dayName.trim();
  return compact ? label.slice(0, 3) : label;
}

export function formatTimetableLessonLabel(
  lessonNumber: number,
  compact = false
): string {
  return compact
    ? i18n.t('timetable.lessonLabelCompact', { count: lessonNumber })
    : i18n.t('timetable.lessonLabelFull', { count: lessonNumber });
}

/**
 * Renders a configured period name, canonicalizing recognized numbered labels.
 *
 * `lessonLabelPattern` — the active preset's own pattern. It is tried first,
 * merged with the legacy school pattern above, so e.g. «3 пара» parses in an
 * academic workspace while «1 урок» keeps parsing everywhere.
 */
export function formatConfiguredLessonLabel(
  label: string,
  compact = false,
  lessonLabelPattern?: RegExp
): string {
  const trimmed = label.trim();
  for (const pattern of [lessonLabelPattern, SCHOOL_LESSON_LABEL]) {
    if (!pattern) continue;
    const lessonMatch = trimmed.match(pattern);
    if (lessonMatch) {
      return formatTimetableLessonLabel(Number(lessonMatch[1]), compact);
    }
  }
  return trimmed;
}
