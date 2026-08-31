// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import type { Hour } from '@/types';

/**
 * Institution presets: pure data, no React and no i18n.
 *
 * The app speaks one of these presets end to end: the resource bundle chosen by
 * `locale` supplies the terminology (handwritten sentences, see src/i18n), the
 * `defaults` seed new timetables, and `features` gate functionality that only
 * makes sense for some institution kinds (МОЗ sanitary checks are school-only,
 * streams and activity subtypes are university-only).
 *
 * The type is chosen once at institution creation and never changes afterwards.
 */

export type InstitutionPresetId = 'school' | 'gymnasium' | 'college' | 'university';

export type InstitutionLocale = 'uk' | 'uk-university' | 'uk-college';

export interface InstitutionPresetDefaults {
  nDaysPerWeek: number;
  nHoursPerDay: number;
  slotMinutes: number;
  breakMinutes: number;
  longBreakAfterSlot?: number;
  longBreakMinutes?: number;
  firstBellHHMM: string;
}

export interface InstitutionPresetFeatures {
  /** МОЗ №2205 (2020) weekly-load warnings — school education only. */
  sanitaryChecks: boolean;
  /** Two-shift scheduling (зміни). */
  shifts: boolean;
  /** One activity may address a whole year (потік) across several groups. */
  streams: boolean;
  /** Lecture/seminar/lab classification of activities. */
  activitySubtypes: boolean;
}

export interface InstitutionPreset {
  id: InstitutionPresetId;
  /** i18next language bundle that carries this preset's terminology. */
  locale: InstitutionLocale;
  labelKey: string;
  descriptionKey: string;
  defaults: InstitutionPresetDefaults;
  features: InstitutionPresetFeatures;
  /**
   * Parses the canonical numbered label of a lesson/period as this preset
   * writes it into `hoursOfTheDay[].name` (e.g. «7 урок», «2 пара»).
   */
  lessonLabelPattern: RegExp;
  /** The noun used to build default period names («1 урок», «1 пара»). */
  hourNameUnit: string;
}

const SCHOOL_DEFAULTS: InstitutionPresetDefaults = {
  nDaysPerWeek: 5,
  nHoursPerDay: 7,
  slotMinutes: 45,
  breakMinutes: 10,
  longBreakAfterSlot: 3,
  longBreakMinutes: 20,
  firstBellHHMM: '08:30',
};

const SCHOOL_FEATURES: InstitutionPresetFeatures = {
  sanitaryChecks: true,
  shifts: true,
  streams: false,
  activitySubtypes: false,
};

const ACADEMIC_FEATURES: InstitutionPresetFeatures = {
  sanitaryChecks: false,
  shifts: false,
  streams: true,
  activitySubtypes: true,
};

const SCHOOL_LESSON_LABEL = /^(\d+)\s*(?:ур\.?|урок)$/iu;
const ACADEMIC_LESSON_LABEL = /^(\d+)\s*(?:пар\.?|пара|пари|пар)$/iu;

export const INSTITUTION_PRESETS: Record<InstitutionPresetId, InstitutionPreset> = {
  school: {
    id: 'school',
    locale: 'uk',
    labelKey: 'institution.presets.school.label',
    descriptionKey: 'institution.presets.school.description',
    defaults: SCHOOL_DEFAULTS,
    features: SCHOOL_FEATURES,
    lessonLabelPattern: SCHOOL_LESSON_LABEL,
    hourNameUnit: 'урок',
  },
  gymnasium: {
    id: 'gymnasium',
    locale: 'uk',
    labelKey: 'institution.presets.gymnasium.label',
    descriptionKey: 'institution.presets.gymnasium.description',
    defaults: SCHOOL_DEFAULTS,
    features: SCHOOL_FEATURES,
    lessonLabelPattern: SCHOOL_LESSON_LABEL,
    hourNameUnit: 'урок',
  },
  college: {
    id: 'college',
    locale: 'uk-college',
    labelKey: 'institution.presets.college.label',
    descriptionKey: 'institution.presets.college.description',
    defaults: {
      nDaysPerWeek: 5,
      nHoursPerDay: 6,
      slotMinutes: 80,
      breakMinutes: 10,
      firstBellHHMM: '08:30',
    },
    features: ACADEMIC_FEATURES,
    lessonLabelPattern: ACADEMIC_LESSON_LABEL,
    hourNameUnit: 'пара',
  },
  university: {
    id: 'university',
    locale: 'uk-university',
    labelKey: 'institution.presets.university.label',
    descriptionKey: 'institution.presets.university.description',
    defaults: {
      // A pair is two academic hours (2 × 45) plus one short break.
      nDaysPerWeek: 5,
      nHoursPerDay: 6,
      slotMinutes: 95,
      breakMinutes: 10,
      firstBellHHMM: '08:30',
    },
    features: ACADEMIC_FEATURES,
    lessonLabelPattern: ACADEMIC_LESSON_LABEL,
    hourNameUnit: 'пара',
  },
};

export function isInstitutionPresetId(value: unknown): value is InstitutionPresetId {
  return typeof value === 'string' && value in INSTITUTION_PRESETS;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The single source of default bell schedules.
 *
 * Consolidates the three divergent hardcoded tables that used to live in
 * workspaceManager, rulesSlice and Settings. `name` carries the period's
 * label («1 урок»), `longName` its bell range — the convention the rules
 * editor already assumed.
 */
export function buildDefaultHours(preset: InstitutionPreset): Hour[] {
  const { nHoursPerDay, slotMinutes, breakMinutes, longBreakAfterSlot, longBreakMinutes, firstBellHHMM } =
    preset.defaults;

  const hours: Hour[] = [];
  let start = hhmmToMinutes(firstBellHHMM);
  for (let n = 1; n <= nHoursPerDay; n++) {
    const end = start + slotMinutes;
    hours.push({
      name: `${n} ${preset.hourNameUnit}`,
      longName: `${minutesToHHMM(start)} - ${minutesToHHMM(end)}`,
    });
    const isLongBreak = longBreakAfterSlot !== undefined && n === longBreakAfterSlot;
    start = end + (isLongBreak ? (longBreakMinutes ?? breakMinutes) : breakMinutes);
  }
  return hours;
}
