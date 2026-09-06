import { describe, it, expect, beforeEach } from 'vitest';
import { db, GUEST_SCHOOL_ID } from '@/db';
import { workspaceManager } from './workspaceManager';

describe('migrating the guest workspace to the cloud', () => {
  beforeEach(async () => {
    await db.clearAllData();
    await db.schools.clear();
    await db.workspaces.clear();
    await db.workspaceSnapshots.clear();
    await db.history.clear();
    await db.activeWorkspaceState.clear();
    await workspaceManager.init();
  });

  it('reports no content for a freshly seeded guest workspace', async () => {
    expect(await workspaceManager.guestWorkspaceHasContent()).toBe(false);
  });

  it('reports content once real entities exist', async () => {
    await db.teachers.put({ id: 't1', name: 'Сисова О. Г.' });
    expect(await workspaceManager.guestWorkspaceHasContent()).toBe(true);
  });

  it('moves the guest data into a cloud-owned school', async () => {
    await db.teachers.put({ id: 't1', name: 'Сисова О. Г.' });
    await db.subjects.put({ id: 's1', name: 'Українська мова' });

    const { school, workspace } = await workspaceManager.migrateGuestWorkspaceToCloud('user-1');

    expect(school.ownerUid).toBe('user-1');
    expect(school.id).not.toBe(GUEST_SCHOOL_ID);
    expect(workspace.schoolId).toBe(school.id);

    // The data must survive the switch, not just the school record.
    expect(await db.teachers.count()).toBe(1);
    expect(await db.subjects.count()).toBe(1);

    const context = await workspaceManager.getActiveContext();
    expect(context.isGuest).toBe(false);
    expect(context.school.id).toBe(school.id);
  });

  it('leaves the migrated school nameless so the dashboard can prompt', async () => {
    await db.teachers.put({ id: 't1', name: 'Сисова О. Г.' });

    const { school } = await workspaceManager.migrateGuestWorkspaceToCloud('user-1');

    expect(school.name).toBe('');
  });

  it('uses a supplied name when one is known', async () => {
    await db.teachers.put({ id: 't1', name: 'Сисова О. Г.' });

    const { school } = await workspaceManager.migrateGuestWorkspaceToCloud('user-1', {
      name: 'Гімназія 131',
    });

    expect(school.name).toBe('Гімназія 131');
  });

  it('keeps existing cloud schools untouched', async () => {
    const existing = await workspaceManager.createSchool('Ліцей №15', { ownerUid: 'user-1' });
    await db.teachers.put({ id: 't1', name: 'Сисова О. Г.' });

    const { school } = await workspaceManager.migrateGuestWorkspaceToCloud('user-1');

    expect(school.id).not.toBe(existing.id);
    const schools = await workspaceManager.listSchools();
    expect(schools.map((s) => s.id)).toContain(existing.id);
  });
});
