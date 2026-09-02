/**
 * Rules Slice - Timetable rules/settings state
 * NOTE: Dates are stored as ISO strings for Redux serializability
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Day, Hour } from '../../types';
import { OFFICIAL_MODE } from '../../types';

// Interface with string dates for Redux compatibility
export interface TimetableRulesState {
  id: string;
  mode: number;
  institutionName: string;
  comments?: string;
  nDaysPerWeek: number;
  nHoursPerDay: number;
  daysOfTheWeek: Day[];
  hoursOfTheDay: Hour[];
  nRealDaysPerWeek?: number;
  nRealHoursPerDay?: number;
  nTerms?: number;
  nDaysPerTerm?: number;
  shifts?: {
    shift1: { firstHour: number; lastHour: number };
    shift2: { firstHour: number; lastHour: number };
  };
  modified: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

interface RulesState {
  current: TimetableRulesState | null;
  modified: boolean;
}

const createDefaultRules = (id: string): TimetableRulesState => ({
  id,
  mode: OFFICIAL_MODE,
  // Empty on purpose; the UI prompts for a real name (see placeholderName).
  institutionName: '',
  comments: '',
  nDaysPerWeek: 5,
  nHoursPerDay: 8,
  daysOfTheWeek: [
    { name: 'Monday', longName: 'Monday' },
    { name: 'Tuesday', longName: 'Tuesday' },
    { name: 'Wednesday', longName: 'Wednesday' },
    { name: 'Thursday', longName: 'Thursday' },
    { name: 'Friday', longName: 'Friday' },
  ],
  // `name` is the period's label, `longName` its bell range. Seeding the label
  // with a time made the «Назва» column look like a broken copy of «Початок».
  hoursOfTheDay: [
    { name: '1 урок', longName: '08:00 - 09:00' },
    { name: '2 урок', longName: '09:00 - 10:00' },
    { name: '3 урок', longName: '10:00 - 11:00' },
    { name: '4 урок', longName: '11:00 - 12:00' },
    { name: '5 урок', longName: '12:00 - 13:00' },
    { name: '6 урок', longName: '13:00 - 14:00' },
    { name: '7 урок', longName: '14:00 - 15:00' },
    { name: '8 урок', longName: '15:00 - 16:00' },
  ],
  modified: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const initialState: RulesState = {
  current: null,
  modified: false,
};

// Helper to ensure dates are ISO strings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeRules = (rules: any): TimetableRulesState => {
  return {
    ...rules,
    createdAt: rules.createdAt instanceof Date 
      ? rules.createdAt.toISOString() 
      : (typeof rules.createdAt === 'string' ? rules.createdAt : new Date().toISOString()),
    updatedAt: rules.updatedAt instanceof Date 
      ? rules.updatedAt.toISOString() 
      : (typeof rules.updatedAt === 'string' ? rules.updatedAt : new Date().toISOString()),
  };
};

const rulesSlice = createSlice({
  name: 'rules',
  initialState,
  reducers: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRules: (state, action: PayloadAction<any>) => {
      state.current = normalizeRules(action.payload);
      state.modified = false;
    },
    createNewRules: (state, action: PayloadAction<string>) => {
      state.current = createDefaultRules(action.payload);
      state.modified = true;
    },
    updateInstitutionName: (state, action: PayloadAction<string>) => {
      if (state.current) {
        state.current.institutionName = action.payload;
        state.current.updatedAt = new Date().toISOString();
        state.modified = true;
      }
    },
    updateComments: (state, action: PayloadAction<string>) => {
      if (state.current) {
        state.current.comments = action.payload;
        state.current.updatedAt = new Date().toISOString();
        state.modified = true;
      }
    },
    updateMode: (state, action: PayloadAction<number>) => {
      if (state.current) {
        state.current.mode = action.payload;
        state.current.updatedAt = new Date().toISOString();
        state.modified = true;
      }
    },
    updateDays: (state, action: PayloadAction<Day[]>) => {
      if (state.current) {
        state.current.daysOfTheWeek = action.payload;
        state.current.nDaysPerWeek = action.payload.length;
        state.current.updatedAt = new Date().toISOString();
        state.modified = true;
      }
    },
    updateHours: (state, action: PayloadAction<Hour[]>) => {
      if (state.current) {
        state.current.hoursOfTheDay = action.payload;
        state.current.nHoursPerDay = action.payload.length;
        state.current.updatedAt = new Date().toISOString();
        state.modified = true;
      }
    },
    updateShifts: (state, action: PayloadAction<TimetableRulesState['shifts']>) => {
      if (state.current) {
        state.current.shifts = action.payload;
        state.current.updatedAt = new Date().toISOString();
        state.modified = true;
      }
    },
    markAsSaved: (state) => {
      state.modified = false;
      if (state.current) {
        state.current.modified = false;
      }
    },
    clearRules: (state) => {
      state.current = null;
      state.modified = false;
    },
  },
});

export const {
  setRules,
  createNewRules,
  updateInstitutionName,
  updateComments,
  updateMode,
  updateDays,
  updateHours,
  updateShifts,
  markAsSaved,
  clearRules,
} = rulesSlice.actions;

export default rulesSlice.reducer;
