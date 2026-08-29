/**
 * Generation Slice - Timetable generation state
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GenerationState } from '../../types';

const initialState: GenerationState = {
  isRunning: false,
  isPaused: false,
  progress: 0,
  placedActivities: 0,
  totalActivities: 0,
  conflicts: [],
  startTime: undefined,
  elapsedTime: 0,
  maxPlacedActivities: 0,
};

const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    startGeneration: (state, action: PayloadAction<number>) => {
      state.isRunning = true;
      state.isPaused = false;
      state.progress = 0;
      state.placedActivities = 0;
      state.totalActivities = action.payload;
      state.conflicts = [];
      state.startTime = new Date();
      state.elapsedTime = 0;
      state.maxPlacedActivities = 0;
    },
    pauseGeneration: (state) => {
      state.isPaused = true;
    },
    resumeGeneration: (state) => {
      state.isPaused = false;
    },
    stopGeneration: (state) => {
      state.isRunning = false;
      state.isPaused = false;
    },
    updateProgress: (state, action: PayloadAction<{
      placedActivities: number;
      conflicts?: string[];
    }>) => {
      state.placedActivities = action.payload.placedActivities;
      if (state.totalActivities > 0) {
        state.progress = (action.payload.placedActivities / state.totalActivities) * 100;
      }
      if (action.payload.conflicts) {
        state.conflicts = action.payload.conflicts;
      }
      if (action.payload.placedActivities > state.maxPlacedActivities) {
        state.maxPlacedActivities = action.payload.placedActivities;
      }
    },
    updateElapsedTime: (state, action: PayloadAction<number>) => {
      state.elapsedTime = action.payload;
    },
    addConflict: (state, action: PayloadAction<string>) => {
      state.conflicts.push(action.payload);
    },
    clearConflicts: (state) => {
      state.conflicts = [];
    },
    generationComplete: (state) => {
      state.isRunning = false;
      state.isPaused = false;
      state.progress = 100;
    },
    generationFailed: (state, action: PayloadAction<string>) => {
      state.isRunning = false;
      state.isPaused = false;
      state.conflicts.push(action.payload);
    },
    resetGeneration: () => initialState,
  },
});

export const {
  startGeneration,
  pauseGeneration,
  resumeGeneration,
  stopGeneration,
  updateProgress,
  updateElapsedTime,
  addConflict,
  clearConflicts,
  generationComplete,
  generationFailed,
  resetGeneration,
} = generationSlice.actions;

export default generationSlice.reducer;
