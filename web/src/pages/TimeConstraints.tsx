import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Search, Clock, Pencil } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { addTimeConstraint, updateTimeConstraint, deleteTimeConstraint } from '@/store/slices/constraintsSlice';
import type { TimeConstraint, ConstraintType } from '@/types';

type TimeConstraintType = Extract<ConstraintType, 
  | 'BasicCompulsoryTime'
  | 'BreakTimes'
  | 'TeacherNotAvailableTimes'
  | 'TeacherMaxDaysPerWeek'
  | 'TeacherMaxHoursDaily'
  | 'StudentsSetNotAvailableTimes'
  | 'MinDaysBetweenActivities'
>;

const constraintTypeLabels: Record<string, string> = {
  'BasicCompulsoryTime': 'Basic Compulsory Time',
  'BreakTimes': 'Break Times',
  'TeacherNotAvailableTimes': 'Teacher Not Available',
  'TeacherMaxDaysPerWeek': 'Teacher Max Days/Week',
  'TeacherMaxHoursDaily': 'Teacher Max Hours/Day',
  'TeacherMaxGapsPerWeek': 'Teacher Max Gaps/Week',
  'TeacherMaxGapsPerDay': 'Teacher Max Gaps/Day',
  'TeachersMaxHoursDaily': 'All Teachers Max Hours/Day',
  'StudentsSetNotAvailableTimes': 'Students Not Available',
  'StudentsMaxHoursDaily': 'Students Max Hours/Day',
  'MinDaysBetweenActivities': 'Min Days Between Activities',
  'ActivitiesSameStartingTime': 'Activities Same Starting Time',
  'ActivitiesNotOverlapping': 'Activities Not Overlapping',
};

const constraintDescriptions: Record<string, string> = {
  'BasicCompulsoryTime': 'Ensures activities don\'t overlap for the same teacher/students',
  'BreakTimes': 'Define break periods when no activities can be scheduled',
  'TeacherNotAvailableTimes': 'Specify times when a teacher is unavailable',
  'TeacherMaxDaysPerWeek': 'Limit maximum days a teacher can work per week',
  'TeacherMaxHoursDaily': 'Limit maximum hours a teacher can work per day',
  'StudentsSetNotAvailableTimes': 'Specify times when student groups are unavailable',
  'MinDaysBetweenActivities': 'Ensure minimum days between split activities',
};

export function TimeConstraints() {
  const dispatch = useAppDispatch();
  const { timeConstraints } = useAppSelector((state) => state.constraints);
  const teachers = useAppSelector((state) => state.teachers.items);
  const { years, groups } = useAppSelector((state) => state.students);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingConstraint, setEditingConstraint] = useState<TimeConstraint | null>(null);
  
  const [selectedType, setSelectedType] = useState<TimeConstraintType>('BasicCompulsoryTime');
  const [weight, setWeight] = useState('100');
  const [active, setActive] = useState(true);
  const [teacherIdOrName, setTeacherIdOrName] = useState('');
  const [studentsSetId, setStudentsSetId] = useState('');
  const [maxDays, setMaxDays] = useState('5');
  const [maxHours, setMaxHours] = useState('8');

  const constraintTypes: TimeConstraintType[] = [
    'BasicCompulsoryTime',
    'BreakTimes', 
    'TeacherNotAvailableTimes',
    'TeacherMaxDaysPerWeek',
    'TeacherMaxHoursDaily',
    'StudentsSetNotAvailableTimes',
    'MinDaysBetweenActivities',
  ];

  // Student options
  const studentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    years.forEach(y => opts.push({ value: y.name, label: `${y.name} (Year)` }));
    groups.forEach(g => opts.push({ value: g.name, label: `${g.name} (Group)` }));
    return opts;
  }, [years, groups]);

  const getTeacherDisplayName = (idOrName: string): string => {
    const teacher = teachers.find(t => t.id === idOrName || t.name === idOrName);
    if (teacher) return `${teacher.name}${teacher.code ? ` (${teacher.code})` : ''}`;
    return idOrName || 'Unknown';
  };

  function getConstraintDescription(constraint: TimeConstraint): string {
    const c = constraint as unknown as Record<string, unknown>;
    switch (constraint.type) {
      case 'TeacherMaxDaysPerWeek':
        return `${getTeacherDisplayName(c.teacherId as string)}, Max: ${c.maxDays} days`;
      case 'TeacherMaxHoursDaily':
        return `${getTeacherDisplayName(c.teacherId as string)}, Max: ${c.maxHours} hours`;
      case 'TeacherNotAvailableTimes':
        return `${getTeacherDisplayName(c.teacherId as string)}, ${(c.times as unknown[])?.length || 0} time slots`;
      case 'StudentsSetNotAvailableTimes':
        return `${c.studentsSetId}, ${(c.times as unknown[])?.length || 0} time slots`;
      case 'MinDaysBetweenActivities':
        return `Min: ${c.minDays} days, ${(c.activityIds as string[])?.length || 0} activities`;
      case 'BreakTimes':
        return `${(c.times as unknown[])?.length || 0} break time slots`;
      default:
        return '';
    }
  }

  // Filter constraints by search
  const filteredConstraints = useMemo(() => {
    if (!searchQuery) return timeConstraints;
    const query = searchQuery.toLowerCase();
    return timeConstraints.filter((c) => {
      const label = constraintTypeLabels[c.type]?.toLowerCase() || '';
      const desc = getConstraintDescription(c).toLowerCase();
      return label.includes(query) || desc.includes(query) || c.type.toLowerCase().includes(query);
    });
  }, [timeConstraints, searchQuery]);

  // Pagination
  const {
    paginatedItems: paginatedConstraints,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredConstraints, { initialPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openAddDialog = (type: TimeConstraintType) => {
    setDialogMode('add');
    setEditingConstraint(null);
    setSelectedType(type);
    setWeight('100');
    setActive(true);
    setTeacherIdOrName('');
    setStudentsSetId('');
    setMaxDays('5');
    setMaxHours('8');
    setDialogOpen(true);
  };

  const openEditDialog = (constraint: TimeConstraint) => {
    setDialogMode('edit');
    setEditingConstraint(constraint);
    setSelectedType(constraint.type as TimeConstraintType);
    setWeight(String(constraint.weightPercentage));
    setActive(constraint.active);
    
    const c = constraint as unknown as Record<string, unknown>;
    setTeacherIdOrName((c.teacherId as string) || '');
    setStudentsSetId((c.studentsSetId as string) || '');
    setMaxDays(String(c.maxDays || 5));
    setMaxHours(String(c.maxHours || 8));
    
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    let constraint: TimeConstraint;

    const baseConstraint = {
      id: editingConstraint?.id || uuidv4(),
      weightPercentage: parseFloat(weight),
      active,
      comments: '',
    };

    switch (selectedType) {
      case 'BasicCompulsoryTime':
        constraint = { ...baseConstraint, type: 'BasicCompulsoryTime' };
        break;
      case 'TeacherMaxDaysPerWeek':
        constraint = { 
          ...baseConstraint, 
          type: 'TeacherMaxDaysPerWeek',
          teacherId: teacherIdOrName,
          maxDays: parseInt(maxDays),
        } as TimeConstraint;
        break;
      case 'TeacherMaxHoursDaily':
        constraint = { 
          ...baseConstraint, 
          type: 'TeacherMaxHoursDaily',
          teacherId: teacherIdOrName,
          maxHours: parseInt(maxHours),
        } as TimeConstraint;
        break;
      case 'TeacherNotAvailableTimes':
        constraint = { 
          ...baseConstraint, 
          type: 'TeacherNotAvailableTimes',
          teacherId: teacherIdOrName,
          times: (editingConstraint as unknown as Record<string, unknown>)?.times || [],
        } as TimeConstraint;
        break;
      case 'StudentsSetNotAvailableTimes':
        constraint = { 
          ...baseConstraint, 
          type: 'StudentsSetNotAvailableTimes',
          studentsSetId,
          times: (editingConstraint as unknown as Record<string, unknown>)?.times || [],
        } as TimeConstraint;
        break;
      default:
        constraint = { ...baseConstraint, type: selectedType };
    }

    if (dialogMode === 'edit') {
      await dispatch(updateTimeConstraint(constraint));
    } else {
      await dispatch(addTimeConstraint(constraint));
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this constraint?')) {
      await dispatch(deleteTimeConstraint(id));
    }
  };

  const getConstraintCount = (type: string) => {
    return timeConstraints.filter(c => c.type === type).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Time Constraints</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Define when activities can and cannot be scheduled ({timeConstraints.length} total)
          </p>
        </div>
      </div>

      {/* Add Constraint Section */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Add New Time Constraint</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">Select a constraint type to add</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {constraintTypes.map((type) => (
              <Button 
                key={type} 
                variant="outline" 
                className="h-auto py-3 px-4 justify-start text-left"
                onClick={() => openAddDialog(type)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{constraintTypeLabels[type]}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getConstraintCount(type)} existing
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search constraints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Constraints List */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">All Time Constraints</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            {filteredConstraints.length} constraint(s) {searchQuery ? 'found' : 'defined'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No constraints match your search.' : 'No time constraints added yet.'}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedConstraints.map((constraint) => (
                  <div 
                    key={constraint.id} 
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Clock className="h-5 w-5 text-red-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {constraintTypeLabels[constraint.type] || constraint.type}
                          </span>
                          <Badge variant={constraint.active ? 'default' : 'secondary'}>
                            {constraint.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                            {constraint.weightPercentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {getConstraintDescription(constraint)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(constraint)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleDelete(constraint.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4">
                <Pagination {...paginationProps} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">
              {dialogMode === 'edit' ? 'Edit' : 'Add'} {constraintTypeLabels[selectedType]}
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              {constraintDescriptions[selectedType]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-gray-700 dark:text-gray-300">Weight Percentage</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-white dark:bg-gray-900"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">100% = mandatory, lower = preferred</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="active" className="text-gray-700 dark:text-gray-300">Active</Label>
            </div>

            {(selectedType === 'TeacherNotAvailableTimes' || 
              selectedType === 'TeacherMaxDaysPerWeek' ||
              selectedType === 'TeacherMaxHoursDaily') && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Teacher</Label>
                <select
                  value={teacherIdOrName}
                  onChange={(e) => setTeacherIdOrName(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}{t.code ? ` (${t.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedType === 'StudentsSetNotAvailableTimes' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Student Group</Label>
                <select
                  value={studentsSetId}
                  onChange={(e) => setStudentsSetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select student group</option>
                  {studentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedType === 'TeacherMaxDaysPerWeek' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Maximum Days per Week</Label>
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={maxDays}
                  onChange={(e) => setMaxDays(e.target.value)}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            )}

            {selectedType === 'TeacherMaxHoursDaily' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Maximum Hours per Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={maxHours}
                  onChange={(e) => setMaxHours(e.target.value)}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {dialogMode === 'edit' ? 'Update' : 'Add'} Constraint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
