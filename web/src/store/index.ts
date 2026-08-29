/**
 * FET Web - Redux Store Configuration
 */

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import appReducer from './slices/appSlice';
import rulesReducer from './slices/rulesSlice';
import teachersReducer from './slices/teachersSlice';
import subjectsReducer from './slices/subjectsSlice';
import studentsReducer from './slices/studentsSlice';
import activitiesReducer from './slices/activitiesSlice';
import roomsReducer from './slices/roomsSlice';
import constraintsReducer from './slices/constraintsSlice';
import generationReducer from './slices/generationSlice';
import activityTagsReducer from './slices/activityTagsSlice';
import workspaceReducer from './slices/workspaceSlice';
import { fetApi } from './api';

export const store = configureStore({
  reducer: {
    app: appReducer,
    rules: rulesReducer,
    teachers: teachersReducer,
    subjects: subjectsReducer,
    students: studentsReducer,
    activities: activitiesReducer,
    rooms: roomsReducer,
    constraints: constraintsReducer,
    generation: generationReducer,
    activityTags: activityTagsReducer,
    workspace: workspaceReducer,
    [fetApi.reducerPath]: fetApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['generation/setStartTime'],
        ignoredPaths: ['generation.startTime'],
      },
    }).concat(fetApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
