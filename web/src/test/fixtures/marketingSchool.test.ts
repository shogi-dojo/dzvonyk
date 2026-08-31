// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { parseROZFile } from '../../lib/rozParser';
import {
  createMarketingRozFixture,
  MARKETING_CLASSES,
  MARKETING_SCHOOL_NAME,
  MARKETING_SUBJECTS,
  MARKETING_TEACHERS,
} from './marketingSchool';

describe('marketing screenshot fixture', () => {
  it('builds a dense fictional school with every lesson placed', () => {
    const fixture = createMarketingRozFixture();
    const parsed = parseROZFile(fixture.bytes);

    expect(parsed.report.schoolName).toBe(MARKETING_SCHOOL_NAME);
    expect(parsed.file.studentsGroups).toHaveLength(MARKETING_CLASSES.length);
    expect(parsed.file.subjects).toHaveLength(MARKETING_SUBJECTS.length);
    expect(
      parsed.file.teachers
        .map((teacher) => teacher.name)
        .filter((name) => !MARKETING_TEACHERS.includes(name as (typeof MARKETING_TEACHERS)[number]))
    ).toEqual([]);
    expect(parsed.file.teachers).toHaveLength(MARKETING_TEACHERS.length);
    expect(parsed.report.counts.lessons).toBe(270);
    expect(parsed.file.activities).toHaveLength(540);
    expect(parsed.placements).toHaveLength(540);
    expect(parsed.report.unplacedHours).toBe(0);
    expect(fixture.stats).toEqual({
      classes: 18,
      subjects: 15,
      teachers: 33,
      lessons: 270,
      placedHours: 540,
    });
  });

  it('uses unique demo identities and does not reuse FAQ placeholder names', () => {
    expect(new Set(MARKETING_TEACHERS).size).toBe(MARKETING_TEACHERS.length);
    expect(MARKETING_SCHOOL_NAME).not.toMatch(/131|Демо-Сузір|Матрична/);
    expect(MARKETING_TEACHERS.join(' ')).not.toMatch(/Прикладенко|Уявний|Макетна|Тестовий/);
  });

  it('contains no simultaneous class or teacher placements', () => {
    const parsed = parseROZFile(createMarketingRozFixture().bytes);
    const activities = new Map(parsed.file.activities.map((activity) => [activity.id, activity]));
    const occupiedClasses = new Set<string>();
    const occupiedTeachers = new Set<string>();

    for (const placement of parsed.placements) {
      const activity = activities.get(placement.activityId);
      expect(activity).toBeDefined();

      const classKey = `${activity!.studentSetIds[0]}:${placement.day}:${placement.hour}`;
      const teacherKey = `${activity!.teacherIds[0]}:${placement.day}:${placement.hour}`;
      expect(occupiedClasses.has(classKey), classKey).toBe(false);
      expect(occupiedTeachers.has(teacherKey), teacherKey).toBe(false);
      occupiedClasses.add(classKey);
      occupiedTeachers.add(teacherKey);
    }
  });
});
