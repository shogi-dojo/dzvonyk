import { describe, expect, it } from 'vitest';
import { generateClassPrintHtml } from './printDocument';
import type { GridCell } from './timetableGrid';
import type { TimetableRules } from '../types';

describe('printDocument', () => {
  it('prints full bell ranges and alternating-week labels', () => {
    const rules: TimetableRules = {
      id: 'rules',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 1,
      nHoursPerDay: 1,
      daysOfTheWeek: [{ name: 'Понеділок' }],
      hoursOfTheDay: [{ name: '1 урок', longName: '08:30 – 09:15' }],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };
    const grid: GridCell[][] = [[[{ activityId: 'a1', subject: 'Фізика', teachers: [], students: [], duration: 1, activityTags: [], weekParity: 'numerator' }]]];

    const html = generateClassPrintHtml('8-А', grid, rules);
    expect(html).toContain('08:30 – 09:15');
    expect(html).toContain('Чисельник');
  });
});
