import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, BookOpen, Calendar, Building2, Clock, 
  Play, FileUp, FilePlus, FileDown, Settings, AlertCircle, CheckCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { setRules } from '@/store/slices/rulesSlice';
import { setTeachers } from '@/store/slices/teachersSlice';
import { setSubjects } from '@/store/slices/subjectsSlice';
import { setActivities } from '@/store/slices/activitiesSlice';
import { setRooms, setBuildings } from '@/store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints } from '@/store/slices/constraintsSlice';
import { setStudents } from '@/store/slices/studentsSlice';
import { db } from '@/db';
import { parseFETFile, exportToFETXml } from '@/lib/fetParser';
import type { FETFile } from '@/types';

export function Dashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const rules = useAppSelector((state) => state.rules.current);
  const teachers = useAppSelector((state) => state.teachers.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const activities = useAppSelector((state) => state.activities.items);
  const { rooms, buildings } = useAppSelector((state) => state.rooms);
  const { years, groups, subgroups } = useAppSelector((state) => state.students);
  const { timeConstraints, spaceConstraints } = useAppSelector((state) => state.constraints);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const quickStats = [
    { name: 'Teachers', value: teachers.length, icon: Users, href: '/teachers', color: 'text-blue-500' },
    { name: 'Subjects', value: subjects.length, icon: BookOpen, href: '/subjects', color: 'text-green-500' },
    { name: 'Activities', value: activities.length, icon: Calendar, href: '/activities', color: 'text-purple-500' },
    { name: 'Rooms', value: rooms.length, icon: Building2, href: '/rooms', color: 'text-orange-500' },
    { name: 'Time Constraints', value: timeConstraints.length, icon: Clock, href: '/time-constraints', color: 'text-red-500' },
    { name: 'Space Constraints', value: spaceConstraints.length, icon: Building2, href: '/space-constraints', color: 'text-cyan-500' },
  ];

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.size, 'bytes');
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const content = await file.text();
      console.log('File content length:', content.length);
      
      const data = parseFETFile(content);
      console.log('Parsed data:', data);
      
      // Clear all existing data
      await db.clearAllData();
      
      // Create rules
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
      
      // Update Redux state directly
      dispatch(setRules(newRules));
      dispatch(setTeachers(data.teachers));
      dispatch(setSubjects(data.subjects));
      dispatch(setActivities(data.activities));
      dispatch(setRooms(data.rooms));
      dispatch(setBuildings(data.buildings));
      dispatch(setStudents({
        years: data.studentsYears,
        groups: data.studentsGroups,
        subgroups: data.studentsSubgroups,
      }));
      dispatch(setTimeConstraints(data.timeConstraints));
      dispatch(setSpaceConstraints(data.spaceConstraints));
      
      setImportSuccess(`Successfully imported: ${data.teachers.length} teachers, ${data.subjects.length} subjects, ${data.activities.length} activities, ${data.timeConstraints.length} time constraints`);
      
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Unknown error during import');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      // Get activity tags from DB
      const activityTags = await db.activityTags.toArray();
      
      // Build FET data structure
      const fetData: FETFile = {
        version: '6.5.0',
        mode: rules?.mode || 0,
        institutionName: rules?.institutionName || 'Untitled',
        comments: rules?.comments || '',
        daysOfTheWeek: rules?.daysOfTheWeek || [],
        hoursOfTheDay: rules?.hoursOfTheDay || [],
        subjects,
        activityTags,
        teachers,
        studentsYears: years,
        studentsGroups: groups,
        studentsSubgroups: subgroups,
        activities,
        buildings,
        rooms,
        timeConstraints,
        spaceConstraints,
      };
      
      // Generate XML
      const xmlContent = exportToFETXml(fetData);
      
      // Download file
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${rules?.institutionName || 'timetable'}.fet`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setImportSuccess('Timetable exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      setImportError(error instanceof Error ? error.message : 'Unknown error during export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".fet,.xml"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Welcome to FET Web - Free Educational Timetabling Software
        </p>
      </div>

      {/* Status Messages */}
      {importError && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardContent className="py-4 flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>Error: {importError}</span>
          </CardContent>
        </Card>
      )}

      {importSuccess && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-900/20">
          <CardContent className="py-4 flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span>{importSuccess}</span>
          </CardContent>
        </Card>
      )}

      {/* Institution Info */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Institution</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            {rules?.institutionName || 'No timetable loaded'}
            {rules && ` • ${rules.nDaysPerWeek} days × ${rules.nHoursPerDay} hours`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link to="/settings">
                <FilePlus className="mr-2 h-4 w-4" />
                New Timetable
              </Link>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleImportClick}
              disabled={importing}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {importing ? 'Importing...' : 'Import .FET File'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={exporting || !rules}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export .FET File'}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/generate">
                <Play className="mr-2 h-4 w-4" />
                Generate Timetable
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickStats.map((stat) => (
          <Link key={stat.name} to={stat.href}>
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Quick Actions</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">Common tasks to set up your timetable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/teachers">
                <Users className="mb-2 h-6 w-6" />
                Add Teachers
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/subjects">
                <BookOpen className="mb-2 h-6 w-6" />
                Add Subjects
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/students">
                <Users className="mb-2 h-6 w-6" />
                Add Students
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/activities">
                <Calendar className="mb-2 h-6 w-6" />
                Add Activities
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Getting Started</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">Follow these steps to create your timetable</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400">
            <li>Set up your institution's time structure (days and hours) in Settings</li>
            <li>Add teachers who will be teaching</li>
            <li>Add subjects/courses to be taught</li>
            <li>Define student years, groups, and subgroups</li>
            <li>Create activities (lessons) linking teachers, subjects, and students</li>
            <li>Add rooms and buildings</li>
            <li>Define constraints (time and space)</li>
            <li>Generate the timetable</li>
            <li>View and export the results</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
