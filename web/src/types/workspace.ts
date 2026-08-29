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
} from './index';

export type SyncStatus = 'local' | 'saving' | 'synced' | 'offline' | 'conflict' | 'error';

export interface School {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  ownerUid?: string;
}

export interface AcademicYearWorkspace {
  id: string;
  schoolId: string;
  label: string;
  startDate?: string;
  endDate?: string;
  localRevision: number;
  cloudRevision?: number;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface WorkspaceSnapshotData {
  rules: TimetableRules | null;
  teachers: Teacher[];
  subjects: Subject[];
  activityTags: ActivityTag[];
  studentsYears: StudentsYear[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  activities: Activity[];
  buildings: Building[];
  rooms: Room[];
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
  solutions: TimetableSolution[];
}

export interface WorkspaceSnapshotEnvelope {
  version: 1;
  schemaVersion: 1;
  workspaceId?: string;
  schoolId?: string;
  timestamp: string;
  checksum?: string;
  data: WorkspaceSnapshotData;
  metadata?: {
    appVersion?: string;
    institutionName?: string;
    description?: string;
  };
}

export type WorkspaceVersionType = 'auto' | 'manual' | 'conflict';

export interface WorkspaceVersionMetadata {
  id: string;
  workspaceId: string;
  revision: number;
  type: WorkspaceVersionType;
  name?: string;
  createdAt: string;
  sizeBytes?: number;
  snapshotEnvelope?: WorkspaceSnapshotEnvelope;
}

export interface EntityChange<T = unknown> {
  table: string;
  key: string;
  prev: T | null;
  next: T | null;
}

export interface HistoryEntry {
  id: string;
  workspaceId: string;
  timestamp: string;
  description: string;
  undoChanges: EntityChange<unknown>[];
  redoChanges: EntityChange<unknown>[];
}
