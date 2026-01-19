import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Search, Clock, Pencil, X } from 'lucide-react';
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
import type { TimeConstraint, TimeSlot } from '@/types';

// Constraint type definitions
interface ConstraintTypeDef {
  label: string;
  description: string;
  category: string;
  fields: string[];
}
const TIME_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsoryTime': {
    label: 'Basic Compulsory Time',
    description: 'Ensures activities don\'t overlap for the same teacher/students. Required for valid timetables.',
    category: 'basic',
    fields: []
  },
  'BreakTimes': {
    label: 'Break Times',
    description: 'Define break periods when no activities can be scheduled.',
    category: 'basic',
    fields: ['times']
  },
  'TeacherNotAvailableTimes': {
    label: 'Teacher Not Available Times',
    description: 'Specify times when a specific teacher is unavailable to teach.',
    category: 'teacher',
    fields: ['teacher', 'times']
  },
  'TeacherMaxDaysPerWeek': {
    label: 'Teacher Max Days Per Week',
    description: 'Limit the maximum number of days a teacher can work in a week.',
    category: 'teacher',
    fields: ['teacher', 'maxDays']
  },
  'TeacherMaxHoursDaily': {
    label: 'Teacher Max Hours Daily',
    description: 'Limit the maximum hours a teacher can work in a single day.',
    category: 'teacher',
    fields: ['teacher', 'maxHours']
  },
  'TeacherMaxGapsPerWeek': {
    label: 'Teacher Max Gaps Per Week',
    description: 'Limit the maximum number of gaps (free periods between classes) for a teacher in a week.',
    category: 'teacher',
    fields: ['teacher', 'maxGaps']
  },
  'TeacherMaxGapsPerDay': {
    label: 'Teacher Max Gaps Per Day',
    description: 'Limit the maximum number of gaps for a teacher in a single day.',
    category: 'teacher',
    fields: ['teacher', 'maxGaps']
  },
  'TeachersMaxHoursDaily': {
    label: 'All Teachers Max Hours Daily',
    description: 'Limit the maximum hours all teachers can work in a single day.',
    category: 'teacher',
    fields: ['maxHours']
  },
  'StudentsSetNotAvailableTimes': {
    label: 'Students Not Available Times',
    description: 'Specify times when a student group is unavailable.',
    category: 'students',
    fields: ['studentsSet', 'times']
  },
  'StudentsSetMaxHoursDaily': {
    label: 'Students Max Hours Daily',
    description: 'Limit the maximum hours a student group can have classes in a single day.',
    category: 'students',
    fields: ['studentsSet', 'maxHours']
  },
  'StudentsSetMaxGapsPerWeek': {
    label: 'Students Max Gaps Per Week',
    description: 'Limit the maximum gaps for a student group in a week.',
    category: 'students',
    fields: ['studentsSet', 'maxGaps']
  },
  'MinDaysBetweenActivities': {
    label: 'Min Days Between Activities',
    description: 'Ensure minimum days between split activities (e.g., same subject on different days).',
    category: 'activity',
    fields: ['activities', 'minDays', 'consecutiveIfSameDay']
  },
  'ActivitiesSameStartingTime': {
    label: 'Activities Same Starting Time',
    description: 'Force a set of activities to start at the same time.',
    category: 'activity',
    fields: ['activities']
  },
  'ActivitiesNotOverlapping': {
    label: 'Activities Not Overlapping',
    description: 'Ensure a set of activities do not overlap in time.',
    category: 'activity',
    fields: ['activities']
  },
  'ActivityPreferredStartingTime': {
    label: 'Activity Preferred Starting Time',
    description: 'Set a preferred or locked starting time for an activity.',
    category: 'activity',
    fields: ['activity', 'day', 'hour', 'locked']
  },
};

type TimeConstraintTypeKey = keyof typeof TIME_CONSTRAINT_TYPES;

export function TimeConstraints() {
  const dispatch = useAppDispatch();
  const { timeConstraints } = useAppSelector((state) => state.constraints);
  const teachers = useAppSelector((state) => state.teachers.items);
  const activities = useAppSelector((state) => state.activities.items);
  const { years, groups } = useAppSelector((state) => state.students);
  const rules = useAppSelector((state) => state.rules.current);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingConstraint, setEditingConstraint] = useState<TimeConstraint | null>(null);
  
  // Form state
  const [selectedType, setSelectedType] = useState<TimeConstraintTypeKey>('BasicCompulsoryTime');
  const [weight, setWeight] = useState('100');
  const [active, setActive] = useState(true);
  const [teacherId, setTeacherId] = useState('');
  const [studentsSetId, setStudentsSetId] = useState('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [maxDays, setMaxDays] = useState('5');
  const [maxHours, setMaxHours] = useState('8');
  const [maxGaps, setMaxGaps] = useState('2');
  const [minDays, setMinDays] = useState('1');
  const [consecutiveIfSameDay, setConsecutiveIfSameDay] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState(0);
  const [locked, setLocked] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<TimeSlot[]>([]);

  // Days and hours from rules
  const days = useMemo(() => rules?.daysOfTheWeek || [], [rules]);
  const hours = useMemo(() => rules?.hoursOfTheDay || [], [rules]);

  // Student options
  const studentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    years.forEach(y => opts.push({ value: y.name, label: `${y.name} (Year)` }));
    groups.forEach(g => opts.push({ value: g.name, label: `${g.name} (Group)` }));
    return opts;
  }, [years, groups]);

  const getTeacherDisplayName = (idOrName: string): string => {
    const teacher = teachers.find(t => t.id === idOrName || t.name === idOrName);
    if (teacher) return teacher.name;
    return idOrName || 'Unknown';
  };

  const getActivityDisplayName = (id: string): string => {
    const activity = activities.find(a => a.id === id);
    if (activity) return `${activity.subjectId} - ${activity.teacherIds.join(', ') || 'No teacher'} (${activity.duration}h)`;
    return id;
  };

  function getConstraintDescription(constraint: TimeConstraint): string {
    const c = constraint as any;
    switch (constraint.type) {
      case 'BasicCompulsoryTime':
        return 'Basic time validity constraint';
      case 'BreakTimes':
        return `${c.times?.length || 0} break time slots`;
      case 'TeacherNotAvailableTimes':
        return `${getTeacherDisplayName(c.teacherId)}: ${c.times?.length || 0} unavailable slots`;
      case 'TeacherMaxDaysPerWeek':
        return `${getTeacherDisplayName(c.teacherId)}: max ${c.maxDays} days/week`;
      case 'TeacherMaxHoursDaily':
        return `${getTeacherDisplayName(c.teacherId)}: max ${c.maxHours} hours/day`;
      case 'TeacherMaxGapsPerWeek':
        return `${getTeacherDisplayName(c.teacherId)}: max ${c.maxGaps} gaps/week`;
      case 'TeacherMaxGapsPerDay':
        return `${getTeacherDisplayName(c.teacherId)}: max ${c.maxGaps} gaps/day`;
      case 'TeachersMaxHoursDaily':
        return `All teachers: max ${c.maxHours} hours/day`;
      case 'StudentsSetNotAvailableTimes':
        return `${c.studentsSetId}: ${c.times?.length || 0} unavailable slots`;
      case 'StudentsSetMaxHoursDaily':
        return `${c.studentsSetId}: max ${c.maxHours} hours/day`;
      case 'StudentsSetMaxGapsPerWeek':
        return `${c.studentsSetId}: max ${c.maxGaps} gaps/week`;
      case 'MinDaysBetweenActivities':
        return `${c.activityIds?.length || 0} activities, min ${c.minDays} days between`;
      case 'ActivitiesSameStartingTime':
        return `${c.activityIds?.length || 0} activities must start together`;
      case 'ActivitiesNotOverlapping':
        return `${c.activityIds?.length || 0} activities must not overlap`;
      case 'ActivityPreferredStartingTime':
        return `Activity at Day ${c.day + 1}, Hour ${c.hour + 1}${c.permanentlyLocked ? ' (Locked)' : ''}`;
      default:
        return '';
    }
  }

  // Filter constraints by search
  const filteredConstraints = useMemo(() => {
    if (!searchQuery) return timeConstraints;
    const query = searchQuery.toLowerCase();
    return timeConstraints.filter((c) => {
      const typeInfo = TIME_CONSTRAINT_TYPES[c.type as TimeConstraintTypeKey];
      const label = typeInfo?.label?.toLowerCase() || c.type.toLowerCase();
      const desc = getConstraintDescription(c).toLowerCase();
      return label.includes(query) || desc.includes(query) || c.type.toLowerCase().includes(query);
    });
  }, [timeConstraints, searchQuery, teachers]);

  // Pagination
  const {
    paginatedItems: paginatedConstraints,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredConstraints, { initialPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const resetForm = () => {
    setWeight('100');
    setActive(true);
    setTeacherId('');
    setStudentsSetId('');
    setSelectedActivityIds([]);
    setSelectedActivityId('');
    setMaxDays('5');
    setMaxHours('8');
    setMaxGaps('2');
    setMinDays('1');
    setConsecutiveIfSameDay(true);
    setSelectedDay(0);
    setSelectedHour(0);
    setLocked(false);
    setSelectedTimes([]);
  };

  const openAddDialog = (type: TimeConstraintTypeKey) => {
    setDialogMode('add');
    setEditingConstraint(null);
    setSelectedType(type);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (constraint: TimeConstraint) => {
    setDialogMode('edit');
    setEditingConstraint(constraint);
    setSelectedType(constraint.type as TimeConstraintTypeKey);
    setWeight(String(constraint.weightPercentage));
    setActive(constraint.active);
    
    const c = constraint as any;
    setTeacherId(c.teacherId || '');
    setStudentsSetId(c.studentsSetId || '');
    setSelectedActivityIds(c.activityIds || []);
    setSelectedActivityId(c.activityId || '');
    setMaxDays(String(c.maxDays || 5));
    setMaxHours(String(c.maxHours || 8));
    setMaxGaps(String(c.maxGaps || 2));
    setMinDays(String(c.minDays || 1));
    setConsecutiveIfSameDay(c.consecutiveIfSameDay ?? true);
    setSelectedDay(c.day || 0);
    setSelectedHour(c.hour || 0);
    setLocked(c.permanentlyLocked || false);
    setSelectedTimes(c.times || []);
    
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const baseConstraint = {
      id: editingConstraint?.id || uuidv4(),
      weightPercentage: parseFloat(weight),
      active,
      comments: '',
    };

    let constraint: TimeConstraint;

    switch (selectedType) {
      case 'BasicCompulsoryTime':
        constraint = { ...baseConstraint, type: 'BasicCompulsoryTime' };
        break;
      case 'BreakTimes':
        constraint = { ...baseConstraint, type: 'BreakTimes', times: selectedTimes } as any;
        break;
      case 'TeacherNotAvailableTimes':
        constraint = { ...baseConstraint, type: 'TeacherNotAvailableTimes', teacherId, times: selectedTimes } as any;
        break;
      case 'TeacherMaxDaysPerWeek':
        constraint = { ...baseConstraint, type: 'TeacherMaxDaysPerWeek', teacherId, maxDays: parseInt(maxDays) } as any;
        break;
      case 'TeacherMaxHoursDaily':
        constraint = { ...baseConstraint, type: 'TeacherMaxHoursDaily', teacherId, maxHours: parseInt(maxHours) } as any;
        break;
      case 'TeacherMaxGapsPerWeek':
        constraint = { ...baseConstraint, type: 'TeacherMaxGapsPerWeek', teacherId, maxGaps: parseInt(maxGaps) } as any;
        break;
      case 'TeacherMaxGapsPerDay':
        constraint = { ...baseConstraint, type: 'TeacherMaxGapsPerDay', teacherId, maxGaps: parseInt(maxGaps) } as any;
        break;
      case 'TeachersMaxHoursDaily':
        constraint = { ...baseConstraint, type: 'TeachersMaxHoursDaily', maxHours: parseInt(maxHours) } as any;
        break;
      case 'StudentsSetNotAvailableTimes':
        constraint = { ...baseConstraint, type: 'StudentsSetNotAvailableTimes', studentsSetId, times: selectedTimes } as any;
        break;
      case 'StudentsSetMaxHoursDaily':
        constraint = { ...baseConstraint, type: 'StudentsSetMaxHoursDaily', studentsSetId, maxHours: parseInt(maxHours) } as any;
        break;
      case 'StudentsSetMaxGapsPerWeek':
        constraint = { ...baseConstraint, type: 'StudentsSetMaxGapsPerWeek', studentsSetId, maxGaps: parseInt(maxGaps) } as any;
        break;
      case 'MinDaysBetweenActivities':
        constraint = { ...baseConstraint, type: 'MinDaysBetweenActivities', activityIds: selectedActivityIds, minDays: parseInt(minDays), consecutiveIfSameDay } as any;
        break;
      case 'ActivitiesSameStartingTime':
        constraint = { ...baseConstraint, type: 'ActivitiesSameStartingTime', activityIds: selectedActivityIds } as any;
        break;
      case 'ActivitiesNotOverlapping':
        constraint = { ...baseConstraint, type: 'ActivitiesNotOverlapping', activityIds: selectedActivityIds } as any;
        break;
      case 'ActivityPreferredStartingTime':
        constraint = { ...baseConstraint, type: 'ActivityPreferredStartingTime', activityId: selectedActivityId, day: selectedDay, hour: selectedHour, permanentlyLocked: locked } as any;
        break;
      default:
        constraint = { ...baseConstraint, type: selectedType } as any;
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

  const toggleTimeSlot = (day: number, hour: number) => {
    const exists = selectedTimes.some(t => t.day === day && t.hour === hour);
    if (exists) {
      setSelectedTimes(selectedTimes.filter(t => !(t.day === day && t.hour === hour)));
    } else {
      setSelectedTimes([...selectedTimes, { day, hour }]);
    }
  };

  const toggleActivity = (activityId: string) => {
    if (selectedActivityIds.includes(activityId)) {
      setSelectedActivityIds(selectedActivityIds.filter(id => id !== activityId));
    } else {
      setSelectedActivityIds([...selectedActivityIds, activityId]);
    }
  };

  const getConstraintCount = (type: string) => {
    return timeConstraints.filter(c => c.type === type).length;
  };

  const constraintsByCategory = useMemo(() => {
    const cats: Record<string, TimeConstraintTypeKey[]> = {
      basic: [],
      teacher: [],
      students: [],
      activity: [],
    };
    Object.entries(TIME_CONSTRAINT_TYPES).forEach(([key, val]) => {
      cats[val.category].push(key as TimeConstraintTypeKey);
    });
    return cats;
  }, []);

  const typeInfo = TIME_CONSTRAINT_TYPES[selectedType];
  const fields = typeInfo?.fields || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Time Constraints</h1>
          <p className="text-muted-foreground">
            Define when activities can and cannot be scheduled ({timeConstraints.length} total)
          </p>
        </div>
      </div>

      {/* Add Constraint Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Add New Time Constraint</CardTitle>
          <CardDescription className="text-muted-foreground">Select a constraint type to add</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Basic</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.basic.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)} className="text-left">
                  {TIME_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Teacher Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Teacher Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.teacher.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)} className="text-left">
                  {TIME_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Students Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Students Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.students.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)} className="text-left">
                  {TIME_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Activity Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Activity Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.activity.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)} className="text-left">
                  {TIME_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search constraints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Constraints List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">All Time Constraints</CardTitle>
          <CardDescription className="text-muted-foreground">
            {filteredConstraints.length} constraint(s) {searchQuery ? 'found' : 'defined'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No constraints match your search.' : 'No time constraints added yet.'}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedConstraints.map((constraint) => (
                  <div 
                    key={constraint.id} 
                    className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Clock className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-foreground">
                            {TIME_CONSTRAINT_TYPES[constraint.type as TimeConstraintTypeKey]?.label || constraint.type}
                          </span>
                          <Badge variant={constraint.active ? 'default' : 'secondary'}>
                            {constraint.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {constraint.weightPercentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {getConstraintDescription(constraint)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(constraint)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
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
        <DialogContent className="bg-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {dialogMode === 'edit' ? 'Edit' : 'Add'} {typeInfo?.label}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {typeInfo?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Weight */}
            <div className="grid gap-2">
              <Label className="text-secondary-foreground">Weight Percentage</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">100% = mandatory, lower = preferred</p>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="active" className="text-secondary-foreground">Active</Label>
            </div>

            {/* Teacher field */}
            {fields.includes('teacher') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Teacher</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Students Set field */}
            {fields.includes('studentsSet') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Students Set</Label>
                <select
                  value={studentsSetId}
                  onChange={(e) => setStudentsSetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select a student group</option>
                  {studentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Max Days field */}
            {fields.includes('maxDays') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Maximum Days</Label>
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={maxDays}
                  onChange={(e) => setMaxDays(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            {/* Max Hours field */}
            {fields.includes('maxHours') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Maximum Hours</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={maxHours}
                  onChange={(e) => setMaxHours(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            {/* Max Gaps field */}
            {fields.includes('maxGaps') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Maximum Gaps</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={maxGaps}
                  onChange={(e) => setMaxGaps(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            {/* Min Days field */}
            {fields.includes('minDays') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Minimum Days Between</Label>
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={minDays}
                  onChange={(e) => setMinDays(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            {/* Consecutive If Same Day field */}
            {fields.includes('consecutiveIfSameDay') && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="consecutiveIfSameDay"
                  checked={consecutiveIfSameDay}
                  onChange={(e) => setConsecutiveIfSameDay(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="consecutiveIfSameDay" className="text-secondary-foreground">
                  If on same day, activities must be consecutive
                </Label>
              </div>
            )}

            {/* Single Activity field */}
            {fields.includes('activity') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Activity</Label>
                <select
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select an activity</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{getActivityDisplayName(a.id)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Day/Hour fields */}
            {fields.includes('day') && fields.includes('hour') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-secondary-foreground">Day</Label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                  >
                    {days.map((d, i) => (
                      <option key={i} value={i}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-secondary-foreground">Hour</Label>
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                  >
                    {hours.map((h, i) => (
                      <option key={i} value={i}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Locked field */}
            {fields.includes('locked') && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="locked"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="locked" className="text-secondary-foreground">
                  Permanently Locked (cannot be changed during generation)
                </Label>
              </div>
            )}

            {/* Activities Multi-select */}
            {fields.includes('activities') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Activities ({selectedActivityIds.length} selected)</Label>
                <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-background p-2">
                  {activities.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No activities available</p>
                  ) : (
                    activities.map((a) => (
                      <div 
                        key={a.id} 
                        className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
                          selectedActivityIds.includes(a.id) ? 'bg-primary/20' : 'hover:bg-border'
                        }`}
                        onClick={() => toggleActivity(a.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedActivityIds.includes(a.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-foreground">{getActivityDisplayName(a.id)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Time Slots Grid */}
            {fields.includes('times') && days.length > 0 && hours.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Time Slots ({selectedTimes.length} selected)</Label>
                <div className="overflow-x-auto border border-border rounded-md bg-background p-2">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="p-1 text-xs text-muted-foreground"></th>
                        {days.map((d, i) => (
                          <th key={i} className="p-1 text-xs text-muted-foreground text-center">{d.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hours.map((h, hourIdx) => (
                        <tr key={hourIdx}>
                          <td className="p-1 text-xs text-muted-foreground whitespace-nowrap">{h.name}</td>
                          {days.map((_, dayIdx) => {
                            const isSelected = selectedTimes.some(t => t.day === dayIdx && t.hour === hourIdx);
                            return (
                              <td key={dayIdx} className="p-1">
                                <button
                                  type="button"
                                  onClick={() => toggleTimeSlot(dayIdx, hourIdx)}
                                  className={`w-6 h-6 rounded ${
                                    isSelected ? 'bg-primary' : 'bg-border hover:bg-muted'
                                  }`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
