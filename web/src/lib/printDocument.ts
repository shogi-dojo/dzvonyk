/**
 * Self-contained HTML Print Document Generator & Silent Iframe Printer
 * Generates standards-compliant A4 print sheets that fit cleanly without app chrome.
 */

import type {
  TimetableRules,
  TimetableSolution,
  Activity,
  Teacher,
  Subject,
  Room,
  StudentsGroup,
  StudentsSubgroup,
} from '@/types';
import {
  buildTimetableGrid,
  buildAllClassesGrid,
  type GridCell,
  type CellData,
} from './timetableGrid';
import { hourTimeLabel } from './bellSchedule';
import {
  sumWeeklyLoad,
  formatWeeklyLoad,
  formatHours,
  computeTeacherWorkloadReportData,
  computeAllClassesWeeklyLoad,
} from './weeklyLoad';

export interface PrintOptions {
  includeApproval?: boolean;
  colorMode?: boolean;
  orientation?: 'landscape' | 'portrait';
  pageSize?: 'a4' | 'a3' | 'auto';
  academicYear?: string;
}

/**
 * Triggers the browser print dialog for an isolated HTML string using a hidden iframe.
 * Avoids printing app navigation, sidebar, buttons or headers.
 */
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: popup window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }
  }, 250);
}

/**
 * Common base CSS for print layouts
 */
function getPrintStyles(
  orientation: 'landscape' | 'portrait' = 'landscape',
  pageSize: 'a4' | 'a3' | 'auto' = 'a4'
): string {
  const pageRule =
    pageSize === 'auto'
      ? '@page { size: auto; margin: 8mm 10mm; }'
      : pageSize === 'a3'
      ? `@page { size: A3 ${orientation}; margin: 8mm 10mm; }`
      : `@page { size: A4 ${orientation}; margin: 8mm 10mm; }`;

  return `
    ${pageRule}
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .sheet {
      width: 100%;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sheet.page-break {
      page-break-after: always;
      break-after: page;
      min-height: 100vh;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      padding-bottom: 4px;
    }
    .school-info {
      font-size: 11px;
    }
    .school-name {
      font-size: 13px;
      font-weight: bold;
    }
    .approval-block {
      width: 220px;
      border-left: 2px solid #ccc;
      padding-left: 8px;
      font-size: 10px;
    }
    .approval-title {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10px;
    }
    .doc-title {
      text-align: center;
      margin-bottom: 8px;
      border-bottom: 1.5px solid #000;
      padding-bottom: 4px;
    }
    .doc-title h1 {
      margin: 0;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-title p {
      margin: 2px 0 0 0;
      font-size: 10px;
      color: #555;
    }
    table.tt-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 4px;
    }
    table.tt-table th, table.tt-table td {
      border: 1px solid #333;
      padding: 4px 6px;
      vertical-align: top;
    }
    table.tt-table th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
      font-size: 11px;
      padding: 5px;
    }
    table.tt-table th.time-col {
      width: 65px;
    }
    table.tt-table td.time-cell {
      background: #fafafa;
      text-align: center;
      font-weight: bold;
      vertical-align: middle;
      font-size: 11px;
    }
    .period-num {
      font-size: 12px;
      font-weight: bold;
    }
    .period-time {
      font-size: 9px;
      color: #666;
      font-weight: normal;
    }
    .lesson-box {
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 3px 4px;
      margin-bottom: 3px;
      background: #fdfdfd;
    }
    .lesson-box:last-child {
      margin-bottom: 0;
    }
    .lesson-box.colored {
      border-left-width: 4px;
    }
    .lesson-subj {
      font-weight: bold;
      font-size: 11px;
      color: #000;
    }
    .lesson-details {
      font-size: 9.5px;
      color: #333;
      margin-top: 1px;
    }
    .lesson-room {
      font-size: 8.5px;
      color: #666;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      padding-top: 4px;
      border-top: 1px solid #ddd;
      font-size: 9px;
      color: #666;
    }
  `;
}

function renderHeader(
  rules: TimetableRules,
  includeApproval = true
): string {
  if (!includeApproval) {
    return `
      <div class="header-row">
        <div class="school-info">
          <div class="school-name">${escapeHtml(rules.institutionName)}</div>
          ${rules.comments ? `<div>${escapeHtml(rules.comments)}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="header-row">
      <div class="school-info">
        <div class="school-name">${escapeHtml(rules.institutionName)}</div>
        ${rules.comments ? `<div>${escapeHtml(rules.comments)}</div>` : ''}
      </div>
      <div class="approval-block">
        <div class="approval-title">«ЗАТВЕРДЖУЮ»</div>
        <div>Директор ${escapeHtml(rules.institutionName)}</div>
        <div style="margin-top: 12px; border-bottom: 1px solid #000; width: 140px;"></div>
        <div style="font-size: 8.5px; color: #666;">(підпис / ПІБ)</div>
        <div style="margin-top: 4px;">«____» ____________ 202___ р.</div>
      </div>
    </div>
  `;
}

function renderFooter(): string {
  return `
    <div class="footer-row">
      <div>Заступник директора з НВР: __________________ / __________________</div>
      <div>Сформовано в системі «Дзвоник»: ${new Date().toLocaleDateString('uk-UA')}</div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderWeekParity(parity?: 'both' | 'numerator' | 'denominator'): string {
  if (parity === 'numerator') return '<div class="lesson-details">Чисельник</div>';
  if (parity === 'denominator') return '<div class="lesson-details">Знаменник</div>';
  return '';
}

/**
 * Renders a single entity grid (class or teacher) table HTML
 */
function renderSingleGridTable(
  grid: GridCell[][],
  rules: TimetableRules,
  colorMode: boolean,
  showTeacher: boolean,
  showStudents: boolean,
  currentClassName?: string
): string {
  const days = rules.daysOfTheWeek;
  const hours = rules.hoursOfTheDay;

  let tableHtml = `
    <table class="tt-table">
      <thead>
        <tr>
          <th class="time-col">Урок</th>
          ${days.map((d) => `<th>${escapeHtml(d.name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  hours.forEach((hour, hIdx) => {
    tableHtml += `
      <tr>
        <td class="time-cell">
          <div class="period-num">${hIdx + 1}</div>
          <div class="period-time">${escapeHtml(hourTimeLabel(hour))}</div>
        </td>
    `;

    days.forEach((_, dIdx) => {
      const cell = grid[hIdx]?.[dIdx];
      if (cell === 'spanned') return;

      tableHtml += `<td>`;
      if (Array.isArray(cell)) {
        cell.forEach((c) => {
          const style =
            colorMode && c.subjectColor
              ? `border-left-color: ${c.subjectColor}; background-color: ${c.subjectColor}15;`
              : '';
          const coloredClass = colorMode && c.subjectColor ? 'colored' : '';

          // Extract subgroup if printing a specific class
          const subgroups = !showStudents && currentClassName && c.students.length > 0
            ? c.students
                .map((s) => {
                  if (s === currentClassName) return '';
                  if (s.startsWith(`${currentClassName},`) || s.startsWith(`${currentClassName} `) || s.startsWith(`${currentClassName}/`)) {
                    return s.replace(currentClassName, '').trim().replace(/^[,/:-]\s*/, '');
                  }
                  return s;
                })
                .filter(Boolean)
            : [];

          tableHtml += `
            <div class="lesson-box ${coloredClass}" style="${style}">
              <div class="lesson-subj">${escapeHtml(c.subject)}</div>
              ${renderWeekParity(c.weekParity)}
              ${
                subgroups.length > 0
                  ? `<div class="lesson-details" style="font-weight: bold; color: #444;">${escapeHtml(subgroups.join(', '))}</div>`
                  : ''
              }
              ${
                showTeacher && c.teachers.length > 0
                  ? `<div class="lesson-details">${escapeHtml(c.teachers.join(', '))}</div>`
                  : ''
              }
              ${
                showStudents && c.students.length > 0
                  ? `<div class="lesson-details">${escapeHtml(c.students.join(', '))}</div>`
                  : ''
              }
              ${
                c.activityTags && c.activityTags.length > 0
                  ? `<div class="lesson-details" style="font-size: 8.5px; color: #777;">${escapeHtml(c.activityTags.join(', '))}</div>`
                  : ''
              }
              ${
                c.room
                  ? `<div class="lesson-room">каб. ${escapeHtml(c.room)}</div>`
                  : ''
              }
            </div>
          `;
        });
      }
      tableHtml += `</td>`;
    });

    tableHtml += `</tr>`;
  });

  tableHtml += `</tbody></table>`;
  return tableHtml;
}

/**
 * Generates printable HTML for a single Class timetable (1 A4 landscape page)
 */
export function generateClassPrintHtml(
  className: string,
  grid: GridCell[][],
  rules: TimetableRules,
  options: PrintOptions = {}
): string {
  const { includeApproval = true, colorMode = true, orientation = 'landscape' } = options;

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Розклад ${escapeHtml(className)} - ${escapeHtml(rules.institutionName)}</title>
  <style>${getPrintStyles(orientation)}</style>
</head>
<body>
  <div class="sheet">
    ${renderHeader(rules, includeApproval)}
    <div class="doc-title">
      <h1>РОЗКЛАД УРОКІВ ${escapeHtml(className)} КЛАСУ</h1>
      <p>${rules.daysOfTheWeek.length} навчальних днів • ${rules.hoursOfTheDay.length} уроків на день</p>
    </div>
    ${renderSingleGridTable(grid, rules, colorMode, true, false, className)}
    ${renderFooter()}
  </div>
</body>
</html>`;
}

/**
 * Generates printable HTML for a single Teacher timetable (1 A4 landscape page)
 */
export function generateTeacherPrintHtml(
  teacherName: string,
  grid: GridCell[][],
  rules: TimetableRules,
  options: PrintOptions = {}
): string {
  const { includeApproval = true, colorMode = true, orientation = 'landscape' } = options;

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Розклад: ${escapeHtml(teacherName)} - ${escapeHtml(rules.institutionName)}</title>
  <style>${getPrintStyles(orientation)}</style>
</head>
<body>
  <div class="sheet">
    ${renderHeader(rules, includeApproval)}
    <div class="doc-title">
      <h1>РОЗКЛАД УРОКІВ ВИКЛАДАЧА: ${escapeHtml(teacherName)}</h1>
      <p>${rules.daysOfTheWeek.length} навчальних днів • ${rules.hoursOfTheDay.length} уроків на день</p>
    </div>
    ${renderSingleGridTable(grid, rules, colorMode, false, true)}
    ${renderFooter()}
  </div>
</body>
</html>`;
}

/**
 * Generates a batch printable HTML containing EVERY class on its own A4 page
 */
export function generateAllClassesPrintHtml(params: {
  groups: StudentsGroup[];
  solution: TimetableSolution;
  rules: TimetableRules;
  activities: Activity[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  options?: PrintOptions;
}): string {
  const { groups, solution, rules, activities, teachers, subjects, rooms, options = {} } = params;
  const { includeApproval = true, colorMode = true, orientation = 'landscape' } = options;

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }));

  let pagesHtml = '';

  sortedGroups.forEach((group) => {
    const grid = buildTimetableGrid({
      entityId: group.name,
      entityType: 'students',
      solution,
      rules,
      activities,
      teachers,
      subjects,
      rooms,
    });
    if (!grid) return;

    pagesHtml += `
      <div class="sheet page-break">
        ${renderHeader(rules, includeApproval)}
        <div class="doc-title">
          <h1>РОЗКЛАД УРОКІВ ${escapeHtml(group.name)} КЛАСУ</h1>
          <p>${rules.daysOfTheWeek.length} навчальних днів • ${rules.hoursOfTheDay.length} уроків на день</p>
        </div>
        ${renderSingleGridTable(grid, rules, colorMode, true, false, group.name)}
        ${renderFooter()}
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Розклади всіх класів - ${escapeHtml(rules.institutionName)}</title>
  <style>${getPrintStyles(orientation)}</style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/**
 * Generates a batch printable HTML containing EVERY teacher on their own A4 page
 */
export function generateAllTeachersPrintHtml(params: {
  teachers: Teacher[];
  solution: TimetableSolution;
  rules: TimetableRules;
  activities: Activity[];
  subjects: Subject[];
  rooms: Room[];
  options?: PrintOptions;
}): string {
  const { teachers, solution, rules, activities, subjects, rooms, options = {} } = params;
  const { includeApproval = true, colorMode = true, orientation = 'landscape' } = options;

  const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  let pagesHtml = '';

  sortedTeachers.forEach((teacher) => {
    const grid = buildTimetableGrid({
      entityId: teacher.name,
      entityType: 'teachers',
      solution,
      rules,
      activities,
      teachers,
      subjects,
      rooms,
    });
    if (!grid) return;

    pagesHtml += `
      <div class="sheet page-break">
        ${renderHeader(rules, includeApproval)}
        <div class="doc-title">
          <h1>РОЗКЛАД УРОКІВ ВИКЛАДАЧА: ${escapeHtml(teacher.name)}</h1>
          <p>${rules.daysOfTheWeek.length} навчальних днів • ${rules.hoursOfTheDay.length} уроків на день</p>
        </div>
        ${renderSingleGridTable(grid, rules, colorMode, false, true)}
        ${renderFooter()}
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Розклади всіх учителів - ${escapeHtml(rules.institutionName)}</title>
  <style>${getPrintStyles(orientation)}</style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/**
 * Generates printable HTML for the Summary All-Classes Matrix
 */
export function generateSummaryClassesMatrixPrintHtml(params: {
  solution: TimetableSolution;
  rules: TimetableRules;
  activities: Activity[];
  teachers: Teacher[];
  subjects: Subject[];
  groups: StudentsGroup[];
  subgroups: StudentsSubgroup[];
  rooms: Room[];
  options?: PrintOptions;
}): string {
  const { solution, rules, activities, teachers, subjects, groups, subgroups, rooms, options = {} } = params;
  const { includeApproval = true, colorMode = true, orientation = 'landscape', pageSize = 'a4' } = options;

  const matrix = buildAllClassesGrid({
    solution,
    rules,
    activities,
    teachers,
    subjects,
    groups,
    subgroups,
    rooms,
  });
  if (!matrix) return '';

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Зведений розклад усіх класів - ${escapeHtml(rules.institutionName)}</title>
  <style>
    ${getPrintStyles(orientation, pageSize)}
    table.summary-matrix {
      width: 100%;
      border-collapse: collapse;
      ${pageSize === 'auto' ? 'table-layout: auto; min-width: max-content;' : 'table-layout: fixed;'}
      font-size: 10px;
    }
    table.summary-matrix th, table.summary-matrix td {
      border: 1px solid #333;
      padding: 4px 5px;
      vertical-align: top;
      ${pageSize === 'auto' ? 'min-width: 95px;' : ''}
    }
    table.summary-matrix th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
      padding: 6px 4px;
      font-size: 11px;
    }
    .day-header-cell {
      background: #e8e8e8;
      font-weight: bold;
      width: 55px;
      text-align: center;
      vertical-align: middle !important;
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${renderHeader(rules, includeApproval)}
    <div class="doc-title">
      <h1>ЗВЕДЕНИЙ РОЗКЛАД УРОКІВ УСІХ КЛАСІВ</h1>
      <p>${rules.institutionName}</p>
    </div>
    <table class="summary-matrix">
      <thead>
        <tr>
          <th class="day-header-cell">Час</th>
          ${matrix.groups.map((g) => `<th>${escapeHtml(g.name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${matrix.rows
          .map((row) => `
          <tr ${row.hour === 0 ? 'style="border-top: 2px solid #000;"' : ''}>
            <td class="day-header-cell">
              <div><strong>${escapeHtml(row.dayName.slice(0, 2))}</strong></div>
              <div style="font-size: 9px; font-weight: normal; color: #555;">${row.hour + 1} ур.</div>
            </td>
            ${row.cells
              .map((cellItems) => `
              <td>
                ${(cellItems || [])
                  .map(
                    (c) => `
                  <div style="${
                    colorMode && c.subjectColor
                      ? `border-left: 3px solid ${c.subjectColor}; background-color: ${c.subjectColor}15;`
                      : 'background-color: #f9f9f9;'
                  } padding: 3px 4px; margin-bottom: 2px; border-radius: 2px; line-height: 1.3;">
                    <div style="font-weight: bold; font-size: 10px; line-height: 1.3; color: #000; word-break: break-word;">${escapeHtml(
                      c.subject
                    )}</div>
                    ${renderWeekParity(c.weekParity)}
                    ${
                      c.teachers.length > 0
                        ? `<div style="font-size: 9px; color: #444; line-height: 1.25; margin-top: 1px; word-break: break-word;">${escapeHtml(
                            c.teachers[0]
                          )}</div>`
                        : ''
                    }
                    ${
                      c.room
                        ? `<div style="font-size: 8.5px; color: #666; line-height: 1.2;">каб. ${escapeHtml(
                            c.room
                          )}</div>`
                        : ''
                    }
                  </div>
                `
                  )
                  .join('')}
              </td>
            `)
              .join('')}
          </tr>
        `)
          .join('')}
      </tbody>
    </table>
    ${renderFooter()}
  </div>
</body>
</html>`;
}

/**
 * Generates printable HTML for the Summary Teachers Matrix
 */
export function generateSummaryTeachersMatrixPrintHtml(params: {
  solution: TimetableSolution;
  rules: TimetableRules;
  activities: Activity[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  options?: PrintOptions;
}): string {
  const { solution, rules, activities, teachers, subjects, rooms, options = {} } = params;
  const { includeApproval = true, colorMode = true, orientation = 'landscape', pageSize = 'a4' } = options;

  const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  const actMap = new Map(activities.map((a) => [a.id, a]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const subNameMap = new Map(subjects.map((s) => [s.name, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;

  const matrix: (CellData[] | null)[][][] = Array.from(
    { length: nDays },
    () =>
      Array.from({ length: nHours }, () =>
        Array.from({ length: sortedTeachers.length }, () => null)
      )
  );

  for (const p of solution.placements) {
    const act = actMap.get(p.activityId);
    if (!act) continue;

    const subObj = subMap.get(act.subjectId) || subNameMap.get(act.subjectId);
    const subName = subObj?.name || act.subjectId;
    const roomObj = p.roomId ? roomMap.get(p.roomId) || rooms.find((r) => r.name === p.roomId) : undefined;

    const entry: CellData = {
      activityId: act.id,
      subject: subName,
      subjectColor: subObj?.color,
      teachers: act.teacherIds,
      students: act.studentSetIds,
      room: roomObj?.name,
      duration: act.duration || 1,
      activityTags: act.activityTagIds || [],
      weekParity: act.weekParity,
    };

    sortedTeachers.forEach((teacher, tIdx) => {
      if (
        act.teacherIds.includes(teacher.id) ||
        act.teacherIds.includes(teacher.name)
      ) {
        if (p.day < nDays && p.hour < nHours) {
          const existing = matrix[p.day][p.hour][tIdx];
          if (existing) {
            existing.push(entry);
          } else {
            matrix[p.day][p.hour][tIdx] = [entry];
          }
        }
      }
    });
  }

  const rows: { dayName: string; hourName: string; cells: (CellData[] | null)[] }[] = [];
  rules.daysOfTheWeek.forEach((day, dIdx) => {
    rules.hoursOfTheDay.forEach((hour, hIdx) => {
      rows.push({
        dayName: day.name,
        hourName: hour.name,
        cells: matrix[dIdx][hIdx],
      });
    });
  });

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Зведений розклад учителів - ${escapeHtml(rules.institutionName)}</title>
  <style>
    ${getPrintStyles(orientation, pageSize)}
    table.summary-matrix {
      width: 100%;
      border-collapse: collapse;
      ${pageSize === 'auto' ? 'table-layout: auto; min-width: max-content;' : 'table-layout: fixed;'}
      font-size: 10px;
    }
    table.summary-matrix th, table.summary-matrix td {
      border: 1px solid #333;
      padding: 4px 5px;
      vertical-align: top;
      ${pageSize === 'auto' ? 'min-width: 95px;' : ''}
    }
    table.summary-matrix th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
      padding: 6px 4px;
      font-size: 11px;
    }
    .day-header-cell {
      background: #e8e8e8;
      font-weight: bold;
      width: 55px;
      text-align: center;
      vertical-align: middle !important;
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${renderHeader(rules, includeApproval)}
    <div class="doc-title">
      <h1>ЗВЕДЕНИЙ РОЗКЛАД УСІХ ВИКЛАДАЧІВ</h1>
      <p>${rules.institutionName}</p>
    </div>
    <table class="summary-matrix">
      <thead>
        <tr>
          <th class="day-header-cell">Час</th>
          ${sortedTeachers.map((t) => `<th>${escapeHtml(t.name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `
          <tr>
            <td class="day-header-cell">
              <div><strong>${escapeHtml(row.dayName.slice(0, 2))}</strong></div>
              <div style="font-size: 9px; font-weight: normal; color: #555;">${escapeHtml(row.hourName)}</div>
            </td>
            ${row.cells
              .map((cellItems) => `
              <td>
                ${(cellItems || [])
                  .map(
                    (c) => `
                  <div style="${
                    colorMode && c.subjectColor
                      ? `border-left: 3px solid ${c.subjectColor}; background-color: ${c.subjectColor}15;`
                      : 'background-color: #f9f9f9;'
                  } padding: 3px 4px; margin-bottom: 2px; border-radius: 2px; line-height: 1.3;">
                    <div style="font-weight: bold; font-size: 10px; line-height: 1.3; color: #000; word-break: break-word;">${escapeHtml(
                      c.subject
                    )}</div>
                    ${renderWeekParity(c.weekParity)}
                    ${
                      c.students.length > 0
                        ? `<div style="font-size: 9px; color: #444; line-height: 1.25; margin-top: 1px; word-break: break-word;">${escapeHtml(
                            c.students.join(', ')
                          )}</div>`
                        : ''
                    }
                    ${
                      c.room
                        ? `<div style="font-size: 8.5px; color: #666; line-height: 1.2;">каб. ${escapeHtml(
                            c.room
                          )}</div>`
                        : ''
                    }
                  </div>
                `
                  )
                  .join('')}
              </td>
            `)
              .join('')}
          </tr>
        `)
          .join('')}
      </tbody>
    </table>
    ${renderFooter()}
  </div>
</body>
</html>`;
}

/**
 * Generates printable HTML for Teacher Workload / Tariffication Report with detailed subject & class itemization
 */
export function generateTeacherWorkloadPrintHtml(params: {
  rules: TimetableRules;
  teachers: Teacher[];
  activities: Activity[];
  subjects: Subject[];
  options?: PrintOptions;
}): string {
  const { rules, teachers, activities, subjects, options = {} } = params;
  const { includeApproval = true, orientation = 'portrait' } = options;

  const { rows, totalSchoolHours } = computeTeacherWorkloadReportData({
    teachers,
    activities,
    subjects,
  });

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Тарифікаційний звіт навантаження - ${escapeHtml(rules.institutionName)}</title>
  <style>
    ${getPrintStyles(orientation)}
    table.workload-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table.workload-table th, table.workload-table td {
      border: 1px solid #333;
      padding: 5px 7px;
      font-size: 10.5px;
    }
    table.workload-table th {
      background: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${renderHeader(rules, includeApproval)}
    <div class="doc-title">
      <h1>ТАРИФІКАЦІЙНИЙ ЗВІТ ТИЖНЕВОГО НАВАНТАЖЕННЯ ВИКЛАДАЧІВ</h1>
      <p>${rules.institutionName}</p>
    </div>
    <table class="workload-table">
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">№</th>
          <th style="width: 170px; text-align: left;">ПІБ Викладача</th>
          <th style="width: 160px; text-align: left;">Предмет</th>
          <th style="text-align: left;">Класи / підгрупи та години</th>
          <th style="width: 65px; text-align: center;">Годин</th>
          <th style="width: 85px; text-align: center;">Разом / тижд.</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((teacher) => {
            const nSubj = teacher.subjects.length || 1;
            return teacher.subjects
              .map(
                (subj, sIdx) => `
              <tr>
                ${
                  sIdx === 0
                    ? `
                  <td rowspan="${nSubj}" style="text-align: center; vertical-align: top;">${teacher.index}</td>
                  <td rowspan="${nSubj}" style="vertical-align: top; font-weight: bold;">
                    ${escapeHtml(teacher.name)}
                    ${
                      teacher.longName && teacher.longName !== teacher.name
                        ? `<div style="font-weight: normal; font-size: 9.5px; color: #555;">${escapeHtml(teacher.longName)}</div>`
                        : ''
                    }
                    ${
                      teacher.targetHours && teacher.targetHours > 0
                        ? `<div style="font-weight: normal; font-size: 9px; color: #666; margin-top: 2px;">(план: ${formatHours(
                            teacher.targetHours
                          )})</div>`
                        : ''
                    }
                  </td>
                `
                    : ''
                }
                <td style="font-weight: 500;">${escapeHtml(subj.subjectName)}</td>
                <td>${escapeHtml(subj.classesSummary || '—')}</td>
                <td style="text-align: center; font-weight: 600;">${subj.formattedHours}</td>
                ${
                  sIdx === 0
                    ? `
                  <td rowspan="${nSubj}" style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12px; background: #fafafa;">
                    ${formatWeeklyLoad(teacher.totalLoad)}
                  </td>
                `
                    : ''
                }
              </tr>
            `
              )
              .join('');
          })
          .join('')}
        <tr style="background: #f0f0f0; font-weight: bold;">
          <td colspan="5" style="text-align: right;">РАЗОМ ГОДИН ПО ЗАКЛАДУ:</td>
          <td style="text-align: center; font-size: 13px;">${formatHours(totalSchoolHours)}</td>
        </tr>
      </tbody>
    </table>
    ${renderFooter()}
  </div>
</body>
</html>`;
}

/**
 * Generates printable HTML for consolidated Class Weekly Workload Matrix (Parity comparison)
 */
export function generateClassesWorkloadMatrixPrintHtml(params: {
  rules: TimetableRules;
  groups: StudentsGroup[];
  activities: Activity[];
  options?: PrintOptions;
}): string {
  const { rules, groups, activities, options = {} } = params;
  const { includeApproval = true, orientation = 'portrait' } = options;

  const data = computeAllClassesWeeklyLoad(groups, activities);

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Навантаження класів по тижнях - ${escapeHtml(rules.institutionName)}</title>
  <style>
    ${getPrintStyles(orientation)}
    table.workload-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table.workload-table th, table.workload-table td {
      border: 1px solid #333;
      padding: 6px 8px;
      font-size: 11px;
    }
    table.workload-table th {
      background: #f0f0f0;
      font-weight: bold;
    }
    .badge-ok {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      background: #e6f4ea;
      color: #137333;
    }
    .badge-warn {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      background: #fef7e0;
      color: #b06000;
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${renderHeader(rules, includeApproval)}
    <div class="doc-title">
      <h1>ЗВЕДЕНЕ НАВАНТАЖЕННЯ КЛАСІВ ПО ТИЖНЯХ (ЧИСЕЛЬНИК / ЗНАМЕННИК)</h1>
      <p>${rules.institutionName}</p>
    </div>
    <table class="workload-table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">№</th>
          <th style="text-align: left;">Клас</th>
          <th style="width: 80px; text-align: center;">Чисельник</th>
          <th style="width: 80px; text-align: center;">Знаменник</th>
          <th style="width: 90px; text-align: center;">Середнє</th>
          <th style="width: 130px; text-align: center;">Баланс тижнів</th>
          <th style="width: 70px; text-align: center;">Предметів</th>
          <th style="width: 60px; text-align: center;">Уроків</th>
        </tr>
      </thead>
      <tbody>
        ${data.classes
          .map(
            (c, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-weight: bold;">
              ${escapeHtml(c.name)}
              ${
                c.longName && c.longName !== c.name
                  ? `<span style="font-weight: normal; font-size: 9.5px; color: #555; margin-left: 4px;">(${escapeHtml(
                      c.longName
                    )})</span>`
                  : ''
              }
            </td>
            <td style="text-align: center; font-weight: 500;">${formatHours(c.numerator)}</td>
            <td style="text-align: center; font-weight: 500;">${formatHours(c.denominator)}</td>
            <td style="text-align: center; font-weight: bold; font-size: 12px;">${formatHours(c.average)}</td>
            <td style="text-align: center;">
              ${
                c.isBalanced
                  ? '<span class="badge-ok">✓ Збалансовано</span>'
                  : `<span class="badge-warn">⚠ Різниця ${formatHours(c.difference)} год</span>`
              }
            </td>
            <td style="text-align: center;">${c.subjectsCount}</td>
            <td style="text-align: center;">${c.activitiesCount}</td>
          </tr>
        `
          )
          .join('')}
        <tr style="background: #f0f0f0; font-weight: bold;">
          <td colspan="2" style="text-align: right;">РАЗОМ ПО ЗАКЛАДУ:</td>
          <td style="text-align: center;">${formatHours(data.totalNumerator)}</td>
          <td style="text-align: center;">${formatHours(data.totalDenominator)}</td>
          <td style="text-align: center; font-size: 13px;">${formatHours(data.totalAverage)}</td>
          <td style="text-align: center;">
            ${
              data.totalNumerator === data.totalDenominator
                ? '<span class="badge-ok">✓ Збалансовано</span>'
                : `<span class="badge-warn">⚠ Різниця ${formatHours(
                    Math.abs(data.totalNumerator - data.totalDenominator)
                  )} год</span>`
            }
          </td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
    ${renderFooter()}
  </div>
</body>
</html>`;
}
