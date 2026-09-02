import { describe, expect, it } from 'vitest';
import {
  generateClassPrintHtml,
  generateTeacherWorkloadPrintHtml,
  generateClassesWorkloadMatrixPrintHtml,
  generateSummaryClassesMatrixPrintHtml,
  generateDailyMatrixPrintHtml,
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

  describe('generateDailyMatrixPrintHtml', () => {
    it('generates N sheets for N days with N-1 page-breaks and correct day titles', () => {
      const rules: TimetableRules = {
        id: 'rules',
        mode: 0,
        institutionName: 'Тестова гімназія',
        nDaysPerWeek: 3,
        nHoursPerDay: 4,
        daysOfTheWeek: [{ name: 'Понеділок' }, { name: 'Вівторок' }, { name: 'Середа' }],
        hoursOfTheDay: [
          { name: '1', longName: '08:30 – 09:15' },
          { name: '2', longName: '09:25 – 10:10' },
          { name: '3', longName: '10:20 – 11:05' },
          { name: '4', longName: '11:15 – 12:00' },
        ],
        modified: false,
        createdAt: '',
        updatedAt: '',
      };

      const teachers = [{ id: 't1', name: 'Сисова Оксана' }];
      const groups = [{ id: 'g1', name: '5-А', studentIds: [], subgroups: [] }];
      const subjects = [{ id: 's1', name: 'Математика' }];
      const activities = [
        {
          id: 'a1',
          teacherIds: ['t1'],
          subjectId: 's1',
          studentSetIds: ['5-А'],
          duration: 1,
          active: true,
        },
      ];
      const solution = {
        id: 'sol-1',
        rulesId: 'rules',
        placements: [{ activityId: 'a1', day: 0, hour: 1 }],
        conflicts: [],
        isComplete: true,
        generatedAt: new Date(),
      };

      const html = generateDailyMatrixPrintHtml({
        rowAxis: 'teachers',
        solution,
        rules,
        activities,
        teachers,
        subjects,
        groups,
        subgroups: [],
        rooms: [],
      });

      // Exactly 3 day sheets
      const sheetMatches = html.match(/class="sheet day-sheet/g);
      expect(sheetMatches).toHaveLength(3);

      // Exactly 2 page-break classes on sheets (N-1)
      const pageBreakMatches = html.match(/class="sheet[^"]*page-break/g);
      expect(pageBreakMatches).toHaveLength(2);

      // Headers for all days
      expect(html).toContain('РОЗКЛАД УРОКІВ — ПОНЕДІЛОК');
      expect(html).toContain('РОЗКЛАД УРОКІВ — ВІВТОРОК');
      expect(html).toContain('РОЗКЛАД УРОКІВ — СЕРЕДА');
    });

    it('places activity in correct day/hour and renders student class for teachers vs subject for classes', () => {
      const rules: TimetableRules = {
        id: 'rules',
        mode: 0,
        institutionName: 'Тестова школа',
        nDaysPerWeek: 2,
        nHoursPerDay: 3,
        daysOfTheWeek: [{ name: 'Понеділок' }, { name: 'Вівторок' }],
        hoursOfTheDay: [
          { name: '1', longName: '08:30 – 09:15' },
          { name: '2', longName: '09:25 – 10:10' },
          { name: '3', longName: '10:20 – 11:05' },
        ],
        modified: false,
        createdAt: '',
        updatedAt: '',
      };

      const teachers = [{ id: 't1', name: 'Петренко Іван' }];
      const groups = [{ id: 'g1', name: '10-Б', studentIds: [], subgroups: [] }];
      const subjects = [{ id: 's1', name: 'Фізика' }];
      const rooms = [{ id: 'r1', name: '302' }];
      const activities = [
        {
          id: 'a1',
          teacherIds: ['t1'],
          subjectId: 's1',
          studentSetIds: ['10-Б'],
          duration: 1,
          active: true,
        },
      ];
      // Activity is placed on Day 0 (Понеділок), Hour 1 (2 урок)
      const solution = {
        id: 'sol-1',
        rulesId: 'rules',
        placements: [{ activityId: 'a1', day: 0, hour: 1, roomId: 'r1' }],
        conflicts: [],
        isComplete: true,
        generatedAt: new Date(),
      };

      // 1. rowAxis === 'teachers': shows student class name ('10-Б') and room
      const teacherHtml = generateDailyMatrixPrintHtml({
        rowAxis: 'teachers',
        solution,
        rules,
        activities,
        teachers,
        subjects,
        groups,
        subgroups: [],
        rooms,
      });

      expect(teacherHtml).toContain('Петренко');
      expect(teacherHtml).toContain('І.');
      expect(teacherHtml).toContain('10-Б');
      expect(teacherHtml).toContain('каб. 302');

      // 2. rowAxis === 'classes': shows subject name ('Фізика') and room
      const classHtml = generateDailyMatrixPrintHtml({
        rowAxis: 'classes',
        solution,
        rules,
        activities,
        teachers,
        subjects,
        groups,
        subgroups: [],
        rooms,
      });

      expect(classHtml).toContain('10-Б');
      expect(classHtml).toContain('Фізика');
      expect(classHtml).toContain('каб. 302');
    });

    it('renders two shift rows when shifts are configured and one when not', () => {
      const rulesWithShifts: TimetableRules = {
        id: 'rules-shifts',
        mode: 0,
        institutionName: 'Школа зі змінами',
        nDaysPerWeek: 1,
        nHoursPerDay: 4,
        daysOfTheWeek: [{ name: 'Понеділок' }],
        hoursOfTheDay: [
          { name: '1', longName: '08:00 – 08:45' },
          { name: '2', longName: '08:55 – 09:40' },
          { name: '3', longName: '12:00 – 12:45' },
          { name: '4', longName: '12:55 – 13:40' },
        ],
        shifts: {
          shift1: { firstHour: 0, lastHour: 1 },
          shift2: { firstHour: 2, lastHour: 3 },
        },
        modified: false,
        createdAt: '',
        updatedAt: '',
      };

      const solution = {
        id: 'sol',
        rulesId: 'rules-shifts',
        placements: [],
        conflicts: [],
        isComplete: true,
        generatedAt: new Date(),
      };

      const htmlWithShifts = generateDailyMatrixPrintHtml({
        rowAxis: 'teachers',
        solution,
        rules: rulesWithShifts,
        activities: [],
        teachers: [{ id: 't1', name: 'Сисова Оксана' }],
        subjects: [],
        groups: [],
        subgroups: [],
        rooms: [],
      });

      const shiftRowsCount = (htmlWithShifts.match(/class="tr-shift-time"/g) || []).length;
      expect(shiftRowsCount).toBe(2);

      const rulesNoShifts: TimetableRules = {
        ...rulesWithShifts,
        shifts: undefined,
      };

      const htmlNoShifts = generateDailyMatrixPrintHtml({
        rowAxis: 'teachers',
        solution,
        rules: rulesNoShifts,
        activities: [],
        teachers: [{ id: 't1', name: 'Сисова Оксана' }],
        subjects: [],
        groups: [],
        subgroups: [],
        rooms: [],
      });

      const noShiftRowsCount = (htmlNoShifts.match(/class="tr-shift-time"/g) || []).length;
      expect(noShiftRowsCount).toBe(1);

      // Two unlabelled rows of bell times are unreadable: the завуч cannot tell
      // which row is which shift. Each shift row must name itself.
      expect(htmlWithShifts).toContain('I зміна');
      expect(htmlWithShifts).toContain('II зміна');
      const shiftLabelCount = (htmlWithShifts.match(/class="th-shift-label"/g) || []).length;
      expect(shiftLabelCount).toBe(2);

      // A single unnamed row carries no label cell, so the axis header spans it.
      // Scope to the table head: the class name always exists in the <style> block.
      const noShiftThead = htmlNoShifts.slice(
        htmlNoShifts.indexOf('<thead>'),
        htmlNoShifts.indexOf('</thead>')
      );
      expect(noShiftThead).not.toContain('th-shift-label');
      expect(noShiftThead).toContain('rowspan="2"');
    });

    it('keeps every header row the same column count when shifts are labelled', () => {
      const rules: TimetableRules = {
        id: 'rules-geom',
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
      };

      const html = generateDailyMatrixPrintHtml({
        rowAxis: 'teachers',
        solution: {
          id: 'sol',
          rulesId: 'rules-geom',
          placements: [],
          conflicts: [],
          isComplete: true,
          generatedAt: new Date(),
        },
        rules,
        activities: [],
        teachers: [{ id: 't1', name: 'Сисова Оксана Григорівна' }],
        subjects: [],
        groups: [],
        subgroups: [],
        rooms: [],
      });

      const thead = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
      const headerRows = thead.split('<tr').slice(1);
      expect(headerRows).toHaveLength(3);

      // Row 1: axis header + 3 lesson numbers. Rows 2-3: shift label + 3 times.
      for (const row of headerRows) {
        expect((row.match(/<th/g) || []).length).toBe(4);
      }

      // The axis header must not span into the shift rows, or the columns shear.
      expect(thead).toContain('rowspan="1"');
    });

    it('escapes dangerous HTML characters in entity names', () => {
      const rules: TimetableRules = {
        id: 'rules-xss',
        mode: 0,
        institutionName: '<script>alert("school")</script>',
        nDaysPerWeek: 1,
        nHoursPerDay: 1,
        daysOfTheWeek: [{ name: '<b>Понеділок</b>' }],
        hoursOfTheDay: [{ name: '1' }],
        modified: false,
        createdAt: '',
        updatedAt: '',
      };

      const groups = [{ id: 'g1', name: '<img src=x onerror=alert(1)>', studentIds: [], subgroups: [] }];
      const subjects = [{ id: 's1', name: '<script>alert("xss")</script>' }];
      const teachers = [{ id: 't1', name: '<script>alert("teacher")</script>' }];

      const html = generateDailyMatrixPrintHtml({
        rowAxis: 'classes',
        solution: {
          id: 'sol',
          rulesId: 'rules-xss',
          placements: [],
          conflicts: [],
          isComplete: true,
          generatedAt: new Date(),
        },
        rules,
        activities: [],
        teachers,
        subjects,
        groups,
        subgroups: [],
        rooms: [],
      });

      expect(html).not.toContain('<script>alert("school")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;school&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x');
    });

    it('renders cell-unavailable for constrained teacher slots and colored border in colorMode', () => {
      const rules: TimetableRules = {
        id: 'rules-avail',
        mode: 0,
        institutionName: 'Тестова школа',
        nDaysPerWeek: 1,
        nHoursPerDay: 2,
        daysOfTheWeek: [{ name: 'Понеділок' }],
        hoursOfTheDay: [{ name: '1' }, { name: '2' }],
        modified: false,
        createdAt: '',
        updatedAt: '',
      };

      const teachers = [{ id: 't1', name: 'Сисова Оксана' }];
      const subjects = [{ id: 's1', name: 'Математика', color: '#ff0000' }];
      const groups = [{ id: 'g1', name: '5-А', studentIds: [], subgroups: [] }];
      const activities = [
        {
          id: 'a1',
          teacherIds: ['t1'],
          subjectId: 's1',
          studentSetIds: ['5-А'],
          duration: 1,
          active: true,
        },
      ];
      const solution = {
        id: 'sol',
        rulesId: 'rules-avail',
        placements: [{ activityId: 'a1', day: 0, hour: 0 }],
        conflicts: [],
        isComplete: true,
        generatedAt: new Date(),
      };
      const timeConstraints = [
        {
          id: 'tc1',
          type: 'TeacherNotAvailableTimes' as const,
          teacherId: 't1',
          times: [{ day: 0, hour: 1 }],
          active: true,
        },
      ];

      const html = generateDailyMatrixPrintHtml({
        rowAxis: 'teachers',
        solution,
        rules,
        activities,
        teachers,
        subjects,
        groups,
        subgroups: [],
        rooms: [],
        timeConstraints,
        options: { colorMode: true },
      });

      expect(html).toContain('cell-unavailable');
      expect(html).toContain('border-left: 3px solid #ff0000');
    });
  });
  describe('renderHeader institution details', () => {
    const headerRules: TimetableRules = {
      id: 'rules-header',
      mode: 0,
      institutionName: 'Тестова школа',
      nDaysPerWeek: 1,
      nHoursPerDay: 1,
      daysOfTheWeek: [{ name: 'Понеділок' }],
      hoursOfTheDay: [{ name: '1 урок' }],
      modified: false,
      createdAt: '',
      updatedAt: '',
    };
    const grid: GridCell[][] = [[{ dayIndex: 0, hourIndex: 0, cells: [] }]];

    const headerHtml = (options = {}) =>
      generateClassPrintHtml('1-А', grid, headerRules, { includeApproval: true, ...options });

    it('never prints the institution name as the director', () => {
      // Regression: the approval block used to render
      // «Директор ${rules.institutionName}», so every printed schedule was
      // signed by the school itself.
      expect(headerHtml()).not.toContain('Директор Тестова школа');
    });

    it('prints the director from the institution details', () => {
      const html = headerHtml({ institution: { director: 'Шевченко І. І.' } });
      expect(html).toContain('Директор Шевченко І. І.');
    });

    it('leaves a bare Директор label when no director is set', () => {
      const html = headerHtml();
      expect(html).toContain('<div>Директор</div>');
    });

    it('prints the institution address when set', () => {
      const html = headerHtml({ institution: { address: 'м. Київ, вул. Шевченка, 1' } });
      expect(html).toContain('<div class="school-address">');
      expect(html).toContain('м. Київ, вул. Шевченка, 1');
    });

    it('omits the address block entirely when unset', () => {
      // The class exists in the stylesheet either way; assert on the markup.
      expect(headerHtml()).not.toContain('<div class="school-address">');
    });

    it('prefers the institution name over rules.institutionName', () => {
      const html = headerHtml({ institution: { name: 'Ліцей №15 м. Києва' } });
      expect(html).toContain('Ліцей №15 м. Києва');
    });

    it('falls back to rules.institutionName when no institution is passed', () => {
      expect(headerHtml()).toContain('Тестова школа');
    });

    it('escapes the director and address', () => {
      const html = headerHtml({
        institution: {
          director: '<script>alert("d")</script>',
          address: '<img src=x onerror=alert(1)>',
        },
      });
      expect(html).not.toContain('<script>alert("d")</script>');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
