import { describe, expect, it } from 'vitest';
import {
  generateClassPrintHtml,
  generateTeacherWorkloadPrintHtml,
  generateClassesWorkloadMatrixPrintHtml,
  generateSummaryClassesMatrixPrintHtml,
} from './printDocument';
import type { GridCell } from './timetableGrid';
import type { TimetableRules } from '../types';

describe('printDocument', () => {
  it('prints full bell ranges, alternating-week labels, subgroups, and activity tags', () => {
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
    const grid: GridCell[][] = [
      [
        [
          {
            activityId: 'a1',
            subject: 'Інформатика',
            teachers: ['Ткачук Ігор'],
            students: ['8-А, 1 група'],
            duration: 1,
            activityTags: ['Практика'],
            weekParity: 'numerator',
          },
        ],
      ],
    ];

    const html = generateClassPrintHtml('8-А', grid, rules);
    expect(html).toContain('08:30 – 09:15');
    expect(html).toContain('Чисельник');
    expect(html).toContain('1 група');
    expect(html).toContain('Практика');
    expect(html).toContain('Ткачук Ігор');
  });

  it('prints multi-subject itemized teacher workload report', () => {
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
    const teachers = [{ id: 't1', name: 'Сисова Оксана', targetNumberOfHours: 30, qualifiedSubjects: [] }];
    const subjects = [
      { id: 's1', name: 'Українська мова' },
      { id: 's2', name: 'Українська література' },
    ];
    const activities = [
      {
        id: 'a1',
        teacherIds: ['t1'],
        subjectId: 's1',
        studentSetIds: ['5-А'],
        duration: 4,
        active: true,
      },
      {
        id: 'a2',
        teacherIds: ['t1'],
        subjectId: 's2',
        studentSetIds: ['5-А'],
        duration: 2,
        active: true,
      },
    ];

    const html = generateTeacherWorkloadPrintHtml({
      rules,
      teachers,
      activities,
      subjects,
    });

    expect(html).toContain('Сисова Оксана');
    expect(html).toContain('Українська мова');
    expect(html).toContain('Українська література');
    expect(html).toContain('5-А (4)');
    expect(html).toContain('5-А (2)');
    expect(html).toContain('РАЗОМ ГОДИН ПО ЗАКЛАДУ:');
    expect(html).toContain('6');
  });

  it('generates consolidated classes workload parity matrix print html', () => {
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
    const groups = [
      { id: 'g1', name: '5-А', studentIds: [] },
      { id: 'g2', name: '5-Б', studentIds: [] },
    ];
    const activities = [
      {
        id: 'a1',
        teacherIds: ['t1'],
        subjectId: 's1',
        studentSetIds: ['5-А'],
        duration: 30,
        active: true,
      },
      {
        id: 'a2',
        teacherIds: ['t1'],
        subjectId: 's1',
        studentSetIds: ['5-А'],
        duration: 1,
        active: true,
        weekParity: 'numerator' as const,
      },
      {
        id: 'a3',
        teacherIds: ['t1'],
        subjectId: 's1',
        studentSetIds: ['5-Б'],
        duration: 30,
        active: true,
      },
    ];

    const html = generateClassesWorkloadMatrixPrintHtml({
      rules,
      groups,
      activities,
    });

    expect(html).toContain('ЗВЕДЕНЕ НАВАНТАЖЕННЯ КЛАСІВ ПО ТИЖНЯХ');
    expect(html).toContain('5-А');
    expect(html).toContain('5-Б');
    expect(html).toContain('30,5');
    expect(html).toContain('Різниця 1 год');
    expect(html).toContain('Збалансовано');
  });

  it('uses full matrix labels when space is available and compact labels on fixed paper sizes', () => {
    const rules: TimetableRules = {
      id: 'rules',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 1,
      nHoursPerDay: 1,
      daysOfTheWeek: [{ name: 'Понеділок' }],
      hoursOfTheDay: [{ name: '08:30', longName: '08:30 – 09:15' }],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };
    const params = {
      rules,
      solution: {
        id: 'solution',
        rulesId: 'rules',
        placements: [],
        conflicts: [],
        isComplete: true,
        generatedAt: new Date(),
      },
      activities: [],
      teachers: [],
      subjects: [],
      groups: [{ id: 'g1', name: '5-А', studentIds: [], subgroups: [] }],
      subgroups: [],
      rooms: [],
    };

    const autoHtml = generateSummaryClassesMatrixPrintHtml({
      ...params,
      options: { pageSize: 'auto' as const },
    });
    expect(autoHtml).toContain('<strong>Понеділок</strong>');
    expect(autoHtml).toContain('1 урок');

    const a4Html = generateSummaryClassesMatrixPrintHtml({
      ...params,
      options: { pageSize: 'a4' as const },
    });
    expect(a4Html).toContain('<strong>Пон</strong>');
    expect(a4Html).toContain('1 ур.');
  });
});
