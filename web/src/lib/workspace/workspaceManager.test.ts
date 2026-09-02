import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, GUEST_SCHOOL_ID, GUEST_WORKSPACE_ID } from '@/db';
import { workspaceManager } from './workspaceManager';
import type { TimetableRules, Teacher } from '@/types';

const mockRules: TimetableRules = {
  id: 'rules-guest',
  mode: 0,
  institutionName: 'Ліцей №1',
  nDaysPerWeek: 5,
  nHoursPerDay: 7,
  daysOfTheWeek: [{ name: 'Пн', longName: 'Понеділок' }],
  hoursOfTheDay: [{ name: '08:30', longName: '08:30 - 09:15' }],
  modified: false,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

const mockTeacher: Teacher = {
  id: 't-guest-1',
  name: 'Франко І. Я.',
  targetNumberOfHours: 18,
  qualifiedSubjects: [],
};

describe('Workspace Manager & Local Multi-Workspace Storage', () => {
  beforeEach(async () => {
    await db.clearAllData();
    await db.schools.clear();
    await db.workspaces.clear();
    await db.workspaceSnapshots.clear();
    await db.history.clear();
    await db.activeWorkspaceState.clear();
    vi.restoreAllMocks();
  });

  it('initializes default guest school and workspace cleanly', async () => {
    const context = await workspaceManager.init();

    expect(context.isGuest).toBe(true);
    expect(context.school.id).toBe(GUEST_SCHOOL_ID);
    expect(context.workspace.id).toBe(GUEST_WORKSPACE_ID);

    const schools = await workspaceManager.listSchools();
    expect(schools).toHaveLength(1);
    expect(schools[0].id).toBe(GUEST_SCHOOL_ID);

    const workspaces = await workspaceManager.listWorkspaces();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].id).toBe(GUEST_WORKSPACE_ID);
  });

  it('switches workspaces, saving active workspace state into snapshots', async () => {
    await workspaceManager.init();

    // 1. Populate guest workspace with data
    await db.rules.put(mockRules);
    await db.teachers.put(mockTeacher);

    // 2. Create a new school and year workspace
    const newSchool = await workspaceManager.createSchool('Гімназія #2');
    const newWorkspaces = await workspaceManager.listWorkspaces(newSchool.id);
    const targetWs = newWorkspaces[0];

    expect(targetWs).toBeDefined();

    // 3. Switch to the new school workspace
    const switchedContext = await workspaceManager.switchWorkspace(targetWs.id);
    expect(switchedContext.isGuest).toBe(false);
    expect(switchedContext.school.name).toBe('Гімназія #2');
    expect(switchedContext.workspace.id).toBe(targetWs.id);

    // Verify guest workspace was snapshotted
    const guestVersions = await workspaceManager.listVersions(GUEST_WORKSPACE_ID);
    expect(guestVersions.length).toBeGreaterThan(0);
    expect(guestVersions[0].snapshotEnvelope?.data.teachers[0].name).toBe('Франко І. Я.');

    // 4. Switch back to guest workspace and verify teacher is restored
    await workspaceManager.switchWorkspace(GUEST_WORKSPACE_ID);
    const restoredTeacher = await db.teachers.get('t-guest-1');
    expect(restoredTeacher?.name).toBe('Франко І. Я.');
  });

  it('prunes automatic versions exceeding MAX_AUTO_VERSIONS', async () => {
    await workspaceManager.init();

    // Generate 25 auto versions
    for (let i = 0; i < 25; i++) {
      await workspaceManager.saveSnapshotVersion(GUEST_WORKSPACE_ID, 'auto', `Auto ${i}`);
    }

    const versions = await workspaceManager.listVersions(GUEST_WORKSPACE_ID);
    const autoVersions = versions.filter((v) => v.type === 'auto');
    expect(autoVersions.length).toBeLessThanOrEqual(20);
  });

  it('creates recovery snapshot before restoring a saved version', async () => {
    await workspaceManager.init();
    await db.teachers.put(mockTeacher);

    const savedVersion = await workspaceManager.saveSnapshotVersion(
      GUEST_WORKSPACE_ID,
      'manual',
      'Saved Milestone'
    );

    // Modify teacher
    await db.teachers.put({ ...mockTeacher, name: 'Котляревський І. П.' });

    // Restore saved milestone
    await workspaceManager.restoreVersion(savedVersion.id);

    const teacher = await db.teachers.get('t-guest-1');
    expect(teacher?.name).toBe('Франко І. Я.');

    // Check that auto recovery version was created
    const versions = await workspaceManager.listVersions(GUEST_WORKSPACE_ID);
    const recovery = versions.find((v) => v.name?.includes('Автозбереження перед відновленням'));
    expect(recovery).toBeDefined();
  });

  it('renames and duplicates workspaces cleanly', async () => {
    await workspaceManager.init();
    await db.teachers.put(mockTeacher);

    // 1. Rename workspace
    const renamed = await workspaceManager.renameWorkspace(GUEST_WORKSPACE_ID, '2025-2026 (I семестр)');
    expect(renamed.label).toBe('2025-2026 (I семестр)');

    const fetched = await db.workspaces.get(GUEST_WORKSPACE_ID);
    expect(fetched?.label).toBe('2025-2026 (I семестр)');

    // 2. Duplicate workspace
    const duplicated = await workspaceManager.duplicateWorkspace(
      GUEST_WORKSPACE_ID,
      '2025-2026 (II семестр)'
    );
    expect(duplicated.label).toBe('2025-2026 (II семестр)');
    expect(duplicated.id).not.toBe(GUEST_WORKSPACE_ID);

    // Verify snapshot was created for duplicated workspace
    const dupVersions = await workspaceManager.listVersions(duplicated.id);
    expect(dupVersions.length).toBeGreaterThan(0);
    expect(dupVersions[0].snapshotEnvelope?.data.teachers[0].name).toBe('Франко І. Я.');
  });

  it('renames school and synchronizes active rules institution name', async () => {
    await workspaceManager.init();
    await db.rules.put(mockRules);

    // Create a new school
    const newSchool = await workspaceManager.createSchool('Гімназія 131');
    const newWorkspaces = await workspaceManager.listWorkspaces(newSchool.id);
    await workspaceManager.switchWorkspace(newWorkspaces[0].id);

    // Active rules now exist under the new school
    const activeRulesBefore = await db.rules.toArray();
    expect(activeRulesBefore[0].institutionName).toBe('Гімназія 131');

    // Rename school to "Гімназія 1"
    const renamed = await workspaceManager.renameSchool(newSchool.id, {
      name: 'Гімназія 1',
      shortName: 'Гімн 1',
    });
    expect(renamed.name).toBe('Гімназія 1');
    expect(renamed.shortName).toBe('Гімн 1');

    const fetchedSchool = await db.schools.get(newSchool.id);
    expect(fetchedSchool?.name).toBe('Гімназія 1');

    // Verify active rules institution name was synchronized
    const activeRulesAfter = await db.rules.toArray();
    expect(activeRulesAfter[0].institutionName).toBe('Гімназія 1');
  });

  it('self-heals and synchronizes school name with rules institution name during init', async () => {
    // Simulate legacy state where rules were renamed in settings to "Гімназія 1",
    // but the school entity still retained "Гімназія 131"
    await db.schools.put({
      id: GUEST_SCHOOL_ID,
      name: 'Гімназія 131',
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    });
    await db.workspaces.put({
      id: GUEST_WORKSPACE_ID,
      schoolId: GUEST_SCHOOL_ID,
      label: 'Основний',
      localRevision: 1,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    });
    await db.activeWorkspaceState.put({
      id: 'current',
      currentWorkspaceId: GUEST_WORKSPACE_ID,
      currentSchoolId: GUEST_SCHOOL_ID,
      activeRevision: 1,
    });
    await db.rules.put({
      ...mockRules,
      institutionName: 'Гімназія 1',
    });

    // Run init
    const context = await workspaceManager.init();

    expect(context.school.name).toBe('Гімназія 1');

    const schools = await workspaceManager.listSchools();
    expect(schools[0].name).toBe('Гімназія 1');
  });
});
