/**
 * FET Web - Dexie Database
 * IndexedDB storage using Dexie.js for offline-first PWA support
 */

import Dexie, { type Table, type Transaction } from 'dexie';
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
  School,
  AcademicYearWorkspace,
  WorkspaceVersionMetadata,
  HistoryEntry,
  EntityChange,
} from '../types';
import { APP_VERSION } from '@/lib/version';

const TIMETABLE_TABLE_NAMES = [
  'rules',
  'teachers',
  'subjects',
  'activityTags',
  'studentsYears',
  'studentsGroups',
  'studentsSubgroups',
  'activities',
  'buildings',
  'rooms',
  'timeConstraints',
  'spaceConstraints',
  'solutions',
] as const;

export type TimetableMutationListener = (changes: EntityChange<unknown>[]) => void | Promise<void>;

export interface ActiveWorkspaceStateDoc {
  id: string; // 'current'
  currentWorkspaceId: string;
  currentSchoolId: string;
  activeRevision: number;
}

export interface SyncQueueDoc {
  id: string;
  workspaceId: string;
  action: 'push' | 'pull' | 'delete';
  status: 'pending' | 'processing' | 'failed';
  payload?: string; // gzip/json string
  createdAt: string;
  retryCount: number;
}

export const GUEST_SCHOOL_ID = 'guest-school-default';
export const GUEST_WORKSPACE_ID = 'guest-workspace-default';

export class FETDatabase extends Dexie {
  private timetableMutationListeners = new Set<TimetableMutationListener>();
  private pendingTransactionChanges = new WeakMap<Transaction, Map<string, EntityChange<unknown>>>();
  private mutationTrackingSuppressionDepth = 0;
  private pendingMutationLabel: string | null = null;
  // Active materialised timetable tables
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

  // Multi-school / workspace / versions / history tables (v2)
  schools!: Table<School, string>;
  workspaces!: Table<AcademicYearWorkspace, string>;
  workspaceSnapshots!: Table<WorkspaceVersionMetadata, string>;
  history!: Table<HistoryEntry, string>;
  syncQueue!: Table<SyncQueueDoc, string>;
  activeWorkspaceState!: Table<ActiveWorkspaceStateDoc, string>;

  constructor() {
    super('FETDatabase');
    
    // Version 1 (legacy schema)
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

    // Version 2 (multi-workspace, version history, sync queue)
    this.version(2).stores({
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
      schools: 'id, name, ownerUid, createdAt, updatedAt',
      workspaces: 'id, schoolId, label, localRevision, cloudRevision, lastSyncedAt, isArchived, createdAt, updatedAt',
      workspaceSnapshots: 'id, workspaceId, revision, type, createdAt',
      history: 'id, workspaceId, timestamp',
      syncQueue: 'id, workspaceId, action, status, createdAt',
      activeWorkspaceState: 'id, currentWorkspaceId, currentSchoolId, activeRevision',
    }).upgrade(async (tx) => {
      // Lossless migration: Initialize default guest school and workspace
      const now = new Date().toISOString();
      const rulesList = await tx.table('rules').toArray();
      const institutionName = (rulesList[0] as TimetableRules)?.institutionName || 'Локальний розклад';

      await tx.table('schools').put({
        id: GUEST_SCHOOL_ID,
        name: institutionName,
        createdAt: now,
        updatedAt: now,
      });

      await tx.table('workspaces').put({
        id: GUEST_WORKSPACE_ID,
        schoolId: GUEST_SCHOOL_ID,
        label: 'Основний',
        localRevision: 1,
        createdAt: now,
        updatedAt: now,
      });

      await tx.table('activeWorkspaceState').put({
        id: 'current',
        currentWorkspaceId: GUEST_WORKSPACE_ID,
        currentSchoolId: GUEST_SCHOOL_ID,
        activeRevision: 1,
      });
    });

    this.installTimetableMutationHooks();
  }

  private installTimetableMutationHooks(): void {
    for (const tableName of TIMETABLE_TABLE_NAMES) {
      const table = this.table<Record<string, unknown>, string>(tableName);
      const isTrackingEnabled = () => this.mutationTrackingSuppressionDepth === 0;
      const queueUpdate = (
        transaction: Transaction,
        key: string,
        previous: unknown,
        next: unknown
      ) => this.queueTimetableMutation(transaction, tableName, key, previous, next);

      table.hook('creating', (primaryKey, object, transaction) => {
        if (this.mutationTrackingSuppressionDepth > 0) return;
        const key = String(primaryKey ?? object.id);
        this.queueTimetableMutation(transaction, tableName, key, null, object);
      });

      table.hook('updating', function (_modifications, primaryKey, oldObject, transaction) {
        if (!isTrackingEnabled()) return;
        // Dexie exposes the fully materialised object after a successful update.
        // Keep the transaction-level batch intact so cascading edits remain one undo step.
        this.onsuccess = (updatedObject) => {
          queueUpdate(transaction, String(primaryKey), oldObject, updatedObject);
        };
      });

      table.hook('deleting', (primaryKey, object, transaction) => {
        if (this.mutationTrackingSuppressionDepth > 0) return;
        this.queueTimetableMutation(transaction, tableName, String(primaryKey), object, null);
      });
    }
  }

  private queueTimetableMutation(
    transaction: Transaction,
    table: string,
    key: string,
    previous: unknown | null,
    next: unknown | null
  ): void {
    let changes = this.pendingTransactionChanges.get(transaction);
    if (!changes) {
      changes = new Map();
      this.pendingTransactionChanges.set(transaction, changes);
      transaction.on('complete', () => {
        const completed = this.pendingTransactionChanges.get(transaction);
        this.pendingTransactionChanges.delete(transaction);
        if (!completed?.size) return;

        const materialChanges = [...completed.values()].filter(
          (change) => JSON.stringify(change.prev) !== JSON.stringify(change.next)
        );
        if (!materialChanges.length) return;

        for (const listener of this.timetableMutationListeners) {
          void Promise.resolve(listener(materialChanges)).catch((error) => {
            console.warn('[FETDatabase] Timetable mutation listener failed:', error);
          });
        }
      });
    }

    const id = `${table}:${key}`;
    const existing = changes.get(id);
    changes.set(id, {
      table,
      key,
      prev: existing ? existing.prev : previous,
      next,
    });
  }

  public subscribeToTimetableMutations(listener: TimetableMutationListener): () => void {
    this.timetableMutationListeners.add(listener);
    return () => this.timetableMutationListeners.delete(listener);
  }

  /**
   * Labels whatever the operation writes, so history shows what the user did rather
   * than a diff-derived guess. History is recorded from a Dexie subscription, which
   * cannot otherwise know the caller's intent.
   */
  public async withMutationLabel<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pendingMutationLabel;
    this.pendingMutationLabel = label;
    try {
      return await operation();
    } finally {
      this.pendingMutationLabel = previous;
    }
  }

  /** Reads and clears the label set by withMutationLabel, if any. */
  public consumeMutationLabel(): string | null {
    const label = this.pendingMutationLabel;
    this.pendingMutationLabel = null;
    return label;
  }

  public async withoutTimetableMutationTracking<T>(operation: () => Promise<T>): Promise<T> {
    this.mutationTrackingSuppressionDepth += 1;
    try {
      return await operation();
    } finally {
      this.mutationTrackingSuppressionDepth -= 1;
    }
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
      version: APP_VERSION,
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
