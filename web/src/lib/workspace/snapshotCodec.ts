import type { FETDatabase } from '@/db';
import type {
  WorkspaceSnapshotData,
  WorkspaceSnapshotEnvelope,
  TimetableRules,
} from '@/types';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Creates a raw snapshot data object from the active database tables
 */
export async function createSnapshotDataFromDatabase(db: FETDatabase): Promise<WorkspaceSnapshotData> {
  const [
    rulesList,
    teachers,
    subjects,
    activityTags,
    studentsYears,
    studentsGroups,
    studentsSubgroups,
    activities,
    buildings,
    rooms,
    timeConstraints,
    spaceConstraints,
    solutions,
  ] = await Promise.all([
    db.rules.toArray(),
    db.teachers.toArray(),
    db.subjects.toArray(),
    db.activityTags.toArray(),
    db.studentsYears.toArray(),
    db.studentsGroups.toArray(),
    db.studentsSubgroups.toArray(),
    db.activities.toArray(),
    db.buildings.toArray(),
    db.rooms.toArray(),
    db.timeConstraints.toArray(),
    db.spaceConstraints.toArray(),
    db.solutions.toArray(),
  ]);

  const rules = (rulesList[0] as TimetableRules) || null;

  return {
    rules,
    teachers,
    subjects,
    activityTags,
    studentsYears,
    studentsGroups,
    studentsSubgroups,
    activities,
    buildings,
    rooms,
    timeConstraints,
    spaceConstraints,
    solutions,
  };
}

/**
 * Creates a full versioned envelope snapshot from the database
 */
export async function createSnapshotEnvelope(
  db: FETDatabase,
  options?: {
    workspaceId?: string;
    schoolId?: string;
    description?: string;
  }
): Promise<WorkspaceSnapshotEnvelope> {
  const data = await createSnapshotDataFromDatabase(db);
  const institutionName = data.rules?.institutionName;

  return {
    version: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspaceId: options?.workspaceId,
    schoolId: options?.schoolId,
    timestamp: new Date().toISOString(),
    data,
    metadata: {
      appVersion: '1.0.0',
      institutionName,
      description: options?.description,
    },
  };
}

/**
 * Restores a snapshot data object into the database atomically
 */
export async function restoreSnapshotDataToDatabase(
  db: FETDatabase,
  data: WorkspaceSnapshotData
): Promise<void> {
  const tables = [
    db.rules,
    db.teachers,
    db.subjects,
    db.activityTags,
    db.studentsYears,
    db.studentsGroups,
    db.studentsSubgroups,
    db.activities,
    db.buildings,
    db.rooms,
    db.timeConstraints,
    db.spaceConstraints,
    db.solutions,
  ];

  await db.transaction('rw', tables, async () => {
    // 1. Clear all active tables
    await Promise.all(tables.map((t) => t.clear()));

    // 2. Insert new data
    if (data.rules) {
      await db.rules.put(data.rules);
    }
    if (data.teachers?.length > 0) await db.teachers.bulkAdd(data.teachers);
    if (data.subjects?.length > 0) await db.subjects.bulkAdd(data.subjects);
    if (data.activityTags?.length > 0) await db.activityTags.bulkAdd(data.activityTags);
    if (data.studentsYears?.length > 0) await db.studentsYears.bulkAdd(data.studentsYears);
    if (data.studentsGroups?.length > 0) await db.studentsGroups.bulkAdd(data.studentsGroups);
    if (data.studentsSubgroups?.length > 0) await db.studentsSubgroups.bulkAdd(data.studentsSubgroups);
    if (data.activities?.length > 0) await db.activities.bulkAdd(data.activities);
    if (data.buildings?.length > 0) await db.buildings.bulkAdd(data.buildings);
    if (data.rooms?.length > 0) await db.rooms.bulkAdd(data.rooms);
    if (data.timeConstraints?.length > 0) await db.timeConstraints.bulkAdd(data.timeConstraints);
    if (data.spaceConstraints?.length > 0) await db.spaceConstraints.bulkAdd(data.spaceConstraints);
    if (data.solutions?.length > 0) await db.solutions.bulkAdd(data.solutions);
  });
}

/**
 * Restores an envelope snapshot into the active database
 */
export async function restoreSnapshotEnvelopeToDatabase(
  db: FETDatabase,
  envelope: WorkspaceSnapshotEnvelope
): Promise<void> {
  const validated = validateSnapshotEnvelope(envelope);
  await restoreSnapshotDataToDatabase(db, validated.data);
}

/**
 * Serializes a snapshot envelope to a JSON string
 */
export function serializeSnapshotEnvelope(envelope: WorkspaceSnapshotEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Validates and normalizes any snapshot object
 */
export function validateSnapshotEnvelope(raw: unknown): WorkspaceSnapshotEnvelope {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid snapshot envelope: payload is not an object.');
  }

  const obj = raw as Record<string, unknown>;

  // Check if raw is already an envelope or a raw data object
  const hasData = obj.data && typeof obj.data === 'object';
  const rawData = (hasData ? obj.data : obj) as Record<string, unknown>;

  const normalizedData: WorkspaceSnapshotData = {
    rules: (rawData.rules as TimetableRules) || null,
    teachers: Array.isArray(rawData.teachers) ? rawData.teachers : [],
    subjects: Array.isArray(rawData.subjects) ? rawData.subjects : [],
    activityTags: Array.isArray(rawData.activityTags) ? rawData.activityTags : [],
    studentsYears: Array.isArray(rawData.studentsYears) ? rawData.studentsYears : [],
    studentsGroups: Array.isArray(rawData.studentsGroups) ? rawData.studentsGroups : [],
    studentsSubgroups: Array.isArray(rawData.studentsSubgroups) ? rawData.studentsSubgroups : [],
    activities: Array.isArray(rawData.activities) ? rawData.activities : [],
    buildings: Array.isArray(rawData.buildings) ? rawData.buildings : [],
    rooms: Array.isArray(rawData.rooms) ? rawData.rooms : [],
    timeConstraints: Array.isArray(rawData.timeConstraints) ? rawData.timeConstraints : [],
    spaceConstraints: Array.isArray(rawData.spaceConstraints) ? rawData.spaceConstraints : [],
    solutions: Array.isArray(rawData.solutions) ? rawData.solutions : [],
  };

  return {
    version: 1,
    schemaVersion: 1,
    workspaceId: typeof obj.workspaceId === 'string' ? obj.workspaceId : undefined,
    schoolId: typeof obj.schoolId === 'string' ? obj.schoolId : undefined,
    timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : new Date().toISOString(),
    checksum: typeof obj.checksum === 'string' ? obj.checksum : undefined,
    data: normalizedData,
    metadata: typeof obj.metadata === 'object' && obj.metadata !== null ? (obj.metadata as Record<string, string>) : undefined,
  };
}

/**
 * Deserializes JSON string to validated snapshot envelope
 */
export function deserializeSnapshotEnvelope(jsonString: string): WorkspaceSnapshotEnvelope {
  const parsed = JSON.parse(jsonString);
  return validateSnapshotEnvelope(parsed);
}
