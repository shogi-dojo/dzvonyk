export function formatTimetableDayLabel(dayName: string, compact = false): string {
  const label = dayName.trim();
  return compact ? label.slice(0, 3) : label;
}

export function formatTimetableLessonLabel(
  lessonNumber: number,
  compact = false
): string {
  return compact ? `${lessonNumber} ур.` : `${lessonNumber} урок`;
}

export function formatConfiguredLessonLabel(label: string, compact = false): string {
  const trimmed = label.trim();
  const lessonMatch = trimmed.match(/^(\d+)\s*(?:ур\.?|урок)$/iu);
  return lessonMatch
    ? formatTimetableLessonLabel(Number(lessonMatch[1]), compact)
    : trimmed;
}
