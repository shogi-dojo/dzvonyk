/**
 * Rooms Slice - Rooms and buildings state management
 */

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Room, Building } from '../../types';
import { db } from '../../db';

interface RoomsState {
  rooms: Room[];
  buildings: Building[];
  loading: boolean;
  error: string | null;
}

const initialState: RoomsState = {
  rooms: [],
  buildings: [],
  loading: false,
  error: null,
};

// Async thunks
export const loadRooms = createAsyncThunk(
  'rooms/load',
  async () => {
    const [rooms, buildings] = await Promise.all([
      db.rooms.toArray(),
      db.buildings.toArray(),
    ]);
    return { rooms, buildings };
  }
);

export const addRoom = createAsyncThunk(
  'rooms/addRoom',
  async (room: Room) => {
    await db.rooms.add(room);
    return room;
  }
);

export const updateRoom = createAsyncThunk(
  'rooms/updateRoom',
  async (room: Room) => {
    await db.rooms.put(room);
    return room;
  }
);

export const deleteRoom = createAsyncThunk(
  'rooms/deleteRoom',
  async (id: string) => {
    await db.rooms.delete(id);
    return id;
  }
);

export const addBuilding = createAsyncThunk(
  'rooms/addBuilding',
  async (building: Building) => {
    await db.buildings.add(building);
    return building;
  }
);

export const updateBuilding = createAsyncThunk(
  'rooms/updateBuilding',
  async (building: Building) => {
    await db.buildings.put(building);
    return building;
  }
);

export const deleteBuilding = createAsyncThunk(
  'rooms/deleteBuilding',
  async (id: string) => {
    await db.buildings.delete(id);
    return id;
  }
);

const roomsSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {
    setRooms: (state, action: PayloadAction<Room[]>) => {
      state.rooms = action.payload;
    },
    setBuildings: (state, action: PayloadAction<Building[]>) => {
      state.buildings = action.payload;
    },
    clearRooms: (state) => {
      state.rooms = [];
      state.buildings = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadRooms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadRooms.fulfilled, (state, action) => {
        state.loading = false;
        state.rooms = action.payload.rooms;
        state.buildings = action.payload.buildings;
      })
      .addCase(loadRooms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load rooms';
      })
      .addCase(addRoom.fulfilled, (state, action) => {
        state.rooms.push(action.payload);
      })
      .addCase(updateRoom.fulfilled, (state, action) => {
        const index = state.rooms.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.rooms[index] = action.payload;
        }
      })
      .addCase(deleteRoom.fulfilled, (state, action) => {
        state.rooms = state.rooms.filter(r => r.id !== action.payload);
      })
      .addCase(addBuilding.fulfilled, (state, action) => {
        state.buildings.push(action.payload);
      })
      .addCase(updateBuilding.fulfilled, (state, action) => {
        const index = state.buildings.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.buildings[index] = action.payload;
        }
      })
      .addCase(deleteBuilding.fulfilled, (state, action) => {
        state.buildings = state.buildings.filter(b => b.id !== action.payload);
      });
  },
});

export const { setRooms, setBuildings, clearRooms } = roomsSlice.actions;
export default roomsSlice.reducer;
