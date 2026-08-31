// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Ukrainian is the sole supported base locale. Institution presets register
// additional override bundles that contain ONLY the keys whose terminology
// differs; every other key falls back into the complete `uk` bundle.
// Handwritten sentences per preset — no term interpolation.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './uk.json';
import ukUniversity from './uk-university.json';
import ukCollegeDiffs from './uk-college.json';

// College differs from university by only a handful of keys, so its bundle is
// authored as diffs. They are merged at load time instead of relying on a
// college→university fallbackLng chain: i18next resolves the implicit base
// language («uk») BEFORE fallbackLng entries, which would preempt the chain.
//
// The merge must be DEEP. Bundles are nested by namespace, so a shallow spread
// replaces a whole namespace: a college diff touching one `print` key used to
// drop every other university `print` key, silently printing school wording
// («РОЗКЛАД УРОКІВ … КЛАСУ») on college reports.
type TranslationTree = { [key: string]: string | TranslationTree };

function deepMerge(base: TranslationTree, overrides: TranslationTree): TranslationTree {
  const merged: TranslationTree = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];
    merged[key] =
      value !== null && typeof value === 'object' && existing !== null && typeof existing === 'object'
        ? deepMerge(existing, value)
        : value;
  }
  return merged;
}

export const ukCollegeBundle = deepMerge(
  ukUniversity as TranslationTree,
  ukCollegeDiffs as TranslationTree,
);

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      uk: { translation: uk },
      'uk-university': { translation: ukUniversity },
      'uk-college': { translation: ukCollegeBundle },
    },
    lng: 'uk',
    fallbackLng: { default: ['uk'] },
    supportedLngs: ['uk', 'uk-university', 'uk-college'],
    interpolation: { escapeValue: false },
  });

export default i18n;
