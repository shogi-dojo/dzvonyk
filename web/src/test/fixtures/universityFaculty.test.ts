// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { describe, expect, it } from 'vitest';
import { parseFETFile } from '@/lib/fetParser';
import {
  createUniversityFetFixture,
  SUBGROUPS_PER_GROUP,
  UNIVERSITY_COURSES,
  UNIVERSITY_GROUPS,
  UNIVERSITY_LECTURERS,
  UNIVERSITY_NAME,
} from './universityFaculty';

describe('university faculty fixture', () => {
  const fixture = createUniversityFetFixture();
  const parsed = parseFETFile(fixture.xml);

  it('parses back into the courses, groups and subgroups it declares', () => {
    expect(parsed.institutionName).toBe(UNIVERSITY_NAME);
    expect(parsed.studentsYears.map((y) => y.name)).toEqual(
      UNIVERSITY_COURSES.map((c) => c.name)
    );
    expect(parsed.studentsGroups).toHaveLength(UNIVERSITY_GROUPS.length);
    expect(parsed.studentsSubgroups).toHaveLength(
      UNIVERSITY_GROUPS.length * SUBGROUPS_PER_GROUP
    );
    expect(parsed.teachers.map((t) => t.name)).toEqual([...UNIVERSITY_LECTURERS]);
  });

  it('uses the university bell schedule, not the school one', () => {
    expect(parsed.hoursOfTheDay).toHaveLength(6);
    expect(parsed.hoursOfTheDay[0].name).toBe('1 пара');
    expect(parsed.daysOfTheWeek).toHaveLength(5);
  });

  it('carries stream lectures that address several groups in one activity', () => {
    const streams = parsed.activities.filter((a) => a.studentSetIds.length > 1);
    expect(streams.length).toBe(fixture.stats.streamLectures);

    // The largest stream is the first course: five groups on one lecture.
    const largest = streams.reduce((a, b) =>
      b.studentSetIds.length > a.studentSetIds.length ? b : a
    );
    expect(largest.studentSetIds).toHaveLength(5);
    expect(largest.studentSetIds).toEqual(
      expect.arrayContaining(['КН-11', 'КН-12', 'КН-13', 'ІПЗ-11', 'ІПЗ-12'])
    );
  });

  it('names every stream student set as a group that actually exists', () => {
    const known = new Set([
      ...parsed.studentsYears.map((y) => y.name),
      ...parsed.studentsGroups.map((g) => g.name),
      ...parsed.studentsSubgroups.map((s) => s.name),
    ]);

    for (const activity of parsed.activities) {
      for (const setId of activity.studentSetIds) {
        expect(known.has(setId), `unknown student set ${setId}`).toBe(true);
      }
    }
  });

  it('assigns lectures to senior staff and labs to junior staff', () => {
    const lectures = fixture.activities.filter((a) => a.kind === 'lecture');
    const labs = fixture.activities.filter((a) => a.kind === 'lab');
    expect(lectures.length).toBeGreaterThan(10);
    expect(labs.length).toBeGreaterThan(20);

    // A stream lecture is taught once, so the lecturer's own load stays sane.
    const perLecturer = new Map<string, number>();
    for (const activity of fixture.activities) {
      perLecturer.set(activity.teacher, (perLecturer.get(activity.teacher) ?? 0) + 1);
    }
    expect(perLecturer.size).toBeGreaterThan(8);
  });
});
