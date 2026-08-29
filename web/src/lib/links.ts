// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors

/** Public source, linked from the UI to satisfy AGPL §13. Do not remove. */
export const SOURCE_URL = 'https://github.com/shogi-dojo/dzvonyk';

/**
 * Where users report breakage. Read this daily during the school-year start.
 *
 * Email rather than GitHub issues on purpose: the user is a завуч, not a
 * developer, and requiring a GitHub account would silently drop most reports.
 * The subject line is prefilled so incoming mail is easy to filter.
 */
export const FEEDBACK_EMAIL = 'admin@school131.kyiv.ua';
export const FEEDBACK_URL =
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Дзвоник — відгук')}`;

/**
 * Monobank «банка».
 *
 * Deliberately the shareable jar link and not the jar's card number: this repo
 * is public under AGPL, so a card number would live in git history, in every
 * deployed bundle and in every fork, and could not be rotated without
 * recreating the jar. The link also pays in one tap on mobile.
 *
 * Empty string hides every donate affordance, so the UI never ships a dead link.
 */
export const DONATE_URL = 'https://send.monobank.ua/jar/81mYjES3MG';
