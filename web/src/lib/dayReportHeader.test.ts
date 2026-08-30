// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { describe, expect, it } from 'vitest';
import {
  buildDayReportHeader,
  DEFAULT_SHIFT1_LABEL,
  DEFAULT_SHIFT2_LABEL,
} from './dayReportHeader';
import type { TimetableRules } from '@/types';

describe('dayReportHeader', () => {
  it('generates two shift rows when shifts are configured with overlapping ranges', () => {
    const rules: TimetableRules = {
      id: 'rules-1',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 5,
      nHoursPerDay: 8,
      daysOfTheWeek: [{ name: 'Пн' }],
      hoursOfTheDay: [
        { name: '1', longName: '08:30 – 09:15' },
        { name: '2', longName: '09:25 – 10:10' },
        { name: '3', longName: '10:20 – 11:05' },
        { name: '4', longName: '11:15 – 12:00' },
        { name: '5', longName: '12:15 – 13:00' },
        { name: '6', longName: '13:10 – 13:55' },
        { name: '7', longName: '14:05 – 14:50' },
        { name: '8', longName: '15:00 – 15:45' },
      ],
      shifts: {
        shift1: { firstHour: 0, lastHour: 4 },
        shift2: { firstHour: 3, lastHour: 7 },
      },
      modified: false,
      createdAt: '',
      updatedAt: '',
    };

    const header = buildDayReportHeader(rules);

    expect(header.lessonNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(header.shiftRows).toHaveLength(2);

    // Shift 1
    const shift1 = header.shiftRows[0];
    expect(shift1.label).toBe('I зміна');
    expect(shift1.cells).toHaveLength(8);
    expect(shift1.cells[0].timeLabel).toBe('08:30 – 09:15');
    expect(shift1.cells[4].timeLabel).toBe('12:15 – 13:00');
    expect(shift1.cells[5].timeLabel).toBeNull();
    expect(shift1.cells[6].timeLabel).toBeNull();
    expect(shift1.cells[7].timeLabel).toBeNull();

    // Shift 2
    const shift2 = header.shiftRows[1];
    expect(shift2.label).toBe('II зміна');
    expect(shift2.cells).toHaveLength(8);
    expect(shift2.cells[0].timeLabel).toBeNull();
    expect(shift2.cells[1].timeLabel).toBeNull();
    expect(shift2.cells[2].timeLabel).toBeNull();
    expect(shift2.cells[3].timeLabel).toBe('11:15 – 12:00');
    expect(shift2.cells[7].timeLabel).toBe('15:00 – 15:45');
  });

  it('generates a single row with label null when no shifts are configured', () => {
    const rules: TimetableRules = {
      id: 'rules-2',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 5,
      nHoursPerDay: 4,
      daysOfTheWeek: [{ name: 'Пн' }],
      hoursOfTheDay: [
        { name: '1', longName: '08:00 – 08:45' },
        { name: '2', longName: '08:55 – 09:40' },
        { name: '3', longName: '09:50 – 10:35' },
        { name: '4', longName: '10:45 – 11:30' },
      ],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };

    const header = buildDayReportHeader(rules);

    expect(header.lessonNumbers).toEqual([1, 2, 3, 4]);
    expect(header.shiftRows).toHaveLength(1);
    expect(header.shiftRows[0].label).toBeNull();
    expect(header.shiftRows[0].cells).toHaveLength(4);
    expect(header.shiftRows[0].cells[0].timeLabel).toBe('08:00 – 08:45');
    expect(header.shiftRows[0].cells[3].timeLabel).toBe('10:45 – 11:30');
    expect(header.shiftRows[0].cells.every((c) => c.timeLabel !== null)).toBe(true);
  });

  it('handles hoursOfTheDay shorter than nHoursPerDay with fallback hour names', () => {
    const rules: TimetableRules = {
      id: 'rules-3',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 5,
      nHoursPerDay: 5,
      daysOfTheWeek: [{ name: 'Пн' }],
      hoursOfTheDay: [
        { name: '1', longName: '08:30 – 09:15' },
        { name: '2', longName: '09:25 – 10:10' },
      ],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };

    const header = buildDayReportHeader(rules);

    expect(header.lessonNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(header.shiftRows[0].cells[0].timeLabel).toBe('08:30 – 09:15');
    expect(header.shiftRows[0].cells[1].timeLabel).toBe('09:25 – 10:10');
    expect(header.shiftRows[0].cells[2].timeLabel).toBe('3');
    expect(header.shiftRows[0].cells[3].timeLabel).toBe('4');
    expect(header.shiftRows[0].cells[4].timeLabel).toBe('5');
  });

  it('falls back to hour.name when longName is missing or partial', () => {
    const rules: TimetableRules = {
      id: 'rules-4',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 5,
      nHoursPerDay: 3,
      daysOfTheWeek: [{ name: 'Пн' }],
      hoursOfTheDay: [
        { name: '1 урок' },
        { name: '2 урок', longName: '09:25 –' }, // partial, not full range
        { name: '3 урок', longName: '10:20 – 11:05' },
      ],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };

    const header = buildDayReportHeader(rules);

    expect(header.shiftRows[0].cells[0].timeLabel).toBe('1 урок');
    expect(header.shiftRows[0].cells[1].timeLabel).toBe('2 урок');
    expect(header.shiftRows[0].cells[2].timeLabel).toBe('10:20 – 11:05');
  });

  it('labels each shift row so the two time rows can be told apart', () => {
    const rules = {
      id: 'r',
      mode: 0,
      institutionName: 'Тест',
      nDaysPerWeek: 1,
      nHoursPerDay: 3,
      daysOfTheWeek: [{ name: 'Понеділок' }],
      hoursOfTheDay: [
        { name: '1 урок', longName: '08:00 – 08:45' },
        { name: '2 урок', longName: '08:55 – 09:40' },
        { name: '3 урок', longName: '09:55 – 10:40' },
      ],
      shifts: {
        shift1: { firstHour: 0, lastHour: 1 },
        shift2: { firstHour: 1, lastHour: 2 },
      },
      modified: false,
      createdAt: '',
      updatedAt: '',
    } as unknown as TimetableRules;

    const header = buildDayReportHeader(rules);
    expect(header.shiftRows.map((r) => r.label)).toEqual([
      DEFAULT_SHIFT1_LABEL,
      DEFAULT_SHIFT2_LABEL,
    ]);

    // Callers with an i18n catalog supply their own names.
    const translated = buildDayReportHeader(rules, {
      shift1Label: 'First shift',
      shift2Label: 'Second shift',
    });
    expect(translated.shiftRows.map((r) => r.label)).toEqual([
      'First shift',
      'Second shift',
    ]);

    // Every row keeps one cell per lesson regardless of labelling.
    for (const row of translated.shiftRows) {
      expect(row.cells).toHaveLength(header.lessonNumbers.length);
    }
  });
});
