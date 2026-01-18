/**
 * Activities Slice - Activities state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Activity } from '../../types';
import { db } from '../../db';

interface ActivitiesState {
  items: Activity[];
  loading: boolean;
  error: string | null;
}

const initialState: ActivitiesState = {
  items: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadActivities = createAsyncThunk(
  'activities/load',
  async () => {
    return await db.activities.toArray();
  }
);

export const addActivity = createAsyncThunk(
  'activities/add',
  async (activity: Activity) => {
    await db.activities.add(activity);
    return activity;
  }
);

export const addActivities = createAsyncThunk(
  'activities/addMany',
  async (activities: Activity[]) => {
    await db.activities.bulkAdd(activities);
    return activities;
  }
);

export const updateActivity = createAsyncThunk(
  'activities/update',
  async (activity: Activity) => {
    await db.activities.put(activity);
    return activity;
  }
);

export const deleteActivity = createAsyncThunk(
  'activities/delete',
  async (id: string) => {
    await db.activities.delete(id);
    return id;
  }
);

export const deleteActivitiesByGroupId = createAsyncThunk(
  'activities/deleteByGroupId',
  async (groupId: number, { getState }) => {
    const state = getState() as { activities: ActivitiesState };
    const toDelete = state.activities.items
      .filter(a => a.activityGroupId === groupId)
      .map(a => a.id);
    await db.activities.bulkDelete(toDelete);
    return toDelete;
  }
);

const activitiesSlice = createSlice({
  name: 'activities',
  initialState,
  reducers: {
    setActivities: (state, action: PayloadAction<Activity[]>) => {
      state.items = action.payload;
    },
    clearActivities: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadActivities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadActivities.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(loadActivities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load activities';
      })
      .addCase(addActivity.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(addActivities.fulfilled, (state, action) => {
        state.items.push(...action.payload);
      })
      .addCase(updateActivity.fulfilled, (state, action) => {
        const index = state.items.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteActivity.fulfilled, (state, action) => {
        state.items = state.items.filter(a => a.id !== action.payload);
      })
      .addCase(deleteActivitiesByGroupId.fulfilled, (state, action) => {
        state.items = state.items.filter(a => !action.payload.includes(a.id));
      });
  },
});

export const { setActivities, clearActivities } = activitiesSlice.actions;
export default activitiesSlice.reducer;
