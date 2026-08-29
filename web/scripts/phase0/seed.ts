// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 0 validation dataset — approximates a Ukrainian secondary school:
//   30 classes (5–11 grades), ~50 teachers, ~35 rooms,
//   ~900 activities across 5 days × 8 hours.
// Subgroups for іноземна мова / інформатика / трудове навчання.
//
// Consumed by scripts/phase0/run.ts and (via exportToFETXml) emits phase0.fet
// so a fet-cl baseline can be run later on a Linux box.

import type {
  TimetableRules,
  Teacher,
  Subject,
  ActivityTag,
  StudentsYear,
  StudentsGroup,
  StudentsSubgroup,
  Room,
  Building,
  Activity,
  TimeConstraint,
  SpaceConstraint,
  Day,
  Hour,
  FETFile,
} from '../../src/types';
import {
  OFFICIAL_MODE,
  STUDENTS_YEAR,
  STUDENTS_GROUP,
  STUDENTS_SUBGROUP,
} from '../../src/types';

// -------- Config --------

export const N_DAYS = 5;
export const N_HOURS = 8;

// Ukrainian grade parallels: 30 classes total.
// Grades 5..9 → 5 parallels each (Distribute А, Б, В, Г, Д) = 25.
// Grade 10 → 3, Grade 11 → 2. Total 30.
const CLASS_PARALLELS: Record<number, string[]> = {
  5: ['А', 'Б', 'В', 'Г', 'Д'],
  6: ['А', 'Б', 'В', 'Г', 'Д'],
  7: ['А', 'Б', 'В', 'Г', 'Д'],
  8: ['А', 'Б', 'В', 'Г', 'Д'],
  9: ['А', 'Б', 'В', 'Г', 'Д'],
  10: ['А', 'Б', 'В'],
  11: ['А', 'Б'],
};

// Weekly lesson counts per class (target ≈ 30 lessons/week × 30 classes = 900).
// Subjects flagged `split` produce two subgroup activities per slot.
type SubjectSpec = {
  name: string;
  code: string;
  perWeek: number;
  split?: boolean;                // subgroup-split
  preferredRoomTag?: string;      // maps to SubjectPreferredRoom
};

const SUBJECTS: SubjectSpec[] = [
  { name: 'Українська мова',     code: 'УМ',  perWeek: 3 },
  { name: 'Українська література', code: 'УЛ', perWeek: 2 },
  { name: 'Математика',          code: 'МАТ', perWeek: 4 },
  { name: 'Історія України',     code: 'ІУ',  perWeek: 2 },
  { name: 'Іноземна мова',       code: 'АМ',  perWeek: 3, split: true },
  { name: 'Інформатика',         code: 'ІНФ', perWeek: 2, split: true, preferredRoomTag: 'comp' },
  { name: 'Фізика',              code: 'ФІЗ', perWeek: 2, preferredRoomTag: 'phys' },
  { name: 'Хімія',               code: 'ХІМ', perWeek: 2, preferredRoomTag: 'chem' },
  { name: 'Біологія',            code: 'БІО', perWeek: 2 },
  { name: 'Географія',           code: 'ГЕО', perWeek: 1 },
  { name: 'Фізична культура',    code: 'ФК',  perWeek: 3, preferredRoomTag: 'gym' },
  { name: 'Трудове навчання',    code: 'ТН',  perWeek: 2, split: true },
  { name: 'Музика',              code: 'МУЗ', perWeek: 1 },
];
// Sum non-split: 3+2+4+2+2+2+2+1+3+1 = 22
// Split (2 subgroups × per-week): (3+2+2)×2 = 14  →  total activities per class = 22 + 14 = 36
// 36 × 30 classes = 1080 activities. Trim to hit ~900:
// Actually brief says ~900, and 36×30=1080 is close. We'll drop Music and География for grades 10-11
// (matches real Ukrainian curriculum where these subjects taper off in senior grades).
const SENIOR_DROP = new Set(['Музика', 'Географія', 'Трудове навчання']);

// Teachers per subject (spread ~50 total).
const TEACHERS_PER_SUBJECT: Record<string, number> = {
  'Українська мова': 5,
  'Українська література': 4,
  'Математика': 6,
  'Історія України': 3,
  'Іноземна мова': 6,      // split subject → more teachers
  'Інформатика': 3,
  'Фізика': 3,
  'Хімія': 3,
  'Біологія': 3,
  'Географія': 2,
  'Фізична культура': 4,
  'Трудове навчання': 4,   // split subject
  'Музика': 2,
};
// Sum: 5+4+6+3+6+3+3+3+3+2+4+4+2 = 48

// -------- Helpers --------

function id(prefix: string, n: number | string): string {
  return `${prefix}_${n}`;
}

function isSenior(grade: number): boolean {
  return grade >= 10;
}

// -------- Build --------

export interface SeedResult {
  rules: TimetableRules;
  teachers: Teacher[];
  subjects: Subject[];
  activityTags: ActivityTag[];
  studentsYears: StudentsYear[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  activities: Activity[];
  buildings: Building[];
  rooms: Room[];
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
}

export function buildSeed(): SeedResult {
  const days: Day[] = [
    { name: 'Понеділок' },
    { name: 'Вівторок' },
    { name: 'Середа' },
    { name: 'Четвер' },
    { name: 'Пʼятниця' },
  ];
  const hours: Hour[] = Array.from({ length: N_HOURS }, (_, i) => ({ name: String(i + 1) }));

  const now = new Date();
  const rules: TimetableRules = {
    id: 'rules_1',
    mode: OFFICIAL_MODE,
    institutionName: 'Дзвоник Phase 0 test school',
    nDaysPerWeek: N_DAYS,
    nHoursPerDay: N_HOURS,
    daysOfTheWeek: days,
    hoursOfTheDay: hours,
    modified: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // --- Subjects ---
  const subjects: Subject[] = SUBJECTS.map((s, i) => ({
    id: id('subj', i),
    name: s.name,
    code: s.code,
  }));
  const subjectByName = new Map(subjects.map(s => [s.name, s]));

  // --- Teachers ---
  const teachers: Teacher[] = [];
  const teachersBySubject = new Map<string, Teacher[]>();
  let tCounter = 0;
  for (const spec of SUBJECTS) {
    const n = TEACHERS_PER_SUBJECT[spec.name];
    const list: Teacher[] = [];
    for (let i = 0; i < n; i++) {
      const t: Teacher = {
        id: id('t', tCounter),
        name: `${spec.code}-${i + 1}`,
        longName: `Вчитель ${spec.name} №${i + 1}`,
        targetNumberOfHours: 22,
        qualifiedSubjects: [subjectByName.get(spec.name)!.id],
      };
      teachers.push(t);
      list.push(t);
      tCounter++;
    }
    teachersBySubject.set(spec.name, list);
  }

  // --- Buildings & Rooms (~35) ---
  const buildings: Building[] = [{ id: 'b_main', name: 'Головний корпус' }];
  const rooms: Room[] = [];
  // 30 general classrooms
  for (let i = 0; i < 30; i++) {
    rooms.push({
      id: id('r_cls', i),
      name: `К-${101 + i}`,
      capacity: 30,
      buildingId: 'b_main',
      isVirtual: false,
    });
  }
  // Specialised rooms tagged by preferredRoomTag
  const specialised = [
    { tag: 'phys', name: 'Фізкабінет' },
    { tag: 'chem', name: 'Хімкабінет' },
    { tag: 'comp', name: 'Компʼютерний кабінет-1' },
    { tag: 'comp', name: 'Компʼютерний кабінет-2' },
    { tag: 'gym',  name: 'Спортзал' },
  ];
  const roomsByTag = new Map<string, Room[]>();
  specialised.forEach((s, i) => {
    const r: Room = {
      id: id('r_spec', i),
      name: s.name,
      capacity: 30,
      buildingId: 'b_main',
      isVirtual: false,
    };
    rooms.push(r);
    const list = roomsByTag.get(s.tag) ?? [];
    list.push(r);
    roomsByTag.set(s.tag, list);
  });
  // Total rooms = 30 + 5 = 35.

  // --- Students structure: year → group (class) → 2 subgroups for split subjects ---
  const studentsYears: StudentsYear[] = [];
  const studentsGroups: StudentsGroup[] = [];
  const studentsSubgroups: StudentsSubgroup[] = [];
  const classSubgroups = new Map<string, [StudentsSubgroup, StudentsSubgroup]>(); // classGroupId → [sgA, sgB]

  for (const [gradeStr, parallels] of Object.entries(CLASS_PARALLELS)) {
    const grade = Number(gradeStr);
    const yearId = id('yr', grade);
    const groupIds: string[] = [];

    for (const p of parallels) {
      const groupId = id('grp', `${grade}${p}`);
      groupIds.push(groupId);

      const sgAId = id('sg', `${grade}${p}A`);
      const sgBId = id('sg', `${grade}${p}B`);

      const sgA: StudentsSubgroup = {
        id: sgAId,
        name: `${grade}-${p}/A`,
        numberOfStudents: 15,
        type: STUDENTS_SUBGROUP,
      };
      const sgB: StudentsSubgroup = {
        id: sgBId,
        name: `${grade}-${p}/B`,
        numberOfStudents: 15,
        type: STUDENTS_SUBGROUP,
      };
      studentsSubgroups.push(sgA, sgB);
      classSubgroups.set(groupId, [sgA, sgB]);

      studentsGroups.push({
        id: groupId,
        name: `${grade}-${p}`,
        numberOfStudents: 30,
        type: STUDENTS_GROUP,
        subgroups: [sgAId, sgBId],
      });
    }

    studentsYears.push({
      id: yearId,
      name: String(grade),
      numberOfStudents: parallels.length * 30,
      type: STUDENTS_YEAR,
      groups: groupIds,
      divisions: [],
      separator: '-',
    });
  }

  // --- Activities ---
  const activities: Activity[] = [];
  let aCounter = 0;
  let activityGroupCounter = 1;

  // Simple round-robin teacher assignment per subject
  const teacherCursor = new Map<string, number>();

  function nextTeacher(subjectName: string): Teacher {
    const list = teachersBySubject.get(subjectName)!;
    const i = teacherCursor.get(subjectName) ?? 0;
    teacherCursor.set(subjectName, (i + 1) % list.length);
    return list[i];
  }

  for (const [gradeStr, parallels] of Object.entries(CLASS_PARALLELS)) {
    const grade = Number(gradeStr);
    for (const p of parallels) {
      const groupId = id('grp', `${grade}${p}`);
      const [sgA, sgB] = classSubgroups.get(groupId)!;

      for (const spec of SUBJECTS) {
        if (isSenior(grade) && SENIOR_DROP.has(spec.name)) continue;
        const subject = subjectByName.get(spec.name)!;

        for (let occ = 0; occ < spec.perWeek; occ++) {
          if (spec.split) {
            // Two parallel activities (one per subgroup) sharing an activityGroupId so
            // ActivitiesSameStartingTime could later be applied. For Phase 0 we
            // don't add that constraint (skipping subgroup pairing per plan).
            const grp = activityGroupCounter++;
            for (const sg of [sgA, sgB]) {
              activities.push({
                id: id('a', aCounter++),
                activityGroupId: grp,
                teacherIds: [nextTeacher(spec.name).id],
                subjectId: subject.id,
                activityTagIds: [],
                studentSetIds: [sg.id],
                duration: 1,
                totalDuration: 1,
                active: true,
                computeNTotalStudents: true,
                nTotalStudents: 15,
              });
            }
          } else {
            activities.push({
              id: id('a', aCounter++),
              activityGroupId: 0,
              teacherIds: [nextTeacher(spec.name).id],
              subjectId: subject.id,
              activityTagIds: [],
              studentSetIds: [groupId],
              duration: 1,
              totalDuration: 1,
              active: true,
              computeNTotalStudents: true,
              nTotalStudents: 30,
            });
          }
        }
      }
    }
  }

  // --- Constraints ---
  const timeConstraints: TimeConstraint[] = [];
  const spaceConstraints: SpaceConstraint[] = [];

  // TeacherMaxHoursDaily = 6 for all teachers
  for (const t of teachers) {
    timeConstraints.push({
      id: id('tc_maxh', t.id),
      type: 'TeacherMaxHoursDaily',
      weightPercentage: 100,
      active: true,
      // extra fields carried through parseConstraints via `any` cast
      // @ts-expect-error - constraint union lacks this member's fields; see ConstraintFields
      teacherId: t.id,
      // @ts-expect-error - constraint union lacks this member's fields; see ConstraintFields
      maxHours: 6,
    } as TimeConstraint);
  }

  // SubjectPreferredRoom(s) for tagged subjects
  for (const spec of SUBJECTS) {
    if (!spec.preferredRoomTag) continue;
    const tagged = roomsByTag.get(spec.preferredRoomTag) ?? [];
    if (tagged.length === 0) continue;
    const subject = subjectByName.get(spec.name)!;
    if (tagged.length === 1) {
      spaceConstraints.push({
        id: id('sc_spr', subject.id),
        type: 'SubjectPreferredRoom',
        weightPercentage: 100,
        active: true,
        // @ts-expect-error extended
        subjectId: subject.id,
        // @ts-expect-error - constraint union lacks this member's fields; see ConstraintFields
        roomId: tagged[0].id,
      } as SpaceConstraint);
    } else {
      spaceConstraints.push({
        id: id('sc_sprs', subject.id),
        type: 'SubjectPreferredRooms',
        weightPercentage: 100,
        active: true,
        // @ts-expect-error extended
        subjectId: subject.id,
        // @ts-expect-error - constraint union lacks this member's fields; see ConstraintFields
        roomIds: tagged.map(r => r.id),
      } as SpaceConstraint);
    }
  }

  return {
    rules,
    teachers,
    subjects,
    activityTags: [],
    studentsYears,
    studentsGroups,
    studentsSubgroups,
    activities,
    buildings,
    rooms,
    timeConstraints,
    spaceConstraints,
  };
}

// Convert to FETFile shape for .fet XML export.
export function seedToFETFile(seed: SeedResult): FETFile {
  return {
    version: '7.10.2',
    mode: seed.rules.mode,
    institutionName: seed.rules.institutionName,
    comments: 'Дзвоник Phase 0 validation dataset',
    daysOfTheWeek: seed.rules.daysOfTheWeek,
    hoursOfTheDay: seed.rules.hoursOfTheDay,
    subjects: seed.subjects,
    activityTags: seed.activityTags,
    teachers: seed.teachers,
    studentsYears: seed.studentsYears,
    studentsGroups: seed.studentsGroups,
    studentsSubgroups: seed.studentsSubgroups,
    activities: seed.activities,
    buildings: seed.buildings,
    rooms: seed.rooms,
    timeConstraints: seed.timeConstraints,
    spaceConstraints: seed.spaceConstraints,
  };
}
