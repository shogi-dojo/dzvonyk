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

export interface PrintOptions {
  includeApproval?: boolean;
  colorMode?: boolean;
  orientation?: 'landscape' | 'portrait';
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
 * Common base CSS for A4 print layouts
 */
function getPrintStyles(orientation: 'landscape' | 'portrait' = 'landscape'): string {
  return `
    @page {
      size: A4 ${orientation};
      margin: 8mm 10mm;
    }
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.2;
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
  showStudents: boolean
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

          tableHtml += `
            <div class="lesson-box ${coloredClass}" style="${style}">
              <div class="lesson-subj">${escapeHtml(c.subject)}</div>
              ${renderWeekParity(c.weekParity)}
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
    ${renderSingleGridTable(grid, rules, colorMode, true, false)}
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
        ${renderSingleGridTable(grid, rules, colorMode, true, false)}
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
  const { includeApproval = true, colorMode = true, orientation = 'landscape' } = options;

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
    ${getPrintStyles(orientation)}
    table.summary-matrix {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9px;
    }
    table.summary-matrix th, table.summary-matrix td {
      border: 1px solid #333;
      padding: 2px 3px;
      vertical-align: top;
    }
    table.summary-matrix th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }
    .day-header-cell {
      background: #e8e8e8;
      font-weight: bold;
      width: 50px;
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
              <strong>${escapeHtml(row.dayName.slice(0, 2))}</strong> ${row.hour + 1} ур.
            </td>
            ${row.cells
              .map((cellItems) => `
              <td>
                ${(cellItems || [])
                  .map(
                    (c) => `
                  <div style="${
                    colorMode && c.subjectColor
                      ? `border-left: 2px solid ${c.subjectColor}; background-color: ${c.subjectColor}12;`
                      : ''
                  } padding: 1px 2px; margin-bottom: 1px;">
                    <div style="font-weight: bold; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(
                      c.subject
                    )}</div>
                    ${renderWeekParity(c.weekParity)}
                    ${
                      c.teachers.length > 0
                        ? `<div style="font-size: 8px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(
                            c.teachers[0]
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
  const { includeApproval = true, colorMode = true, orientation = 'landscape' } = options;

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
    ${getPrintStyles(orientation)}
    table.summary-matrix {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9px;
    }
    table.summary-matrix th, table.summary-matrix td {
      border: 1px solid #333;
      padding: 2px 3px;
      vertical-align: top;
    }
    table.summary-matrix th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }
    .day-header-cell {
      background: #e8e8e8;
      font-weight: bold;
      width: 50px;
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
              <strong>${escapeHtml(row.dayName.slice(0, 2))}</strong> ${escapeHtml(row.hourName)}
            </td>
            ${row.cells
              .map((cellItems) => `
              <td>
                ${(cellItems || [])
                  .map(
                    (c) => `
                  <div style="${
                    colorMode && c.subjectColor
                      ? `border-left: 2px solid ${c.subjectColor}; background-color: ${c.subjectColor}12;`
                      : ''
                  } padding: 1px 2px; margin-bottom: 1px;">
                    <div style="font-weight: bold; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(
                      c.subject
                    )}</div>
                    ${renderWeekParity(c.weekParity)}
                    ${
                      c.students.length > 0
                        ? `<div style="font-size: 8px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(
                            c.students.join(', ')
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
 * Generates printable HTML for Teacher Workload / Tariffication Report
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

  const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  const subMap = new Map(subjects.map((s) => [s.id, s]));

  const rows = sortedTeachers.map((teacher, index) => {
    const teacherActs = activities.filter(
      (a) => a.active && (a.teacherIds.includes(teacher.id) || a.teacherIds.includes(teacher.name))
    );

    const subjectNames = Array.from(
      new Set(
        teacherActs.map((a) => {
          const s = subMap.get(a.subjectId) || subjects.find((sub) => sub.name === a.subjectId);
          return s?.name || a.subjectId;
        })
      )
    );

    const classNames = Array.from(
      new Set(teacherActs.flatMap((a) => a.studentSetIds))
    );

    const totalHours = teacherActs.reduce((sum, a) => sum + (a.duration || 1), 0);

    return {
      index: index + 1,
      name: teacher.name,
      longName: teacher.longName,
      subjects: subjectNames,
      classes: classNames,
      totalHours,
      targetHours: teacher.targetNumberOfHours,
    };
  });

  const totalSchoolHours = rows.reduce((sum, r) => sum + r.totalHours, 0);

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
      padding: 6px 8px;
      font-size: 11px;
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
          <th style="width: 35px; text-align: center;">№</th>
          <th style="text-align: left;">ПІБ Викладача</th>
          <th style="text-align: left;">Предмети</th>
          <th style="text-align: left;">Класи</th>
          <th style="width: 80px; text-align: center;">Годин/тижд.</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td style="text-align: center;">${r.index}</td>
            <td style="font-weight: bold;">
              ${escapeHtml(r.name)}
              ${r.longName && r.longName !== r.name ? `<div style="font-weight: normal; font-size: 9.5px; color: #555;">${escapeHtml(r.longName)}</div>` : ''}
            </td>
            <td>${escapeHtml(r.subjects.join(', ') || '—')}</td>
            <td>${escapeHtml(r.classes.join(', ') || '—')}</td>
            <td style="text-align: center; font-weight: bold; font-size: 12px;">
              ${r.totalHours}
              ${r.targetHours > 0 ? `<div style="font-size: 9px; font-weight: normal; color: #666;">(план: ${r.targetHours})</div>` : ''}
            </td>
          </tr>
        `
          )
          .join('')}
        <tr style="background: #f0f0f0; font-weight: bold;">
          <td colspan="4" style="text-align: right;">РАЗОМ ГОДИН ПО ЗАКЛАДУ:</td>
          <td style="text-align: center; font-size: 13px;">${totalSchoolHours}</td>
        </tr>
      </tbody>
    </table>
    ${renderFooter()}
  </div>
</body>
</html>`;
}
