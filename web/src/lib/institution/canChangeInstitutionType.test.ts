// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { canChangeInstitutionType, type InstitutionEntityCounts } from './canChangeInstitutionType';

const EMPTY: InstitutionEntityCounts = {
  teachers: 0,
  subjects: 0,
  activityTags: 0,
  studentsYears: 0,
  studentsGroups: 0,
  studentsSubgroups: 0,
  activities: 0,
  buildings: 0,
  rooms: 0,
  timeConstraints: 0,
  spaceConstraints: 0,
  solutions: 0,
};

describe('canChangeInstitutionType', () => {
  it('allows the change only on a completely empty workspace', () => {
    expect(canChangeInstitutionType(EMPTY)).toBe(true);
  });

  it('blocks the change once any entity exists', () => {
    for (const key of Object.keys(EMPTY) as Array<keyof InstitutionEntityCounts>) {
      expect(canChangeInstitutionType({ ...EMPTY, [key]: 1 }), `must block on ${key}`).toBe(false);
    }
  });
});
