import { describe, it, expect } from 'vitest';
import { parseROZFile } from './rozParser';
import { SyntheticRozBuilder, encodeCp1251 } from './rozFixture';

describe('rozParser', () => {
  it('should reject invalid magic header', () => {
    const invalidBytes = new Uint8Array([0, 1, 2, 3, 5, 65, 66, 67, 68, 69]);
    expect(() => parseROZFile(invalidBytes)).toThrow('Невірний формат файлу');
  });

  it('should reject too short buffer', () => {
    const tooShort = new Uint8Array([1, 2, 3]);
    expect(() => parseROZFile(tooShort)).toThrow('Невірний формат файлу');
  });

  it('should parse valid CP1251 Ukrainian school, subjects, and teachers', () => {
    const builder = new SyntheticRozBuilder()
      .setSchool('Гімназія №1', '2026/2027')
      .setSubjects(['Українська мова', 'Математика'])
      .setTeachers(['Сисова Оксана', 'Грибок Лариса'])
      .setClasses(['5-А'])
      .addLesson(1, 2, 0, 0, 0)
      .addCard(1, 1, 1) // Mon, period 1
      .addCard(1, 2, 2); // Tue, period 2

    const res = parseROZFile(builder.build());
    expect(res.report.schoolName).toBe('Гімназія №1');
    expect(res.report.year).toBe('2026/2027');
    expect(res.file.subjects.map((s) => s.name)).toEqual(['Українська мова', 'Математика']);
    expect(res.file.teachers.map((t) => t.name)).toEqual(['Сисова Оксана', 'Грибок Лариса']);
    expect(res.file.studentsGroups.map((g) => g.name)).toEqual(['5-А']);
    expect(res.file.studentsYears.map((y) => y.name)).toEqual(['5']);
  });

  it('should enforce window k id and window k+1 payload rule', () => {
    const builder = new SyntheticRozBuilder()
      .setClasses(['5-А'])
      .setSubjects(['Українська мова', 'Математика'])
      .setTeachers(['Сисова Оксана', 'Грибок Лариса'])
      .addLesson(101, 3, 0, 0, 0) // Lesson 101: 3h, subj 0, students 0 (5-А), teacher 0
      .addLesson(102, 2, 1, 1, 1) // Lesson 102: 2h, subj 1, students 1 (5-А 1 група), teacher 1
      .addCard(101, 1, 1)
      .addCard(101, 2, 1)
      .addCard(101, 4, 1)
      .addCard(102, 8, 2)
      .addCard(102, 16, 2);

    const res = parseROZFile(builder.build());
    expect(res.report.counts.lessons).toBe(2);
    expect(res.report.counts.hours).toBe(5);
    expect(res.file.activities).toHaveLength(5);

    // First 3 activities belong to lesson 101
    const lesson101Acts = res.file.activities.filter((a) => a.activityGroupId === 101);
    expect(lesson101Acts).toHaveLength(3);
    expect(lesson101Acts[0].subjectId).toBe('Українська мова');
    expect(lesson101Acts[0].studentSetIds).toEqual(['5-А']);
    expect(lesson101Acts[0].teacherIds).toEqual(['Сисова Оксана']);

    // Next 2 activities belong to lesson 102
    const lesson102Acts = res.file.activities.filter((a) => a.activityGroupId === 102);
    expect(lesson102Acts).toHaveLength(2);
    expect(lesson102Acts[0].subjectId).toBe('Математика');
    expect(lesson102Acts[0].studentSetIds).toEqual(['5-А 1 група']);
    expect(lesson102Acts[0].teacherIds).toEqual(['Грибок Лариса']);
  });

  it('should generate N activities for N hours with 1:1 placement mapping', () => {
    const builder = new SyntheticRozBuilder()
      .setClasses(['5-А'])
      .addLesson(1, 4, 0, 0, 0)
      .addCard(1, 1, 1)  // Mon, period 1 -> hour 0
      .addCard(1, 2, 2)  // Tue, period 2 -> hour 1
      .addCard(1, 4, 3); // Wed, period 3 -> hour 2 (4th hour is unplaced)

    const res = parseROZFile(builder.build());
    expect(res.file.activities).toHaveLength(4);
    expect(res.placements).toHaveLength(3);
    expect(res.report.unplacedHours).toBe(1);

    expect(res.placements[0]).toEqual({
      activityId: res.file.activities[0].id,
      day: 0,
      hour: 0,
    });
    expect(res.placements[1]).toEqual({
      activityId: res.file.activities[1].id,
      day: 1,
      hour: 1,
    });
    expect(res.placements[2]).toEqual({
      activityId: res.file.activities[2].id,
      day: 2,
      hour: 2,
    });
  });

  it('should map card day bitmask and period correctly to hour (period - 1)', () => {
    const builder = new SyntheticRozBuilder()
      .setClasses(['5-А'])
      .addLesson(1, 5, 0, 0, 0)
      .addCard(1, 1, 1)   // Mon -> day 0, period 1 -> hour 0
      .addCard(1, 2, 3)   // Tue -> day 1, period 3 -> hour 2
      .addCard(1, 4, 5)   // Wed -> day 2, period 5 -> hour 4
      .addCard(1, 8, 7)   // Thu -> day 3, period 7 -> hour 6
      .addCard(1, 16, 9); // Fri -> day 4, period 9 -> hour 8

    const res = parseROZFile(builder.build());
    expect(res.placements).toHaveLength(5);
    expect(res.placements.map((p) => ({ day: p.day, hour: p.hour }))).toEqual([
      { day: 0, hour: 0 },
      { day: 1, hour: 2 },
      { day: 2, hour: 4 },
      { day: 3, hour: 6 },
      { day: 4, hour: 8 },
    ]);
  });

  it('should deduplicate duplicate subject names', () => {
    const builder = new SyntheticRozBuilder()
      .setSubjects(['Математика', 'Математика'])
      .setTeachers(['Коваль Світлана', 'Грибок Лариса'])
      .setClasses(['5-А'])
      .addLesson(1, 1, 0, 0, 0)
      .addLesson(2, 1, 1, 0, 1)
      .addCard(1, 1, 1)
      .addCard(2, 2, 1);

    const res = parseROZFile(builder.build());
    expect(res.file.subjects.map((s) => s.name)).toEqual(['Математика', 'Математика (2)']);
    expect(res.file.teachers.map((t) => t.name)).toEqual(['Коваль Світлана', 'Грибок Лариса']);
    expect(res.report.warnings.some((w) => w.key === 'duplicateNamesResolved')).toBe(true);
  });

  it('should detect two-shift schedules correctly', () => {
    const builder = new SyntheticRozBuilder()
      .setClasses(['5-А', '7-А'])
      // 5-А: uses period 1..8, never period 9
      .addLesson(1, 2, 0, 0, 0) // 5-А
      .addCard(1, 1, 1) // Mon period 1
      .addCard(1, 2, 8) // Tue period 8
      // 7-А: uses period 2..9, never period 1 (students index 5 = 7-А 'Весь клас')
      .addLesson(2, 2, 1, 5, 1) // 7-А
      .addCard(2, 1, 2) // Mon period 2
      .addCard(2, 2, 9); // Tue period 9

    const res = parseROZFile(builder.build());
    expect(res.shifts).toBeDefined();
    expect(res.shifts).toEqual({
      shift1: { firstHour: 0, lastHour: 7 }, // periods 1..8
      shift2: { firstHour: 1, lastHour: 8 }, // periods 2..9
    });

    const g5A = res.file.studentsGroups.find((g) => g.name === '5-А');
    const g7A = res.file.studentsGroups.find((g) => g.name === '7-А');
    expect(g5A?.shift).toBe(1);
    expect(g7A?.shift).toBe(2);
  });

  it('should reject out-of-range entity indices in lesson records without crashing', () => {
    const builder = new SyntheticRozBuilder()
      .setSubjects(['Математика'])
      .setTeachers(['Сисова Оксана'])
      .setClasses(['5-А'])
      .addLesson(1, 2, 0, 0, 0) // Valid lesson
      .addLesson(999, 2, 99, 99, 99) // Invalid out-of-range lesson
      .addCard(1, 1, 1)
      .addCard(1, 2, 1);

    const res = parseROZFile(builder.build());
    expect(res.report.counts.lessons).toBe(1);
    expect(res.file.activities).toHaveLength(2);
  });

  it('should warn rather than silently drop unrecognised lesson records', () => {
    const res = parseROZFile(
      new SyntheticRozBuilder()
        .setSubjects(['Математика'])
        .setTeachers(['Сисова Оксана'])
        .setClasses(['5-А'])
        .addLesson(1, 2, 0, 0, 0)
        .addLesson(2, 2, 99, 99, 99)
        .addCard(1, 1, 1)
        .addCard(1, 2, 1)
        .build()
    );
    expect(res.report.warnings.find((w) => w.key === 'skippedLessons')?.params?.count).toBe(1);
  });

  it('should refuse a file whose lesson records are mostly unrecognised', () => {
    const builder = new SyntheticRozBuilder()
      .setSubjects(['Математика'])
      .setTeachers(['Сисова Оксана'])
      .setClasses(['5-А'])
      .addLesson(1, 2, 0, 0, 0);
    for (let i = 2; i <= 6; i++) builder.addLesson(i, 2, 99, 99, 99);

    expect(() => parseROZFile(builder.build())).toThrow(/не вдалося розпізнати структуру файлу/i);
  });

  it('should warn when a lesson carries more cards than declared hours', () => {
    const res = parseROZFile(
      new SyntheticRozBuilder()
        .setSubjects(['Математика'])
        .setTeachers(['Сисова Оксана'])
        .setClasses(['5-А'])
        .addLesson(1, 1, 0, 0, 0)
        .addCard(1, 1, 1)
        .addCard(1, 2, 3)
        .build()
    );
    expect(res.report.warnings.find((w) => w.key === 'droppedCards')?.params?.count).toBe(1);
    expect(res.placements).toHaveLength(1);
  });

  it('should keep two distinct teachers who share a name instead of shifting indices', () => {
    const res = parseROZFile(
      new SyntheticRozBuilder()
        .setSubjects(['Математика'])
        .setTeachers(['Ткачук Ігор', 'Грибок Лариса', 'Ткачук Ігор'])
        .setClasses(['5-А'])
        .addLesson(1, 1, 0, 0, 2)
        .addCard(1, 1, 1)
        .build()
    );
    expect(res.file.teachers.map((t) => t.name)).toEqual([
      'Ткачук Ігор',
      'Грибок Лариса',
      'Ткачук Ігор (2)',
    ]);
    // The lesson references teacher index 2, which must still resolve to the last entry.
    expect(res.file.activities[0].teacherIds).toEqual(['Ткачук Ігор (2)']);
  });
});
