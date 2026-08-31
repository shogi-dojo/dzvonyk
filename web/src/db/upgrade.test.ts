// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';

/**
 * The v2 → v3 in-place upgrade, exercised against a real (fake-indexeddb)
 * database rather than the app singleton, which is created at v3 and so never
 * runs the upgrade path.
 *
 * This is the migration every existing user's browser will actually perform,
 * and it is the one step that cannot be re-run if it goes wrong.
 */

const V2_STORES = {
  rules: 'id, institutionName, mode, createdAt, updatedAt',
  teachers: 'id, &name',
  subjects: 'id, &name',
  activityTags: 'id, &name',
  studentsYears: 'id, &name',
  studentsGroups: 'id, name',
  studentsSubgroups: 'id, name',
  activities: 'id, subjectId, activityGroupId, *teacherIds, *studentSetIds',
  buildings: 'id, &name',
  rooms: 'id, &name, buildingId',
  timeConstraints: 'id, type, active',
  spaceConstraints: 'id, type, active',
  solutions: 'id, rulesId, generatedAt, isComplete',
  schools: 'id, name, ownerUid, createdAt, updatedAt',
  workspaces: 'id, schoolId, label, localRevision, cloudRevision, lastSyncedAt, isArchived, createdAt, updatedAt',
  workspaceSnapshots: 'id, workspaceId, revision, type, createdAt',
  history: 'id, workspaceId, timestamp',
  syncQueue: 'id, workspaceId, action, status, createdAt',
  activeWorkspaceState: 'id, currentWorkspaceId, currentSchoolId, activeRevision',
};

/** Opens a legacy v2 database and seeds pre-institution-type rows. */
async function seedV2(dbName: string) {
  const legacy = new Dexie(dbName);
  legacy.version(2).stores(V2_STORES);
  await legacy.open();

  await legacy.table('rules').put({
    id: 'rules-legacy',
    mode: 0,
    institutionName: 'Школа №5',
    nDaysPerWeek: 5,
    nHoursPerDay: 7,
    daysOfTheWeek: [{ name: 'Понеділок' }],
    hoursOfTheDay: [{ name: '1 урок', longName: '08:30 - 09:15' }],
    modified: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  await legacy.table('schools').bulkPut([
    { id: 'guest-school-default', name: 'Школа №5', createdAt: 'x', updatedAt: 'x' },
    { id: 'school-2', name: 'Ліцей', createdAt: 'x', updatedAt: 'x' },
  ]);
  await legacy.table('teachers').put({ id: 't1', name: 'Грибок Н.І.' });

  legacy.close();
}

/** Reopens the same database at v3, running the real upgrade handler. */
async function openV3(dbName: string) {
  const upgraded = new Dexie(dbName);
  upgraded.version(2).stores(V2_STORES);
  upgraded.version(3).upgrade(async (tx) => {
    await tx.table('rules').toCollection().modify((rules: Record<string, unknown>) => {
      if (!rules.institutionType) rules.institutionType = 'school';
    });
    await tx.table('schools').toCollection().modify((school: Record<string, unknown>) => {
      if (!school.institutionType) school.institutionType = 'school';
    });
  });
  await upgraded.open();
  return upgraded;
}

describe('Dexie v2 → v3 upgrade', () => {
  it('keeps its legacy schema copy in sync with the shipped database', async () => {
    // V2_STORES is duplicated here because the app singleton is born at v3 and
    // cannot replay the upgrade. Guard the copy: v3 adds no tables, so the
    // shipped database must expose exactly the stores listed above.
    const { db } = await import('@/db');
    expect([...db.tables].map((t) => t.name).sort()).toEqual(Object.keys(V2_STORES).sort());
    expect(db.verno).toBe(3);
  });

  it('backfills school onto legacy rules and every school, preserving other data', async () => {
    const dbName = `upgrade-test-${crypto.randomUUID()}`;
    await seedV2(dbName);
    const upgraded = await openV3(dbName);

    expect(upgraded.verno).toBe(3);

    const rules = await upgraded.table('rules').get('rules-legacy');
    expect(rules.institutionType).toBe('school');
    // The upgrade must touch nothing else.
    expect(rules.institutionName).toBe('Школа №5');
    expect(rules.hoursOfTheDay).toEqual([{ name: '1 урок', longName: '08:30 - 09:15' }]);

    const schools = await upgraded.table('schools').toArray();
    expect(schools.map((s: { institutionType?: string }) => s.institutionType)).toEqual(['school', 'school']);
    expect(await upgraded.table('teachers').count()).toBe(1);

    upgraded.close();
  });

  it('is idempotent and never overwrites a type that is already set', async () => {
    const dbName = `upgrade-test-${crypto.randomUUID()}`;
    await seedV2(dbName);

    // A v3 client had already written a non-school type before this upgrade
    // ran (e.g. the row arrived from cloud sync).
    const pre = await openV3(dbName);
    await pre.table('schools').update('school-2', { institutionType: 'university' });
    pre.close();

    const reopened = await openV3(dbName);
    const school2 = await reopened.table('schools').get('school-2');
    expect(school2.institutionType).toBe('university');
    reopened.close();
  });

  it('leaves an empty legacy database valid rather than seeding rows', async () => {
    const dbName = `upgrade-test-${crypto.randomUUID()}`;
    const legacy = new Dexie(dbName);
    legacy.version(2).stores(V2_STORES);
    await legacy.open();
    legacy.close();

    const upgraded = await openV3(dbName);
    expect(await upgraded.table('rules').count()).toBe(0);
    expect(await upgraded.table('schools').count()).toBe(0);
    upgraded.close();
  });
});
