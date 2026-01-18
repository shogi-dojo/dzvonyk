/**
 * Constraints Slice - Time and space constraints state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { TimeConstraint, SpaceConstraint } from '../../types';
import { db } from '../../db';

interface ConstraintsState {
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
  loading: boolean;
  error: string | null;
}

const initialState: ConstraintsState = {
  timeConstraints: [],
  spaceConstraints: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadConstraints = createAsyncThunk(
  'constraints/load',
  async () => {
    const [timeConstraints, spaceConstraints] = await Promise.all([
      db.timeConstraints.toArray(),
      db.spaceConstraints.toArray(),
    ]);
    return { timeConstraints, spaceConstraints };
  }
);

export const addTimeConstraint = createAsyncThunk(
  'constraints/addTime',
  async (constraint: TimeConstraint) => {
    await db.timeConstraints.add(constraint);
    return constraint;
  }
);

export const updateTimeConstraint = createAsyncThunk(
  'constraints/updateTime',
  async (constraint: TimeConstraint) => {
    await db.timeConstraints.put(constraint);
    return constraint;
  }
);

export const deleteTimeConstraint = createAsyncThunk(
  'constraints/deleteTime',
  async (id: string) => {
    await db.timeConstraints.delete(id);
    return id;
  }
);

export const addSpaceConstraint = createAsyncThunk(
  'constraints/addSpace',
  async (constraint: SpaceConstraint) => {
    await db.spaceConstraints.add(constraint);
    return constraint;
  }
);

export const updateSpaceConstraint = createAsyncThunk(
  'constraints/updateSpace',
  async (constraint: SpaceConstraint) => {
    await db.spaceConstraints.put(constraint);
    return constraint;
  }
);

export const deleteSpaceConstraint = createAsyncThunk(
  'constraints/deleteSpace',
  async (id: string) => {
    await db.spaceConstraints.delete(id);
    return id;
  }
);

const constraintsSlice = createSlice({
  name: 'constraints',
  initialState,
  reducers: {
    setTimeConstraints: (state, action: PayloadAction<TimeConstraint[]>) => {
      state.timeConstraints = action.payload;
    },
    setSpaceConstraints: (state, action: PayloadAction<SpaceConstraint[]>) => {
      state.spaceConstraints = action.payload;
    },
    clearConstraints: (state) => {
      state.timeConstraints = [];
      state.spaceConstraints = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadConstraints.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadConstraints.fulfilled, (state, action) => {
        state.loading = false;
        state.timeConstraints = action.payload.timeConstraints;
        state.spaceConstraints = action.payload.spaceConstraints;
      })
      .addCase(loadConstraints.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load constraints';
      })
      .addCase(addTimeConstraint.fulfilled, (state, action) => {
        state.timeConstraints.push(action.payload);
      })
      .addCase(updateTimeConstraint.fulfilled, (state, action) => {
        const index = state.timeConstraints.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.timeConstraints[index] = action.payload;
        }
      })
      .addCase(deleteTimeConstraint.fulfilled, (state, action) => {
        state.timeConstraints = state.timeConstraints.filter(c => c.id !== action.payload);
      })
      .addCase(addSpaceConstraint.fulfilled, (state, action) => {
        state.spaceConstraints.push(action.payload);
      })
      .addCase(updateSpaceConstraint.fulfilled, (state, action) => {
        const index = state.spaceConstraints.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.spaceConstraints[index] = action.payload;
        }
      })
      .addCase(deleteSpaceConstraint.fulfilled, (state, action) => {
        state.spaceConstraints = state.spaceConstraints.filter(c => c.id !== action.payload);
      });
  },
});

export const { setTimeConstraints, setSpaceConstraints, clearConstraints } = constraintsSlice.actions;
export default constraintsSlice.reducer;
