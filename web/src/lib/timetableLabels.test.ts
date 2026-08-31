import { describe, expect, it } from 'vitest';
import {
  SCHOOL_LESSON_LABEL,
  formatConfiguredLessonLabel,
  formatTimetableDayLabel,
  formatTimetableLessonLabel,
} from './timetableLabels';
import { INSTITUTION_PRESETS } from './institution/presets';

describe('timetable labels', () => {
  it('keeps full labels when the timetable has enough space', () => {
    expect(formatTimetableDayLabel('Понеділок')).toBe('Понеділок');
    expect(formatTimetableLessonLabel(1)).toBe('1 урок');
    // Ordinals, not counts: the label must stay «N урок» for every period.
    expect(formatTimetableLessonLabel(2)).toBe('2 урок');
    expect(formatTimetableLessonLabel(5)).toBe('5 урок');
    expect(formatConfiguredLessonLabel('1 ур.')).toBe('1 урок');
    expect(formatConfiguredLessonLabel('08:30')).toBe('08:30');
  });

  it('uses three-character Ukrainian day labels in compact layouts', () => {
    expect(formatTimetableDayLabel('Понеділок', true)).toBe('Пон');
    expect(formatTimetableDayLabel('Вівторок', true)).toBe('Вів');
    expect(formatTimetableDayLabel('Середа', true)).toBe('Сер');
    expect(formatTimetableDayLabel('Четвер', true)).toBe('Чет');
    expect(formatTimetableDayLabel('Пʼятниця', true)).toBe('Пʼя');
    expect(formatTimetableLessonLabel(1, true)).toBe('1 ур.');
    expect(formatConfiguredLessonLabel('1 урок', true)).toBe('1 ур.');
  });

  it('parses academic period names when the university preset pattern is given', () => {
    const academic = INSTITUTION_PRESETS.university.lessonLabelPattern;
    expect(formatConfiguredLessonLabel('3 пара', false, academic)).toBe('3 урок');
    expect(formatConfiguredLessonLabel('3 пара', true, academic)).toBe('3 ур.');
    expect(formatConfiguredLessonLabel('4 пари', true, academic)).toBe('4 ур.');
    expect(formatConfiguredLessonLabel('2 пар.', true, academic)).toBe('2 ур.');
  });

  it('still parses legacy school hour names inside academic workspaces', () => {
    const academic = INSTITUTION_PRESETS.university.lessonLabelPattern;
    // Legacy data: hours authored by the school preset keep parsing even when
    // the merged academic pattern cannot match them.
    expect(formatConfiguredLessonLabel('1 урок', false, academic)).toBe('1 урок');
    expect(formatConfiguredLessonLabel('7 урок', true, academic)).toBe('7 ур.');
    expect(formatConfiguredLessonLabel('1 ур.', false, academic)).toBe('1 урок');
    expect(formatConfiguredLessonLabel('1 урок', true)).toBe('1 ур.');
    expect(SCHOOL_LESSON_LABEL.test('1 урок')).toBe(true);
  });
});
