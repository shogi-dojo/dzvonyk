/**
 * Synthetic .roz file generator for tests and fixtures
 */

/**
 * Helper to encode strings in windows-1251
 */
export function encodeCp1251(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
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
        bytes.push(0x3f);
      }
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Synthetic .roz builder for testing and integration
 */
export class SyntheticRozBuilder {
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
    const rawWindowsCount = this.lessons.length > 0 ? this.lessons.length + 1 : 0;
    for (let k = 0; k < rawWindowsCount; k++) {
      const win = new Uint8Array(183);
      const view = new DataView(win.buffer);

      win.set([0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00], 4);

      if (k < this.lessons.length) {
        view.setInt32(167, this.lessons[k].id, true);
      }

      if (k > 0) {
        const prev = this.lessons[k - 1];
        view.setInt32(49, prev.hours, true);
        view.setInt32(66, prev.subject, true);
        view.setInt32(74, prev.students, true);
        view.setInt32(82, prev.teacher, true);
      }

      chunks.push(win);
    }

    // Cards (stride 75 bytes, sentinel 00 ff ff ff ff 00 00 00 at byte 32)
    for (const card of this.cards) {
      const cBuf = new Uint8Array(75);
      const view = new DataView(cBuf.buffer);
      view.setInt32(0, card.lesson, true);
      view.setInt32(12, card.period, true);
      view.setInt32(24, card.dayBit, true);
      cBuf.set([0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00], 32);
      chunks.push(cBuf);
    }

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
