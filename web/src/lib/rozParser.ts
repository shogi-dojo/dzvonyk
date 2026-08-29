/**
 * aSc TimeTables .roz File Parser
 * Decodes native aSc binary container into dzvonyk's FET-shaped data model
 */

import { v4 as uuidv4 } from 'uuid';
import {
  STUDENTS_GROUP,
  STUDENTS_SUBGROUP,
  STUDENTS_YEAR,
  type FETFile,
  type Teacher,
  type Subject,
  type StudentsYear,
  type StudentsGroup,
  type StudentsSubgroup,
  type Activity,
  type Day,
  type Hour,
  type ActivityPlacement,
} from '../types';

export interface RozWarning {
  key: string;
  params?: Record<string, string | number>;
}

export interface RozSampleLesson {
  className: string;
  groupName: string;
  subject: string;
  teacher: string;
  hours: number;
  slots: string[];
}

export interface RozImportReport {
  schoolName: string;
  year: string;
  counts: {
    classes: number;
    subgroups: number;
    teachers: number;
    subjects: number;
    lessons: number;
    hours: number;
    placements: number;
  };
  unplacedHours: number;
  warnings: RozWarning[];
  sampleLessons: RozSampleLesson[];
}

export interface RozImportResult {
  file: FETFile;
  placements: ActivityPlacement[];
  report: RozImportReport;
  shifts?: {
    shift1: { firstHour: number; lastHour: number };
    shift2: { firstHour: number; lastHour: number };
  };
}

const LESSON_LEN = 183;
const LESSON_SIG = new Uint8Array([2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 0]);
const CARD_SENTINEL = new Uint8Array([0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00]);

const UKRAINIAN_DAYS: Day[] = [
  { name: 'Понеділок', longName: 'Понеділок' },
  { name: 'Вівторок', longName: 'Вівторок' },
  { name: 'Середа', longName: 'Середа' },
  { name: 'Четвер', longName: 'Четвер' },
  { name: 'Пʼятниця', longName: 'Пʼятниця' },
];

const DAY_ABBRS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];

const DAYBIT_MAP: Record<number, number> = {
  1: 0,  // Mon
  2: 1,  // Tue
  4: 2,  // Wed
  8: 3,  // Thu
  16: 4, // Fri
};

function generateHours(count: number): Hour[] {
  const hours: Hour[] = [];
  const startHour = 8;
  for (let i = 0; i < count; i++) {
    const h1 = (startHour + i).toString().padStart(2, '0');
    const h2 = (startHour + i + 1).toString().padStart(2, '0');
    hours.push({
      name: `${h1}:00`,
      longName: `${h1}:00 - ${h2}:00`,
    });
  }
  return hours;
}

function matchSignature(data: Uint8Array, offset: number, sig: Uint8Array): boolean {
  if (offset + sig.length > data.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (data[offset + i] !== sig[i]) return false;
  }
  return true;
}

function findSignatureOffsets(data: Uint8Array, sig: Uint8Array, start = 0, end = data.length): number[] {
  const offsets: number[] = [];
  const limit = Math.min(data.length - sig.length, end);
  for (let i = start; i <= limit; i++) {
    if (matchSignature(data, i, sig)) {
      offsets.push(i);
    }
  }
  return offsets;
}

function decodePStr(
  data: Uint8Array,
  offset: number,
  decoder: TextDecoder
): { text: string; nextOffset: number } | null {
  if (offset >= data.length) return null;
  const len = data[offset];
  if (len < 1 || len > 64 || offset + 1 + len > data.length) {
    return null;
  }
  const slice = data.subarray(offset + 1, offset + 1 + len);
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (!((c >= 0x20 && c < 0x7f) || c >= 0xa8)) {
      return null;
    }
  }
  return {
    text: decoder.decode(slice),
    nextOffset: offset + 1 + len,
  };
}

function scanStrings(
  data: Uint8Array,
  start: number,
  end: number,
  decoder: TextDecoder
): Array<{ offset: number; text: string }> {
  const out: Array<{ offset: number; text: string }> = [];
  let i = start;
  while (i < end) {
    const res = decodePStr(data, i, decoder);
    if (res) {
      out.push({ offset: i, text: res.text });
      i = res.nextOffset;
    } else {
      i++;
    }
  }
  return out;
}

function deduplicateNames(names: string[]): { resolved: string[]; duplicateCount: number } {
  const resolved: string[] = [];
  const counts = new Map<string, number>();
  let duplicateCount = 0;

  for (const name of names) {
    const count = counts.get(name) || 0;
    counts.set(name, count + 1);
    if (count === 0) {
      resolved.push(name);
    } else {
      duplicateCount++;
      resolved.push(`${name} (${count + 1})`);
    }
  }

  return { resolved, duplicateCount };
}

/**
 * Parse an aSc .roz file buffer into dzvonyk data structures
 */
export function parseROZFile(bytes: ArrayBuffer | Uint8Array): RozImportResult {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const warnings: RozWarning[] = [];

  // 1. Verify magic header
  if (data.length < 10 || data[4] !== 5) {
    throw new Error('Невірний формат файлу: замалий розмір або відсутній заголовок aSc');
  }

  const decoder = new TextDecoder('windows-1251');
  const magicText = decoder.decode(data.subarray(5, 10));
  if (magicText !== 'ASCTT') {
    throw new Error(`Невірний формат файлу: очікувався маркер ASCTT, отримано "${magicText}"`);
  }

  // 2. Scan string table
  const allStrings = scanStrings(data, 10, data.length, decoder);

  // 3. Extract school name and academic year
  let schoolName = 'Школа';
  let year = '';
  for (let i = 0; i < allStrings.length - 1; i++) {
    if (allStrings[i].text === '#1166') {
      schoolName = allStrings[i + 1].text;
    } else if (allStrings[i].text === '#1167') {
      year = allStrings[i + 1].text;
    }
  }

  // 4. Extract subjects
  const rawSubjects: string[] = [];
  let lastSubjOffset = 0;
  for (let i = 0; i < allStrings.length - 1; i++) {
    if (allStrings[i].text === '#3375') {
      rawSubjects.push(allStrings[i + 1].text);
      if (allStrings[i].offset > lastSubjOffset) {
        lastSubjOffset = allStrings[i].offset;
      }
    }
  }

  // 5. Extract groups and teachers
  const firstVesKlasEntry = allStrings.find((s) => s.text === 'Весь клас');
  if (!firstVesKlasEntry) {
    throw new Error('Невірний формат файлу: не знайдено групи учнів («Весь клас»)');
  }
  const firstGrpOffset = firstVesKlasEntry.offset;

  const rawTeachers: string[] = [];
  const seenTeachers = new Set<string>();
  for (const item of allStrings) {
    if (item.offset > lastSubjOffset && item.offset < firstGrpOffset) {
      const s = item.text;
      if (s.includes(' ') || s === 'Вакансія' || s === 'ЗБД') {
        if (!seenTeachers.has(s)) {
          rawTeachers.push(s);
          seenTeachers.add(s);
        }
      }
    }
  }

  // 6. Extract classes and verify group structure
  const rawClasses: string[] = [];
  for (let i = 0; i < allStrings.length - 2; i++) {
    if (allStrings[i].text === 'CLASSTT' && allStrings[i + 1].text === allStrings[i + 2].text) {
      rawClasses.push(allStrings[i + 1].text);
    }
  }

  if (rawClasses.length === 0) {
    throw new Error('Не знайдено жодного класу у файлі');
  }

  const firstClassttOffset = allStrings.find((s) => s.text === 'CLASSTT')?.offset ?? data.length;

  // Scan group named-objects between firstGrpOffset - 50 and firstClassttOffset
  const groupSigOffsets = findSignatureOffsets(data, LESSON_SIG, Math.max(0, firstGrpOffset - 50), firstClassttOffset);
  const groupNames: string[] = [];

  for (const sigOff of groupSigOffsets) {
    const off = sigOff + 27;
    if (off >= data.length) continue;
    const strCount = data[off];
    if (strCount < 1 || strCount > 10) continue;

    let pos = off + 1;
    let groupName = '';
    for (let sIdx = 0; sIdx < strCount; sIdx++) {
      if (pos >= data.length) break;
      const sLen = data[pos];
      if (pos + 1 + sLen > data.length) break;
      const text = decoder.decode(data.subarray(pos + 1, pos + 1 + sLen));
      pos += 1 + sLen;
      if (sIdx === 0) {
        groupName = text;
      }
    }

    if (groupName && groupName !== 'CLASSTT') {
      groupNames.push(groupName);
    }
  }

  const vesKlasCount = groupNames.filter((s) => s === 'Весь клас').length;
  if (vesKlasCount !== rawClasses.length) {
    throw new Error(
      `Невідповідність структури класів та груп: знайдено ${vesKlasCount} «Весь клас» та ${rawClasses.length} класів`
    );
  }

  const groupsPerClass = groupNames.length / rawClasses.length;
  if (!Number.isInteger(groupsPerClass) || groupsPerClass <= 0) {
    throw new Error(`Некоректна кількість підгруп на клас: ${groupNames.length} груп на ${rawClasses.length} класів`);
  }

  const standardGroupNames = groupNames.slice(0, groupsPerClass);

  // 7. Deduplicate entity names (Dexie requires unique &name for teachers and subjects)
  const { resolved: subjects, duplicateCount: duplicateSubjects } = deduplicateNames(rawSubjects);
  const { resolved: teachers, duplicateCount: duplicateTeachers } = deduplicateNames(rawTeachers);

  if (duplicateSubjects > 0 || duplicateTeachers > 0) {
    warnings.push({
      key: 'duplicateNamesResolved',
      params: { count: duplicateSubjects + duplicateTeachers },
    });
  }

  // 8. Extract cards (75-byte records located by CARD_SENTINEL at byte 32)
  interface RawCard {
    lesson: number;
    day: number;
    period: number;
    offset: number;
  }

  const sentinelOffsets = findSignatureOffsets(data, CARD_SENTINEL);
  const cards: RawCard[] = [];

  for (const sOff of sentinelOffsets) {
    const o = sOff - 32;
    if (o < 0 || o + 75 > data.length) continue;

    const lid = view.getInt32(o + 0, true);
    const period = view.getInt32(o + 12, true);
    const dayBit = view.getInt32(o + 24, true);

    if (lid > 0 && lid < 5000 && period >= 1 && period <= 20 && dayBit in DAYBIT_MAP) {
      cards.push({
        lesson: lid,
        day: DAYBIT_MAP[dayBit],
        period,
        offset: o,
      });
    }
  }

  // Find start offset of contiguous card section
  const cardOffs = cards.map((c) => c.offset).sort((a, b) => a - b);
  const cardOffSet = new Set(cardOffs);
  let cardStart = data.length;
  for (const o of cardOffs) {
    let consecutive = true;
    for (let k = 1; k < 10; k++) {
      if (!cardOffSet.has(o + 75 * k)) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      cardStart = o;
      break;
    }
  }

  // 9. Extract lessons (183-byte records located by signature between last CLASSTT_END and cardStart)
  // Non-obvious rule: lesson id at byte 167 belongs to record whose payload is in window k+1.
  const classttEndOffsets = findSignatureOffsets(data, new Uint8Array([0x43, 0x4c, 0x41, 0x53, 0x53, 0x54, 0x54, 0x5f, 0x45, 0x4e, 0x44])); // "CLASSTT_END"
  const lastClassttEnd = classttEndOffsets.length > 0 ? classttEndOffsets[classttEndOffsets.length - 1] : firstClassttOffset;

  const lessonSigOffsets = findSignatureOffsets(data, LESSON_SIG, lastClassttEnd, cardStart);
  interface RawWindow {
    offset: number;
    id167: number;
    hours: number;
    subject: number;
    students: number;
    teacher: number;
  }

  const rawWindows: RawWindow[] = [];
  for (const sigOff of lessonSigOffsets) {
    const o = sigOff - 4;
    if (o < lastClassttEnd || o >= cardStart || o + LESSON_LEN > data.length) continue;
    rawWindows.push({
      offset: o,
      id167: view.getInt32(o + 167, true),
      hours: view.getInt32(o + 49, true),
      subject: view.getInt32(o + 66, true),
      students: view.getInt32(o + 74, true),
      teacher: view.getInt32(o + 82, true),
    });
  }

  interface ParsedLesson {
    id: number;
    hours: number;
    subjectIdx: number;
    studentsIdx: number;
    teacherIdx: number;
  }

  const totalSets = rawClasses.length * groupsPerClass;
  const lessons: ParsedLesson[] = [];

  for (let k = 0; k < rawWindows.length - 1; k++) {
    const lid = rawWindows[k].id167;
    const payload = rawWindows[k + 1];

    if (
      lid > 0 &&
      lid < 5000 &&
      payload.hours >= 1 &&
      payload.hours <= 12 &&
      payload.subject >= 0 &&
      payload.subject < subjects.length &&
      payload.teacher >= 0 &&
      payload.teacher < teachers.length &&
      payload.students >= 0 &&
      payload.students < totalSets
    ) {
      lessons.push({
        id: lid,
        hours: payload.hours,
        subjectIdx: payload.subject,
        studentsIdx: payload.students,
        teacherIdx: payload.teacher,
      });
    }
  }

  if (lessons.length === 0) {
    throw new Error('Не знайдено жодного уроку у файлі');
  }

  // 10. Build student years, groups, subgroups
  const studentsYearsMap = new Map<string, StudentsYear>();
  const studentsGroups: StudentsGroup[] = [];
  const studentsSubgroups: StudentsSubgroup[] = [];

  for (let cIdx = 0; cIdx < rawClasses.length; cIdx++) {
    const className = rawClasses[cIdx];
    // Extract year from className (e.g. "5" from "5-А" or "5А" or "5")
    const yearMatch = className.match(/^\d+/);
    const yearName = yearMatch ? yearMatch[0] : className;

    if (!studentsYearsMap.has(yearName)) {
      studentsYearsMap.set(yearName, {
        id: uuidv4(),
        name: yearName,
        longName: yearName,
        code: '',
        numberOfStudents: 0,
        type: STUDENTS_YEAR,
        groups: [],
        divisions: [],
        separator: ' ',
        comments: '',
      });
    }

    const yearObj = studentsYearsMap.get(yearName)!;
    yearObj.groups.push(className);

    // Build subgroups for this class
    const classSubgroupNames: string[] = [];
    for (let g = 1; g < groupsPerClass; g++) {
      const subgroupName = `${className} ${standardGroupNames[g]}`;
      classSubgroupNames.push(subgroupName);

      studentsSubgroups.push({
        id: uuidv4(),
        name: subgroupName,
        longName: subgroupName,
        code: '',
        numberOfStudents: 0,
        type: STUDENTS_SUBGROUP,
        comments: '',
      });
    }

    studentsGroups.push({
      id: uuidv4(),
      name: className,
      longName: className,
      code: '',
      numberOfStudents: 0,
      type: STUDENTS_GROUP,
      subgroups: classSubgroupNames,
      comments: '',
    });
  }

  const studentsYears = Array.from(studentsYearsMap.values());

  // Helper to resolve student set name from students index
  function resolveStudentSetName(studentsIdx: number): string {
    const classIdx = Math.floor(studentsIdx / groupsPerClass);
    const groupSubIdx = studentsIdx % groupsPerClass;
    const className = rawClasses[classIdx];
    if (groupSubIdx === 0) {
      return className;
    }
    return `${className} ${standardGroupNames[groupSubIdx]}`;
  }

  // 11. Group cards by lesson id and build activities and placements
  const cardsByLesson = new Map<number, RawCard[]>();
  for (const card of cards) {
    const list = cardsByLesson.get(card.lesson) || [];
    list.push(card);
    cardsByLesson.set(card.lesson, list);
  }

  const activities: Activity[] = [];
  const placements: ActivityPlacement[] = [];
  let totalHours = 0;
  let unplacedHours = 0;

  for (const lesson of lessons) {
    totalHours += lesson.hours;
    const lessonCards = cardsByLesson.get(lesson.id) || [];
    const actGroupId = lesson.hours > 1 ? lesson.id : 0;
    const teacherName = teachers[lesson.teacherIdx];
    const subjectName = subjects[lesson.subjectIdx];
    const studentSetName = resolveStudentSetName(lesson.studentsIdx);

    const lessonActivities: Activity[] = [];
    for (let h = 0; h < lesson.hours; h++) {
      const act: Activity = {
        id: uuidv4(),
        activityGroupId: actGroupId,
        teacherIds: [teacherName],
        subjectId: subjectName,
        activityTagIds: [],
        studentSetIds: [studentSetName],
        duration: 1,
        totalDuration: lesson.hours,
        active: true,
        computeNTotalStudents: true,
        nTotalStudents: 0,
        comments: '',
      };
      lessonActivities.push(act);
      activities.push(act);
    }

    // Zip cards against activities in order
    const placedCount = Math.min(lessonCards.length, lessonActivities.length);
    for (let c = 0; c < placedCount; c++) {
      placements.push({
        activityId: lessonActivities[c].id,
        day: lessonCards[c].day,
        hour: lessonCards[c].period - 1,
      });
    }

    if (lesson.hours > lessonCards.length) {
      unplacedHours += lesson.hours - lessonCards.length;
    }
  }

  // 12. Detect two-shift schedule
  // Collect periods used by each class from cards
  const classPeriods = new Map<string, Set<number>>();
  for (const cls of rawClasses) {
    classPeriods.set(cls, new Set());
  }

  for (const lesson of lessons) {
    const classIdx = Math.floor(lesson.studentsIdx / groupsPerClass);
    const className = rawClasses[classIdx];
    const lessonCards = cardsByLesson.get(lesson.id) || [];
    const set = classPeriods.get(className);
    if (set) {
      for (const card of lessonCards) {
        set.add(card.period);
      }
    }
  }

  const allPeriods = cards.map((c) => c.period);
  const maxPeriod = allPeriods.length > 0 ? Math.max(...allPeriods) : 9;
  const hoursOfTheDay = generateHours(Math.max(9, maxPeriod));

  // Determine shifts:
  // Check if some classes with cards never use period 1 while using maxPeriod (e.g. 9)
  // and other classes use period 1 while not using maxPeriod (e.g. max 8).
  let shift1Max = 0;
  let shift2Min = Infinity;
  let shift2Max = 0;
  let hasShift2Classes = false;

  for (const [, periods] of classPeriods.entries()) {
    if (periods.size === 0) continue;
    if (periods.has(maxPeriod) && !periods.has(1)) {
      hasShift2Classes = true;
      for (const p of periods) {
        if (p < shift2Min) shift2Min = p;
        if (p > shift2Max) shift2Max = p;
      }
    } else if (periods.has(1) && !periods.has(maxPeriod)) {
      for (const p of periods) {
        if (p > shift1Max) shift1Max = p;
      }
    }
  }

  let shifts: { shift1: { firstHour: number; lastHour: number }; shift2: { firstHour: number; lastHour: number } } | undefined;

  if (hasShift2Classes && shift1Max > 0 && shift2Min < Infinity) {
    shifts = {
      shift1: { firstHour: 0, lastHour: shift1Max - 1 },
      shift2: { firstHour: shift2Min - 1, lastHour: shift2Max - 1 },
    };

    // Assign shift to each StudentsGroup
    for (const group of studentsGroups) {
      const periods = classPeriods.get(group.name);
      if (periods && periods.has(maxPeriod) && !periods.has(1)) {
        group.shift = 2;
      } else {
        group.shift = 1;
      }
    }
  }

  // 13. Warnings
  warnings.push({ key: 'constraintsNotImported' });
  warnings.push({ key: 'roomsNotImported' });
  if (unplacedHours > 0) {
    warnings.push({ key: 'unplacedHours', params: { count: unplacedHours } });
  }

  // 14. Sample lessons for report
  const sampleLessons: RozSampleLesson[] = lessons.slice(0, 10).map((l) => {
    const classIdx = Math.floor(l.studentsIdx / groupsPerClass);
    const groupSubIdx = l.studentsIdx % groupsPerClass;
    const lCards = cardsByLesson.get(l.id) || [];
    return {
      className: rawClasses[classIdx],
      groupName: standardGroupNames[groupSubIdx],
      subject: subjects[l.subjectIdx],
      teacher: teachers[l.teacherIdx],
      hours: l.hours,
      slots: lCards.map((c) => `${DAY_ABBRS[c.day]}${c.period}`),
    };
  });

  const teacherObjects: Teacher[] = teachers.map((name) => ({
    id: uuidv4(),
    name,
    longName: name,
    code: '',
    targetNumberOfHours: 0,
    qualifiedSubjects: [],
    comments: '',
  }));

  const subjectObjects: Subject[] = subjects.map((name) => ({
    id: uuidv4(),
    name,
    longName: name,
    code: '',
    comments: '',
  }));

  const fetFile: FETFile = {
    version: 'aSc.roz',
    mode: 0,
    institutionName: schoolName,
    comments: year ? `Навчальний рік: ${year}` : '',
    daysOfTheWeek: UKRAINIAN_DAYS,
    hoursOfTheDay,
    subjects: subjectObjects,
    activityTags: [],
    teachers: teacherObjects,
    studentsYears,
    studentsGroups,
    studentsSubgroups,
    activities,
    buildings: [],
    rooms: [],
    timeConstraints: [],
    spaceConstraints: [],
    shifts,
  };

  const report: RozImportReport = {
    schoolName,
    year,
    counts: {
      classes: rawClasses.length,
      subgroups: studentsSubgroups.length,
      teachers: teachers.length,
      subjects: subjects.length,
      lessons: lessons.length,
      hours: totalHours,
      placements: placements.length,
    },
    unplacedHours,
    warnings,
    sampleLessons,
  };

  return {
    file: fetFile,
    placements,
    report,
    shifts,
  };
}
