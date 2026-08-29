import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { useAppDispatch } from '../store/hooks';
import { setRules } from '../store/slices/rulesSlice';
import { setTeachers } from '../store/slices/teachersSlice';
import { setSubjects } from '../store/slices/subjectsSlice';
import { setActivityTags } from '../store/slices/activityTagsSlice';
import { setActivities } from '../store/slices/activitiesSlice';
import { setRooms, setBuildings } from '../store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints } from '../store/slices/constraintsSlice';
import { setStudents } from '../store/slices/studentsSlice';
import { parseROZFile, type RozImportResult } from '../lib/rozParser';

function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      result[key] = serializeDates((obj as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  return obj;
}

export function useRozImport() {
  const dispatch = useAppDispatch();
  const [preview, setPreview] = useState<RozImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File): Promise<boolean> => {
    setImporting(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseROZFile(buffer);
      setPreview(result);
      return true;
    } catch (err) {
      console.error('Failed to parse .roz file:', err);
      setError(err instanceof Error ? err.message : 'Не вдалося прочитати файл .roz');
      return false;
    } finally {
      setImporting(false);
    }
  }, []);

  const confirm = useCallback(async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);

    try {
      const { file: data, placements, shifts, report } = preview;
      await db.clearAllData();

      const rulesId = uuidv4();
      const newRules = {
        id: rulesId,
        mode: data.mode,
        institutionName: data.institutionName,
        comments: data.comments,
        nDaysPerWeek: data.daysOfTheWeek.length,
        nHoursPerDay: data.hoursOfTheDay.length,
        daysOfTheWeek: data.daysOfTheWeek,
        hoursOfTheDay: data.hoursOfTheDay,
        shifts: shifts ?? data.shifts,
        modified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.rules.add(newRules);

      if (data.teachers.length > 0) await db.teachers.bulkAdd(data.teachers);
      if (data.subjects.length > 0) await db.subjects.bulkAdd(data.subjects);
      if (data.activityTags.length > 0) await db.activityTags.bulkAdd(data.activityTags);
      if (data.studentsYears.length > 0) await db.studentsYears.bulkAdd(data.studentsYears);
      if (data.studentsGroups.length > 0) await db.studentsGroups.bulkAdd(data.studentsGroups);
      if (data.studentsSubgroups.length > 0) await db.studentsSubgroups.bulkAdd(data.studentsSubgroups);
      if (data.activities.length > 0) await db.activities.bulkAdd(data.activities);
      if (data.buildings.length > 0) await db.buildings.bulkAdd(data.buildings);
      if (data.rooms.length > 0) await db.rooms.bulkAdd(data.rooms);
      if (data.timeConstraints.length > 0) await db.timeConstraints.bulkAdd(data.timeConstraints);
      if (data.spaceConstraints.length > 0) await db.spaceConstraints.bulkAdd(data.spaceConstraints);

      // Save the placed solution so Timetable page renders it immediately
      if (placements.length > 0) {
        await db.solutions.add({
          id: uuidv4(),
          rulesId,
          placements,
          conflicts: [],
          isComplete: report.unplacedHours === 0,
          generatedAt: new Date(),
        });
      }

      // Redux store updates
      dispatch(setRules(serializeDates(newRules)));
      dispatch(setTeachers(data.teachers));
      dispatch(setSubjects(data.subjects));
      dispatch(setActivityTags(data.activityTags));
      dispatch(setActivities(data.activities));
      dispatch(setRooms(data.rooms));
      dispatch(setBuildings(data.buildings));
      dispatch(setTimeConstraints(data.timeConstraints));
      dispatch(setSpaceConstraints(data.spaceConstraints));
      dispatch(
        setStudents({
          years: data.studentsYears,
          groups: data.studentsGroups,
          subgroups: data.studentsSubgroups,
        })
      );

      setPreview(null);
    } catch (err) {
      console.error('Failed to confirm .roz import:', err);
      setError(err instanceof Error ? err.message : 'Не вдалося зберегти імпортовані дані');
      throw err;
    } finally {
      setImporting(false);
    }
  }, [preview, dispatch]);

  const cancel = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return {
    preview,
    parseFile,
    confirm,
    cancel,
    importing,
    error,
  };
}
