// SPDX-License-Identifier: AGPL-3.0-or-later
import { SyntheticRozBuilder } from '../../lib/rozFixture';

const DAYS = [1, 2, 4, 8, 16] as const;
const PERIODS_PER_DAY = 9;
const EXTRA_SPLIT_CLASSES = 9;

export const MARKETING_SCHOOL_NAME = 'Ліцей Обрій-27';
export const MARKETING_ACADEMIC_YEAR = '2026/2027';

export const MARKETING_CLASSES = [
  '5-А', '5-Б', '5-В', '5-Г',
  '6-А', '6-Б', '6-В', '6-Г',
  '7-А', '7-Б', '7-В', '7-Г',
  '8-А', '8-Б', '8-В', '8-Г',
  '9-А', '9-Б', '9-В', '9-Г',
  '10-А', '10-Б', '10-В',
  '11-А', '11-Б',
] as const;

export const MARKETING_SUBJECTS = [
  'Українська мова',
  'Українська література',
  'Математика',
  'Алгебра',
  'Геометрія',
  'Англійська мова',
  'Історія України',
  'Всесвітня історія',
  'Фізика',
  'Хімія',
  'Біологія',
  'Географія',
  'Інформатика',
  'Фізична культура',
  'Мистецтво',
  'Технології',
  'Громадянська освіта',
  'Захист України',
  'Природничі науки',
  'Зарубіжна література',
] as const;

type SubjectName = (typeof MARKETING_SUBJECTS)[number];
type TeacherGroup =
  | 'ukrainian'
  | 'mathematics'
  | 'english'
  | 'history'
  | 'physics'
  | 'sciences'
  | 'informatics'
  | 'physicalEducation'
  | 'arts';

interface TeacherProfile {
  name: string;
  group: TeacherGroup;
  gender: 'female' | 'male';
}

/**
 * Familiar Ukrainian surnames paired into fictional demo identities. No name
 * is copied from the reference .roz files or from a real staff directory.
 */
const MARKETING_TEACHER_PROFILES: readonly TeacherProfile[] = [
  { name: 'Шевченко Олена Василівна', group: 'ukrainian', gender: 'female' },
  { name: 'Бондаренко Наталія Сергіївна', group: 'ukrainian', gender: 'female' },
  { name: 'Коваленко Ірина Олександрівна', group: 'ukrainian', gender: 'female' },
  { name: 'Ткаченко Марина Вікторівна', group: 'ukrainian', gender: 'female' },

  { name: 'Мельник Оксана Іванівна', group: 'mathematics', gender: 'female' },
  { name: 'Бойко Людмила Петрівна', group: 'mathematics', gender: 'female' },
  { name: 'Кравченко Тетяна Миколаївна', group: 'mathematics', gender: 'female' },
  { name: 'Олійник Світлана Андріївна', group: 'mathematics', gender: 'female' },
  { name: 'Козак Андрій Миколайович', group: 'mathematics', gender: 'male' },

  { name: 'Поліщук Ганна Володимирівна', group: 'english', gender: 'female' },
  { name: 'Савченко Юлія Романівна', group: 'english', gender: 'female' },
  { name: 'Романенко Алла Дмитрівна', group: 'english', gender: 'female' },
  { name: 'Лисенко Вікторія Юріївна', group: 'english', gender: 'female' },

  { name: 'Марченко Надія Олегівна', group: 'history', gender: 'female' },
  { name: 'Мороз Катерина Ігорівна', group: 'history', gender: 'female' },
  { name: 'Левченко Сергій Петрович', group: 'history', gender: 'male' },

  { name: 'Петренко Валентина Михайлівна', group: 'physics', gender: 'female' },
  { name: 'Мазур Олександр Іванович', group: 'physics', gender: 'male' },

  { name: 'Іваненко Дарина Павлівна', group: 'sciences', gender: 'female' },
  { name: 'Ковальчук Людмила Богданівна', group: 'sciences', gender: 'female' },
  { name: 'Гриценко Інна Василівна', group: 'sciences', gender: 'female' },
  { name: 'Павленко Ольга Сергіївна', group: 'sciences', gender: 'female' },
  { name: 'Кравчук Віталій Олегович', group: 'sciences', gender: 'male' },

  { name: 'Кучеренко Анна Олексіївна', group: 'informatics', gender: 'female' },
  { name: 'Тимошенко Марія Віталіївна', group: 'informatics', gender: 'female' },
  { name: 'Бондар Володимир Андрійович', group: 'informatics', gender: 'male' },

  { name: 'Руденко Лариса Анатоліївна', group: 'physicalEducation', gender: 'female' },
  { name: 'Ткачук Роман Васильович', group: 'physicalEducation', gender: 'male' },
  { name: 'Савчук Дмитро Юрійович', group: 'physicalEducation', gender: 'male' },

  { name: 'Сидоренко Євгенія Вікторівна', group: 'arts', gender: 'female' },
  { name: 'Панченко Анастасія Юріївна', group: 'arts', gender: 'female' },
] as const;

export const MARKETING_TEACHERS = MARKETING_TEACHER_PROFILES.map((profile) => profile.name);
export const MARKETING_WOMEN_COUNT = MARKETING_TEACHER_PROFILES.filter(
  (profile) => profile.gender === 'female'
).length;

const SUBJECT_TEACHER_GROUP: Record<SubjectName, TeacherGroup> = {
  'Українська мова': 'ukrainian',
  'Українська література': 'ukrainian',
  'Математика': 'mathematics',
  'Алгебра': 'mathematics',
  'Геометрія': 'mathematics',
  'Англійська мова': 'english',
  'Історія України': 'history',
  'Всесвітня історія': 'history',
  'Громадянська освіта': 'history',
  'Фізика': 'physics',
  'Захист України': 'physics',
  'Хімія': 'sciences',
  'Біологія': 'sciences',
  'Географія': 'sciences',
  'Природничі науки': 'sciences',
  'Інформатика': 'informatics',
  'Фізична культура': 'physicalEducation',
  'Мистецтво': 'arts',
  'Технології': 'arts',
  'Зарубіжна література': 'arts',
};

interface TemplateItem {
  subject: SubjectName;
  split: boolean;
}

interface CoursePlan {
  classIndex: number;
  studentSubIndex: 0 | 1 | 2;
  subject: SubjectName;
  slots: number[];
  teacherIndex?: number;
}

export interface MarketingFixtureStats {
  classes: number;
  subjects: number;
  teachers: number;
  women: number;
  lessons: number;
  classSlots: number;
  placedHours: number;
  splitPlacements: number;
  teacherLoadMin: number;
  teacherLoadMedian: number;
  teacherLoadMax: number;
  teacherGapsMedian: number;
}

export interface MarketingFixture {
  bytes: Uint8Array;
  stats: MarketingFixtureStats;
}

function repeat(subject: SubjectName, count: number): TemplateItem[] {
  return Array.from({ length: count }, () => ({ subject, split: false }));
}

function split(subject: SubjectName): TemplateItem {
  return { subject, split: true };
}

function englishBlock(extraSplit: boolean): TemplateItem[] {
  return extraSplit
    ? [repeat('Англійська мова', 1)[0], split('Англійська мова'), split('Англійська мова')]
    : [...repeat('Англійська мова', 2), split('Англійська мова')];
}

function templateForGrade(grade: number, extraSplit: boolean): TemplateItem[] {
  const english = englishBlock(extraSplit);

  if (grade <= 6) {
    return [
      ...repeat('Українська мова', 3),
      ...repeat('Українська література', 2),
      ...repeat('Математика', 4),
      ...english,
      ...repeat('Історія України', 1),
      ...repeat('Природничі науки', 2),
      ...repeat('Біологія', 1),
      ...repeat('Географія', 1),
      split('Інформатика'),
      ...repeat('Фізична культура', 3),
      ...repeat('Мистецтво', 1),
      ...repeat('Технології', 1),
      ...repeat('Зарубіжна література', 1),
    ];
  }

  if (grade <= 9) {
    return [
      ...repeat('Українська мова', 3),
      ...repeat('Українська література', 1),
      ...repeat('Алгебра', 3),
      ...repeat('Геометрія', 2),
      ...english,
      ...repeat('Історія України', 1),
      ...repeat('Всесвітня історія', 1),
      ...repeat('Фізика', 2),
      ...repeat('Хімія', 1),
      ...repeat('Біологія', 1),
      ...repeat('Географія', 1),
      split('Інформатика'),
      ...repeat('Фізична культура', 2),
      ...repeat('Мистецтво', 1),
      ...repeat('Зарубіжна література', 1),
    ];
  }

  return [
    ...repeat('Українська мова', 3),
    ...repeat('Українська література', 1),
    ...repeat('Алгебра', 2),
    ...repeat('Геометрія', 2),
    ...english,
    ...repeat('Історія України', 1),
    ...repeat('Всесвітня історія', 1),
    ...repeat('Фізика', 2),
    ...repeat('Хімія', 1),
    ...repeat('Біологія', 1),
    ...repeat('Географія', 1),
    split('Інформатика'),
    ...repeat('Фізична культура', 2),
    ...repeat('Захист України', 1),
    ...repeat('Громадянська освіта', 1),
    ...repeat('Зарубіжна література', 1),
  ];
}

function seededShuffle<T>(values: T[], seed: number): T[] {
  const result = [...values];
  let state = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function gradeOf(className: string): number {
  return Number.parseInt(className, 10);
}

function classShift(grade: number, classIndex: number): 0 | 1 | 2 {
  if (grade <= 6) return 0;
  if (grade === 7) return classIndex % 2 === 0 ? 0 : 1;
  if (grade <= 9) return classIndex % 2 === 0 ? 1 : 2;
  return 2;
}

/**
 * Twenty-four class slots over a nine-period day. Different shift bands and
 * deliberately skipped periods reproduce the spread seen in real .roz files.
 */
function slotsForClass(classIndex: number, grade: number): number[] {
  const shift = classShift(grade, classIndex);
  const slots: number[] = [];

  for (let day = 0; day < DAYS.length; day++) {
    const lessonCount = day === 4 ? 4 : 5;
    const candidates = Array.from({ length: 7 }, (_, hour) => hour + shift);
    const ranked = candidates
      .map((hour) => ({
        hour,
        rank: (hour * 11 + classIndex * 7 + day * 5 + (classIndex + day) ** 2) % 29,
      }))
      .sort((left, right) => left.rank - right.rank || left.hour - right.hour)
      .slice(0, lessonCount)
      .map(({ hour }) => hour)
      .sort((left, right) => left - right);

    for (const hour of ranked) slots.push(day * PERIODS_PER_DAY + hour);
  }

  return slots;
}

let lastSchedulingFailure = '';

function buildCourses(salt: number): CoursePlan[] | null {
  const courses = new Map<string, CoursePlan>();
  const groupDemandBySlot = new Map<number, Map<TeacherGroup, number>>();
  const groupCapacity = new Map<TeacherGroup, number>();
  for (const profile of MARKETING_TEACHER_PROFILES) {
    groupCapacity.set(profile.group, (groupCapacity.get(profile.group) ?? 0) + 1);
  }

  const classOrder = seededShuffle(
    [...MARKETING_CLASSES.entries()],
    99173 + salt * 31337
  );
  for (const [classIndex, className] of classOrder) {
    const grade = gradeOf(className);
    const template = templateForGrade(grade, classIndex < EXTRA_SPLIT_CLASSES);
    if (template.length !== 24) {
      throw new Error(`${className} has ${template.length} template slots instead of 24`);
    }

    const slots = slotsForClass(classIndex, grade);
    const remaining = seededShuffle(template, 20260831 + classIndex * 7919 + salt * 104729);
    const availableSlots = [...slots];
    const scheduledBySlot = new Map<number, TemplateItem>();
    const daySubjectCounts = new Map<string, number>();
    let searchNodes = 0;

    const placeNext = (): boolean => {
      searchNodes++;
      if (searchNodes > 100_000) return false;
      if (remaining.length === 0) return true;

      let selectedSlotPosition = -1;
      let selectedCandidates: Array<{
        item: TemplateItem;
        index: number;
        group: TeacherGroup;
        demand: number;
        score: number;
      }> = [];

      for (let slotPosition = 0; slotPosition < availableSlots.length; slotPosition++) {
        const slot = availableSlots[slotPosition];
        const day = Math.floor(slot / PERIODS_PER_DAY);
        const demandAtSlot = groupDemandBySlot.get(slot) ?? new Map<TeacherGroup, number>();
        const seenItems = new Set<string>();
        const candidates = remaining
          .map((item, index) => {
            const signature = `${item.subject}:${item.split}`;
            if (seenItems.has(signature)) return null;
            seenItems.add(signature);

            const group = SUBJECT_TEACHER_GROUP[item.subject];
            const demand = item.split ? 2 : 1;
            const currentDemand = demandAtSlot.get(group) ?? 0;
            if (currentDemand + demand > (groupCapacity.get(group) ?? 0)) return null;

            const sameSubjectToday = daySubjectCounts.get(`${day}:${item.subject}`) ?? 0;
            const tieBreak = (index * 17 + slot * 13 + classIndex * 11 + salt * 7) % 31;
            return {
              item,
              index,
              group,
              demand,
              score: sameSubjectToday * 1_000 + currentDemand * 50 + tieBreak,
            };
          })
          .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
          .sort((left, right) => left.score - right.score);

        if (candidates.length === 0) return false;
        if (selectedSlotPosition === -1 || candidates.length < selectedCandidates.length) {
          selectedSlotPosition = slotPosition;
          selectedCandidates = candidates;
        }
      }

      const slot = availableSlots[selectedSlotPosition];
      const day = Math.floor(slot / PERIODS_PER_DAY);
      const demandAtSlot = groupDemandBySlot.get(slot) ?? new Map<TeacherGroup, number>();

      for (const selected of selectedCandidates) {
        const previousDemand = demandAtSlot.get(selected.group) ?? 0;
        const subjectDayKey = `${day}:${selected.item.subject}`;
        const previousSubjectCount = daySubjectCounts.get(subjectDayKey) ?? 0;
        const [removedItem] = remaining.splice(selected.index, 1);
        availableSlots.splice(selectedSlotPosition, 1);
        scheduledBySlot.set(slot, selected.item);
        demandAtSlot.set(selected.group, previousDemand + selected.demand);
        groupDemandBySlot.set(slot, demandAtSlot);
        daySubjectCounts.set(subjectDayKey, previousSubjectCount + 1);

        if (placeNext()) return true;

        daySubjectCounts.set(subjectDayKey, previousSubjectCount);
        if (previousSubjectCount === 0) daySubjectCounts.delete(subjectDayKey);
        demandAtSlot.set(selected.group, previousDemand);
        if (previousDemand === 0) demandAtSlot.delete(selected.group);
        scheduledBySlot.delete(slot);
        availableSlots.splice(selectedSlotPosition, 0, slot);
        remaining.splice(selected.index, 0, removedItem);
      }

      return false;
    };

    if (!placeNext()) {
      lastSchedulingFailure = `${className}: exhausted ${searchNodes} placement states`;
      return null;
    }

    const scheduled = slots.map((slot) => scheduledBySlot.get(slot)!);

    scheduled.forEach((item, itemIndex) => {
      const studentSubIndexes: Array<0 | 1 | 2> = item.split ? [1, 2] : [0];
      for (const studentSubIndex of studentSubIndexes) {
        const key = `${classIndex}:${studentSubIndex}:${item.subject}`;
        const course = courses.get(key) ?? {
          classIndex,
          studentSubIndex,
          subject: item.subject,
          slots: [],
        };
        course.slots.push(slots[itemIndex]);
        courses.set(key, course);
      }
    });
  }

  if (courses.size === 0 || [...courses.values()].some((course) => course.slots.length === 0)) {
    return null;
  }
  return [...courses.values()];
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function teacherGapCounts(occupied: Set<number>[]): number[] {
  return occupied.map((slots) => {
    let gaps = 0;
    for (let day = 0; day < DAYS.length; day++) {
      const hours = [...slots]
        .filter((slot) => Math.floor(slot / PERIODS_PER_DAY) === day)
        .map((slot) => slot % PERIODS_PER_DAY)
        .sort((left, right) => left - right);
      if (hours.length > 1) gaps += hours[hours.length - 1] - hours[0] + 1 - hours.length;
    }
    return gaps;
  });
}

let lastAssignmentFailure = '';

function assignTeachers(courses: CoursePlan[]) {
  const teacherPools = new Map<TeacherGroup, number[]>();
  MARKETING_TEACHER_PROFILES.forEach((profile, teacherIndex) => {
    const pool = teacherPools.get(profile.group) ?? [];
    pool.push(teacherIndex);
    teacherPools.set(profile.group, pool);
  });

  const loads = Array.from({ length: MARKETING_TEACHERS.length }, () => 0);
  const occupied = Array.from(
    { length: MARKETING_TEACHERS.length },
    () => new Set<number>()
  );

  for (const [group, pool] of teacherPools) {
    const groupCourses = courses.filter(
      (course) => SUBJECT_TEACHER_GROUP[course.subject] === group
    );
    const slotSets = groupCourses.map((course) => new Set(course.slots));
    const neighbours = groupCourses.map(() => new Set<number>());

    for (let left = 0; left < groupCourses.length; left++) {
      for (let right = left + 1; right < groupCourses.length; right++) {
        if (groupCourses[left].slots.some((slot) => slotSets[right].has(slot))) {
          neighbours[left].add(right);
          neighbours[right].add(left);
        }
      }
    }

    const colours = Array.from({ length: groupCourses.length }, () => -1);
    const colourLoads = Array.from({ length: pool.length }, () => 0);

    for (let assignedCount = 0; assignedCount < groupCourses.length; assignedCount++) {
      let selected = -1;
      let selectedSaturation = -1;
      let selectedDegree = -1;
      let selectedHours = -1;

      for (let index = 0; index < groupCourses.length; index++) {
        if (colours[index] !== -1) continue;
        const saturation = new Set(
          [...neighbours[index]]
            .map((neighbour) => colours[neighbour])
            .filter((colour) => colour !== -1)
        ).size;
        const degree = neighbours[index].size;
        const hours = groupCourses[index].slots.length;
        if (
          saturation > selectedSaturation ||
          (saturation === selectedSaturation && degree > selectedDegree) ||
          (saturation === selectedSaturation && degree === selectedDegree && hours > selectedHours)
        ) {
          selected = index;
          selectedSaturation = saturation;
          selectedDegree = degree;
          selectedHours = hours;
        }
      }

      const blockedColours = new Set(
        [...neighbours[selected]]
          .map((neighbour) => colours[neighbour])
          .filter((colour) => colour !== -1)
      );
      const availableColours = pool
        .map((_, colour) => colour)
        .filter((colour) => !blockedColours.has(colour))
        .sort((left, right) => colourLoads[left] - colourLoads[right] || left - right);
      const colour = availableColours[0];
      if (colour === undefined) {
        lastAssignmentFailure = `${group}: ${groupCourses.length} courses, ${pool.length} teachers`;
        return null;
      }

      colours[selected] = colour;
      colourLoads[colour] += groupCourses[selected].slots.length;
    }

    groupCourses.forEach((course, index) => {
      const teacherIndex = pool[colours[index]];
      course.teacherIndex = teacherIndex;
      loads[teacherIndex] += course.slots.length;
      for (const slot of course.slots) occupied[teacherIndex].add(slot);
    });
  }

  return { courses, loads, occupied };
}

function createRealisticPlan() {
  let assignedPlans = 0;
  let bestSummary = '';
  for (let salt = 0; salt < 500; salt++) {
    const courses = buildCourses(salt);
    if (!courses) continue;
    const assigned = assignTeachers(courses);
    if (!assigned) continue;
    assignedPlans++;

    const minLoad = Math.min(...assigned.loads);
    const maxLoad = Math.max(...assigned.loads);
    const medianLoad = median(assigned.loads);
    const gapsMedian = median(teacherGapCounts(assigned.occupied));
    bestSummary = `min=${minLoad}, median=${medianLoad}, max=${maxLoad}, gaps=${gapsMedian}`;
    if (minLoad >= 14 && maxLoad >= 25 && maxLoad <= 31 && medianLoad >= 18 && gapsMedian >= 4) {
      return { ...assigned, gapsMedian };
    }
  }

  throw new Error(
    `Unable to create a collision-free realistic marketing timetable (${assignedPlans} assigned; ${bestSummary}; ${lastAssignmentFailure}; ${lastSchedulingFailure})`
  );
}

export function createMarketingRozFixture(): MarketingFixture {
  const builder = new SyntheticRozBuilder()
    .setSchool(MARKETING_SCHOOL_NAME, MARKETING_ACADEMIC_YEAR)
    .setSubjects([...MARKETING_SUBJECTS])
    .setTeachers([...MARKETING_TEACHERS])
    .setClasses([...MARKETING_CLASSES]);

  const plan = createRealisticPlan();
  let lessonId = 1;
  let placedHours = 0;
  let splitPlacements = 0;

  for (const course of plan.courses) {
    const currentLessonId = lessonId++;
    const subjectIndex = MARKETING_SUBJECTS.indexOf(course.subject);
    const studentIndex = course.classIndex * 5 + course.studentSubIndex;
    builder.addLesson(
      currentLessonId,
      course.slots.length,
      subjectIndex,
      studentIndex,
      course.teacherIndex!
    );

    for (const slot of course.slots) {
      const day = Math.floor(slot / PERIODS_PER_DAY);
      const period = (slot % PERIODS_PER_DAY) + 1;
      builder.addCard(currentLessonId, DAYS[day], period);
      placedHours++;
      if (course.studentSubIndex > 0) splitPlacements++;
    }
  }

  return {
    bytes: builder.build(),
    stats: {
      classes: MARKETING_CLASSES.length,
      subjects: MARKETING_SUBJECTS.length,
      teachers: MARKETING_TEACHERS.length,
      women: MARKETING_WOMEN_COUNT,
      lessons: lessonId - 1,
      classSlots: MARKETING_CLASSES.length * 24,
      placedHours,
      splitPlacements,
      teacherLoadMin: Math.min(...plan.loads),
      teacherLoadMedian: median(plan.loads),
      teacherLoadMax: Math.max(...plan.loads),
      teacherGapsMedian: plan.gapsMedian,
    },
  };
}
