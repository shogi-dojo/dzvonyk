// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { describe, expect, it } from 'vitest';
import { preserveInstitutionType } from './preserveInstitutionType';

describe('preserveInstitutionType', () => {
  it('keeps the university type when a .fet import replaces the rules row', () => {
    // The file formats carry no institution type, so the rebuilt rules must be
    // stamped from the School, which survives the import untouched.
    expect(preserveInstitutionType({ institutionType: 'university' }, null)).toBe('university');
  });

  it('falls back to the previous rules when there is no active school', () => {
    // Guest workspaces have rules but no School row.
    expect(preserveInstitutionType(null, { institutionType: 'college' })).toBe('college');
  });

  it('defaults to school so legacy imports keep rendering as before', () => {
    expect(preserveInstitutionType(null, null)).toBe('school');
    expect(preserveInstitutionType(undefined, undefined)).toBe('school');
  });

  it('lets the school win over a stale rules mirror', () => {
    expect(
      preserveInstitutionType({ institutionType: 'university' }, { institutionType: 'school' })
    ).toBe('university');
  });
});
