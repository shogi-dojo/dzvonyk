import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  School,
  AcademicYearWorkspace,
  WorkspaceVersionMetadata,
  SyncStatus,
} from '@/types';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { historyManager } from '@/lib/history';
import { trackEvent } from '@/lib/analytics';
import { syncService } from '@/lib/firebase/syncService';

interface WorkspaceState {
  activeSchool: School | null;
  activeWorkspace: AcademicYearWorkspace | null;
  schools: School[];
  workspaces: AcademicYearWorkspace[];
  isGuest: boolean;
  syncStatus: SyncStatus;
  versions: WorkspaceVersionMetadata[];
  loading: boolean;
  error: string | null;
}

const initialState: WorkspaceState = {
  activeSchool: null,
  activeWorkspace: null,
  schools: [],
  workspaces: [],
  isGuest: true,
  syncStatus: 'local',
  versions: [],
  loading: false,
  error: null,
};

export const loadWorkspaceContext = createAsyncThunk(
  'workspace/loadContext',
  async () => {
    const context = await workspaceManager.init();
    const schools = await workspaceManager.listSchools();
    const workspaces = await workspaceManager.listWorkspaces();
    const versions = await workspaceManager.listVersions(context.workspace.id);

    return {
      activeSchool: context.school,
      activeWorkspace: context.workspace,
      isGuest: context.isGuest,
      schools,
      workspaces,
      versions,
    };
  }
);

export const switchWorkspaceAction = createAsyncThunk(
  'workspace/switch',
  async (workspaceId: string) => {
    const context = await workspaceManager.switchWorkspace(workspaceId);
    await historyManager.init(context.workspace.id);
    trackEvent('workspace_switched', { is_cloud: Boolean(context.school.ownerUid) });
    const workspaces = await workspaceManager.listWorkspaces();
    const versions = await workspaceManager.listVersions(context.workspace.id);

    return {
      activeSchool: context.school,
      activeWorkspace: context.workspace,
      isGuest: context.isGuest,
      workspaces,
      versions,
    };
  }
);

export const createSchoolAction = createAsyncThunk(
  'workspace/createSchool',
  async ({ name, shortName }: { name: string; shortName?: string }, { getState }) => {
    const state = getState() as { auth: { user: { uid: string } | null } };
    const school = await workspaceManager.createSchool(name, shortName, state.auth.user?.uid);
    const newSchoolWorkspaces = await workspaceManager.listWorkspaces(school.id);
    const firstWorkspace = newSchoolWorkspaces[0];
    const context = firstWorkspace
      ? await workspaceManager.switchWorkspace(firstWorkspace.id)
      : await workspaceManager.getActiveContext();
    await historyManager.init(context.workspace.id);
    if (state.auth.user) {
      await syncService.syncActiveWorkspace(state.auth.user.uid);
    }
    const schools = await workspaceManager.listSchools();
    const workspaces = await workspaceManager.listWorkspaces();

    return { school, workspace: context.workspace, schools, workspaces, isGuest: context.isGuest };
  }
);

export const createWorkspaceAction = createAsyncThunk(
  'workspace/createWorkspace',
  async ({
    schoolId,
    label,
    cloneFromWorkspaceId,
    cloneStructureOnly,
  }: {
    schoolId: string;
    label: string;
    cloneFromWorkspaceId?: string;
    cloneStructureOnly?: boolean;
  }) => {
    const workspace = await workspaceManager.createWorkspace(schoolId, label, {
      cloneFromWorkspaceId,
      cloneStructureOnly,
    });
    const workspaces = await workspaceManager.listWorkspaces();
    return { workspace, workspaces };
  }
);

export const deleteWorkspaceAction = createAsyncThunk(
  'workspace/deleteWorkspace',
  async (workspaceId: string) => {
    await workspaceManager.deleteWorkspace(workspaceId);
    const workspaces = await workspaceManager.listWorkspaces();
    const activeContext = await workspaceManager.getActiveContext();

    return {
      workspaces,
      activeWorkspace: activeContext.workspace,
      activeSchool: activeContext.school,
      isGuest: activeContext.isGuest,
    };
  }
);

export const saveVersionAction = createAsyncThunk(
  'workspace/saveVersion',
  async ({ workspaceId, name }: { workspaceId: string; name: string }) => {
    const version = await workspaceManager.saveSnapshotVersion(workspaceId, 'manual', name);
    const versions = await workspaceManager.listVersions(workspaceId);
    return { version, versions };
  }
);

export const restoreVersionAction = createAsyncThunk(
  'workspace/restoreVersion',
  async ({ versionId, workspaceId }: { versionId: string; workspaceId: string }) => {
    await workspaceManager.restoreVersion(versionId);
    const versions = await workspaceManager.listVersions(workspaceId);
    return { versions };
  }
);

export const deleteVersionAction = createAsyncThunk(
  'workspace/deleteVersion',
  async ({ versionId, workspaceId }: { versionId: string; workspaceId: string }) => {
    await workspaceManager.deleteVersion(versionId);
    const versions = await workspaceManager.listVersions(workspaceId);
    return { versions };
  }
);

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setSyncStatus: (state, action: PayloadAction<SyncStatus>) => {
      state.syncStatus = action.payload;
    },
    setSchools: (state, action: PayloadAction<School[]>) => {
      state.schools = action.payload;
    },
    setWorkspaces: (state, action: PayloadAction<AcademicYearWorkspace[]>) => {
      state.workspaces = action.payload;
    },
    incrementLocalRevision: (state) => {
      if (state.activeWorkspace) {
        state.activeWorkspace.localRevision += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Load context
      .addCase(loadWorkspaceContext.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadWorkspaceContext.fulfilled, (state, action) => {
        state.loading = false;
        state.activeSchool = action.payload.activeSchool;
        state.activeWorkspace = action.payload.activeWorkspace;
        state.isGuest = action.payload.isGuest;
        state.schools = action.payload.schools;
        state.workspaces = action.payload.workspaces;
        state.versions = action.payload.versions;
      })
      .addCase(loadWorkspaceContext.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load workspace context';
      })
      // Switch workspace
      .addCase(switchWorkspaceAction.fulfilled, (state, action) => {
        state.activeSchool = action.payload.activeSchool;
        state.activeWorkspace = action.payload.activeWorkspace;
        state.isGuest = action.payload.isGuest;
        state.workspaces = action.payload.workspaces;
        state.versions = action.payload.versions;
      })
      // Create school
      .addCase(createSchoolAction.fulfilled, (state, action) => {
        state.schools = action.payload.schools;
        state.activeSchool = action.payload.school;
        state.activeWorkspace = action.payload.workspace;
        state.isGuest = action.payload.isGuest;
        state.workspaces = action.payload.workspaces;
      })
      // Create workspace
      .addCase(createWorkspaceAction.fulfilled, (state, action) => {
        state.workspaces = action.payload.workspaces;
      })
      // Delete workspace
      .addCase(deleteWorkspaceAction.fulfilled, (state, action) => {
        state.workspaces = action.payload.workspaces;
        state.activeWorkspace = action.payload.activeWorkspace;
        state.activeSchool = action.payload.activeSchool;
        state.isGuest = action.payload.isGuest;
      })
      // Save version
      .addCase(saveVersionAction.fulfilled, (state, action) => {
        state.versions = action.payload.versions;
      })
      // Restore version
      .addCase(restoreVersionAction.fulfilled, (state, action) => {
        state.versions = action.payload.versions;
      })
      // Delete version
      .addCase(deleteVersionAction.fulfilled, (state, action) => {
        state.versions = action.payload.versions;
      });
  },
});

export const { setSyncStatus, setSchools, setWorkspaces, incrementLocalRevision } = workspaceSlice.actions;
export default workspaceSlice.reducer;
