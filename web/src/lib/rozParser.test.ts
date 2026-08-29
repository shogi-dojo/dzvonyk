import { describe, it, expect } from 'vitest';
import { parseROZFile } from './rozParser';

/**
 * Helper to encode strings in windows-1251 using TextEncoder or custom mapping for Cyrillic
 */
function encodeCp1251(str: string): Uint8Array {
  // We can use iconv-lite or buffer or custom byte mapping for test strings
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      // Map Ukrainian / Russian Cyrillic characters to CP1251
      // А-Я: 0x410..0x42F -> 0xC0..0xDF
      // а-я: 0x430..0x44F -> 0xE0..0xFF
      // Ґ: 0x490 -> 0xA5, ґ: 0x491 -> 0xB4
      // Є: 0x404 -> 0xAA, є: 0x454 -> 0xBA
      // І: 0x406 -> 0x49 (ASCII I) or 0xB2, і: 0x456 -> 0x69 (ASCII i) or 0xB3
      // Ї: 0x407 -> 0xAF, ї: 0x457 -> 0xBF
      // №: 0x2116 -> 0xB9, ’: 0x2019 -> 0x27
      if (code === 0x2116) {
        bytes.push(0xb9);
      } else if (code >= 0x410 && code <= 0x42f) {
        bytes.push(code - 0x410 + 0xc0);
      } else if (code >= 0x430 && code <= 0x44f) {
        bytes.push(code - 0x430 + 0xe0);
      } else if (code === 0x490) {
        bytes.push(0xa5);
      } else if (code === 0x491) {
        bytes.push(0xb4);
      } else if (code === 0x404) {
        bytes.push(0xaa);
      } else if (code === 0x454) {
        bytes.push(0xba);
      } else if (code === 0x406) {
        bytes.push(0xb2);
      } else if (code === 0x456) {
        bytes.push(0xb3);
      } else if (code === 0x407) {
        bytes.push(0xaf);
      } else if (code === 0x457) {
        bytes.push(0xbf);
      } else {
        bytes.push(0x3f); // '?' fallback
      }
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Synthetic .roz builder for testing
 */
class SyntheticRozBuilder {
  private school = 'Тестова школа';
  private year = '2026/2027';
  private subjects: string[] = ['Українська мова', 'Математика'];
  private teachers: string[] = ['Сисова Оксана', 'Грибок Лариса'];
  private classes: string[] = ['5-А', '7-А'];
  private groups = ['Весь клас', '1 група', '2 група', 'Хлопці', 'Дівчата'];
  private lessons: Array<{
    id: number;
    hours: number;
    subject: number;
    students: number;
    teacher: number;
  }> = [];
  private cards: Array<{
    lesson: number;
    dayBit: number;
    period: number;
  }> = [];

  setSchool(school: string, year: string) {
    this.school = school;
    this.year = year;
    return this;
  }

  setSubjects(subjects: string[]) {
    this.subjects = subjects;
    return this;
  }

  setTeachers(teachers: string[]) {
    this.teachers = teachers;
    return this;
  }

  setClasses(classes: string[]) {
    this.classes = classes;
    return this;
  }

  addLesson(id: number, hours: number, subject: number, students: number, teacher: number) {
    this.lessons.push({ id, hours, subject, students, teacher });
    return this;
  }

  addCard(lesson: number, dayBit: number, period: number) {
    this.cards.push({ lesson, dayBit, period });
    return this;
  }

  build(): Uint8Array {
    const chunks: Uint8Array[] = [];

    // Header: 4 bytes prefix + 1 byte len + "ASCTT"
    const header = new Uint8Array([0x52, 0x01, 0x00, 0x00, 0x05, 0x41, 0x53, 0x43, 0x54, 0x54]);
    chunks.push(header);

    // Helper to write length-prefixed CP1251 string
    function makePStr(str: string): Uint8Array {
      const enc = encodeCp1251(str);
      const res = new Uint8Array(1 + enc.length);
      res[0] = enc.length;
      res.set(enc, 1);
      return res;
    }

    // Helper for named-object record
    function makeNamedRecord(name: string, shortName: string): Uint8Array {
      const sig = new Uint8Array([
        0x00, 0x11, 0x22, 0x33, // RGB
        0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00, // signature (12 bytes)
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, // 8-byte guid
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 7 zeros
        0x02, // 2 strings count
      ]);
      const nStr = makePStr(name);
      const snStr = makePStr(shortName);
      const res = new Uint8Array(sig.length + nStr.length + snStr.length);
      res.set(sig, 0);
      res.set(nStr, sig.length);
      res.set(snStr, sig.length + nStr.length);
      return res;
    }

    // School and year markers
    chunks.push(makePStr('#1166'));
    chunks.push(makePStr(this.school));
    chunks.push(makePStr('#1167'));
    chunks.push(makePStr(this.year));

    // Subjects
    for (const subj of this.subjects) {
      chunks.push(makePStr('#3375'));
      chunks.push(makePStr(subj));
    }

    // Teachers (between last subject and first group)
    for (const teacher of this.teachers) {
      chunks.push(makePStr(teacher));
    }

    // Groups (5 per class, each starting with "Весь клас" as named-object)
    for (let c = 0; c < this.classes.length; c++) {
      for (const grp of this.groups) {
        chunks.push(makeNamedRecord(grp, ''));
      }
    }

    // Classes ("CLASSTT" <name> <name>)
    for (const cls of this.classes) {
      chunks.push(makePStr('CLASSTT'));
      chunks.push(makePStr(cls));
      chunks.push(makePStr(cls));
    }
    chunks.push(makePStr('CLASSTT_END'));

    // Lesson records (stride 183 bytes, signature 02 00 00 00 02 00 00 00 02 00 01 00 at offset 4)
    // Non-obvious rule: window k has id at 167; window k+1 has payload at 49, 66, 74, 82.
    // To encode N lessons, we write N + 1 raw windows.
    const rawWindowsCount = this.lessons.length > 0 ? this.lessons.length + 1 : 0;
    for (let k = 0; k < rawWindowsCount; k++) {
      const win = new Uint8Array(183);
      const view = new DataView(win.buffer);

      // Signature at offset 4: 02 00 00 00 02 00 00 00 02 00 01 00
      win.set([0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00], 4);

      if (k < this.lessons.length) {
        // Window k sets id for lesson k
        view.setInt32(167, this.lessons[k].id, true);
      }

      if (k > 0) {
        // Window k carries payload for lesson k - 1
        const prev = this.lessons[k - 1];
        view.setInt32(49, prev.hours, true);
        view.setInt32(66, prev.subject, true);
        view.setInt32(74, prev.students, true);
        view.setInt32(82, prev.teacher, true);
      }

      chunks.push(win);
    }

    // Cards (stride 75 bytes, sentinel 00 ff ff ff ff 00 00 00 at byte 32)
    // Write 10 cards minimum to satisfy contiguous scan check if needed
    for (const card of this.cards) {
      const cBuf = new Uint8Array(75);
      const view = new DataView(cBuf.buffer);
      view.setInt32(0, card.lesson, true);
      view.setInt32(12, card.period, true);
      view.setInt32(24, card.dayBit, true);
      // Sentinel at byte 32
      cBuf.set([0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00], 32);
      chunks.push(cBuf);
    }

    // Concatenate all chunks
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

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
});
