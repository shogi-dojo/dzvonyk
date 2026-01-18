/**
 * App Slice - Global application state
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  currentRulesId: string | null;
  isDarkMode: boolean;
  language: string;
  sidebarOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

// Get initial dark mode from localStorage or system preference
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('fet-dark-mode');
  if (stored !== null) {
    return stored === 'true';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const initialState: AppState = {
  currentRulesId: null,
  isDarkMode: getInitialDarkMode(),
  language: 'en',
  sidebarOpen: true,
  isLoading: false,
  error: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setCurrentRulesId: (state, action: PayloadAction<string | null>) => {
      state.currentRulesId = action.payload;
    },
    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode;
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('fet-dark-mode', String(state.isDarkMode));
      }
    },
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('fet-dark-mode', String(action.payload));
      }
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCurrentRulesId,
  toggleDarkMode,
  setDarkMode,
  setLanguage,
  toggleSidebar,
  setSidebarOpen,
  setLoading,
  setError,
  clearError,
} = appSlice.actions;

export default appSlice.reducer;
