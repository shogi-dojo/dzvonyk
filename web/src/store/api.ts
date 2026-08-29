/**
 * FET Web - RTK Query API
 * For managing async data operations
 */

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { db } from '../db';
import type {
  Teacher,
  Subject,
  Activity,
  Room,
  Building,
  TimeConstraint,
  SpaceConstraint,
  TimetableRules,
  TimetableSolution,
} from '../types';

export const fetApi = createApi({
  reducerPath: 'fetApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    'Teachers',
    'Subjects',
    'Activities',
    'Rooms',
    'Buildings',
    'TimeConstraints',
    'SpaceConstraints',
    'Rules',
    'Solutions',
  ],
  endpoints: (builder) => ({
    // Teachers
    getTeachers: builder.query<Teacher[], void>({
      queryFn: async () => {
        try {
          const teachers = await db.teachers.toArray();
          return { data: teachers };
        } catch {
          return { error: { message: 'Failed to fetch teachers' } };
        }
      },
      providesTags: ['Teachers'],
    }),
    
    // Subjects
    getSubjects: builder.query<Subject[], void>({
      queryFn: async () => {
        try {
          const subjects = await db.subjects.toArray();
          return { data: subjects };
        } catch {
          return { error: { message: 'Failed to fetch subjects' } };
        }
      },
      providesTags: ['Subjects'],
    }),

    // Activities
    getActivities: builder.query<Activity[], void>({
      queryFn: async () => {
        try {
          const activities = await db.activities.toArray();
          return { data: activities };
        } catch {
          return { error: { message: 'Failed to fetch activities' } };
        }
      },
      providesTags: ['Activities'],
    }),

    // Rooms
    getRooms: builder.query<Room[], void>({
      queryFn: async () => {
        try {
          const rooms = await db.rooms.toArray();
          return { data: rooms };
        } catch {
          return { error: { message: 'Failed to fetch rooms' } };
        }
      },
      providesTags: ['Rooms'],
    }),

    // Buildings
    getBuildings: builder.query<Building[], void>({
      queryFn: async () => {
        try {
          const buildings = await db.buildings.toArray();
          return { data: buildings };
        } catch {
          return { error: { message: 'Failed to fetch buildings' } };
        }
      },
      providesTags: ['Buildings'],
    }),

    // Time Constraints
    getTimeConstraints: builder.query<TimeConstraint[], void>({
      queryFn: async () => {
        try {
          const constraints = await db.timeConstraints.toArray();
          return { data: constraints };
        } catch {
          return { error: { message: 'Failed to fetch time constraints' } };
        }
      },
      providesTags: ['TimeConstraints'],
    }),

    // Space Constraints
    getSpaceConstraints: builder.query<SpaceConstraint[], void>({
      queryFn: async () => {
        try {
          const constraints = await db.spaceConstraints.toArray();
          return { data: constraints };
        } catch {
          return { error: { message: 'Failed to fetch space constraints' } };
        }
      },
      providesTags: ['SpaceConstraints'],
    }),

    // Rules
    getRules: builder.query<TimetableRules[], void>({
      queryFn: async () => {
        try {
          const rules = await db.rules.toArray();
          return { data: rules };
        } catch {
          return { error: { message: 'Failed to fetch rules' } };
        }
      },
      providesTags: ['Rules'],
    }),

    getRulesById: builder.query<TimetableRules | undefined, string>({
      queryFn: async (id) => {
        try {
          const rules = await db.rules.get(id);
          return { data: rules };
        } catch {
          return { error: { message: 'Failed to fetch rules' } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Rules', id }],
    }),

    // Solutions
    getSolutions: builder.query<TimetableSolution[], void>({
      queryFn: async () => {
        try {
          const solutions = await db.solutions.toArray();
          return { data: solutions };
        } catch {
          return { error: { message: 'Failed to fetch solutions' } };
        }
      },
      providesTags: ['Solutions'],
    }),

    // Statistics
    getStatistics: builder.query<{
      teachers: number;
      subjects: number;
      activities: number;
      rooms: number;
      timeConstraints: number;
      spaceConstraints: number;
    }, void>({
      queryFn: async () => {
        try {
          const stats = await db.getStatistics();
          return { data: stats };
        } catch {
          return { error: { message: 'Failed to fetch statistics' } };
        }
      },
      providesTags: ['Teachers', 'Subjects', 'Activities', 'Rooms', 'TimeConstraints', 'SpaceConstraints'],
    }),
  }),
});

export const {
  useGetTeachersQuery,
  useGetSubjectsQuery,
  useGetActivitiesQuery,
  useGetRoomsQuery,
  useGetBuildingsQuery,
  useGetTimeConstraintsQuery,
  useGetSpaceConstraintsQuery,
  useGetRulesQuery,
  useGetRulesByIdQuery,
  useGetSolutionsQuery,
  useGetStatisticsQuery,
} = fetApi;
