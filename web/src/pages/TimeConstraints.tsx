import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Search, Clock, Pencil } from 'lucide-react';
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
  category: string;
  fields: string[];
}
const TIME_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsoryTime': { category: 'basic', fields: [] },
  'BreakTimes': { category: 'basic', fields: ['times'] },
  'TeacherNotAvailableTimes': { category: 'teacher', fields: ['teacher', 'times'] },
  'TeacherMaxDaysPerWeek': { category: 'teacher', fields: ['teacher', 'maxDays'] },
  'TeacherMaxHoursDaily': { category: 'teacher', fields: ['teacher', 'maxHours'] },
  'TeacherMaxGapsPerWeek': { category: 'teacher', fields: ['teacher', 'maxGaps'] },
  'TeacherMaxGapsPerDay': { category: 'teacher', fields: ['teacher', 'maxGaps'] },
  'TeachersMaxHoursDaily': { category: 'teacher', fields: ['maxHours'] },
  'StudentsSetNotAvailableTimes': { category: 'students', fields: ['studentsSet', 'times'] },
  'StudentsSetMaxHoursDaily': { category: 'students', fields: ['studentsSet', 'maxHours'] },
  'StudentsSetMaxGapsPerWeek': { category: 'students', fields: ['studentsSet', 'maxGaps'] },
  'MinDaysBetweenActivities': { category: 'activity', fields: ['activities', 'minDays', 'consecutiveIfSameDay'] },
  'ActivitiesSameStartingTime': { category: 'activity', fields: ['activities'] },
  'ActivitiesNotOverlapping': { category: 'activity', fields: ['activities'] },
  'ActivityPreferredStartingTime': { category: 'activity', fields: ['activity', 'day', 'hour', 'locked'] },
};

type TimeConstraintTypeKey = keyof typeof TIME_CONSTRAINT_TYPES;

export function TimeConstraints() {
  const { t } = useTranslation();
  const typeLabel = (key: string) => t(`timeConstraints.types.${key}.label`, { defaultValue: key });
  const typeDescription = (key: string) => t(`timeConstraints.types.${key}.description`, { defaultValue: '' });
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
    years.forEach(y => opts.push({ value: y.name, label: t('activities.studentLabelYear', { name: y.name }) }));
    groups.forEach(g => opts.push({ value: g.name, label: t('activities.studentLabelGroup', { name: g.name }) }));
    return opts;
  }, [years, groups, t]);

  const getTeacherDisplayName = (idOrName: string): string => {
    const teacher = teachers.find(tt => tt.id === idOrName || tt.name === idOrName);
    if (teacher) return teacher.name;
    return idOrName || t('timeConstraints.unknown');
  };

  const getActivityDisplayName = (id: string): string => {
    const activity = activities.find(a => a.id === id);
    if (activity) return t('timeConstraints.activityLabel', { subject: activity.subjectId, teachers: activity.teacherIds.join(', ') || t('timeConstraints.noTeacher'), duration: activity.duration });
    return id;
  };

  function getConstraintDescription(constraint: TimeConstraint): string {
    const c = constraint as any;
    switch (constraint.type) {
      case 'BasicCompulsoryTime':
        return t('timeConstraints.descriptions.basic');
      case 'BreakTimes':
        return t('timeConstraints.descriptions.breakTimes', { count: c.times?.length || 0 });
      case 'TeacherNotAvailableTimes':
        return t('timeConstraints.descriptions.teacherUnavail', { teacher: getTeacherDisplayName(c.teacherId), count: c.times?.length || 0 });
      case 'TeacherMaxDaysPerWeek':
        return t('timeConstraints.descriptions.teacherMaxDays', { teacher: getTeacherDisplayName(c.teacherId), count: c.maxDays });
      case 'TeacherMaxHoursDaily':
        return t('timeConstraints.descriptions.teacherMaxHours', { teacher: getTeacherDisplayName(c.teacherId), count: c.maxHours });
      case 'TeacherMaxGapsPerWeek':
        return t('timeConstraints.descriptions.teacherMaxGapsWeek', { teacher: getTeacherDisplayName(c.teacherId), count: c.maxGaps });
      case 'TeacherMaxGapsPerDay':
        return t('timeConstraints.descriptions.teacherMaxGapsDay', { teacher: getTeacherDisplayName(c.teacherId), count: c.maxGaps });
      case 'TeachersMaxHoursDaily':
        return t('timeConstraints.descriptions.allTeachersMaxHours', { count: c.maxHours });
      case 'StudentsSetNotAvailableTimes':
        return t('timeConstraints.descriptions.studentsUnavail', { students: c.studentsSetId, count: c.times?.length || 0 });
      case 'StudentsSetMaxHoursDaily':
        return t('timeConstraints.descriptions.studentsMaxHours', { students: c.studentsSetId, count: c.maxHours });
      case 'StudentsSetMaxGapsPerWeek':
        return t('timeConstraints.descriptions.studentsMaxGaps', { students: c.studentsSetId, count: c.maxGaps });
      case 'MinDaysBetweenActivities':
        return t('timeConstraints.descriptions.minDaysBetween', { count: c.activityIds?.length || 0, days: c.minDays });
      case 'ActivitiesSameStartingTime':
        return t('timeConstraints.descriptions.sameStart', { count: c.activityIds?.length || 0 });
      case 'ActivitiesNotOverlapping':
        return t('timeConstraints.descriptions.notOverlapping', { count: c.activityIds?.length || 0 });
      case 'ActivityPreferredStartingTime':
        return c.permanentlyLocked
          ? t('timeConstraints.descriptions.activityAtLocked', { day: c.day + 1, hour: c.hour + 1 })
          : t('timeConstraints.descriptions.activityAt', { day: c.day + 1, hour: c.hour + 1 });
      default:
        return '';
    }
  }

  // Filter constraints by search
  const filteredConstraints = useMemo(() => {
    if (!searchQuery) return timeConstraints;
    const query = searchQuery.toLowerCase();
    return timeConstraints.filter((c) => {
      const label = typeLabel(c.type).toLowerCase();
      const desc = getConstraintDescription(c).toLowerCase();
      return label.includes(query) || desc.includes(query) || c.type.toLowerCase().includes(query);
    });
  }, [timeConstraints, searchQuery, teachers, t]);

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
    if (confirm(t('timeConstraints.confirmDelete'))) {
      await dispatch(deleteTimeConstraint(id));
    }
  };

  const toggleTimeSlot = (day: number, hour: number) => {
    const exists = selectedTimes.some(ts => ts.day === day && ts.hour === hour);
    if (exists) {
      setSelectedTimes(selectedTimes.filter(ts => !(ts.day === day && ts.hour === hour)));
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

  const fields = TIME_CONSTRAINT_TYPES[selectedType]?.fields || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('timeConstraints.title')}</h1>
          <p className="text-muted-foreground">
            {t('timeConstraints.description', { count: timeConstraints.length })}
          </p>
        </div>
      </div>

      {/* Add Constraint Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('timeConstraints.addTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('timeConstraints.addDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['basic', 'teacher', 'students', 'activity'] as const).map((cat) => (
            <div key={cat}>
              <h3 className="text-sm font-medium text-secondary-foreground mb-2">{t(`timeConstraints.categories.${cat}`)}</h3>
              <div className="flex flex-wrap gap-2">
                {constraintsByCategory[cat].map((type) => (
                  <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)} className="text-left">
                    {typeLabel(type)}
                    <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('timeConstraints.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Constraints List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('timeConstraints.listTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('timeConstraints.listCount', { count: filteredConstraints.length, status: searchQuery ? t('timeConstraints.statusFound') : t('timeConstraints.statusDefined') })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? t('timeConstraints.emptySearch') : t('timeConstraints.empty')}
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
                            {typeLabel(constraint.type)}
                          </span>
                          <Badge variant={constraint.active ? 'default' : 'secondary'}>
                            {constraint.active ? t('common.active') : t('common.inactive')}
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
              {dialogMode === 'edit'
                ? t('timeConstraints.dialog.editTitle', { label: typeLabel(selectedType) })
                : t('timeConstraints.dialog.addTitle', { label: typeLabel(selectedType) })}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {typeDescription(selectedType)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Weight */}
            <div className="grid gap-2">
              <Label className="text-secondary-foreground">{t('timeConstraints.dialog.weight')}</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">{t('timeConstraints.dialog.weightHint')}</p>
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
              <Label htmlFor="active" className="text-secondary-foreground">{t('timeConstraints.dialog.active')}</Label>
            </div>

            {/* Teacher field */}
            {fields.includes('teacher') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.teacher')}</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('timeConstraints.dialog.selectTeacher')}</option>
                  {teachers.map((tt) => (
                    <option key={tt.id} value={tt.name}>{tt.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Students Set field */}
            {fields.includes('studentsSet') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.studentsSet')}</Label>
                <select
                  value={studentsSetId}
                  onChange={(e) => setStudentsSetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('timeConstraints.dialog.selectStudentsSet')}</option>
                  {studentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Max Days field */}
            {fields.includes('maxDays') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.maxDays')}</Label>
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
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.maxHours')}</Label>
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
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.maxGaps')}</Label>
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
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.minDays')}</Label>
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
                  {t('timeConstraints.dialog.consecutiveIfSameDay')}
                </Label>
              </div>
            )}

            {/* Single Activity field */}
            {fields.includes('activity') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.activity')}</Label>
                <select
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('timeConstraints.dialog.selectActivity')}</option>
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
                  <Label className="text-secondary-foreground">{t('timeConstraints.dialog.day')}</Label>
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
                  <Label className="text-secondary-foreground">{t('timeConstraints.dialog.hour')}</Label>
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
                  {t('timeConstraints.dialog.locked')}
                </Label>
              </div>
            )}

            {/* Activities Multi-select */}
            {fields.includes('activities') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.activities', { count: selectedActivityIds.length })}</Label>
                <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-background p-2">
                  {activities.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('timeConstraints.dialog.noActivities')}</p>
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
                <Label className="text-secondary-foreground">{t('timeConstraints.dialog.timeSlots', { count: selectedTimes.length })}</Label>
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
                            const isSelected = selectedTimes.some(ts => ts.day === dayIdx && ts.hour === hourIdx);
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>
              {dialogMode === 'edit' ? t('timeConstraints.dialog.submitEdit') : t('timeConstraints.dialog.submitAdd')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
