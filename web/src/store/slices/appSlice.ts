/**
 * App Slice - Global application state
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  currentRulesId: string | null;
  isDarkMode: boolean;
  language: string;
  sidebarOpen: boolean;
  desktopSidebarCollapsed: boolean;
  isLoading: boolean;
  error: string | null;
}

// Get initial dark mode from localStorage (defaults to light theme)
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('dzvonyk-theme') || localStorage.getItem('fet-dark-mode');
  if (stored !== null) {
    return stored === 'dark' || stored === 'true';
  }
  // Default is Light theme
  return false;
};

const getInitialSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('dzvonyk-sidebar-collapsed') === 'true';
};

const initialState: AppState = {
  currentRulesId: null,
  isDarkMode: getInitialDarkMode(),
  language: 'uk',
  sidebarOpen: true,
  desktopSidebarCollapsed: getInitialSidebarCollapsed(),
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
      if (typeof window !== 'undefined') {
        localStorage.setItem('dzvonyk-theme', state.isDarkMode ? 'dark' : 'light');
        localStorage.setItem('fet-dark-mode', String(state.isDarkMode));
        document.documentElement.classList.toggle('dark', state.isDarkMode);
      }
    },
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('dzvonyk-theme', action.payload ? 'dark' : 'light');
        localStorage.setItem('fet-dark-mode', String(action.payload));
        document.documentElement.classList.toggle('dark', action.payload);
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
    toggleDesktopSidebar: (state) => {
      state.desktopSidebarCollapsed = !state.desktopSidebarCollapsed;
      if (typeof window !== 'undefined') {
        localStorage.setItem('dzvonyk-sidebar-collapsed', String(state.desktopSidebarCollapsed));
      }
    },
    setDesktopSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.desktopSidebarCollapsed = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('dzvonyk-sidebar-collapsed', String(action.payload));
      }
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
  toggleDesktopSidebar,
  setDesktopSidebarCollapsed,
  setLoading,
  setError,
  clearError,
} = appSlice.actions;

export default appSlice.reducer;
