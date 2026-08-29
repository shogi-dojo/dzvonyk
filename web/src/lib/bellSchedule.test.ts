import { describe, expect, it } from 'vitest';
import { asTimeValue, getHourRange, formatHourRange, hourTimeLabel } from './bellSchedule';
import type { Hour } from '@/types';

/** Replays how the editor actually drives these helpers: read pair, write pair. */
function editPeriod(initial: Hour) {
  let hour = { ...initial };
  return {
    set(part: 'start' | 'end', value: string) {
      const [s, e] = getHourRange(hour);
      const start = part === 'start' ? value : s;
      const end = part === 'end' ? value : e;
      hour = { ...hour, longName: formatHourRange(start, end) };
    },
    get: () => hour,
  };
}

describe('bellSchedule', () => {
  it('reads a full bell range', () => {
    expect(getHourRange({ name: '1 урок', longName: '08:30 – 09:15' })).toEqual([
      '08:30',
      '09:15',
    ]);
  });

  it('accepts hyphen and em dash separators', () => {
    expect(getHourRange({ name: '1', longName: '08:30 - 09:15' })[1]).toBe('09:15');
    expect(getHourRange({ name: '1', longName: '08:30 — 09:15' })[1]).toBe('09:15');
  });

  it('keeps a legacy start-only name', () => {
    expect(getHourRange({ name: '08:00' })).toEqual(['08:00', '']);
  });

  // A renamed period must not leak its label into <input type="time">: the input
  // rejects it, blanking the field and losing the bell time with no error shown.
  it('never returns a non-time label as a time value', () => {
    expect(getHourRange({ name: 'Урок 1', longName: 'Урок 1' })).toEqual(['', '']);
    expect(asTimeValue('Урок 1')).toBe('');
    expect(asTimeValue(' 08:00 ')).toBe('08:00');
  });

  it('builds a complete range and clears an empty one', () => {
    expect(formatHourRange('08:30', '09:15')).toBe('08:30 – 09:15');
    expect(formatHourRange('', '')).toBeUndefined();
  });

  // Regression: typing the start used to store a bare «08:30», which reads back
  // as a period label rather than a time, so the start was lost the moment the
  // end was typed. Half-filled states keep their dash so they round-trip.
  it('keeps a half-entered time until the pair is complete', () => {
    const period = editPeriod({ name: '1 урок' });
    expect(getHourRange(period.get())).toEqual(['', '']);

    period.set('start', '08:30');
    expect(getHourRange(period.get())).toEqual(['08:30', '']);

    period.set('end', '09:15');
    expect(period.get().longName).toBe('08:30 – 09:15');
    expect(getHourRange(period.get())).toEqual(['08:30', '09:15']);
  });

  it('clearing both fields restores the name for print', () => {
    const period = editPeriod({ name: '1 урок', longName: '08:30 – 09:15' });
    period.set('start', '');
    period.set('end', '');
    expect(period.get().longName).toBeUndefined();
    expect(hourTimeLabel(period.get())).toBe('1 урок');
  });

  // Print must never show a dangling dash mid-edit.
  it('prints the period name for an incomplete range', () => {
    expect(hourTimeLabel({ name: '1 урок', longName: '08:30 –' })).toBe('1 урок');
    expect(hourTimeLabel({ name: '1 урок', longName: '08:30 – 09:15' })).toBe('08:30 – 09:15');
    expect(hourTimeLabel({ name: '08:00' })).toBe('08:00');
  });
});
