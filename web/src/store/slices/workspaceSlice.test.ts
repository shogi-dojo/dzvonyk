// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { db, GUEST_SCHOOL_ID, GUEST_WORKSPACE_ID } from '@/db';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import workspaceReducer, { createWorkspaceAction } from './workspaceSlice';
import authReducer from './authSlice';
import rulesReducer from './rulesSlice';

vi.mock('@/lib/history', () => ({
  historyManager: { init: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/firebase/syncService', () => ({
  syncService: { syncActiveWorkspace: vi.fn().mockResolvedValue(undefined) },
}));

function makeStore() {
  return configureStore({
    reducer: { workspace: workspaceReducer, auth: authReducer, rules: rulesReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });
}

describe('createWorkspaceAction', () => {
  beforeEach(async () => {
    await db.clearAllData();
    await db.schools.clear();
    await db.workspaces.clear();
    await db.workspaceSnapshots.clear();
    await db.activeWorkspaceState.clear();
    await workspaceManager.init();
  });

  it('switches to the workspace it just created', async () => {
    const store = makeStore();

    const created = await store
      .dispatch(
        createWorkspaceAction({ schoolId: GUEST_SCHOOL_ID, label: '2027-2028 (II семестр)' })
      )
      .unwrap();

    // The new workspace must become the active one — otherwise the dialog
    // closes and the user is silently left on the previous timetable.
    expect(created.activeWorkspace.id).toBe(created.workspace.id);
    expect(created.activeWorkspace.id).not.toBe(GUEST_WORKSPACE_ID);
    expect(created.activeWorkspace.label).toBe('2027-2028 (II семестр)');

    // Persisted, not just reported.
    const active = await db.activeWorkspaceState.get('current');
    expect(active?.currentWorkspaceId).toBe(created.workspace.id);

    // ...and reflected in the store the sidebar reads from.
    expect(store.getState().workspace.activeWorkspace?.id).toBe(created.workspace.id);
    expect(store.getState().workspace.workspaces.map((w) => w.id)).toContain(created.workspace.id);
  });

  it('seeds the new workspace from the school preset rather than reusing old rules', async () => {
    await db.schools.update(GUEST_SCHOOL_ID, { institutionType: 'university' });
    const store = makeStore();

    const created = await store
      .dispatch(createWorkspaceAction({ schoolId: GUEST_SCHOOL_ID, label: 'Новий' }))
      .unwrap();
    expect(created.activeWorkspace.id).toBe(created.workspace.id);

    // An empty workspace is seeded by switchWorkspace from the school's
    // (immutable) type, so a university gets pairs, not 45-minute lessons.
    const rules = (await db.rules.toArray())[0];
    expect(rules.institutionType).toBe('university');
    expect(rules.hoursOfTheDay[0].name).toBe('1 пара');
  });
});
