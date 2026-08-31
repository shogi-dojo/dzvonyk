// SPDX-License-Identifier: AGPL-3.0-or-later
import { SyntheticRozBuilder } from '../../lib/rozFixture';

const DAYS = [1, 2, 4, 8, 16] as const;
const PERIODS_PER_DAY = 6;
const CLASS_ROTATION = 7;

export const MARKETING_SCHOOL_NAME = 'Ліцей Обрій-27';
export const MARKETING_ACADEMIC_YEAR = '2026/2027';

export const MARKETING_CLASSES = [
  '5-А',
  '5-Б',
  '5-В',
  '6-А',
  '6-Б',
  '6-В',
  '7-А',
  '7-Б',
  '7-В',
  '8-А',
  '8-Б',
  '8-В',
  '9-А',
  '9-Б',
  '10-А',
  '10-Б',
  '11-А',
  '11-Б',
] as const;

export const MARKETING_SUBJECTS = [
  'Українська мова',
  'Українська література',
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
  'Захист України',
] as const;

/**
 * Composite demo identities created solely for screenshots. They are not
 * sourced from a school, a .roz file, or a real staff directory.
 */
export const MARKETING_TEACHERS = [
  'Вербич Олена Ростиславівна',
  'Дібровенко Марко Ігорович',
  'Калинчук Соломія Андріївна',
  'Зорянський Богдан Миронович',
  'Левандівська Орися Тарасівна',
  'Світаненко Назар Романович',
  'Яснопільська Марія Остапівна',
  'Берегович Данило Юрійович',
  "Терновська Ірина Лук'янівна",
  'Соколовий Артем Васильович',
  'Росич Оксана Михайлівна',
  'Квітенко Павло Сергійович',
  'Данич Наталія Олегівна',
  'Ліщинська Віра Андріївна',
  'Озерний Максим Петрович',
  'Русанівська Ганна Ігорівна',
  'Барвінчук Юлія Віталіївна',
  'Мирненко Ілля Богданович',
  'Вільшанська Тетяна Сергіївна',
  'Степовик Роман Олексійович',
  'Деснянська Лариса Юріївна',
  'Кременецький Орест Павлович',
  'Волошина Дарина Максимівна',
  'Променюк Ярина Василівна',
  'Соловець Андрій Романович',
  'Кринична Марта Ігорівна',
  'Гайовий Денис Тарасович',
  'Розмай Олена Петрівна',
  'Долинчук Антон Богданович',
  'Черемшина Софія Андріївна',
  'Лісовий Михайло Романович',
  'Каштаницька Надія Олегівна',
  'Ранкович Владислав Сергійович',
] as const;

// Six lessons per day. Rotating this sequence by a coprime step gives every
// class the same weekly load while spreading subjects across the school grid.
const WEEKLY_SUBJECT_SEQUENCE = [
  0, 2, 4, 7, 12, 1,
  3, 0, 5, 9, 11, 4,
  2, 8, 14, 12, 6, 10,
  4, 3, 1, 7, 11, 5,
  2, 9, 8, 0, 12, 13,
] as const;

export interface MarketingFixtureStats {
  classes: number;
  subjects: number;
  teachers: number;
  lessons: number;
  placedHours: number;
}

export interface MarketingFixture {
  bytes: Uint8Array;
  stats: MarketingFixtureStats;
}

function slotsForClass(classIndex: number): number[][] {
  const slots = Array.from({ length: MARKETING_SUBJECTS.length }, () => [] as number[]);
  const offset = (classIndex * CLASS_ROTATION) % WEEKLY_SUBJECT_SEQUENCE.length;

  for (let slot = 0; slot < WEEKLY_SUBJECT_SEQUENCE.length; slot++) {
    const subjectIndex = WEEKLY_SUBJECT_SEQUENCE[(slot + offset) % WEEKLY_SUBJECT_SEQUENCE.length];
    slots[subjectIndex].push(slot);
  }

  return slots;
}

/**
 * Colour each subject's class-conflict graph. One colour is one teacher, so
 * classes whose occurrences overlap never receive the same teacher.
 */
function teacherIndexesBySubject(): number[][] {
  const classSlots = MARKETING_CLASSES.map((_, classIndex) => slotsForClass(classIndex));
  let teacherOffset = 0;

  const result = MARKETING_SUBJECTS.map((_, subjectIndex) => {
    const colors: number[] = [];

    for (let classIndex = 0; classIndex < MARKETING_CLASSES.length; classIndex++) {
      const current = new Set(classSlots[classIndex][subjectIndex]);
      const occupiedColors = new Set<number>();

      for (let previous = 0; previous < classIndex; previous++) {
        if (classSlots[previous][subjectIndex].some((slot) => current.has(slot))) {
          occupiedColors.add(colors[previous]);
        }
      }

      let color = 0;
      while (occupiedColors.has(color)) color++;
      colors.push(color);
    }

    const poolSize = Math.max(...colors) + 1;
    const teacherIndexes = colors.map((color) => teacherOffset + color);
    teacherOffset += poolSize;
    return teacherIndexes;
  });

  if (teacherOffset !== MARKETING_TEACHERS.length) {
    throw new Error(
      `Marketing fixture needs ${teacherOffset} teacher identities, received ${MARKETING_TEACHERS.length}`
    );
  }

  return result;
}

export function createMarketingRozFixture(): MarketingFixture {
  const builder = new SyntheticRozBuilder()
    .setSchool(MARKETING_SCHOOL_NAME, MARKETING_ACADEMIC_YEAR)
    .setSubjects([...MARKETING_SUBJECTS])
    .setTeachers([...MARKETING_TEACHERS])
    .setClasses([...MARKETING_CLASSES]);

  const teacherIndexes = teacherIndexesBySubject();
  let lessonId = 1;
  let placedHours = 0;

  MARKETING_CLASSES.forEach((_, classIndex) => {
    const slotsBySubject = slotsForClass(classIndex);

    slotsBySubject.forEach((slots, subjectIndex) => {
      if (slots.length === 0) return;

      const currentLessonId = lessonId++;
      // aSc stores five student sets per class; the first is "Весь клас".
      const wholeClassStudentIndex = classIndex * 5;
      builder.addLesson(
        currentLessonId,
        slots.length,
        subjectIndex,
        wholeClassStudentIndex,
        teacherIndexes[subjectIndex][classIndex]
      );

      for (const slot of slots) {
        const day = Math.floor(slot / PERIODS_PER_DAY);
        const period = (slot % PERIODS_PER_DAY) + 1;
        builder.addCard(currentLessonId, DAYS[day], period);
        placedHours++;
      }
    });
  });

  return {
    bytes: builder.build(),
    stats: {
      classes: MARKETING_CLASSES.length,
      subjects: MARKETING_SUBJECTS.length,
      teachers: MARKETING_TEACHERS.length,
      lessons: lessonId - 1,
      placedHours,
    },
  };
}
