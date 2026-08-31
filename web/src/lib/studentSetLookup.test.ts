// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createIdOrNameIndex, resolveByIdOrName } from './studentSetLookup';

const sets = [
  { id: 'g1', name: 'КН-11' },
  { id: 'g2', name: 'КН-12' },
];

describe('student set lookup', () => {
  it('resolves by id and by name', () => {
    expect(resolveByIdOrName(sets, 'g1')?.name).toBe('КН-11');
    expect(resolveByIdOrName(sets, 'КН-12')?.id).toBe('g2');
    expect(resolveByIdOrName(sets, 'missing')).toBeUndefined();
  });

  it('indexes by id and by name', () => {
    const index = createIdOrNameIndex(sets);
    expect(index.get('g1')?.name).toBe('КН-11');
    expect(index.get('КН-12')?.id).toBe('g2');
    expect(index.get('missing')).toBeUndefined();
  });

  it('resolves the name-shaped references the app and importers actually write', () => {
    // Students.tsx appends `newGroup.name` to year.groups, fetParser pushes
    // gName, rozParser pushes className. The "group IDs" label on the type was
    // wrong, and code that trusted it dropped imported streams entirely.
    const groups = [
      { id: 'uuid-a', name: 'КН-11' },
      { id: 'uuid-b', name: 'КН-12' },
    ];
    const yearGroupsAsWritten = ['КН-11', 'КН-12'];
    const index = createIdOrNameIndex(groups);
    expect(yearGroupsAsWritten.map((ref) => index.get(ref)?.id)).toEqual(['uuid-a', 'uuid-b']);
  });

  it('lets an id win over another set that is merely named like it', () => {
    // Pathological but possible after an import: one group is literally named
    // after another group's id. The id owner must still resolve to itself.
    const collided = [
      { id: 'g1', name: 'КН-11' },
      { id: 'g2', name: 'g1' },
    ];
    expect(createIdOrNameIndex(collided).get('g1')?.id).toBe('g1');
  });
});
