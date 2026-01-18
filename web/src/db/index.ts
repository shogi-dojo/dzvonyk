/**
 * FET Web - Dexie Database
 * IndexedDB storage using Dexie.js for offline-first PWA support
 */

import Dexie, { type Table } from 'dexie';
import type {
  TimetableRules,
  Teacher,
  Subject,
  ActivityTag,
  StudentsYear,
  StudentsGroup,
  StudentsSubgroup,
  Activity,
  Building,
  Room,
  TimeConstraint,
  SpaceConstraint,
  TimetableSolution,
} from '../types';

export class FETDatabase extends Dexie {
  // Tables
  rules!: Table<TimetableRules, string>;
  teachers!: Table<Teacher, string>;
  subjects!: Table<Subject, string>;
  activityTags!: Table<ActivityTag, string>;
  studentsYears!: Table<StudentsYear, string>;
  studentsGroups!: Table<StudentsGroup, string>;
  studentsSubgroups!: Table<StudentsSubgroup, string>;
  activities!: Table<Activity, string>;
  buildings!: Table<Building, string>;
  rooms!: Table<Room, string>;
  timeConstraints!: Table<TimeConstraint, string>;
  spaceConstraints!: Table<SpaceConstraint, string>;
  solutions!: Table<TimetableSolution, string>;

  constructor() {
    super('FETDatabase');
    
    this.version(1).stores({
      rules: 'id, institutionName, mode, createdAt, updatedAt',
      teachers: 'id, &name',
      subjects: 'id, &name',
      activityTags: 'id, &name',
      studentsYears: 'id, &name',
      studentsGroups: 'id, name',
      studentsSubgroups: 'id, name',
      activities: 'id, subjectId, activityGroupId, *teacherIds, *studentSetIds',
      buildings: 'id, &name',
      rooms: 'id, &name, buildingId',
      timeConstraints: 'id, type, active',
      spaceConstraints: 'id, type, active',
      solutions: 'id, rulesId, generatedAt, isComplete',
    });
  }

  // Helper methods for managing data

  async clearAllData(): Promise<void> {
    const tables = [
      this.rules,
      this.teachers,
      this.subjects,
      this.activityTags,
      this.studentsYears,
      this.studentsGroups,
      this.studentsSubgroups,
      this.activities,
      this.buildings,
      this.rooms,
      this.timeConstraints,
      this.spaceConstraints,
      this.solutions,
    ];
    
    await this.transaction('rw', tables, async () => {
      await Promise.all(tables.map(t => t.clear()));
    });
  }

  async exportToJSON(): Promise<object> {
    const [
      rules,
      teachers,
      subjects,
      activityTags,
      studentsYears,
      studentsGroups,
      studentsSubgroups,
      activities,
      buildings,
      rooms,
      timeConstraints,
      spaceConstraints,
      solutions,
    ] = await Promise.all([
      this.rules.toArray(),
      this.teachers.toArray(),
      this.subjects.toArray(),
      this.activityTags.toArray(),
      this.studentsYears.toArray(),
      this.studentsGroups.toArray(),
      this.studentsSubgroups.toArray(),
      this.activities.toArray(),
      this.buildings.toArray(),
      this.rooms.toArray(),
      this.timeConstraints.toArray(),
      this.spaceConstraints.toArray(),
      this.solutions.toArray(),
    ]);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        rules,
        teachers,
        subjects,
        activityTags,
        studentsYears,
        studentsGroups,
        studentsSubgroups,
        activities,
        buildings,
        rooms,
        timeConstraints,
        spaceConstraints,
        solutions,
      },
    };
  }

  async getStatistics(): Promise<{
    teachers: number;
    subjects: number;
    activities: number;
    rooms: number;
    timeConstraints: number;
    spaceConstraints: number;
  }> {
    const [teachers, subjects, activities, rooms, timeConstraints, spaceConstraints] = 
      await Promise.all([
        this.teachers.count(),
        this.subjects.count(),
        this.activities.count(),
        this.rooms.count(),
        this.timeConstraints.count(),
        this.spaceConstraints.count(),
      ]);

    return {
      teachers,
      subjects,
      activities,
      rooms,
      timeConstraints,
      spaceConstraints,
    };
  }
}

// Singleton instance
export const db = new FETDatabase();

export default db;
