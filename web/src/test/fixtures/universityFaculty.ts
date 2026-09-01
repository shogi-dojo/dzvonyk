// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * A realistic fictional university faculty, emitted as a .fet file.
 *
 * The school-side marketing fixture builds a .roz binary, which is a
 * school-only format with no notion of courses, groups or streams. A
 * university needs the .fet shape instead: several courses (курси), each split
 * into academic groups, and lectures that address a whole course at once —
 * the потік that only the academic presets enable.
 *
 * No name here is copied from a real institution or staff directory.
 */

export const UNIVERSITY_NAME = 'Політехнічний університет «Дніпро-Захід»';
export const UNIVERSITY_ACADEMIC_YEAR = '2026/2027';

/** Курси (years of study), each holding its academic groups. */
export const UNIVERSITY_COURSES = [
  { name: '1 курс', groups: ['КН-11', 'КН-12', 'КН-13', 'ІПЗ-11', 'ІПЗ-12'] },
  { name: '2 курс', groups: ['КН-21', 'КН-22', 'ІПЗ-21', 'ІПЗ-22'] },
  { name: '3 курс', groups: ['КН-31', 'КН-32', 'ІПЗ-31'] },
  { name: '4 курс', groups: ['КН-41', 'ІПЗ-41'] },
] as const;

export const UNIVERSITY_GROUPS = UNIVERSITY_COURSES.flatMap((course) => course.groups);

/** Each group splits into two subgroups for labs. */
export const SUBGROUPS_PER_GROUP = 2;

export const UNIVERSITY_SUBJECTS = [
  'Вища математика',
  'Дискретна математика',
  'Алгоритми та структури даних',
  'Програмування',
  'Обʼєктно-орієнтоване програмування',
  'Бази даних',
  'Операційні системи',
  'Компʼютерні мережі',
  'Архітектура компʼютерів',
  'Теорія ймовірностей',
  'Іноземна мова за професійним спрямуванням',
  'Філософія',
  'Історія України та української культури',
  'Фізичне виховання',
  'Штучний інтелект',
  'Веброзробка',
  'Захист інформації',
  'Методи оптимізації',
] as const;

type SubjectName = (typeof UNIVERSITY_SUBJECTS)[number];

interface LecturerProfile {
  name: string;
  /** Академічне звання — universities show it where schools show nothing. */
  rank: 'професор' | 'доцент' | 'старший викладач' | 'асистент';
  subjects: SubjectName[];
}

/**
 * Fictional lecturers. Ukrainian academic staffing puts professors on the
 * lecture streams and assistants on the lab subgroups, so the workload numbers
 * below spread the way a real faculty's do.
 */
const LECTURER_PROFILES: readonly LecturerProfile[] = [
  { name: 'Гончаренко Віктор Павлович', rank: 'професор', subjects: ['Вища математика', 'Методи оптимізації'] },
  { name: 'Дяченко Ірина Миколаївна', rank: 'професор', subjects: ['Дискретна математика', 'Теорія ймовірностей'] },
  { name: 'Захарченко Олег Степанович', rank: 'професор', subjects: ['Алгоритми та структури даних', 'Штучний інтелект'] },
  { name: 'Мельниченко Ольга Вадимівна', rank: 'доцент', subjects: ['Програмування', 'Обʼєктно-орієнтоване програмування'] },
  { name: 'Пилипенко Роман Ігорович', rank: 'доцент', subjects: ['Бази даних', 'Веброзробка'] },
  { name: 'Соколенко Наталія Андріївна', rank: 'доцент', subjects: ['Операційні системи', 'Архітектура компʼютерів'] },
  { name: 'Верещак Дмитро Олексійович', rank: 'доцент', subjects: ['Компʼютерні мережі', 'Захист інформації'] },
  { name: 'Кириленко Тетяна Борисівна', rank: 'старший викладач', subjects: ['Іноземна мова за професійним спрямуванням'] },
  { name: 'Мірошник Ганна Русланівна', rank: 'старший викладач', subjects: ['Іноземна мова за професійним спрямуванням'] },
  { name: 'Онищенко Богдан Тарасович', rank: 'доцент', subjects: ['Філософія', 'Історія України та української культури'] },
  { name: 'Ярошенко Софія Валеріївна', rank: 'асистент', subjects: ['Програмування', 'Веброзробка'] },
  { name: 'Литвиненко Артем Сергійович', rank: 'асистент', subjects: ['Алгоритми та структури даних', 'Бази даних'] },
  { name: 'Демченко Юрій Анатолійович', rank: 'асистент', subjects: ['Операційні системи', 'Компʼютерні мережі'] },
  { name: 'Слободян Марія Петрівна', rank: 'асистент', subjects: ['Вища математика', 'Дискретна математика'] },
  { name: 'Гнатюк Владислав Ігорович', rank: 'старший викладач', subjects: ['Фізичне виховання'] },
] as const;

export const UNIVERSITY_LECTURERS = LECTURER_PROFILES.map((p) => p.name);

/** Аудиторії: lecture halls hold a whole stream, labs hold one subgroup. */
export const UNIVERSITY_ROOMS = [
  { name: 'Ауд. 101', building: 'Корпус 1', capacity: 150 },
  { name: 'Ауд. 102', building: 'Корпус 1', capacity: 150 },
  { name: 'Ауд. 205', building: 'Корпус 1', capacity: 60 },
  { name: 'Ауд. 206', building: 'Корпус 1', capacity: 60 },
  { name: 'Ауд. 207', building: 'Корпус 1', capacity: 60 },
  { name: 'Лаб. 310', building: 'Корпус 2', capacity: 15 },
  { name: 'Лаб. 311', building: 'Корпус 2', capacity: 15 },
  { name: 'Лаб. 312', building: 'Корпус 2', capacity: 15 },
  { name: 'Лаб. 313', building: 'Корпус 2', capacity: 15 },
  { name: 'Спортзал', building: 'Корпус 3', capacity: 80 },
] as const;

export type ActivityKind = 'lecture' | 'seminar' | 'lab';

export interface UniversityActivity {
  id: number;
  subject: SubjectName;
  teacher: string;
  /** One entry = a whole course (потік); several = the groups it addresses. */
  studentSets: string[];
  kind: ActivityKind;
  duration: number;
}

export interface UniversityFixtureStats {
  courses: number;
  groups: number;
  subgroups: number;
  lecturers: number;
  subjects: number;
  rooms: number;
  activities: number;
  streamLectures: number;
  /** Groups addressed by the single largest stream lecture. */
  largestStreamGroups: number;
}

export interface UniversityFixture {
  xml: string;
  stats: UniversityFixtureStats;
  activities: UniversityActivity[];
}

function lecturerFor(subject: SubjectName, rankPreference: ActivityKind, salt: number): string {
  const candidates = LECTURER_PROFILES.filter((p) => p.subjects.includes(subject));
  if (candidates.length === 0) return LECTURER_PROFILES[0].name;

  // Lectures go to senior staff, labs to assistants — as a real faculty does.
  const senior = candidates.filter((p) => p.rank === 'професор' || p.rank === 'доцент');
  const junior = candidates.filter((p) => p.rank === 'асистент' || p.rank === 'старший викладач');
  const pool =
    rankPreference === 'lecture'
      ? senior.length > 0 ? senior : candidates
      : junior.length > 0 ? junior : candidates;

  return pool[salt % pool.length].name;
}

/** The taught plan of one course: which subjects, and how they are delivered. */
function planForCourse(courseIndex: number): SubjectName[] {
  const plans: SubjectName[][] = [
    [
      'Вища математика',
      'Дискретна математика',
      'Програмування',
      'Іноземна мова за професійним спрямуванням',
      'Історія України та української культури',
      'Фізичне виховання',
    ],
    [
      'Алгоритми та структури даних',
      'Обʼєктно-орієнтоване програмування',
      'Теорія ймовірностей',
      'Архітектура компʼютерів',
      'Іноземна мова за професійним спрямуванням',
      'Філософія',
    ],
    [
      'Бази даних',
      'Операційні системи',
      'Компʼютерні мережі',
      'Веброзробка',
      'Методи оптимізації',
    ],
    ['Штучний інтелект', 'Захист інформації', 'Бази даних', 'Веброзробка'],
  ];
  return plans[courseIndex];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subgroupNames(group: string): string[] {
  return Array.from({ length: SUBGROUPS_PER_GROUP }, (_, i) => `${group}-${i + 1}`);
}

/**
 * Builds the activity plan.
 *
 * Lectures are streams: one activity naming every group of the course, so the
 * lecturer teaches it once. Seminars are per group, labs are per subgroup.
 * This is exactly the arithmetic the workload panel and preflight must treat
 * differently, so the numbers below are the test's subject matter.
 */
function buildActivities(): UniversityActivity[] {
  const activities: UniversityActivity[] = [];
  let id = 1;

  UNIVERSITY_COURSES.forEach((course, courseIndex) => {
    const subjects = planForCourse(courseIndex);

    subjects.forEach((subject, subjectIndex) => {
      const physical = subject === 'Фізичне виховання';

      if (!physical) {
        // Лекція-потік: one activity for the entire course.
        activities.push({
          id: id++,
          subject,
          teacher: lecturerFor(subject, 'lecture', courseIndex + subjectIndex),
          studentSets: [...course.groups],
          kind: 'lecture',
          duration: 1,
        });
      }

      // Семінар / практичне: one per group.
      course.groups.forEach((group, groupIndex) => {
        activities.push({
          id: id++,
          subject,
          teacher: lecturerFor(subject, 'seminar', courseIndex + groupIndex + subjectIndex),
          studentSets: [group],
          kind: physical ? 'seminar' : 'seminar',
          duration: 1,
        });
      });

      // Лабораторна: one per subgroup, only for the hands-on subjects.
      const hasLab = [
        'Програмування',
        'Обʼєктно-орієнтоване програмування',
        'Бази даних',
        'Операційні системи',
        'Компʼютерні мережі',
        'Веброзробка',
        'Алгоритми та структури даних',
        'Штучний інтелект',
      ].includes(subject);

      if (hasLab) {
        course.groups.forEach((group, groupIndex) => {
          subgroupNames(group).forEach((subgroup, subIndex) => {
            activities.push({
              id: id++,
              subject,
              teacher: lecturerFor(subject, 'lab', courseIndex + groupIndex + subIndex),
              studentSets: [subgroup],
              kind: 'lab',
              duration: 1,
            });
          });
        });
      }
    });
  });

  return activities;
}

export function createUniversityFetFixture(): UniversityFixture {
  const activities = buildActivities();

  const days = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця'];
  // Шість пар — the university preset's own default day length.
  const hours = Array.from({ length: 6 }, (_, i) => `${i + 1} пара`);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<fet version="7.5.1">\n\n';
  xml += '<Mode>Official</Mode>\n\n';
  xml += `<Institution_Name>${escapeXml(UNIVERSITY_NAME)}</Institution_Name>\n\n`;
  xml += `<Comments>${escapeXml(`Навчальний рік ${UNIVERSITY_ACADEMIC_YEAR}`)}</Comments>\n\n`;

  xml += '<Days_List>\n';
  xml += `<Number_of_Days>${days.length}</Number_of_Days>\n`;
  for (const day of days) xml += `<Day><Name>${escapeXml(day)}</Name></Day>\n`;
  xml += '</Days_List>\n\n';

  xml += '<Hours_List>\n';
  xml += `<Number_of_Hours>${hours.length}</Number_of_Hours>\n`;
  for (const hour of hours) xml += `<Hour><Name>${escapeXml(hour)}</Name></Hour>\n`;
  xml += '</Hours_List>\n\n';

  xml += '<Subjects_List>\n';
  for (const subject of UNIVERSITY_SUBJECTS) {
    xml += `<Subject><Name>${escapeXml(subject)}</Name></Subject>\n`;
  }
  xml += '</Subjects_List>\n\n';

  xml += '<Activity_Tags_List></Activity_Tags_List>\n\n';

  xml += '<Teachers_List>\n';
  for (const profile of LECTURER_PROFILES) {
    xml += '<Teacher>\n';
    xml += `\t<Name>${escapeXml(profile.name)}</Name>\n`;
    xml += `\t<Comments>${escapeXml(profile.rank)}</Comments>\n`;
    xml += '</Teacher>\n';
  }
  xml += '</Teachers_List>\n\n';

  xml += '<Students_List>\n';
  for (const course of UNIVERSITY_COURSES) {
    const courseStudents = course.groups.length * 24;
    xml += '<Year>\n';
    xml += `\t<Name>${escapeXml(course.name)}</Name>\n`;
    xml += `\t<Number_of_Students>${courseStudents}</Number_of_Students>\n`;
    for (const group of course.groups) {
      xml += '\t<Group>\n';
      xml += `\t\t<Name>${escapeXml(group)}</Name>\n`;
      xml += '\t\t<Number_of_Students>24</Number_of_Students>\n';
      for (const subgroup of subgroupNames(group)) {
        xml += '\t\t<Subgroup>\n';
        xml += `\t\t\t<Name>${escapeXml(subgroup)}</Name>\n`;
        xml += '\t\t\t<Number_of_Students>12</Number_of_Students>\n';
        xml += '\t\t</Subgroup>\n';
      }
      xml += '\t</Group>\n';
    }
    xml += '</Year>\n';
  }
  xml += '</Students_List>\n\n';

  xml += '<Activities_List>\n';
  for (const activity of activities) {
    xml += '<Activity>\n';
    xml += `\t<Id>${activity.id}</Id>\n`;
    xml += `\t<Teacher>${escapeXml(activity.teacher)}</Teacher>\n`;
    xml += `\t<Subject>${escapeXml(activity.subject)}</Subject>\n`;
    for (const set of activity.studentSets) {
      xml += `\t<Students>${escapeXml(set)}</Students>\n`;
    }
    xml += `\t<Duration>${activity.duration}</Duration>\n`;
    xml += `\t<Total_Duration>${activity.duration}</Total_Duration>\n`;
    xml += '\t<Active>true</Active>\n';
    xml += '\t<Activity_Group_Id>0</Activity_Group_Id>\n';
    xml += '</Activity>\n';
  }
  xml += '</Activities_List>\n\n';

  xml += '<Buildings_List>\n';
  const buildings = [...new Set(UNIVERSITY_ROOMS.map((r) => r.building))];
  for (const building of buildings) {
    xml += `<Building><Name>${escapeXml(building)}</Name></Building>\n`;
  }
  xml += '</Buildings_List>\n\n';

  xml += '<Rooms_List>\n';
  for (const room of UNIVERSITY_ROOMS) {
    xml += '<Room>\n';
    xml += `\t<Name>${escapeXml(room.name)}</Name>\n`;
    xml += `\t<Building>${escapeXml(room.building)}</Building>\n`;
    xml += `\t<Capacity>${room.capacity}</Capacity>\n`;
    xml += '</Room>\n';
  }
  xml += '</Rooms_List>\n\n';

  xml += '<Time_Constraints_List>\n';
  xml += '<ConstraintBasicCompulsoryTime><Weight_Percentage>100</Weight_Percentage><Active>true</Active></ConstraintBasicCompulsoryTime>\n';
  xml += '</Time_Constraints_List>\n\n';

  xml += '<Space_Constraints_List>\n';
  xml += '<ConstraintBasicCompulsorySpace><Weight_Percentage>100</Weight_Percentage><Active>true</Active></ConstraintBasicCompulsorySpace>\n';
  xml += '</Space_Constraints_List>\n\n';

  xml += '</fet>\n';

  const streamLectures = activities.filter((a) => a.kind === 'lecture');

  return {
    xml,
    activities,
    stats: {
      courses: UNIVERSITY_COURSES.length,
      groups: UNIVERSITY_GROUPS.length,
      subgroups: UNIVERSITY_GROUPS.length * SUBGROUPS_PER_GROUP,
      lecturers: UNIVERSITY_LECTURERS.length,
      subjects: UNIVERSITY_SUBJECTS.length,
      rooms: UNIVERSITY_ROOMS.length,
      activities: activities.length,
      streamLectures: streamLectures.length,
      largestStreamGroups: Math.max(...streamLectures.map((a) => a.studentSets.length)),
    },
  };
}
