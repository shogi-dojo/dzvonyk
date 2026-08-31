import { v4 as uuidv4 } from 'uuid';
import { db, GUEST_SCHOOL_ID, GUEST_WORKSPACE_ID, type FETDatabase } from '@/db';
import type {
  School,
  AcademicYearWorkspace,
  WorkspaceSnapshotEnvelope,
  WorkspaceVersionMetadata,
  WorkspaceVersionType,
  TimetableRules,
} from '@/types';
import {
  createSnapshotEnvelope,
  restoreSnapshotEnvelopeToDatabase,
} from './snapshotCodec';

export const MAX_AUTO_VERSIONS = 20;

export interface ActiveWorkspaceContext {
  school: School;
  workspace: AcademicYearWorkspace;
  isGuest: boolean;
}

export class WorkspaceManager {
  private database: FETDatabase;

  constructor(database: FETDatabase = db) {
    this.database = database;
  }

  /**
   * Initializes local workspaces and ensures default state is ready
   */
  async init(): Promise<ActiveWorkspaceContext> {
    const now = new Date().toISOString();

    // 1. Ensure guest school exists
    let guestSchool = await this.database.schools.get(GUEST_SCHOOL_ID);
    if (!guestSchool) {
      guestSchool = {
        id: GUEST_SCHOOL_ID,
        name: 'Локальний розклад',
        createdAt: now,
        updatedAt: now,
      };
      await this.database.schools.put(guestSchool);
    }

    // 2. Ensure guest workspace exists
    let guestWorkspace = await this.database.workspaces.get(GUEST_WORKSPACE_ID);
    if (!guestWorkspace) {
      guestWorkspace = {
        id: GUEST_WORKSPACE_ID,
        schoolId: GUEST_SCHOOL_ID,
        label: 'Основний',
        localRevision: 1,
        createdAt: now,
        updatedAt: now,
      };
      await this.database.workspaces.put(guestWorkspace);
    }

    // 3. Ensure active state is populated
    let activeState = await this.database.activeWorkspaceState.get('current');
    if (!activeState) {
      activeState = {
        id: 'current',
        currentWorkspaceId: GUEST_WORKSPACE_ID,
        currentSchoolId: GUEST_SCHOOL_ID,
        activeRevision: 1,
      };
      await this.database.activeWorkspaceState.put(activeState);
    }

    const currentWorkspace = (await this.database.workspaces.get(activeState.currentWorkspaceId)) || guestWorkspace;
    let currentSchool = (await this.database.schools.get(currentWorkspace.schoolId)) || guestSchool;

    // Self-healing: If active timetable rules has a custom institutionName, sync it to the active school
    const rulesList = await this.database.rules.toArray();
    const currentRulesName = (rulesList[0] as TimetableRules)?.institutionName?.trim();
    if (
      currentRulesName &&
      currentRulesName !== 'Default Institution' &&
      currentRulesName !== 'Untitled' &&
      currentRulesName !== currentSchool.name
    ) {
      currentSchool = {
        ...currentSchool,
        name: currentRulesName,
        updatedAt: now,
      };
      await this.database.schools.put(currentSchool);
    }

    return {
      school: currentSchool,
      workspace: currentWorkspace,
      isGuest: currentWorkspace.id === GUEST_WORKSPACE_ID,
    };
  }

  /**
   * Returns current active workspace and school
   */
  async getActiveContext(): Promise<ActiveWorkspaceContext> {
    const activeState = await this.database.activeWorkspaceState.get('current');
    if (!activeState) {
      return this.init();
    }

    const workspace = await this.database.workspaces.get(activeState.currentWorkspaceId);
    if (!workspace) {
      return this.init();
    }

    const school = await this.database.schools.get(workspace.schoolId);
    if (!school) {
      return this.init();
    }

    return {
      school,
      workspace,
      isGuest: workspace.id === GUEST_WORKSPACE_ID,
    };
  }

  /**
   * Marks the materialised timetable as newer than its last cloud snapshot.
   * This is called by the database mutation journal after each committed edit.
   */
  async markActiveWorkspaceChanged(): Promise<AcademicYearWorkspace | null> {
    const activeState = await this.database.activeWorkspaceState.get('current');
    if (!activeState) return null;

    const workspace = await this.database.workspaces.get(activeState.currentWorkspaceId);
    if (!workspace) return null;

    const nextRevision = Math.max(workspace.localRevision, workspace.cloudRevision || 0) + 1;
    const updatedWorkspace: AcademicYearWorkspace = {
      ...workspace,
      localRevision: nextRevision,
      updatedAt: new Date().toISOString(),
    };

    await this.database.transaction(
      'rw',
      [this.database.workspaces, this.database.activeWorkspaceState],
      async () => {
        await this.database.workspaces.put(updatedWorkspace);
        await this.database.activeWorkspaceState.update('current', {
          activeRevision: nextRevision,
        });
      }
    );

    return updatedWorkspace;
  }

  /**
   * Switches active materialised workspace
   */
  async switchWorkspace(targetWorkspaceId: string): Promise<ActiveWorkspaceContext> {
    const targetWorkspace = await this.database.workspaces.get(targetWorkspaceId);
    if (!targetWorkspace) {
      throw new Error(`Workspace ${targetWorkspaceId} not found.`);
    }

    const targetSchool = await this.database.schools.get(targetWorkspace.schoolId);
    if (!targetSchool) {
      throw new Error(`School ${targetWorkspace.schoolId} not found.`);
    }

    const currentContext = await this.getActiveContext();

    // 1. Materialize & save current active workspace snapshot
    if (currentContext.workspace.id !== targetWorkspaceId) {
      const currentSnapshot = await createSnapshotEnvelope(this.database, {
        workspaceId: currentContext.workspace.id,
        schoolId: currentContext.school.id,
        description: 'Auto save on workspace switch',
      });

      await this.saveSnapshotInternal(currentContext.workspace.id, 'auto', currentSnapshot, 'Поточний стан');
    }

    // 2. Load target workspace snapshot if exists
    const targetVersions = await this.listVersions(targetWorkspaceId);
    const latestTargetVersion = targetVersions[0];

    await this.database.withoutTimetableMutationTracking(async () => {
      if (latestTargetVersion?.snapshotEnvelope) {
        await restoreSnapshotEnvelopeToDatabase(this.database, latestTargetVersion.snapshotEnvelope);
      } else {
        // Empty workspace initialization
        await this.database.clearAllData();
        const rulesId = uuidv4();
        const defaultRules: TimetableRules = {
          id: rulesId,
          mode: 0,
          institutionName: targetSchool.name,
          nDaysPerWeek: 5,
          nHoursPerDay: 7,
          daysOfTheWeek: [
            { name: 'Monday', longName: 'Monday' },
            { name: 'Tuesday', longName: 'Tuesday' },
            { name: 'Wednesday', longName: 'Wednesday' },
            { name: 'Thursday', longName: 'Thursday' },
            { name: 'Friday', longName: 'Friday' },
          ],
          hoursOfTheDay: [
            { name: '08:30', longName: '08:30 - 09:15' },
            { name: '09:25', longName: '09:25 - 10:10' },
            { name: '10:20', longName: '10:20 - 11:05' },
            { name: '11:20', longName: '11:20 - 12:05' },
            { name: '12:20', longName: '12:20 - 13:05' },
            { name: '13:15', longName: '13:15 - 14:00' },
            { name: '14:10', longName: '14:10 - 14:55' },
          ],
          modified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.database.rules.put(defaultRules);
      }
    });

    // 3. Update active workspace state
    await this.database.activeWorkspaceState.put({
      id: 'current',
      currentWorkspaceId: targetWorkspace.id,
      currentSchoolId: targetSchool.id,
      activeRevision: targetWorkspace.localRevision,
    });

    return {
      school: targetSchool,
      workspace: targetWorkspace,
      isGuest: targetWorkspace.id === GUEST_WORKSPACE_ID,
    };
  }

  /**
   * Creates a new School
   */
  async createSchool(name: string, shortName?: string, ownerUid?: string): Promise<School> {
    const now = new Date().toISOString();
    const school: School = {
      id: uuidv4(),
      name,
      shortName,
      ownerUid,
      createdAt: now,
      updatedAt: now,
    };

    await this.database.schools.put(school);

    // Create a default first academic year workspace for this school
    await this.createWorkspace(school.id, '2025-2026');

    return school;
  }

  /**
   * Renames a school and syncs the active timetable rules institution name if active
   */
  async renameSchool(schoolId: string, newName: string, shortName?: string): Promise<School> {
    const school = await this.database.schools.get(schoolId);
    if (!school) throw new Error(`School ${schoolId} not found`);

    const trimmedName = newName.trim();
    const updated: School = {
      ...school,
      name: trimmedName,
      ...(shortName !== undefined ? { shortName: shortName.trim() || undefined } : {}),
      updatedAt: new Date().toISOString(),
    };

    await this.database.schools.put(updated);

    // If this school is currently active, sync the name to the active rules table
    const activeState = await this.database.activeWorkspaceState.get('current');
    if (activeState && activeState.currentSchoolId === schoolId) {
      const rulesList = await this.database.rules.toArray();
      if (rulesList.length > 0) {
        const activeRules = rulesList[0] as TimetableRules;
        if (activeRules.institutionName !== trimmedName) {
          await this.database.rules.update(activeRules.id, {
            institutionName: trimmedName,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return updated;
  }

  /**
   * Creates a new Academic Year Workspace with optional cloning
   */
  async createWorkspace(
    schoolId: string,
    label: string,
    options?: {
      cloneFromWorkspaceId?: string;
      cloneStructureOnly?: boolean;
    }
  ): Promise<AcademicYearWorkspace> {
    const now = new Date().toISOString();
    const workspaceId = uuidv4();

    const workspace: AcademicYearWorkspace = {
      id: workspaceId,
      schoolId,
      label,
      localRevision: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.database.workspaces.put(workspace);

    // If cloning from another workspace
    if (options?.cloneFromWorkspaceId) {
      let sourceEnvelope: WorkspaceSnapshotEnvelope | null = null;
      const current = await this.getActiveContext();

      if (current.workspace.id === options.cloneFromWorkspaceId) {
        sourceEnvelope = await createSnapshotEnvelope(this.database, {
          workspaceId: workspaceId,
          schoolId: schoolId,
          description: `Клон з ${options.cloneFromWorkspaceId}`,
        });
      } else {
        const versions = await this.listVersions(options.cloneFromWorkspaceId);
        sourceEnvelope = versions[0]?.snapshotEnvelope || null;
      }

      if (sourceEnvelope) {
        // Exclude generated solutions and history when cloning academic year
        const clonedData = {
          ...sourceEnvelope.data,
          solutions: options?.cloneStructureOnly ? [] : sourceEnvelope.data.solutions,
        };

        const clonedEnvelope: WorkspaceSnapshotEnvelope = {
          ...sourceEnvelope,
          workspaceId,
          schoolId,
          timestamp: now,
          data: clonedData,
        };

        await this.saveSnapshotInternal(workspaceId, 'manual', clonedEnvelope, `Створено з ${options.cloneFromWorkspaceId}`);
      }
    }

    return workspace;
  }

  /**
   * Renames a workspace label
   */
  async renameWorkspace(workspaceId: string, newLabel: string): Promise<AcademicYearWorkspace> {
    const ws = await this.database.workspaces.get(workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

    const updated: AcademicYearWorkspace = {
      ...ws,
      label: newLabel.trim(),
      updatedAt: new Date().toISOString(),
    };

    await this.database.workspaces.put(updated);
    return updated;
  }

  /**
   * Duplicates a workspace with its data or structure
   */
  async duplicateWorkspace(
    workspaceId: string,
    newLabel: string,
    options?: { cloneStructureOnly?: boolean }
  ): Promise<AcademicYearWorkspace> {
    const source = await this.database.workspaces.get(workspaceId);
    if (!source) throw new Error(`Workspace ${workspaceId} not found`);

    const cloned = await this.createWorkspace(source.schoolId, newLabel.trim(), {
      cloneFromWorkspaceId: workspaceId,
      cloneStructureOnly: options?.cloneStructureOnly ?? false,
    });

    return cloned;
  }

  /**
   * Deletes a workspace and its snapshots
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === GUEST_WORKSPACE_ID) {
      throw new Error('Cannot delete default guest workspace.');
    }

    const current = await this.getActiveContext();
    if (current.workspace.id === workspaceId) {
      await this.switchWorkspace(GUEST_WORKSPACE_ID);
    }

    await this.database.transaction('rw', [this.database.workspaces, this.database.workspaceSnapshots, this.database.history], async () => {
      await this.database.workspaces.delete(workspaceId);
      await this.database.workspaceSnapshots.where('workspaceId').equals(workspaceId).delete();
      await this.database.history.where('workspaceId').equals(workspaceId).delete();
    });
  }

  /**
   * Deletes a school and all child workspaces
   */
  async deleteSchool(schoolId: string): Promise<void> {
    if (schoolId === GUEST_SCHOOL_ID) {
      throw new Error('Cannot delete guest school.');
    }

    const workspaces = await this.database.workspaces.where('schoolId').equals(schoolId).toArray();
    for (const ws of workspaces) {
      await this.deleteWorkspace(ws.id);
    }

    await this.database.schools.delete(schoolId);
  }

  /**
   * Removes signed-in workspace data from this browser while preserving the
   * login-less guest workspace and its last local snapshot.
   */
  async resetToGuest(): Promise<ActiveWorkspaceContext> {
    await this.init();
    const current = await this.getActiveContext();
    if (current.workspace.id !== GUEST_WORKSPACE_ID) {
      await this.switchWorkspace(GUEST_WORKSPACE_ID);
    }

    await this.database.transaction(
      'rw',
      [
        this.database.schools,
        this.database.workspaces,
        this.database.workspaceSnapshots,
        this.database.history,
        this.database.syncQueue,
      ],
      async () => {
        await this.database.schools.filter((school) => school.id !== GUEST_SCHOOL_ID).delete();
        await this.database.workspaces.filter((workspace) => workspace.id !== GUEST_WORKSPACE_ID).delete();
        await this.database.workspaceSnapshots
          .filter((snapshot) => snapshot.workspaceId !== GUEST_WORKSPACE_ID)
          .delete();
        await this.database.history
          .filter((entry) => entry.workspaceId !== GUEST_WORKSPACE_ID)
          .delete();
        await this.database.syncQueue.clear();
      }
    );

    return this.getActiveContext();
  }

  /**
   * Lists all schools
   */
  async listSchools(): Promise<School[]> {
    return this.database.schools.toArray();
  }

  /**
   * Lists all academic year workspaces for a school
   */
  async listWorkspaces(schoolId?: string): Promise<AcademicYearWorkspace[]> {
    if (schoolId) {
      return this.database.workspaces.where('schoolId').equals(schoolId).toArray();
    }
    return this.database.workspaces.toArray();
  }

  /**
   * Saves a named or automatic snapshot version
   */
  async saveSnapshotVersion(
    workspaceId: string,
    type: WorkspaceVersionType,
    name?: string
  ): Promise<WorkspaceVersionMetadata> {
    const envelope = await createSnapshotEnvelope(this.database, {
      workspaceId,
      description: name || type,
    });

    return this.saveSnapshotInternal(workspaceId, type, envelope, name);
  }

  /**
   * Internal helper to persist snapshot metadata and enforce retention policy (last 20 auto versions)
   */
  private async saveSnapshotInternal(
    workspaceId: string,
    type: WorkspaceVersionType,
    envelope: WorkspaceSnapshotEnvelope,
    name?: string
  ): Promise<WorkspaceVersionMetadata> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const serialized = JSON.stringify(envelope);
    const workspace = await this.database.workspaces.get(workspaceId);

    const versionDoc: WorkspaceVersionMetadata = {
      id,
      workspaceId,
      revision: workspace?.localRevision ?? 1,
      type,
      name,
      createdAt: now,
      sizeBytes: new Blob([serialized]).size,
      snapshotEnvelope: envelope,
    };

    await this.database.workspaceSnapshots.put(versionDoc);

    // Prune auto versions to keep only the latest 20
    if (type === 'auto') {
      const autoVersions = await this.database.workspaceSnapshots
        .where('workspaceId')
        .equals(workspaceId)
        .filter((v) => v.type === 'auto')
        .sortBy('createdAt');

      if (autoVersions.length > MAX_AUTO_VERSIONS) {
        const toDelete = autoVersions.slice(0, autoVersions.length - MAX_AUTO_VERSIONS);
        await Promise.all(toDelete.map((v) => this.database.workspaceSnapshots.delete(v.id)));
      }
    }

    return versionDoc;
  }

  /**
   * Lists saved versions for a workspace
   */
  async listVersions(workspaceId: string): Promise<WorkspaceVersionMetadata[]> {
    const versions = await this.database.workspaceSnapshots
      .where('workspaceId')
      .equals(workspaceId)
      .reverse()
      .sortBy('createdAt');

    return versions;
  }

  /**
   * Restores a saved snapshot version
   */
  async restoreVersion(versionId: string): Promise<void> {
    const version = await this.database.workspaceSnapshots.get(versionId);
    if (!version || !version.snapshotEnvelope) {
      throw new Error(`Version ${versionId} not found.`);
    }

    // 1. Create a recovery snapshot before restoring
    await this.saveSnapshotVersion(version.workspaceId, 'auto', 'Автозбереження перед відновленням');

    // 2. Restore version into active materialised tables
    await restoreSnapshotEnvelopeToDatabase(this.database, version.snapshotEnvelope);
  }

  /**
   * Deletes a saved version
   */
  async deleteVersion(versionId: string): Promise<void> {
    await this.database.workspaceSnapshots.delete(versionId);
  }
}

export const workspaceManager = new WorkspaceManager(db);
