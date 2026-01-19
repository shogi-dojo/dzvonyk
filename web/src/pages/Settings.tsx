import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, FileUp, AlertCircle, CheckCircle2, Settings as SettingsIcon, Calendar, Clock, AlertTriangle, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, EmptyState } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { 
  createNewRules, 
  updateInstitutionName, 
  updateDays, 
  updateHours,
  markAsSaved,
  setRules,
  clearRules
} from '@/store/slices/rulesSlice';
import { setTeachers, clearTeachers } from '@/store/slices/teachersSlice';
import { setSubjects, clearSubjects } from '@/store/slices/subjectsSlice';
import { setActivities, clearActivities } from '@/store/slices/activitiesSlice';
import { setRooms, setBuildings, clearRooms } from '@/store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints, clearConstraints } from '@/store/slices/constraintsSlice';
import { setStudents, clearStudents } from '@/store/slices/studentsSlice';
import { db } from '@/db';
import { parseFETFile } from '@/lib/fetParser';
import type { Day, Hour } from '@/types';

const DEFAULT_DAYS: Day[] = [
  { name: 'Monday', longName: 'Monday' },
  { name: 'Tuesday', longName: 'Tuesday' },
  { name: 'Wednesday', longName: 'Wednesday' },
  { name: 'Thursday', longName: 'Thursday' },
  { name: 'Friday', longName: 'Friday' },
];

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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      // Clear all data from IndexedDB
      await db.clearAllData();
      
      // Clear Redux state
      dispatch(clearRules());
      dispatch(clearTeachers());
      dispatch(clearSubjects());
      dispatch(clearActivities());
      dispatch(clearRooms());
      dispatch(clearConstraints());
      dispatch(clearStudents());
      
      // Reset local state
      setInstitutionName('');
      setDays(DEFAULT_DAYS);
      setHours(DEFAULT_HOURS);
      setImportError(null);
      setImportSuccess(null);
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Reset error:', error);
    } finally {
      setResetting(false);
    }
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
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".fet,.xml" 
        onChange={handleFileChange} 
        className="hidden" 
        aria-label="Import FET file"
      />

      <PageHeader
        title="Settings"
        description="Configure your timetable parameters"
        icon={<SettingsIcon className="h-6 w-6" aria-hidden="true" />}
        actions={
          <div className="flex gap-2">
            {!rules && (
              <Button onClick={handleCreateNew} className="gap-2 gradient-primary hover-lift">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create New
              </Button>
            )}
            {rules && (
              <Button onClick={handleSave} disabled={!modified && institutionName === rules.institutionName} className="gap-2 hover-lift">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save Changes
              </Button>
            )}
          </div>
        }
      />

      {/* Import Section */}
      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle>Import FET File</CardTitle>
          <CardDescription>Import a .fet file from the desktop FET application</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleImportClick} variant="outline" disabled={importing} className="gap-2 hover-lift">
            <FileUp className="h-4 w-4" aria-hidden="true" />
            {importing ? 'Importing...' : 'Choose FET File'}
          </Button>
          
          {importError && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-slide-up" role="alert">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-destructive">Import Failed</p>
                <p className="text-sm text-destructive/80">{importError}</p>
              </div>
            </div>
          )}
          
          {importSuccess && (
            <div className="mt-4 p-4 rounded-lg bg-success/10 border border-success/20 flex items-start gap-3 animate-slide-up" role="status">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-success">Import Successful</p>
                <p className="text-sm text-success/80">{importSuccess}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {rules && (
        <>
          {/* Institution Settings */}
          <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardHeader>
              <CardTitle>Institution</CardTitle>
              <CardDescription>Basic information about your institution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="institutionName">Institution Name</Label>
                <Input
                  id="institutionName"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Enter institution name"
                  className="max-w-md"
                  aria-describedby="institutionName-desc"
                />
                <p id="institutionName-desc" className="text-xs text-muted-foreground">
                  This name will appear in exported timetables
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Days of the Week */}
          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Days of the Week</CardTitle>
                    <CardDescription>Configure working days ({days.length} days)</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetToDefaults}>
                    <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
                    Reset Defaults
                  </Button>
                  <Button size="sm" onClick={addDay} className="gap-1">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Day
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {days.map((day, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label htmlFor={`day-${index}`} className="sr-only">Day {index + 1}</Label>
                    <Input 
                      id={`day-${index}`}
                      value={day.name} 
                      onChange={(e) => updateDay(index, e.target.value)} 
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeDay(index)} 
                      disabled={days.length <= 1} 
                      className="shrink-0"
                      aria-label={`Remove ${day.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hours of the Day */}
          <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Hours of the Day</CardTitle>
                    <CardDescription>Configure time slots ({hours.length} hours)</CardDescription>
                  </div>
                </div>
                <Button size="sm" onClick={addHour} className="gap-1">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Hour
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                {hours.map((hour, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label htmlFor={`hour-${index}`} className="sr-only">Hour {index + 1}</Label>
                    <Input 
                      id={`hour-${index}`}
                      value={hour.name} 
                      onChange={(e) => updateHourName(index, e.target.value)} 
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeHour(index)} 
                      disabled={hours.length <= 1} 
                      className="shrink-0"
                      aria-label={`Remove ${hour.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
            <StatCard title="Days per Week" value={days.length} icon={<Calendar className="h-5 w-5" aria-hidden="true" />} />
            <StatCard title="Hours per Day" value={hours.length} icon={<Clock className="h-5 w-5" aria-hidden="true" />} />
            <StatCard title="Total Slots/Week" value={days.length * hours.length} icon={<Calendar className="h-5 w-5" aria-hidden="true" />} />
            <StatCard title="Status" value={modified ? 'Modified' : 'Saved'} icon={<SettingsIcon className="h-5 w-5" aria-hidden="true" />} />
          </div>

          {/* Reset Data Section */}
          <Card className="animate-slide-up border-destructive/30" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions that affect all your data</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!showResetConfirm ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="font-medium text-foreground">Reset All Data</p>
                    <p className="text-sm text-muted-foreground">
                      Delete all teachers, subjects, activities, rooms, constraints, and generated timetables
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowResetConfirm(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Reset Data
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-lg border-2 border-destructive bg-destructive/10 animate-slide-up" role="alertdialog" aria-labelledby="reset-title" aria-describedby="reset-desc">
                  <p id="reset-title" className="font-medium text-destructive mb-2">Are you absolutely sure?</p>
                  <p id="reset-desc" className="text-sm text-muted-foreground mb-4">
                    This action cannot be undone. This will permanently delete all your data including teachers, 
                    subjects, activities, rooms, constraints, and any generated timetables.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowResetConfirm(false)}
                      disabled={resetting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleResetAllData}
                      disabled={resetting}
                      className="gap-2"
                    >
                      {resetting ? (
                        <>
                          <RotateCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Yes, Delete Everything
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!rules && (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<SettingsIcon className="h-12 w-12" aria-hidden="true" />}
              title="No Configuration Found"
              description="Create a new timetable configuration or import from a FET file."
              action={
                <div className="flex gap-4">
                  <Button onClick={handleCreateNew} className="gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create New
                  </Button>
                  <Button variant="outline" onClick={handleImportClick} className="gap-2">
                    <FileUp className="h-4 w-4" aria-hidden="true" />
                    Import FET File
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
