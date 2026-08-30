import type {
  Activity,
  Teacher,
  Room,
  Subject,
  TimetableRules,
  TimetableSolution,
  StudentsYear,
  StudentsGroup,
  StudentsSubgroup,
  TimeConstraint,
  TeacherNotAvailableTimesConstraint,
  StudentsSetNotAvailableTimesConstraint,
} from '@/types';

export function createTestTimetableData() {
  const rules: TimetableRules = {
    id: 'rules-test',
    institutionName: 'Гімназія №1',
    comments: '',
    mode: 0,
    modified: false,
    createdAt: new Date('2026-08-30T10:00:00Z'),
    updatedAt: new Date('2026-08-30T10:00:00Z'),
    nDaysPerWeek: 5,
    nHoursPerDay: 9,
    daysOfTheWeek: [
      { name: 'Понеділок' },
      { name: 'Вівторок' },
      { name: 'Середа' },
      { name: 'Четвер' },
      { name: 'Пʼятниця' },
    ],
    hoursOfTheDay: [
      { name: '1' },
      { name: '2' },
      { name: '3' },
      { name: '4' },
      { name: '5' },
      { name: '6' },
      { name: '7' },
      { name: '8' },
      { name: '9' },
    ],
    shifts: {
      shift1: { firstHour: 0, lastHour: 7 }, // periods 1-8
      shift2: { firstHour: 1, lastHour: 8 }, // periods 2-9
    },
  };

  const teachers: Teacher[] = [
    {
      id: 't-1',
      name: 'Вчитель А',
      targetNumberOfHours: 18,
      qualifiedSubjects: ['sub-math'],
    },
    {
      id: 't-2',
      name: 'Вчитель Б',
      targetNumberOfHours: 18,
      qualifiedSubjects: ['sub-lang'],
    },
    {
      id: 't-3',
      name: 'Вчитель В',
      targetNumberOfHours: 18,
      qualifiedSubjects: ['sub-hist'],
    },
  ];

  const subjects: Subject[] = [
    { id: 'sub-math', name: 'Математика', code: 'Ма', color: '#3b82f6' },
    { id: 'sub-lang', name: 'Українська мова', code: 'Ум', color: '#ef4444' },
    { id: 'sub-hist', name: 'Історія України', code: 'Іу', color: '#10b981' },
  ];

  const rooms: Room[] = [
    { id: 'r-101', name: '101', capacity: 30, isVirtual: false },
    { id: 'r-102', name: '102', capacity: 30, isVirtual: false },
  ];

  const subgroups: StudentsSubgroup[] = [
    { id: 'sg-5a-1', name: '5-А 1 група', numberOfStudents: 15, type: 3 },
    { id: 'sg-5a-2', name: '5-А 2 група', numberOfStudents: 15, type: 3 },
  ];

  const groups: StudentsGroup[] = [
    {
      id: 'g-5a',
      name: '5-А',
      numberOfStudents: 30,
      type: 2,
      subgroups: ['5-А 1 група', '5-А 2 група'],
      shift: 1,
    },
    {
      id: 'g-5b',
      name: '5-Б',
      numberOfStudents: 28,
      type: 2,
      subgroups: [],
      shift: 2,
    },
  ];

  const years: StudentsYear[] = [
    {
      id: 'y-5',
      name: '5 клас',
      numberOfStudents: 58,
      type: 1,
      groups: ['5-А', '5-Б'],
      divisions: [],
      separator: ' ',
    },
  ];

  const activities: Activity[] = [
    // 5-A Math (Teacher A, duration 1, shift 1)
    {
      id: 'act-1',
      activityGroupId: 1,
      teacherIds: ['Вчитель А'],
      subjectId: 'sub-math',
      activityTagIds: [],
      studentSetIds: ['5-А'],
      duration: 1,
      totalDuration: 1,
      active: true,
      computeNTotalStudents: true,
      nTotalStudents: 30,
    },
    // 5-A Ukrainian language (Teacher B, duration 1, shift 1)
    {
      id: 'act-2',
      activityGroupId: 2,
      teacherIds: ['Вчитель Б'],
      subjectId: 'sub-lang',
      activityTagIds: [],
      studentSetIds: ['5-А'],
      duration: 1,
      totalDuration: 1,
      active: true,
      computeNTotalStudents: true,
      nTotalStudents: 30,
    },
    // 5-B History (Teacher C, duration 2, shift 2)
    {
      id: 'act-3',
      activityGroupId: 3,
      teacherIds: ['Вчитель В'],
      subjectId: 'sub-hist',
      activityTagIds: [],
      studentSetIds: ['5-Б'],
      duration: 2,
      totalDuration: 2,
      active: true,
      computeNTotalStudents: true,
      nTotalStudents: 28,
    },
    // 5-A subgroup 1 Math (Teacher A, numerator)
    {
      id: 'act-4-num',
      activityGroupId: 4,
      teacherIds: ['Вчитель А'],
      subjectId: 'sub-math',
      activityTagIds: [],
      studentSetIds: ['5-А 1 група'],
      duration: 1,
      totalDuration: 1,
      active: true,
      computeNTotalStudents: true,
      nTotalStudents: 15,
      weekParity: 'numerator',
    },
    // 5-A subgroup 1 Lang (Teacher B, denominator)
    {
      id: 'act-5-den',
      activityGroupId: 5,
      teacherIds: ['Вчитель Б'],
      subjectId: 'sub-lang',
      activityTagIds: [],
      studentSetIds: ['5-А 1 група'],
      duration: 1,
      totalDuration: 1,
      active: true,
      computeNTotalStudents: true,
      nTotalStudents: 15,
      weekParity: 'denominator',
    },
  ];

  const timeConstraints: TimeConstraint[] = [
    {
      id: 'c-teacher-a-unavail',
      type: 'TeacherNotAvailableTimes',
      teacherId: 'Вчитель А',
      times: [{ day: 4, hour: 0 }], // Friday period 1
      weightPercentage: 100,
      active: true,
      comments: '',
    } as TeacherNotAvailableTimesConstraint,
    {
      id: 'c-5a-unavail',
      type: 'StudentsSetNotAvailableTimes',
      studentsSetId: '5-А',
      times: [{ day: 0, hour: 0 }], // Monday period 1
      weightPercentage: 100,
      active: true,
      comments: '',
    } as StudentsSetNotAvailableTimesConstraint,
  ];

  const solution: TimetableSolution = {
    id: 'sol-test-1',
    rulesId: 'rules-test',
    placements: [
      { activityId: 'act-1', day: 0, hour: 1, roomId: 'r-101' }, // Mon period 2
      { activityId: 'act-2', day: 1, hour: 2, roomId: 'r-102' }, // Tue period 3
      { activityId: 'act-3', day: 2, hour: 1 },                   // Wed period 2-3 (dur 2)
    ],
    conflicts: [],
    isComplete: true,
    generatedAt: new Date('2026-08-30T10:00:00Z'),
  };

  return {
    rules,
    teachers,
    subjects,
    rooms,
    subgroups,
    groups,
    years,
    activities,
    timeConstraints,
    solution,
  };
}
