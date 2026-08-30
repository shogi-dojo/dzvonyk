import { describe, expect, it } from 'vitest';
import { generateClassPrintHtml, generateTeacherWorkloadPrintHtml } from './printDocument';
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

  it('prints alternating week teacher workload with fractional average and week split', () => {
    const rules: TimetableRules = {
      id: 'rules',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 5,
      nHoursPerDay: 7,
      daysOfTheWeek: [{ name: 'Понеділок' }],
      hoursOfTheDay: [{ name: '1 урок', longName: '08:30 – 09:15' }],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };
    const teachers = [{ id: 't1', name: 'Коваленко І. В.', targetNumberOfHours: 30, qualifiedSubjects: [] }];
    const subjects = [{ id: 's1', name: 'Математика' }];
    // 29 hours every week + 1 hour numerator only = 29.5 average (30 numerator / 29 denominator)
    const activities = [
      ...Array.from({ length: 29 }, (_, i) => ({
        id: `a-${i}`,
        teacherIds: ['t1'],
        subjectId: 's1',
        studentSetIds: ['5-А'],
        duration: 1,
        active: true,
      })),
      {
        id: 'a-half',
        teacherIds: ['t1'],
        subjectId: 's1',
        studentSetIds: ['5-А'],
        duration: 1,
        active: true,
        weekParity: 'numerator' as const,
      },
    ];

    const html = generateTeacherWorkloadPrintHtml({
      rules,
      teachers,
      activities,
      subjects,
    });

    expect(html).toContain('29,5 (30/29)');
    expect(html).toContain('РАЗОМ ГОДИН ПО ЗАКЛАДУ:');
    expect(html).toContain('29,5');
  });
});
