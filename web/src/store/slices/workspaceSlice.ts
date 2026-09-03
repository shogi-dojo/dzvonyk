import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  School,
  AcademicYearWorkspace,
  WorkspaceVersionMetadata,
  SyncStatus,
} from '@/types';
import { db } from '@/db';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { historyManager } from '@/lib/history';
import { trackEvent } from '@/lib/analytics';
import { syncService } from '@/lib/firebase/syncService';
import { setRules, updateInstitutionName } from '@/store/slices/rulesSlice';
import type { InstitutionPresetId } from '@/lib/institution/presets';

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
  async (
    {
      name,
      shortName,
      address,
      director,
      institutionType,
    }: {
      name: string;
      shortName?: string;
      address?: string;
      director?: string;
      institutionType?: InstitutionPresetId;
    },
    { getState }
  ) => {
    const state = getState() as { auth: { user: { uid: string } | null } };
    const school = await workspaceManager.createSchool(name, {
      shortName,
      address,
      director,
      ownerUid: state.auth.user?.uid,
      institutionType,
    });
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

export const changeInstitutionTypeAction = createAsyncThunk(
  'workspace/changeInstitutionType',
  async (
    { schoolId, institutionType }: { schoolId: string; institutionType: InstitutionPresetId },
    { getState, dispatch }
  ) => {
    const school = await workspaceManager.changeSchoolInstitutionType(schoolId, institutionType);
    const schools = await workspaceManager.listSchools();

    // Reload the materialised rules so the new preset's bell schedule is live.
    const rulesList = await db.rules.toArray();
    if (rulesList.length > 0) {
      dispatch(setRules(rulesList[0]));
    }

    const state = getState() as { auth: { user: { uid: string } | null } };
    if (state.auth.user && school.ownerUid) {
      await syncService.syncSchool(state.auth.user.uid, school);
    }

    return { school, schools };
  }
);

export const renameSchoolAction = createAsyncThunk(
  'workspace/renameSchool',
  async (
    {
      schoolId,
      name,
      shortName,
      address,
      director,
    }: {
      schoolId: string;
      name: string;
      shortName?: string;
      address?: string;
      director?: string;
    },
    { getState, dispatch }
  ) => {
    const updated = await workspaceManager.renameSchool(schoolId, {
      name,
      shortName,
      address,
      director,
    });
    const schools = await workspaceManager.listSchools();
    const activeContext = await workspaceManager.getActiveContext();

    if (activeContext.school.id === schoolId) {
      dispatch(updateInstitutionName(updated.name));
    }

    const state = getState() as { auth: { user: { uid: string } | null } };
    if (state.auth.user && updated.ownerUid) {
      await syncService.syncSchool(state.auth.user.uid, updated);
    }

    return {
      school: updated,
      schools,
      activeSchool: activeContext.school,
    };
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

export const renameWorkspaceAction = createAsyncThunk(
  'workspace/renameWorkspace',
  async ({ workspaceId, label }: { workspaceId: string; label: string }) => {
    const updated = await workspaceManager.renameWorkspace(workspaceId, label);
    const workspaces = await workspaceManager.listWorkspaces();
    const activeContext = await workspaceManager.getActiveContext();
    return {
      workspace: updated,
      workspaces,
      activeWorkspace: activeContext.workspace,
    };
  }
);

export const duplicateWorkspaceAction = createAsyncThunk(
  'workspace/duplicateWorkspace',
  async ({
    workspaceId,
    label,
    cloneStructureOnly,
  }: {
    workspaceId: string;
    label: string;
    cloneStructureOnly?: boolean;
  }) => {
    const duplicated = await workspaceManager.duplicateWorkspace(workspaceId, label, {
      cloneStructureOnly,
    });
    const context = await workspaceManager.switchWorkspace(duplicated.id);
    await historyManager.init(context.workspace.id);
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

export const forceSaveWorkspaceAction = createAsyncThunk(
  'workspace/forceSave',
  async (name: string | undefined = undefined, { getState }) => {
    const context = await workspaceManager.getActiveContext();
    const version = await workspaceManager.saveSnapshotVersion(
      context.workspace.id,
      'manual',
      name || `Ручне збереження ${new Date().toLocaleTimeString('uk-UA')}`
    );
    const versions = await workspaceManager.listVersions(context.workspace.id);
    const state = getState() as { auth: { user: { uid: string } | null } };
    if (state.auth.user) {
      await syncService.syncActiveWorkspace(state.auth.user.uid);
    }
    return { version, versions };
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
      // Change institution type
      .addCase(changeInstitutionTypeAction.fulfilled, (state, action) => {
        state.schools = action.payload.schools;
        if (state.activeSchool?.id === action.payload.school.id) {
          state.activeSchool = action.payload.school;
        }
      })
      // Rename school
      .addCase(renameSchoolAction.fulfilled, (state, action) => {
        state.schools = action.payload.schools;
        if (state.activeSchool?.id === action.payload.school.id) {
          state.activeSchool = action.payload.school;
        }
      })
      // Create workspace
      .addCase(createWorkspaceAction.fulfilled, (state, action) => {
        state.workspaces = action.payload.workspaces;
      })
      // Rename workspace
      .addCase(renameWorkspaceAction.fulfilled, (state, action) => {
        state.workspaces = action.payload.workspaces;
        if (state.activeWorkspace?.id === action.payload.workspace.id) {
          state.activeWorkspace.label = action.payload.workspace.label;
        }
      })
      // Duplicate workspace
      .addCase(duplicateWorkspaceAction.fulfilled, (state, action) => {
        state.activeSchool = action.payload.activeSchool;
        state.activeWorkspace = action.payload.activeWorkspace;
        state.isGuest = action.payload.isGuest;
        state.workspaces = action.payload.workspaces;
        state.versions = action.payload.versions;
      })
      // Force save
      .addCase(forceSaveWorkspaceAction.fulfilled, (state, action) => {
        state.versions = action.payload.versions;
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
