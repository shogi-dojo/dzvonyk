import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, FileUp, AlertCircle, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { 
  createNewRules, 
  updateInstitutionName, 
  updateDays, 
  updateHours,
  markAsSaved,
  setRules
} from '@/store/slices/rulesSlice';
import { setTeachers } from '@/store/slices/teachersSlice';
import { setSubjects } from '@/store/slices/subjectsSlice';
import { setActivities } from '@/store/slices/activitiesSlice';
import { setRooms, setBuildings } from '@/store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints } from '@/store/slices/constraintsSlice';
import { setStudents } from '@/store/slices/studentsSlice';
import { db } from '@/db';
import { parseFETFile } from '@/lib/fetParser';
import type { Day, Hour } from '@/types';

// Default days of the week
const DEFAULT_DAYS: Day[] = [
  { name: 'Monday', longName: 'Monday' },
  { name: 'Tuesday', longName: 'Tuesday' },
  { name: 'Wednesday', longName: 'Wednesday' },
  { name: 'Thursday', longName: 'Thursday' },
  { name: 'Friday', longName: 'Friday' },
];

// Default hours
const DEFAULT_HOURS: Hour[] = [
  { name: '08:00', longName: '08:00 - 09:00' },
  { name: '09:00', longName: '09:00 - 10:00' },
  { name: '10:00', longName: '10:00 - 11:00' },
  { name: '11:00', longName: '11:00 - 12:00' },
  { name: '12:00', longName: '12:00 - 13:00' },
  { name: '13:00', longName: '13:00 - 14:00' },
  { name: '14:00', longName: '14:00 - 15:00' },
  { name: '15:00', longName: '15:00 - 16:00' },
];

// Helper to serialize dates
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

export function Settings() {
  const dispatch = useAppDispatch();
  const rules = useAppSelector((state) => state.rules.current);
  const modified = useAppSelector((state) => state.rules.modified);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [institutionName, setInstitutionName] = useState('');
  const [days, setDays] = useState<Day[]>(DEFAULT_DAYS);
  const [hours, setHours] = useState<Hour[]>(DEFAULT_HOURS);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (rules) {
      setInstitutionName(rules.institutionName);
      setDays(rules.daysOfTheWeek.length > 0 ? rules.daysOfTheWeek : DEFAULT_DAYS);
      setHours(rules.hoursOfTheDay.length > 0 ? rules.hoursOfTheDay : DEFAULT_HOURS);
    }
  }, [rules]);

  const handleCreateNew = () => {
    const id = uuidv4();
    dispatch(createNewRules(id));
  };

  const handleSave = async () => {
    if (!rules) return;
    
    dispatch(updateInstitutionName(institutionName));
    dispatch(updateDays(days));
    dispatch(updateHours(hours));
    
    // Save to IndexedDB with ISO string dates
    await db.rules.put({
      ...rules,
      institutionName,
      daysOfTheWeek: days,
      hoursOfTheDay: hours,
      nDaysPerWeek: days.length,
      nHoursPerDay: hours.length,
      updatedAt: new Date().toISOString(),
    });
    
    dispatch(markAsSaved());
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const content = await file.text();
      const data = parseFETFile(content);
      
      // Clear all existing data
      await db.clearAllData();
      
      // Create rules with ISO string dates
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
        modified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.rules.add(newRules);
      
      // Import all entities
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
      
      // Update Redux state with serialized rules
      dispatch(setRules(serializeDates(newRules)));
      dispatch(setTeachers(data.teachers));
      dispatch(setSubjects(data.subjects));
      dispatch(setActivities(data.activities));
      dispatch(setRooms(data.rooms));
      dispatch(setBuildings(data.buildings));
      dispatch(setTimeConstraints(data.timeConstraints));
      dispatch(setSpaceConstraints(data.spaceConstraints));
      dispatch(setStudents({
        years: data.studentsYears,
        groups: data.studentsGroups,
        subgroups: data.studentsSubgroups,
      }));
      
      setImportSuccess(`Successfully imported: ${data.teachers.length} teachers, ${data.subjects.length} subjects, ${data.activities.length} activities, ${data.rooms.length} rooms`);
      
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import FET file');
    } finally {
      setImporting(false);
    }
  };

  const addDay = () => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const nextDayIndex = days.length < 7 ? days.length : days.length;
    const newDayName = dayNames[nextDayIndex % 7] || `Day ${days.length + 1}`;
    setDays([...days, { name: newDayName, longName: newDayName }]);
  };

  const removeDay = (index: number) => {
    if (days.length <= 1) return;
    setDays(days.filter((_, i) => i !== index));
  };

  const updateDay = (index: number, name: string) => {
    const updated = [...days];
    updated[index] = { name, longName: name };
    setDays(updated);
  };

  const addHour = () => {
    const lastHour = hours.length > 0 ? hours[hours.length - 1].name : '07:00';
    const [h] = lastHour.split(':').map(Number);
    const nextHour = `${String((h + 1) % 24).padStart(2, '0')}:00`;
    const nextHourEnd = `${String((h + 2) % 24).padStart(2, '0')}:00`;
    setHours([...hours, { name: nextHour, longName: `${nextHour} - ${nextHourEnd}` }]);
  };

  const removeHour = (index: number) => {
    if (hours.length <= 1) return;
    setHours(hours.filter((_, i) => i !== index));
  };

  const updateHourName = (index: number, name: string) => {
    const updated = [...hours];
    updated[index] = { ...updated[index], name };
    setHours(updated);
  };

  const resetToDefaults = () => {
    setDays(DEFAULT_DAYS);
    setHours(DEFAULT_HOURS);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure your timetable parameters</p>
        </div>
        <div className="flex gap-2">
          {!rules && (
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          )}
          {rules && (
            <Button onClick={handleSave} disabled={!modified && institutionName === rules.institutionName}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Import Section */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Import FET File</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            Import a .fet file from the desktop FET application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fet,.xml"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button onClick={handleImportClick} variant="outline" disabled={importing}>
            <FileUp className="mr-2 h-4 w-4" />
            {importing ? 'Importing...' : 'Choose FET File'}
          </Button>
          
          {importError && (
            <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Import Failed</p>
                <p className="text-sm text-red-600 dark:text-red-300">{importError}</p>
              </div>
            </div>
          )}
          
          {importSuccess && (
            <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Import Successful</p>
                <p className="text-sm text-green-600 dark:text-green-300">{importSuccess}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {rules && (
        <>
          {/* Institution Settings */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">Institution</CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Basic information about your institution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="institutionName" className="text-gray-700 dark:text-gray-300">Institution Name</Label>
                <Input
                  id="institutionName"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Enter institution name"
                  className="max-w-md bg-white dark:bg-gray-900"
                />
              </div>
            </CardContent>
          </Card>

          {/* Days of the Week */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-gray-100">Days of the Week</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Configure working days ({days.length} days)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetToDefaults}>
                    Reset to Defaults
                  </Button>
                  <Button size="sm" onClick={addDay}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Day
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {days.map((day, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={day.name}
                      onChange={(e) => updateDay(index, e.target.value)}
                      className="bg-white dark:bg-gray-900"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDay(index)}
                      disabled={days.length <= 1}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hours of the Day */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-gray-100">Hours of the Day</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Configure time slots ({hours.length} hours)
                  </CardDescription>
                </div>
                <Button size="sm" onClick={addHour}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Hour
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                {hours.map((hour, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={hour.name}
                      onChange={(e) => updateHourName(index, e.target.value)}
                      className="bg-white dark:bg-gray-900"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHour(index)}
                      disabled={hours.length <= 1}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">Current Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Days per Week</dt>
                  <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100">{days.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Hours per Day</dt>
                  <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100">{hours.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Total Slots/Week</dt>
                  <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100">{days.length * hours.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {modified ? 'Modified (unsaved)' : 'Saved'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </>
      )}

      {!rules && (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No timetable configuration found. Create a new one or import from a FET file.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create New
              </Button>
              <Button variant="outline" onClick={handleImportClick}>
                <FileUp className="mr-2 h-4 w-4" />
                Import FET File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
