import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useInstitutionPreset } from '@/hooks';
import { setRules } from '@/store/slices/rulesSlice';
import { setTeachers } from '@/store/slices/teachersSlice';
import { setSubjects } from '@/store/slices/subjectsSlice';
import { setActivities } from '@/store/slices/activitiesSlice';
import { setRooms, setBuildings } from '@/store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints } from '@/store/slices/constraintsSlice';
import { setStudents } from '@/store/slices/studentsSlice';
import { loadWorkspaceContext, setSyncStatus } from '@/store/slices/workspaceSlice';
import { setUser, setShowMigrationDialog, initAuthThunk } from '@/store/slices/authSlice';
import { subscribeToAuthState } from '@/lib/firebase/auth';
import { historyManager } from '@/lib/history';
import { syncService } from '@/lib/firebase/syncService';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { db } from '@/db';

interface AppInitializerProps {
  children: React.ReactNode;
}

// Helper to convert Date objects to ISO strings for Redux serialization
function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      result[key] = serializeDates((obj as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  return obj;
}

export function AppInitializer({ children }: AppInitializerProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [initialized, setInitialized] = useState(false);
  useInstitutionPreset();

  useEffect(() => {
    // 1. Initialize Auth redirect check and auth subscription
    dispatch(initAuthThunk());
    const unsubscribeAuth = subscribeToAuthState(async (user) => {
      dispatch(setUser(user));
      if (!user) return;

      try {
        const cloudWorkspaces = await syncService.hydrateCloudWorkspaces(user.uid);
        if (cloudWorkspaces.length === 0) return;

        dispatch(setShowMigrationDialog(false));
        const current = await workspaceManager.getActiveContext();
        const currentBelongsToUser = current.school.ownerUid === user.uid;
        const targetWorkspace = currentBelongsToUser
          ? current.workspace
          : cloudWorkspaces[0];

        if (targetWorkspace.id !== current.workspace.id) {
          await workspaceManager.switchWorkspace(targetWorkspace.id);
        }
        await syncService.syncActiveWorkspace(user.uid);
        const context = await dispatch(loadWorkspaceContext()).unwrap();
        await historyManager.init(context.activeWorkspace.id);
        await loadAllData();
      } catch (error) {
        // Offline startup still uses the complete local workspace.
        console.warn('Cloud workspace bootstrap notice:', error);
      }
    });
    const unsubscribeSync = syncService.subscribeStatus((status) => {
      dispatch(setSyncStatus(status));
    });
    async function loadAllData() {
      try {
        console.log('Loading data from IndexedDB...');
        
        // Initialize and load workspace context
        try {
          const context = await dispatch(loadWorkspaceContext()).unwrap();
          await historyManager.init(context.activeWorkspace.id);
        } catch (wsErr) {
          console.warn('Workspace initialization notice:', wsErr);
        }

        // Load rules and serialize dates
        const rules = await db.rules.toArray();
        if (rules.length > 0) {
          const serializedRules = serializeDates(rules[0]);
          dispatch(setRules(serializedRules));
        }

        // Load teachers
        const teachers = await db.teachers.toArray();
        dispatch(setTeachers(teachers));

        // Load subjects
        const subjects = await db.subjects.toArray();
        dispatch(setSubjects(subjects));

        // Load activities
        const activities = await db.activities.toArray();
        dispatch(setActivities(activities));

        // Load rooms and buildings
        const rooms = await db.rooms.toArray();
        const buildings = await db.buildings.toArray();
        dispatch(setRooms(rooms));
        dispatch(setBuildings(buildings));

        // Load students
        const years = await db.studentsYears.toArray();
        const groups = await db.studentsGroups.toArray();
        const subgroups = await db.studentsSubgroups.toArray();
        dispatch(setStudents({ years, groups, subgroups }));

        // Load constraints
        const timeConstraints = await db.timeConstraints.toArray();
        const spaceConstraints = await db.spaceConstraints.toArray();
        dispatch(setTimeConstraints(timeConstraints));
        dispatch(setSpaceConstraints(spaceConstraints));

        console.log('Data loaded:', {
          rules: rules.length,
          teachers: teachers.length,
          subjects: subjects.length,
          activities: activities.length,
          rooms: rooms.length,
          years: years.length,
          timeConstraints: timeConstraints.length,
          spaceConstraints: spaceConstraints.length,
        });
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setInitialized(true);
      }
    }

    loadAllData();

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, [dispatch]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
