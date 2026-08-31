// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Ukrainian is the sole supported base locale. Institution presets register
// additional override bundles that contain ONLY the keys whose terminology
// differs; every other key falls back through the chain into the complete
// `uk` bundle. Handwritten sentences per preset — no term interpolation.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './uk.json';
import ukUniversity from './uk-university.json';
import ukCollege from './uk-college.json';

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      uk: { translation: uk },
      'uk-university': { translation: ukUniversity },
      'uk-college': { translation: ukCollege },
    },
    lng: 'uk',
    // College deliberately differs from university by a handful of keys, so it
    // falls back through the university bundle first.
    fallbackLng: {
      'uk-university': ['uk'],
      'uk-college': ['uk-university', 'uk'],
      default: ['uk'],
    },
    supportedLngs: ['uk', 'uk-university', 'uk-college'],
    interpolation: { escapeValue: false },
  });

export default i18n;
