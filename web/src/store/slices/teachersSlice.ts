/**
 * Teachers Slice - Teachers state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Teacher } from '../../types';
import { db } from '../../db';

interface TeachersState {
  items: Teacher[];
  loading: boolean;
  error: string | null;
}

const initialState: TeachersState = {
  items: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadTeachers = createAsyncThunk(
  'teachers/load',
  async () => {
    return await db.teachers.toArray();
  }
);

export const addTeacher = createAsyncThunk(
  'teachers/add',
  async (teacher: Teacher) => {
    await db.teachers.add(teacher);
    return teacher;
  }
);

export const updateTeacher = createAsyncThunk(
  'teachers/update',
  async (teacher: Teacher) => {
    await db.teachers.put(teacher);
    return teacher;
  }
);

export const deleteTeacher = createAsyncThunk(
  'teachers/delete',
  async (id: string) => {
    await db.teachers.delete(id);
    return id;
  }
);

const teachersSlice = createSlice({
  name: 'teachers',
  initialState,
  reducers: {
    setTeachers: (state, action: PayloadAction<Teacher[]>) => {
      state.items = action.payload;
    },
    clearTeachers: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Load
      .addCase(loadTeachers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadTeachers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(loadTeachers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load teachers';
      })
      // Add
      .addCase(addTeacher.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      // Update
      .addCase(updateTeacher.fulfilled, (state, action) => {
        const index = state.items.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      // Delete
      .addCase(deleteTeacher.fulfilled, (state, action) => {
        state.items = state.items.filter(t => t.id !== action.payload);
      });
  },
});

export const { setTeachers, clearTeachers } = teachersSlice.actions;
export default teachersSlice.reducer;
