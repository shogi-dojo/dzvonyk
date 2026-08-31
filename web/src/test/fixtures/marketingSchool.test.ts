// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { parseROZFile } from '../../lib/rozParser';
import {
  createMarketingRozFixture,
  MARKETING_CLASSES,
  MARKETING_SCHOOL_NAME,
  MARKETING_SUBJECTS,
  MARKETING_TEACHERS,
  MARKETING_WOMEN_COUNT,
} from './marketingSchool';

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

describe('marketing screenshot fixture', () => {
  it('matches realistic anonymized .roz proportions with every hour placed', () => {
    const fixture = createMarketingRozFixture();
    const parsed = parseROZFile(fixture.bytes);

    expect(parsed.report.schoolName).toBe(MARKETING_SCHOOL_NAME);
    expect(parsed.file.studentsGroups).toHaveLength(MARKETING_CLASSES.length);
    expect(parsed.file.subjects).toHaveLength(MARKETING_SUBJECTS.length);
    expect(
      parsed.file.teachers
        .map((teacher) => teacher.name)
        .filter((name) => !MARKETING_TEACHERS.includes(name))
    ).toEqual([]);
    expect(parsed.file.teachers).toHaveLength(MARKETING_TEACHERS.length);
    expect(parsed.report.counts.lessons).toBe(439);
    expect(parsed.file.activities).toHaveLength(659);
    expect(parsed.placements).toHaveLength(659);
    expect(parsed.report.unplacedHours).toBe(0);
    expect(fixture.stats).toEqual({
      classes: 25,
      subjects: 20,
      teachers: 31,
      women: 24,
      lessons: 439,
      classSlots: 600,
      placedHours: 659,
      splitPlacements: 118,
      teacherLoadMin: 15,
      teacherLoadMedian: 20,
      teacherLoadMax: 28,
      teacherGapsMedian: 8,
    });
  });

  it('uses unique fictional identities with familiar surnames and a realistic gender mix', () => {
    expect(new Set(MARKETING_TEACHERS).size).toBe(MARKETING_TEACHERS.length);
    expect(MARKETING_WOMEN_COUNT).toBe(24);
    expect(MARKETING_SCHOOL_NAME).not.toMatch(/131|Демо-Сузір|Матрична/);
    expect(MARKETING_TEACHERS.join(' ')).not.toMatch(/Прикладенко|Уявний|Макетна|Тестовий/);
    expect(MARKETING_TEACHERS.join(' ')).toMatch(/Шевченко|Бондаренко|Коваленко|Мельник/);
  });

  it('keeps every teacher at 14+ hours and spreads lessons through period nine', () => {
    const parsed = parseROZFile(createMarketingRozFixture().bytes);
    const loads = parsed.file.teachers.map((teacher) => teacher.targetNumberOfHours);
    const latestPeriod = Math.max(...parsed.placements.map((placement) => placement.hour + 1));

    expect(Math.min(...loads)).toBeGreaterThanOrEqual(14);
    expect(median(loads)).toBeGreaterThanOrEqual(18);
    expect(Math.max(...loads)).toBeGreaterThanOrEqual(25);
    expect(latestPeriod).toBe(9);
  });

  it('contains paired subgroup lessons without class or teacher collisions', () => {
    const parsed = parseROZFile(createMarketingRozFixture().bytes);
    const activities = new Map(parsed.file.activities.map((activity) => [activity.id, activity]));
    const occupiedTeachers = new Set<string>();
    const classSlots = new Map<string, string[]>();

    for (const placement of parsed.placements) {
      const activity = activities.get(placement.activityId);
      expect(activity).toBeDefined();

      const studentSet = activity!.studentSetIds[0];
      const className = MARKETING_CLASSES.find(
        (candidate) => studentSet === candidate || studentSet.startsWith(`${candidate} `)
      );
      expect(className).toBeDefined();

      const teacherKey = `${activity!.teacherIds[0]}:${placement.day}:${placement.hour}`;
      expect(occupiedTeachers.has(teacherKey), teacherKey).toBe(false);
      occupiedTeachers.add(teacherKey);

      const classKey = `${className}:${placement.day}:${placement.hour}`;
      const setsAtSlot = classSlots.get(classKey) ?? [];
      if (studentSet === className) {
        expect(setsAtSlot, classKey).toHaveLength(0);
      } else {
        expect(setsAtSlot.includes(className!), classKey).toBe(false);
        expect(setsAtSlot.includes(studentSet), classKey).toBe(false);
      }
      setsAtSlot.push(studentSet);
      classSlots.set(classKey, setsAtSlot);
    }

    const pairedSlots = [...classSlots.values()].filter((studentSets) => studentSets.length === 2);
    expect(classSlots.size).toBe(600);
    expect(pairedSlots).toHaveLength(59);
    expect(
      pairedSlots.every((studentSets) => studentSets.every((name) => /[12] група$/.test(name)))
    ).toBe(true);
  });
});
