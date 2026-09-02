// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { useEffect } from 'react';
import i18n from '@/i18n';
import { INSTITUTION_PRESETS, type InstitutionPreset } from '@/lib/institution/presets';
import { resolveInstitutionType } from '@/lib/institution/resolveInstitutionType';
import { useAppSelector } from './useAppSelector';

/**
 * The active institution preset, resolved from the workspace state.
 *
 * Also keeps the i18n language in sync with the preset's terminology bundle,
 * so non-react modules (print documents, engine messages) speak the same
 * terms as the components. With empty override bundles this is provably a
 * no-op: every key resolves to the base `uk` bundle.
 */
export function useInstitutionPreset(): InstitutionPreset {
  const activeSchool = useAppSelector((state) => state.workspace.activeSchool);
  const rules = useAppSelector((state) => state.rules.current);
  const preset = INSTITUTION_PRESETS[resolveInstitutionType(activeSchool ?? undefined, rules ?? undefined)];

  useEffect(() => {
    if (i18n.language !== preset.locale) {
      void i18n.changeLanguage(preset.locale);
    }
  }, [preset.locale]);

  return preset;
}
