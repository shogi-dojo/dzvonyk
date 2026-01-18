/**
 * Students Slice - Students (years, groups, subgroups) state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { StudentsYear, StudentsGroup, StudentsSubgroup } from '../../types';
import { db } from '../../db';

interface StudentsState {
  years: StudentsYear[];
  groups: StudentsGroup[];
  subgroups: StudentsSubgroup[];
  loading: boolean;
  error: string | null;
}

const initialState: StudentsState = {
  years: [],
  groups: [],
  subgroups: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadStudents = createAsyncThunk(
  'students/load',
  async () => {
    const [years, groups, subgroups] = await Promise.all([
      db.studentsYears.toArray(),
      db.studentsGroups.toArray(),
      db.studentsSubgroups.toArray(),
    ]);
    return { years, groups, subgroups };
  }
);

export const addYear = createAsyncThunk(
  'students/addYear',
  async (year: StudentsYear) => {
    await db.studentsYears.add(year);
    return year;
  }
);

export const addGroup = createAsyncThunk(
  'students/addGroup',
  async (group: StudentsGroup) => {
    await db.studentsGroups.add(group);
    return group;
  }
);

export const addSubgroup = createAsyncThunk(
  'students/addSubgroup',
  async (subgroup: StudentsSubgroup) => {
    await db.studentsSubgroups.add(subgroup);
    return subgroup;
  }
);

export const deleteYear = createAsyncThunk(
  'students/deleteYear',
  async (id: string) => {
    await db.studentsYears.delete(id);
    return id;
  }
);

export const deleteGroup = createAsyncThunk(
  'students/deleteGroup',
  async (id: string) => {
    await db.studentsGroups.delete(id);
    return id;
  }
);

export const deleteSubgroup = createAsyncThunk(
  'students/deleteSubgroup',
  async (id: string) => {
    await db.studentsSubgroups.delete(id);
    return id;
  }
);

export const updateYear = createAsyncThunk(
  'students/updateYear',
  async (year: StudentsYear) => {
    await db.studentsYears.put(year);
    return year;
  }
);

export const updateGroup = createAsyncThunk(
  'students/updateGroup',
  async (group: StudentsGroup) => {
    await db.studentsGroups.put(group);
    return group;
  }
);

export const updateSubgroup = createAsyncThunk(
  'students/updateSubgroup',
  async (subgroup: StudentsSubgroup) => {
    await db.studentsSubgroups.put(subgroup);
    return subgroup;
  }
);

const studentsSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {
    setStudents: (state, action: PayloadAction<{
      years: StudentsYear[];
      groups: StudentsGroup[];
      subgroups: StudentsSubgroup[];
    }>) => {
      state.years = action.payload.years;
      state.groups = action.payload.groups;
      state.subgroups = action.payload.subgroups;
    },
    clearStudents: (state) => {
      state.years = [];
      state.groups = [];
      state.subgroups = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadStudents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.years = action.payload.years;
        state.groups = action.payload.groups;
        state.subgroups = action.payload.subgroups;
      })
      .addCase(loadStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load students';
      })
      .addCase(addYear.fulfilled, (state, action) => {
        state.years.push(action.payload);
      })
      .addCase(addGroup.fulfilled, (state, action) => {
        state.groups.push(action.payload);
      })
      .addCase(addSubgroup.fulfilled, (state, action) => {
        state.subgroups.push(action.payload);
      })
      .addCase(deleteYear.fulfilled, (state, action) => {
        state.years = state.years.filter(y => y.id !== action.payload);
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.groups = state.groups.filter(g => g.id !== action.payload);
      })
      
      .addCase(updateYear.fulfilled, (state, action) => {
        const index = state.years.findIndex(y => y.id === action.payload.id);
        if (index !== -1) state.years[index] = action.payload;
      })
      .addCase(updateGroup.fulfilled, (state, action) => {
        const index = state.groups.findIndex(g => g.id === action.payload.id);
        if (index !== -1) state.groups[index] = action.payload;
      })
      .addCase(updateSubgroup.fulfilled, (state, action) => {
        const index = state.subgroups.findIndex(s => s.id === action.payload.id);
        if (index !== -1) state.subgroups[index] = action.payload;
      })
      .addCase(deleteSubgroup.fulfilled, (state, action) => {
        state.subgroups = state.subgroups.filter(s => s.id !== action.payload);
      });
  },
});

export const { setStudents, clearStudents } = studentsSlice.actions;
export default studentsSlice.reducer;
