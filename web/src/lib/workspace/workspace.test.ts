import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db';
import {
  serializeSnapshotEnvelope,
  deserializeSnapshotEnvelope,
  validateSnapshotEnvelope,
} from './snapshotCodec';
import { workspaceRepository } from './workspaceRepository';
import type { Teacher, Subject, Activity, Room, TimetableRules } from '@/types';

const mockRules: TimetableRules = {
  id: 'rules-1',
  mode: 0,
  institutionName: 'Тестова гімназія',
  nDaysPerWeek: 5,
  nHoursPerDay: 7,
  daysOfTheWeek: [
    { name: 'Понеділок', longName: 'Понеділок' },
    { name: 'Вівторок', longName: 'Вівторок' },
  ],
  hoursOfTheDay: [
    { name: '08:30', longName: '08:30 - 09:15' },
    { name: '09:25', longName: '09:25 - 10:10' },
  ],
  modified: false,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

const mockTeacher: Teacher = {
  id: 't-1',
  name: 'Шевченко Т. Г.',
  targetNumberOfHours: 18,
  qualifiedSubjects: ['sub-1'],
};

const mockSubject: Subject = {
  id: 'sub-1',
  name: 'Українська література',
  color: '#3b82f6',
};

const mockRoom: Room = {
  id: 'room-1',
  name: '101',
  capacity: 30,
  isVirtual: false,
};

const mockActivity: Activity = {
  id: 'act-1',
  activityGroupId: 0,
  teacherIds: ['t-1'],
  subjectId: 'sub-1',
  activityTagIds: [],
  studentSetIds: ['group-1'],
  duration: 1,
  totalDuration: 1,
  active: true,
  computeNTotalStudents: true,
  nTotalStudents: 25,
};

describe('Centralized Workspace Persistence & Snapshot Codec', () => {
  beforeEach(async () => {
    await db.clearAllData();
    vi.restoreAllMocks();
  });

  it('creates and restores a full snapshot envelope with complete fidelity', async () => {
    // 1. Seed database through workspaceRepository
    await workspaceRepository.saveRules(mockRules);
    await workspaceRepository.saveTeacher(mockTeacher);
    await workspaceRepository.saveSubject(mockSubject);
    await workspaceRepository.saveRoom(mockRoom);
    await workspaceRepository.saveActivity(mockActivity);

    // 2. Create snapshot envelope
    const envelope = await workspaceRepository.createSnapshot({
      workspaceId: 'ws-test-1',
      schoolId: 'sch-test-1',
      description: 'Initial backup',
    });

    expect(envelope.version).toBe(1);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.workspaceId).toBe('ws-test-1');
    expect(envelope.metadata?.institutionName).toBe('Тестова гімназія');
    expect(envelope.data.teachers).toHaveLength(1);
    expect(envelope.data.subjects).toHaveLength(1);
    expect(envelope.data.rooms).toHaveLength(1);
    expect(envelope.data.activities).toHaveLength(1);

    // 3. Serialize and deserialize
    const serialized = serializeSnapshotEnvelope(envelope);
    expect(typeof serialized).toBe('string');

    const deserialized = deserializeSnapshotEnvelope(serialized);
    expect(deserialized.data.teachers[0].name).toBe('Шевченко Т. Г.');

    // 4. Clear database and restore
    await db.clearAllData();
    const countBefore = await db.teachers.count();
    expect(countBefore).toBe(0);

    await workspaceRepository.restoreSnapshot(deserialized);

    const countAfter = await db.teachers.count();
    expect(countAfter).toBe(1);
    const restoredTeacher = await db.teachers.get('t-1');
    expect(restoredTeacher?.name).toBe('Шевченко Т. Г.');
    const restoredRules = await db.rules.get('rules-1');
    expect(restoredRules?.institutionName).toBe('Тестова гімназія');
  });

  it('notifies mutation hooks on repository actions with undo/redo diffs', async () => {
    const hookSpy = vi.fn();
    const unsubscribe = workspaceRepository.registerMutationHook(hookSpy);

    await workspaceRepository.saveTeacher(mockTeacher);
    expect(hookSpy).toHaveBeenCalledWith(
      expect.stringContaining('Шевченко Т. Г.'),
      expect.arrayContaining([
        expect.objectContaining({ table: 'teachers', key: 't-1', next: null }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ table: 'teachers', key: 't-1', next: mockTeacher }),
      ])
    );

    await workspaceRepository.deleteTeacher('t-1');
    expect(hookSpy).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('validates and normalizes missing or legacy snapshot structures safely', () => {
    const legacyPayload = {
      rules: mockRules,
      teachers: [mockTeacher],
      // all other tables omitted
    };

    const validated = validateSnapshotEnvelope(legacyPayload);
    expect(validated.version).toBe(1);
    expect(validated.data.teachers).toHaveLength(1);
    expect(validated.data.subjects).toEqual([]);
    expect(validated.data.rooms).toEqual([]);
    expect(validated.data.solutions).toEqual([]);
  });
});
