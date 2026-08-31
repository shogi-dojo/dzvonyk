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
const ukCollege = { ...ukUniversity, ...ukCollegeDiffs };

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      uk: { translation: uk },
      'uk-university': { translation: ukUniversity },
      'uk-college': { translation: ukCollege },
    },
    lng: 'uk',
    fallbackLng: { default: ['uk'] },
    supportedLngs: ['uk', 'uk-university', 'uk-college'],
    interpolation: { escapeValue: false },
  });

export default i18n;
