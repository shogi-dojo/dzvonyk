import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { workspaceManager } from './workspaceManager';
import type { TimetableRules } from '@/types';
import { isPlaceholderInstitutionName } from '@/lib/institution/placeholderName';

const mockRules: TimetableRules = {
  id: 'rules-details',
  mode: 0,
  institutionName: 'Стара назва',
  nDaysPerWeek: 5,
  nHoursPerDay: 7,
  daysOfTheWeek: [{ name: 'Пн', longName: 'Понеділок' }],
  hoursOfTheDay: [{ name: '08:30', longName: '08:30 - 09:15' }],
  modified: false,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

describe('institution details on schools', () => {
  beforeEach(async () => {
    await db.clearAllData();
    await db.schools.clear();
    await db.workspaces.clear();
    await db.workspaceSnapshots.clear();
    await db.history.clear();
    await db.activeWorkspaceState.clear();
  });

  it('seeds the guest school without a fabricated name', async () => {
    // A seeded «Локальний розклад» reads like a real name, so it survived
    // into printed schedules and .fet exports. Nameless means the UI prompts.
    const context = await workspaceManager.init();

    expect(context.school.name).toBe('');
    expect(isPlaceholderInstitutionName(context.school.name)).toBe(true);
  });

  it('adopts a real rules name onto the nameless guest school', async () => {
    await workspaceManager.init();
    await db.rules.put({ ...mockRules, institutionName: 'Ліцей №15 м. Києва' });

    const context = await workspaceManager.init();

    expect(context.school.name).toBe('Ліцей №15 м. Києва');
  });

  it('leaves the guest school nameless when rules carry only a placeholder', async () => {
    await workspaceManager.init();
    await db.rules.put({ ...mockRules, institutionName: 'Нова школа' });

    const context = await workspaceManager.init();

    expect(context.school.name).toBe('');
  });

  it('createSchool persists name, short name, address, and director', async () => {
    await workspaceManager.init();

    const school = await workspaceManager.createSchool('Гімназія 131', {
      shortName: 'Гімназія 131',
      address: 'м. Київ, вул. Шевченка, 1',
      director: 'Шевченко І. І.',
      ownerUid: 'user-1',
    });

    expect(school).toMatchObject({
      name: 'Гімназія 131',
      shortName: 'Гімназія 131',
      address: 'м. Київ, вул. Шевченка, 1',
      director: 'Шевченко І. І.',
      ownerUid: 'user-1',
    });

    const fetched = await db.schools.get(school.id);
    expect(fetched).toMatchObject({
      address: 'м. Київ, вул. Шевченка, 1',
      director: 'Шевченко І. І.',
    });
  });

  it('createSchool normalizes blank optional fields to undefined', async () => {
    await workspaceManager.init();

    const school = await workspaceManager.createSchool('Ліцей №1', {
      shortName: '   ',
      address: '',
      director: '  ',
    });

    expect(school.shortName).toBeUndefined();
    expect(school.address).toBeUndefined();
    expect(school.director).toBeUndefined();
  });

  it('renameSchool updates details and mirrors the name into active rules', async () => {
    await workspaceManager.init();
    await db.rules.put(mockRules);

    const school = await workspaceManager.createSchool('Стара назва');
    const workspaces = await workspaceManager.listWorkspaces(school.id);
    await workspaceManager.switchWorkspace(workspaces[0].id);

    const updated = await workspaceManager.renameSchool(school.id, {
      name: 'Великорусавський ліцей',
      shortName: 'ВРЛ',
      address: 'смт Великорусавське, вул. Шкільна, 1',
      director: 'Іваненко І. І.',
    });

    expect(updated).toMatchObject({
      name: 'Великорусавський ліцей',
      shortName: 'ВРЛ',
      address: 'смт Великорусавське, вул. Шкільна, 1',
      director: 'Іваненко І. І.',
    });

    const fetched = await db.schools.get(school.id);
    expect(fetched?.director).toBe('Іваненко І. І.');
    expect(fetched?.address).toBe('смт Великорусавське, вул. Шкільна, 1');

    const activeRules = await db.rules.toArray();
    expect(activeRules[0].institutionName).toBe('Великорусавський ліцей');
  });

  it('renameSchool keeps unset optional fields instead of wiping them', async () => {
    await workspaceManager.init();

    const school = await workspaceManager.createSchool('Ліцей', {
      shortName: 'Ліцей',
      address: 'м. Київ',
      director: 'Петренко П. П.',
    });

    const updated = await workspaceManager.renameSchool(school.id, {
      name: 'Ліцей №2',
    });

    expect(updated.name).toBe('Ліцей №2');
    expect(updated.shortName).toBe('Ліцей');
    expect(updated.address).toBe('м. Київ');
    expect(updated.director).toBe('Петренко П. П.');
  });

  it('renameSchool normalizes blank optional fields to undefined', async () => {
    await workspaceManager.init();

    const school = await workspaceManager.createSchool('Ліцей', {
      shortName: 'Ліцей',
      address: 'м. Київ',
      director: 'Петренко П. П.',
    });

    const updated = await workspaceManager.renameSchool(school.id, {
      name: 'Ліцей',
      shortName: ' ',
      address: '',
      director: '',
    });

    expect(updated.shortName).toBeUndefined();
    expect(updated.address).toBeUndefined();
    expect(updated.director).toBeUndefined();
  });
});
