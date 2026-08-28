// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 3: i18n. Ukrainian is the default and only fully-supported locale;
// English exists as a fallback for keys not yet translated so nothing renders
// as a raw key.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import uk from './uk.json';
import en from './en.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { uk: { translation: uk }, en: { translation: en } },
    fallbackLng: 'uk',
    supportedLngs: ['uk', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'dzvonyk.lang',
    },
  });

export default i18n;
