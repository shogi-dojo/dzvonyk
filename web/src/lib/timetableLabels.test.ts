import { describe, expect, it } from 'vitest';
import {
  formatConfiguredLessonLabel,
  formatTimetableDayLabel,
  formatTimetableLessonLabel,
} from './timetableLabels';

describe('timetable labels', () => {
  it('keeps full labels when the timetable has enough space', () => {
    expect(formatTimetableDayLabel('Понеділок')).toBe('Понеділок');
    expect(formatTimetableLessonLabel(1)).toBe('1 урок');
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
});
