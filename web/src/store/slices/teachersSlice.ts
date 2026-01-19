/**
 * Teachers Slice - Teachers state management with cascading updates
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
  async (teacher: Teacher, { getState }) => {
    // Get the old teacher to check for name changes
    const state = getState() as { teachers: TeachersState };
    const oldTeacher = state.teachers.items.find(t => t.id === teacher.id);
    
    await db.teachers.put(teacher);
    
    // If the name changed, update all activities that reference this teacher
    if (oldTeacher && oldTeacher.name !== teacher.name) {
      const activities = await db.activities.toArray();
      const activitiesToUpdate = activities.filter(a => 
        a.teacherIds.includes(oldTeacher.name) || a.teacherIds.includes(oldTeacher.id)
      );
      
      for (const activity of activitiesToUpdate) {
        const updatedTeacherIds = activity.teacherIds.map(id => 
          (id === oldTeacher.name || id === oldTeacher.id) ? teacher.name : id
        );
        await db.activities.update(activity.id, { teacherIds: updatedTeacherIds });
      }
      
      // Also update constraints that reference this teacher
      const timeConstraints = await db.timeConstraints.toArray();
      for (const constraint of timeConstraints) {
        const c = constraint as any;
        if (c.teacherId === oldTeacher.name || c.teacherId === oldTeacher.id) {
          const updated = { ...constraint, teacherId: teacher.name } as any;
          await db.timeConstraints.put(updated);
        }
      }
    }
    
    return { teacher, oldName: oldTeacher?.name };
  }
);

export const deleteTeacher = createAsyncThunk(
  'teachers/delete',
  async (id: string, { getState }) => {
    const state = getState() as { teachers: TeachersState };
    const teacher = state.teachers.items.find(t => t.id === id);
    
    await db.teachers.delete(id);
    
    // Remove teacher from activities
    if (teacher) {
      const activities = await db.activities.toArray();
      const activitiesToUpdate = activities.filter(a => 
        a.teacherIds.includes(teacher.name) || a.teacherIds.includes(teacher.id)
      );
      
      for (const activity of activitiesToUpdate) {
        const updatedTeacherIds = activity.teacherIds.filter(tid => 
          tid !== teacher.name && tid !== teacher.id
        );
        if (updatedTeacherIds.length > 0) {
          await db.activities.update(activity.id, { teacherIds: updatedTeacherIds });
        } else {
          // Activity would have no teachers, deactivate it
          await db.activities.update(activity.id, { active: false });
        }
      }
    }
    
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
        const index = state.items.findIndex(t => t.id === action.payload.teacher.id);
        if (index !== -1) {
          state.items[index] = action.payload.teacher;
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
