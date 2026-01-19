/**
 * Activity Tags Slice - Activity Tags state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { ActivityTag } from '../../types';
import { db } from '../../db';

interface ActivityTagsState {
  items: ActivityTag[];
  loading: boolean;
  error: string | null;
}

const initialState: ActivityTagsState = {
  items: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadActivityTags = createAsyncThunk(
  'activityTags/load',
  async () => {
    return await db.activityTags.toArray();
  }
);

export const addActivityTag = createAsyncThunk(
  'activityTags/add',
  async (tag: ActivityTag) => {
    await db.activityTags.add(tag);
    return tag;
  }
);

export const updateActivityTag = createAsyncThunk(
  'activityTags/update',
  async (tag: ActivityTag) => {
    await db.activityTags.put(tag);
    return tag;
  }
);

export const deleteActivityTag = createAsyncThunk(
  'activityTags/delete',
  async (id: string) => {
    await db.activityTags.delete(id);
    return id;
  }
);

const activityTagsSlice = createSlice({
  name: 'activityTags',
  initialState,
  reducers: {
    setActivityTags: (state, action: PayloadAction<ActivityTag[]>) => {
      state.items = action.payload;
    },
    clearActivityTags: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadActivityTags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadActivityTags.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(loadActivityTags.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load activity tags';
      })
      .addCase(addActivityTag.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateActivityTag.fulfilled, (state, action) => {
        const index = state.items.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteActivityTag.fulfilled, (state, action) => {
        state.items = state.items.filter(t => t.id !== action.payload);
      });
  },
});

export const { setActivityTags, clearActivityTags } = activityTagsSlice.actions;
export default activityTagsSlice.reducer;
