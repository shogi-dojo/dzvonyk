// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { resolveInstitutionType } from './resolveInstitutionType';

describe('resolveInstitutionType', () => {
  it('defaults to school when nothing is stored yet', () => {
    expect(resolveInstitutionType()).toBe('school');
    expect(resolveInstitutionType(null, null)).toBe('school');
    expect(resolveInstitutionType({}, {})).toBe('school');
  });

  it('prefers the school record over the rules copy', () => {
    expect(
      resolveInstitutionType({ institutionType: 'university' }, { institutionType: 'school' })
    ).toBe('university');
  });

  it('falls back to the rules copy when the school record lacks the field', () => {
    expect(resolveInstitutionType({}, { institutionType: 'college' })).toBe('college');
    expect(resolveInstitutionType(null, { institutionType: 'gymnasium' })).toBe('gymnasium');
  });

  it('reads the school record alone', () => {
    expect(resolveInstitutionType({ institutionType: 'gymnasium' })).toBe('gymnasium');
  });
});
