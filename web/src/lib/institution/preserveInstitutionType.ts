// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { resolveInstitutionType } from './resolveInstitutionType';
import type { InstitutionPresetId } from './presets';
import type { School, TimetableRules } from '@/types';

/**
 * The institution type a freshly imported timetable must carry.
 *
 * Importing a .fet/.roz file replaces the rules row wholesale, but it must not
 * change what kind of institution the workspace is: the type is immutable, and
 * the file formats have no field for it. `School.institutionType` is the source
 * of truth and survives the import, so we re-stamp the new rules from it.
 *
 * Without this the live UI still reads correctly (the School wins in
 * `resolveInstitutionType`), but the rules mirror silently reverts to 'school'
 * — and a snapshot taken afterwards carries rules without the School, so
 * restoring it would turn a university back into a school.
 */
export function preserveInstitutionType(
  school?: Pick<School, 'institutionType'> | null,
  previousRules?: Pick<TimetableRules, 'institutionType'> | null
): InstitutionPresetId {
  return resolveInstitutionType(school, previousRules);
}
