/**
 * Subjects Slice - Subjects state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Subject } from '../../types';
import { db } from '../../db';

interface SubjectsState {
  items: Subject[];
  loading: boolean;
  error: string | null;
}

const initialState: SubjectsState = {
  items: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadSubjects = createAsyncThunk(
  'subjects/load',
  async () => {
    return await db.subjects.toArray();
  }
);

export const addSubject = createAsyncThunk(
  'subjects/add',
  async (subject: Subject) => {
    await db.subjects.add(subject);
    return subject;
  }
);

export const updateSubject = createAsyncThunk(
  'subjects/update',
  async (subject: Subject) => {
    await db.subjects.put(subject);
    return subject;
  }
);

export const deleteSubject = createAsyncThunk(
  'subjects/delete',
  async (id: string) => {
    await db.subjects.delete(id);
    return id;
  }
);

const subjectsSlice = createSlice({
  name: 'subjects',
  initialState,
  reducers: {
    setSubjects: (state, action: PayloadAction<Subject[]>) => {
      state.items = action.payload;
    },
    clearSubjects: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSubjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadSubjects.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(loadSubjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load subjects';
      })
      .addCase(addSubject.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateSubject.fulfilled, (state, action) => {
        const index = state.items.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteSubject.fulfilled, (state, action) => {
        state.items = state.items.filter(s => s.id !== action.payload);
      });
  },
});

export const { setSubjects, clearSubjects } = subjectsSlice.actions;
export default subjectsSlice.reducer;
