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
