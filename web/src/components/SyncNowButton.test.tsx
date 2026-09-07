import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SyncNowButton } from './SyncNowButton';
import authReducer from '@/store/slices/authSlice';
import workspaceReducer from '@/store/slices/workspaceSlice';
import type { SyncStatus } from '@/types';

const syncActiveWorkspace = vi.fn().mockResolvedValue('synced');
const backfillUnsyncedWorkspaces = vi.fn().mockResolvedValue(0);
const hydrateCloudWorkspaces = vi.fn().mockResolvedValue([{ id: 'ws-1' }]);
const migrateGuestWorkspaceToCloud = vi.fn();
const guestWorkspaceHasContent = vi.fn().mockResolvedValue(false);

vi.mock('@/lib/firebase/syncService', () => ({
  syncService: {
    get syncActiveWorkspace() { return syncActiveWorkspace; },
    get backfillUnsyncedWorkspaces() { return backfillUnsyncedWorkspaces; },
    get hydrateCloudWorkspaces() { return hydrateCloudWorkspaces; },
  },
}));

vi.mock('@/lib/workspace/workspaceManager', () => ({
  workspaceManager: {
    get migrateGuestWorkspaceToCloud() { return migrateGuestWorkspaceToCloud; },
    get guestWorkspaceHasContent() { return guestWorkspaceHasContent; },
    // loadWorkspaceContext runs after a migration and reaches for these.
    init: vi.fn().mockResolvedValue({
      school: { id: 's-1', name: '' },
      workspace: { id: 'ws-1', label: '2026-2027' },
      isGuest: false,
    }),
    listSchools: vi.fn().mockResolvedValue([]),
    listWorkspaces: vi.fn().mockResolvedValue([]),
    listVersions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/hooks/useReloadTimetableState', () => ({
  useReloadTimetableState: () => vi.fn(),
}));

vi.mock('@/lib/history', () => ({ historyManager: { init: vi.fn() } }));

function renderButton({
  signedIn,
  syncStatus = 'synced' as SyncStatus,
}: { signedIn: boolean; syncStatus?: SyncStatus }) {
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: {
        user: signedIn ? { uid: 'user-1', email: 'a@b.c', displayName: null, photoURL: null } : null,
        loading: false,
        error: null,
      },
      workspace: {
        activeSchool: null,
        activeWorkspace: null,
        schools: [],
        workspaces: [],
        isGuest: false,
        syncStatus,
        versions: [],
        loading: false,
        error: null,
      },
    } as never,
  });

  return render(
    <Provider store={store}>
      <SyncNowButton />
    </Provider>
  );
}

describe('SyncNowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders nothing for a signed-out user', () => {
    renderButton({ signedIn: false });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a sync action to a signed-in user', () => {
    renderButton({ signedIn: true });
    expect(screen.getByRole('button', { name: 'Зберегти у хмару' })).toBeEnabled();
  });

  it('runs the same backup sign-in performs', async () => {
    renderButton({ signedIn: true });
    screen.getByRole('button', { name: 'Зберегти у хмару' }).click();

    await waitFor(() => {
      expect(syncActiveWorkspace).toHaveBeenCalledWith('user-1');
      // The backfill is the half that reaches workspaces other than the open
      // one, so a manual sync must not skip it.
      expect(backfillUnsyncedWorkspaces).toHaveBeenCalledWith('user-1');
    });
  });

  it('adopts an unmigrated guest workspace before syncing', async () => {
    guestWorkspaceHasContent.mockResolvedValueOnce(true);
    renderButton({ signedIn: true });
    screen.getByRole('button', { name: 'Зберегти у хмару' }).click();

    await waitFor(() => expect(migrateGuestWorkspaceToCloud).toHaveBeenCalledWith('user-1'));
  });

  it('is disabled while a sync is already running', () => {
    renderButton({ signedIn: true, syncStatus: 'saving' });
    expect(screen.getByRole('button', { name: 'Синхронізація…' })).toBeDisabled();
  });

  it('is disabled and marked offline with no connection', () => {
    renderButton({ signedIn: true, syncStatus: 'offline' });
    expect(screen.getByRole('button', { name: 'Немає зʼєднання' })).toBeDisabled();
  });
});
