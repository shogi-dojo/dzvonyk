import { db, type FETDatabase } from '@/db';
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
  WorkspaceSnapshotData,
  WorkspaceSnapshotEnvelope,
  EntityChange,
} from '@/types';
import {
  createSnapshotDataFromDatabase,
  createSnapshotEnvelope,
  restoreSnapshotDataToDatabase,
  restoreSnapshotEnvelopeToDatabase,
} from './snapshotCodec';

export type MutationHook = (
  description: string,
  undoChanges: EntityChange<unknown>[],
  redoChanges: EntityChange<unknown>[]
) => void | Promise<void>;

export class WorkspaceRepository {
  private database: FETDatabase;
  private mutationHooks: MutationHook[] = [];

  constructor(database: FETDatabase = db) {
    this.database = database;
  }

  public registerMutationHook(hook: MutationHook): () => void {
    this.mutationHooks.push(hook);
    return () => {
      this.mutationHooks = this.mutationHooks.filter((h) => h !== hook);
    };
  }

  private async notifyHooks(
    description: string,
    undoChanges: EntityChange<unknown>[],
    redoChanges: EntityChange<unknown>[]
  ): Promise<void> {
    for (const hook of this.mutationHooks) {
      try {
        await hook(description, undoChanges, redoChanges);
      } catch (err) {
        console.warn('[WorkspaceRepository] Mutation hook error:', err);
      }
    }
  }

  // ============ RULES ============
  async saveRules(rules: TimetableRules, description = 'Оновлено налаштування'): Promise<void> {
    const existing = (await this.database.rules.get(rules.id)) || null;
    await this.database.rules.put(rules);
    await this.notifyHooks(
      description,
      [{ table: 'rules', key: rules.id, prev: existing, next: null }],
      [{ table: 'rules', key: rules.id, prev: null, next: rules }]
    );
  }

  // ============ TEACHERS ============
  async saveTeacher(teacher: Teacher, description?: string): Promise<void> {
    const existing = (await this.database.teachers.get(teacher.id)) || null;
    await this.database.teachers.put(teacher);
    await this.notifyHooks(
      description || (existing ? `Змінено вчителя: ${teacher.name}` : `Додано вчителя: ${teacher.name}`),
      [{ table: 'teachers', key: teacher.id, prev: existing, next: null }],
      [{ table: 'teachers', key: teacher.id, prev: null, next: teacher }]
    );
  }

  async deleteTeacher(id: string, description?: string): Promise<void> {
    const existing = (await this.database.teachers.get(id)) || null;
    if (!existing) return;
    await this.database.teachers.delete(id);
    await this.notifyHooks(
      description || `Видалено вчителя: ${existing.name}`,
      [{ table: 'teachers', key: id, prev: existing, next: null }],
      [{ table: 'teachers', key: id, prev: null, next: null }]
    );
  }

  // ============ SUBJECTS ============
  async saveSubject(subject: Subject, description?: string): Promise<void> {
    const existing = (await this.database.subjects.get(subject.id)) || null;
    await this.database.subjects.put(subject);
    await this.notifyHooks(
      description || (existing ? `Змінено предмет: ${subject.name}` : `Додано предмет: ${subject.name}`),
      [{ table: 'subjects', key: subject.id, prev: existing, next: null }],
      [{ table: 'subjects', key: subject.id, prev: null, next: subject }]
    );
  }

  async deleteSubject(id: string, description?: string): Promise<void> {
    const existing = (await this.database.subjects.get(id)) || null;
    if (!existing) return;
    await this.database.subjects.delete(id);
    await this.notifyHooks(
      description || `Видалено предмет: ${existing.name}`,
      [{ table: 'subjects', key: id, prev: existing, next: null }],
      [{ table: 'subjects', key: id, prev: null, next: null }]
    );
  }

  // ============ ACTIVITY TAGS ============
  async saveActivityTag(tag: ActivityTag, description?: string): Promise<void> {
    const existing = (await this.database.activityTags.get(tag.id)) || null;
    await this.database.activityTags.put(tag);
    await this.notifyHooks(
      description || (existing ? `Змінено мітку: ${tag.name}` : `Додано мітку: ${tag.name}`),
      [{ table: 'activityTags', key: tag.id, prev: existing, next: null }],
      [{ table: 'activityTags', key: tag.id, prev: null, next: tag }]
    );
  }

  async deleteActivityTag(id: string, description?: string): Promise<void> {
    const existing = (await this.database.activityTags.get(id)) || null;
    if (!existing) return;
    await this.database.activityTags.delete(id);
    await this.notifyHooks(
      description || `Видалено мітку: ${existing.name}`,
      [{ table: 'activityTags', key: id, prev: existing, next: null }],
      [{ table: 'activityTags', key: id, prev: null, next: null }]
    );
  }

  // ============ STUDENTS ============
  async saveStudentsYear(year: StudentsYear, description?: string): Promise<void> {
    const existing = (await this.database.studentsYears.get(year.id)) || null;
    await this.database.studentsYears.put(year);
    await this.notifyHooks(
      description || (existing ? `Змінено паралель: ${year.name}` : `Додано паралель: ${year.name}`),
      [{ table: 'studentsYears', key: year.id, prev: existing, next: null }],
      [{ table: 'studentsYears', key: year.id, prev: null, next: year }]
    );
  }

  async deleteStudentsYear(id: string, description?: string): Promise<void> {
    const existing = (await this.database.studentsYears.get(id)) || null;
    if (!existing) return;
    await this.database.studentsYears.delete(id);
    await this.notifyHooks(
      description || `Видалено паралель: ${existing.name}`,
      [{ table: 'studentsYears', key: id, prev: existing, next: null }],
      [{ table: 'studentsYears', key: id, prev: null, next: null }]
    );
  }

  async saveStudentsGroup(group: StudentsGroup, description?: string): Promise<void> {
    const existing = (await this.database.studentsGroups.get(group.id)) || null;
    await this.database.studentsGroups.put(group);
    await this.notifyHooks(
      description || (existing ? `Змінено клас: ${group.name}` : `Додано клас: ${group.name}`),
      [{ table: 'studentsGroups', key: group.id, prev: existing, next: null }],
      [{ table: 'studentsGroups', key: group.id, prev: null, next: group }]
    );
  }

  async deleteStudentsGroup(id: string, description?: string): Promise<void> {
    const existing = (await this.database.studentsGroups.get(id)) || null;
    if (!existing) return;
    await this.database.studentsGroups.delete(id);
    await this.notifyHooks(
      description || `Видалено клас: ${existing.name}`,
      [{ table: 'studentsGroups', key: id, prev: existing, next: null }],
      [{ table: 'studentsGroups', key: id, prev: null, next: null }]
    );
  }

  async saveStudentsSubgroup(subgroup: StudentsSubgroup, description?: string): Promise<void> {
    const existing = (await this.database.studentsSubgroups.get(subgroup.id)) || null;
    await this.database.studentsSubgroups.put(subgroup);
    await this.notifyHooks(
      description || (existing ? `Змінено підгрупу: ${subgroup.name}` : `Додано підгрупу: ${subgroup.name}`),
      [{ table: 'studentsSubgroups', key: subgroup.id, prev: existing, next: null }],
      [{ table: 'studentsSubgroups', key: subgroup.id, prev: null, next: subgroup }]
    );
  }

  async deleteStudentsSubgroup(id: string, description?: string): Promise<void> {
    const existing = (await this.database.studentsSubgroups.get(id)) || null;
    if (!existing) return;
    await this.database.studentsSubgroups.delete(id);
    await this.notifyHooks(
      description || `Видалено підгрупу: ${existing.name}`,
      [{ table: 'studentsSubgroups', key: id, prev: existing, next: null }],
      [{ table: 'studentsSubgroups', key: id, prev: null, next: null }]
    );
  }

  // ============ ACTIVITIES ============
  async saveActivity(activity: Activity, description?: string): Promise<void> {
    const existing = (await this.database.activities.get(activity.id)) || null;
    await this.database.activities.put(activity);
    await this.notifyHooks(
      description || (existing ? 'Змінено заняття' : 'Додано заняття'),
      [{ table: 'activities', key: activity.id, prev: existing, next: null }],
      [{ table: 'activities', key: activity.id, prev: null, next: activity }]
    );
  }

  async deleteActivity(id: string, description?: string): Promise<void> {
    const existing = (await this.database.activities.get(id)) || null;
    if (!existing) return;
    await this.database.activities.delete(id);
    await this.notifyHooks(
      description || 'Видалено заняття',
      [{ table: 'activities', key: id, prev: existing, next: null }],
      [{ table: 'activities', key: id, prev: null, next: null }]
    );
  }

  // ============ ROOMS & BUILDINGS ============
  async saveBuilding(building: Building, description?: string): Promise<void> {
    const existing = (await this.database.buildings.get(building.id)) || null;
    await this.database.buildings.put(building);
    await this.notifyHooks(
      description || (existing ? `Змінено корпус: ${building.name}` : `Додано корпус: ${building.name}`),
      [{ table: 'buildings', key: building.id, prev: existing, next: null }],
      [{ table: 'buildings', key: building.id, prev: null, next: building }]
    );
  }

  async deleteBuilding(id: string, description?: string): Promise<void> {
    const existing = (await this.database.buildings.get(id)) || null;
    if (!existing) return;
    await this.database.buildings.delete(id);
    await this.notifyHooks(
      description || `Видалено корпус: ${existing.name}`,
      [{ table: 'buildings', key: id, prev: existing, next: null }],
      [{ table: 'buildings', key: id, prev: null, next: null }]
    );
  }

  async saveRoom(room: Room, description?: string): Promise<void> {
    const existing = (await this.database.rooms.get(room.id)) || null;
    await this.database.rooms.put(room);
    await this.notifyHooks(
      description || (existing ? `Змінено кабінет: ${room.name}` : `Додано кабінет: ${room.name}`),
      [{ table: 'rooms', key: room.id, prev: existing, next: null }],
      [{ table: 'rooms', key: room.id, prev: null, next: room }]
    );
  }

  async deleteRoom(id: string, description?: string): Promise<void> {
    const existing = (await this.database.rooms.get(id)) || null;
    if (!existing) return;
    await this.database.rooms.delete(id);
    await this.notifyHooks(
      description || `Видалено кабінет: ${existing.name}`,
      [{ table: 'rooms', key: id, prev: existing, next: null }],
      [{ table: 'rooms', key: id, prev: null, next: null }]
    );
  }

  // ============ CONSTRAINTS ============
  async saveTimeConstraint(constraint: TimeConstraint, description?: string): Promise<void> {
    const existing = (await this.database.timeConstraints.get(constraint.id)) || null;
    await this.database.timeConstraints.put(constraint);
    await this.notifyHooks(
      description || (existing ? `Змінено обмеження: ${constraint.type}` : `Додано обмеження: ${constraint.type}`),
      [{ table: 'timeConstraints', key: constraint.id, prev: existing, next: null }],
      [{ table: 'timeConstraints', key: constraint.id, prev: null, next: constraint }]
    );
  }

  async deleteTimeConstraint(id: string, description?: string): Promise<void> {
    const existing = (await this.database.timeConstraints.get(id)) || null;
    if (!existing) return;
    await this.database.timeConstraints.delete(id);
    await this.notifyHooks(
      description || `Видалено обмеження: ${existing.type}`,
      [{ table: 'timeConstraints', key: id, prev: existing, next: null }],
      [{ table: 'timeConstraints', key: id, prev: null, next: null }]
    );
  }

  async saveSpaceConstraint(constraint: SpaceConstraint, description?: string): Promise<void> {
    const existing = (await this.database.spaceConstraints.get(constraint.id)) || null;
    await this.database.spaceConstraints.put(constraint);
    await this.notifyHooks(
      description || (existing ? `Змінено просторове обмеження: ${constraint.type}` : `Додано просторове обмеження: ${constraint.type}`),
      [{ table: 'spaceConstraints', key: constraint.id, prev: existing, next: null }],
      [{ table: 'spaceConstraints', key: constraint.id, prev: null, next: constraint }]
    );
  }

  async deleteSpaceConstraint(id: string, description?: string): Promise<void> {
    const existing = (await this.database.spaceConstraints.get(id)) || null;
    if (!existing) return;
    await this.database.spaceConstraints.delete(id);
    await this.notifyHooks(
      description || `Видалено просторове обмеження: ${existing.type}`,
      [{ table: 'spaceConstraints', key: id, prev: existing, next: null }],
      [{ table: 'spaceConstraints', key: id, prev: null, next: null }]
    );
  }

  // ============ SOLUTIONS ============
  async saveSolution(solution: TimetableSolution, description = 'Збережено згенерований розклад'): Promise<void> {
    const existing = (await this.database.solutions.get(solution.id)) || null;
    await this.database.solutions.put(solution);
    await this.notifyHooks(
      description,
      [{ table: 'solutions', key: solution.id, prev: existing, next: null }],
      [{ table: 'solutions', key: solution.id, prev: null, next: solution }]
    );
  }

  // ============ FULL IMPORT / RESET / RESTORE ============
  async importFullData(data: WorkspaceSnapshotData, description = 'Імпортовано розклад'): Promise<void> {
    const prevData = await createSnapshotDataFromDatabase(this.database);
    await restoreSnapshotDataToDatabase(this.database, data);
    await this.notifyHooks(
      description,
      [{ table: '_full', key: 'snapshot', prev: prevData, next: null }],
      [{ table: '_full', key: 'snapshot', prev: null, next: data }]
    );
  }

  async resetWorkspace(description = 'Очищено всі дані розкладу'): Promise<void> {
    const prevData = await createSnapshotDataFromDatabase(this.database);
    await this.database.clearAllData();
    await this.notifyHooks(
      description,
      [{ table: '_full', key: 'snapshot', prev: prevData, next: null }],
      [{ table: '_full', key: 'snapshot', prev: null, next: null }]
    );
  }

  async createSnapshot(options?: { workspaceId?: string; schoolId?: string; description?: string }): Promise<WorkspaceSnapshotEnvelope> {
    return createSnapshotEnvelope(this.database, options);
  }

  async restoreSnapshot(envelope: WorkspaceSnapshotEnvelope, description = 'Відновлено стан розкладу'): Promise<void> {
    const prevData = await createSnapshotDataFromDatabase(this.database);
    await restoreSnapshotEnvelopeToDatabase(this.database, envelope);
    await this.notifyHooks(
      description,
      [{ table: '_full', key: 'snapshot', prev: prevData, next: null }],
      [{ table: '_full', key: 'snapshot', prev: null, next: envelope.data }]
    );
  }
}

// Singleton repository
export const workspaceRepository = new WorkspaceRepository(db);
