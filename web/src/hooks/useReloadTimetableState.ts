import { useCallback } from 'react';
import { useAppDispatch } from '@/hooks';
import { db } from '@/db';
import { setRules } from '@/store/slices/rulesSlice';
import { setTeachers } from '@/store/slices/teachersSlice';
import { setSubjects } from '@/store/slices/subjectsSlice';
import { setActivities } from '@/store/slices/activitiesSlice';
import { setRooms, setBuildings } from '@/store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints } from '@/store/slices/constraintsSlice';
import { setStudents } from '@/store/slices/studentsSlice';

export function useReloadTimetableState() {
  const dispatch = useAppDispatch();

  const reloadAll = useCallback(async () => {
    try {
      const [
        rules,
        teachers,
        subjects,
        activities,
        rooms,
        buildings,
        years,
        groups,
        subgroups,
        timeConstraints,
        spaceConstraints,
      ] = await Promise.all([
        db.rules.toArray(),
        db.teachers.toArray(),
        db.subjects.toArray(),
        db.activities.toArray(),
        db.rooms.toArray(),
        db.buildings.toArray(),
        db.studentsYears.toArray(),
        db.studentsGroups.toArray(),
        db.studentsSubgroups.toArray(),
        db.timeConstraints.toArray(),
        db.spaceConstraints.toArray(),
      ]);

      if (rules.length > 0) {
        dispatch(setRules(rules[0] as unknown as Parameters<typeof setRules>[0]));
      }
      dispatch(setTeachers(teachers));
      dispatch(setSubjects(subjects));
      dispatch(setActivities(activities));
      dispatch(setRooms(rooms));
      dispatch(setBuildings(buildings));
      dispatch(setStudents({ years, groups, subgroups }));
      dispatch(setTimeConstraints(timeConstraints));
      dispatch(setSpaceConstraints(spaceConstraints));
    } catch (err) {
      console.warn('Failed to reload timetable state:', err);
    }
  }, [dispatch]);

  return reloadAll;
}
