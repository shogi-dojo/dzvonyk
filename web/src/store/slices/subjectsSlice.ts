/**
 * Subjects Slice - Subjects state management with cascading updates
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Subject, ConstraintFields, SpaceConstraint } from '../../types';
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
  async (subject: Subject, { getState }) => {
    // Get the old subject to check for name changes
    const state = getState() as { subjects: SubjectsState };
    const oldSubject = state.subjects.items.find(s => s.id === subject.id);
    
    await db.subjects.put(subject);
    
    // If the name changed, update all activities that reference this subject
    if (oldSubject && oldSubject.name !== subject.name) {
      const activities = await db.activities.toArray();
      const activitiesToUpdate = activities.filter(a => 
        a.subjectId === oldSubject.name || a.subjectId === oldSubject.id
      );
      
      for (const activity of activitiesToUpdate) {
        await db.activities.update(activity.id, { subjectId: subject.name });
      }
      
      // Also update constraints that reference this subject
      const spaceConstraints = await db.spaceConstraints.toArray();
      for (const constraint of spaceConstraints) {
        const c = constraint as ConstraintFields;
        if (c.subjectId === oldSubject.name || c.subjectId === oldSubject.id) {
          const updated = { ...constraint, subjectId: subject.name } as SpaceConstraint;
          await db.spaceConstraints.put(updated);
        }
      }
      
      // Update teacher qualified subjects
      const teachers = await db.teachers.toArray();
      for (const teacher of teachers) {
        if (teacher.qualifiedSubjects.includes(oldSubject.name)) {
          const updatedSubjects = teacher.qualifiedSubjects.map(s => 
            s === oldSubject.name ? subject.name : s
          );
          await db.teachers.update(teacher.id, { qualifiedSubjects: updatedSubjects });
        }
      }
    }
    
    return { subject, oldName: oldSubject?.name };
  }
);

export const deleteSubject = createAsyncThunk(
  'subjects/delete',
  async (id: string, { getState }) => {
    const state = getState() as { subjects: SubjectsState };
    const subject = state.subjects.items.find(s => s.id === id);
    
    await db.subjects.delete(id);
    
    // Deactivate activities that use this subject
    if (subject) {
      const activities = await db.activities.toArray();
      const activitiesToUpdate = activities.filter(a => 
        a.subjectId === subject.name || a.subjectId === subject.id
      );
      
      for (const activity of activitiesToUpdate) {
        await db.activities.update(activity.id, { active: false });
      }
      
      // Remove from teacher qualified subjects
      const teachers = await db.teachers.toArray();
      for (const teacher of teachers) {
        if (teacher.qualifiedSubjects.includes(subject.name)) {
          const updatedSubjects = teacher.qualifiedSubjects.filter(s => s !== subject.name);
          await db.teachers.update(teacher.id, { qualifiedSubjects: updatedSubjects });
        }
      }
    }
    
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
        const index = state.items.findIndex(s => s.id === action.payload.subject.id);
        if (index !== -1) {
          state.items[index] = action.payload.subject;
        }
      })
      .addCase(deleteSubject.fulfilled, (state, action) => {
        state.items = state.items.filter(s => s.id !== action.payload);
      });
  },
});

export const { setSubjects, clearSubjects } = subjectsSlice.actions;
export default subjectsSlice.reducer;
