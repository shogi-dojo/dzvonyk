// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type { InstitutionPresetId } from './presets';
import type { School, TimetableRules } from '@/types';

/**
 * The single read point for the institution preset.
 *
 * `School.institutionType` is the source of truth; the copy in
 * `TimetableRules.institutionType` exists so snapshots (which carry rules but
 * not the School) stay portable. The type is immutable once set, so the two
 * cannot diverge. Everything missing — legacy Dexie rows, pre-v2 snapshots,
 * .fet imports — safely resolves to 'school', the only default under which
 * every existing workspace renders byte-for-byte as before.
 */
export function resolveInstitutionType(
  school?: Pick<School, 'institutionType'> | null,
  rules?: Pick<TimetableRules, 'institutionType'> | null
): InstitutionPresetId {
  return school?.institutionType ?? rules?.institutionType ?? 'school';
}
