import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, GUEST_SCHOOL_ID, GUEST_WORKSPACE_ID } from '@/db';
import { syncService } from './syncService';

describe('Cloud Sync Service', () => {
  beforeEach(async () => {
    await db.clearAllData();
    await db.schools.clear();
    await db.workspaces.clear();
    vi.restoreAllMocks();
  });

  it('marks sync as local when operating in guest workspace', async () => {
    await db.schools.put({
      id: GUEST_SCHOOL_ID,
      name: 'Локальний розклад',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.workspaces.put({
      id: GUEST_WORKSPACE_ID,
      schoolId: GUEST_SCHOOL_ID,
      label: 'Основний',
      localRevision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.activeWorkspaceState.put({
      id: 'current',
      currentWorkspaceId: GUEST_WORKSPACE_ID,
      currentSchoolId: GUEST_SCHOOL_ID,
      activeRevision: 1,
    });

    const status = await syncService.syncActiveWorkspace();
    expect(status).toBe('local');
  });

  it('notifies status subscribers when state changes', () => {
    const listener = vi.fn();
    const unsubscribe = syncService.subscribeStatus(listener);

    expect(listener).toHaveBeenCalledWith(expect.any(String));
    unsubscribe();
  });
});
